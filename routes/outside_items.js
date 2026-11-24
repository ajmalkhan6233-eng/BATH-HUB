'use strict';
// OUTSIDE ITEMS (AJ 24 Nov): an item the shop does not stock, bought from outside for one customer. ONE isolated module.
//   POST /api/outside-items               owner/admin: name, qty, price (each), profit (each) or cost (each) -> code OUT-001..., stock +qty
//   GET  /api/outside-items/pending       owner/admin: cost still an ESTIMATE (oldest first, with age in days)
//   POST /api/outside-items/:id/real-cost owner/admin: real cost + reason -> sold lines and profit are recalculated
// The bill itself goes through the normal POS route (so it counts in sales, profit and the daily breakdown, mixed with the shop).
// Stock: with POS_DEDUCT_STOCK=true the sale takes qty out, so this module puts qty IN first and the item nets to 0.
// With it off, the sale does not touch stock, so this module does not either (also nets to 0).
// shortcut: repeat purchases of one code share one avg_cost (the latest estimate); lines are re-costed per entry by time window. Fine for rough costs.
const express = require('express');
const pool = require('../utils/pool');
const router = express.Router();
const money2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const roleOf = req => (req.session && req.session.user && req.session.user.role) || 'staff';
const isOwner = req => ['admin', 'owner'].includes(roleOf(req));
const deductOn = () => String(process.env.POS_DEDUCT_STOCK).toLowerCase() === 'true';
const keyOf = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
const OVERDUE_DAYS = 2;

let ready = null;
function ensure() {
  if (!ready) {
    ready = (async () => {
      await pool.query(`CREATE TABLE IF NOT EXISTS outside_items (item_code TEXT PRIMARY KEY, name TEXT NOT NULL, name_key TEXT NOT NULL UNIQUE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
      await pool.query(`CREATE TABLE IF NOT EXISTS outside_cost_pending (id SERIAL PRIMARY KEY, item_code TEXT NOT NULL, item_name TEXT NOT NULL, qty NUMERIC(12,2) NOT NULL, sell_price NUMERIC(14,2) NOT NULL, est_cost NUMERIC(14,2) NOT NULL, est_profit NUMERIC(14,2) NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_by TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, real_cost NUMERIC(14,2), reason TEXT, confirmed_by TEXT, confirmed_at TIMESTAMP)`);
    })().catch(e => { ready = null; throw e; });
  }
  return ready;
}
const guard = (req, res, next) => isOwner(req) ? next() : res.status(403).json({ error: 'Only the owner or admin can use outside items' });

function check(b) {
  const name = String((b && b.name) || '').trim();
  if (!name || name.length > 200) return { error: 'Item name is required (max 200 characters)' };
  const qty = Number(b.qty), price = Number(b.price);
  if (!Number.isFinite(qty) || qty <= 0 || qty > 99999999) return { error: 'Quantity must be more than 0' };
  if (!Number.isFinite(price) || price <= 0 || price > 9999999999) return { error: 'Selling price must be more than 0' };
  const hasCost = b.cost !== undefined && b.cost !== null && String(b.cost).trim() !== '';
  const hasProfit = b.profit !== undefined && b.profit !== null && String(b.profit).trim() !== '';
  if (!hasCost && !hasProfit) return { error: 'Enter the rough profit or the cost' };
  const cost = hasCost ? Number(b.cost) : price - Number(b.profit);
  if (!Number.isFinite(cost) || cost < 0) return { error: 'Cost is not a valid number' };
  const profit = price - cost;
  if (profit < 0) return { error: 'No loss allowed: the selling price is below the cost' };
  return { name, qty: money2(qty), price: money2(price), cost: money2(cost), profit: money2(profit) };
}

router.post('/outside-items', guard, async (req, res) => {
  const v = check(req.body); if (v.error) return res.status(400).json({ error: v.error });
  let client;
  try {
    await ensure();
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(24112024)');
    const key = keyOf(v.name);
    let code = ((await client.query(`SELECT item_code FROM outside_items WHERE name_key = $1`, [key])).rows[0] || {}).item_code;
    if (!code) {
      const mx = (await client.query(`SELECT item_code FROM outside_items`)).rows.reduce((m, r) => Math.max(m, parseInt(String(r.item_code).slice(4), 10) || 0), 0);
      code = 'OUT-' + String(mx + 1).padStart(3, '0');
      await client.query(`INSERT INTO outside_items (item_code, name, name_key) VALUES ($1,$2,$3)`, [code, v.name, key]);
    }
    const p = await client.query(`SELECT item_code FROM products WHERE item_code = $1 LIMIT 1`, [code]);
    if (p.rows.length) await client.query(`UPDATE products SET name = $2, selling_price = $3, avg_cost = $4, active = true WHERE item_code = $1`, [code, v.name, v.price, v.cost]);
    else await client.query(`INSERT INTO products (item_code, name, category, stock_level, reorder_threshold, selling_price, avg_cost, active) VALUES ($1,$2,'Outside',0,0,$3,$4,true)`, [code, v.name, v.price, v.cost]);
    if (deductOn()) {
      await client.query(`UPDATE products SET stock_level = COALESCE(stock_level, 0) + $2 WHERE item_code = $1`, [code, v.qty]);
      await require('../utils/stock_ledger').recordSafe(client, { item_code: code, qty_change: v.qty, reason: 'outside_in', ref_type: 'outside_item', ref_id: code, note: 'bought outside for a customer; the sale takes it out again' });
    }
    const by = (req.session && req.session.user && (req.session.user.username || req.session.user.name)) || null;
    const ins = await client.query(`INSERT INTO outside_cost_pending (item_code, item_name, qty, sell_price, est_cost, est_profit, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`, [code, v.name, v.qty, v.price, v.cost, v.profit, by]);
    await client.query('COMMIT');
    res.json({ item_code: code, name: v.name, qty: v.qty, price: v.price, cost: v.cost, pending_id: ins.rows[0].id, stock_in: deductOn() });
  } catch (e) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('[outside-items]', e.message); res.status(500).json({ error: 'Could not save the outside item' });
  } finally { if (client) client.release(); }
});

async function pendingRows(db) {
  await ensure();
  const rows = (await db.query(`SELECT id, item_code, item_name, qty, sell_price, est_cost, est_profit, created_at FROM outside_cost_pending WHERE status = 'pending' ORDER BY created_at, id`)).rows;
  const now = Date.now();
  return rows.map(r => ({ ...r, age_days: Math.floor((now - new Date(r.created_at).getTime()) / 86400000) }));
}
router.get('/outside-items/pending', guard, async (req, res) => {
  try { const rows = await pendingRows(pool); res.json({ pending: rows, overdue: rows.filter(r => r.age_days > OVERDUE_DAYS).length }); }
  catch (e) { res.json({ pending: [], overdue: 0 }); }
});

router.post('/outside-items/:id/real-cost', guard, async (req, res) => {
  const id = Number(req.params.id), cost = Number(req.body && req.body.cost), reason = String((req.body && req.body.reason) || '').trim();
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Bad id' });
  if (!Number.isFinite(cost) || cost < 0) return res.status(400).json({ error: 'Real cost must be a number, 0 or more' });
  if (reason.length < 3) return res.status(400).json({ error: 'Type the reason (where the real cost came from)' });
  let client;
  try {
    await ensure(); client = await pool.connect(); await client.query('BEGIN');
    const e = (await client.query(`SELECT * FROM outside_cost_pending WHERE id = $1`, [id])).rows[0];
    if (!e) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Not found' }); }
    if (e.status !== 'pending') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Real cost was already entered for this one' }); }
    const real = money2(cost), est = Number(e.est_cost), from = new Date(e.created_at).getTime();
    const later = (await client.query(`SELECT id, created_at FROM outside_cost_pending WHERE item_code = $1 AND id > $2 ORDER BY id`, [e.item_code, e.id])).rows;
    const lim = later.length ? new Date(later[0].created_at).getTime() : null;
    const bm = new Map((await client.query(`SELECT id, created_at FROM pos_bills`)).rows.map(r => [r.id, new Date(r.created_at).getTime()]));
    const its = (await client.query(`SELECT id, bill_id, qty, unit_cost FROM pos_bill_items WHERE item_code = $1`, [e.item_code])).rows;
    let lines = 0, qtySum = 0;
    for (const it of its) {
      const t = bm.get(it.bill_id); if (t === undefined || t < from || (lim !== null && t >= lim)) continue;
      if (it.unit_cost != null && Math.abs(Number(it.unit_cost) - est) > 0.005) continue;   // only lines still on the estimate
      await client.query(`UPDATE pos_bill_items SET unit_cost = $2 WHERE id = $1`, [it.id, real]); lines++; qtySum += Number(it.qty);
    }
    if (!later.length) await client.query(`UPDATE products SET avg_cost = $2 WHERE item_code = $1`, [e.item_code, real]);
    const by = (req.session && req.session.user && (req.session.user.username || req.session.user.name)) || null;
    await client.query(`UPDATE outside_cost_pending SET status = 'confirmed', real_cost = $2, reason = $3, confirmed_by = $4, confirmed_at = CURRENT_TIMESTAMP WHERE id = $1`, [id, real, reason.slice(0, 300), by]);
    await client.query('COMMIT');
    res.json({ ok: true, lines_updated: lines, old_cost: est, real_cost: real, profit_change: money2((est - real) * qtySum) });
  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('[outside-items real-cost]', err.message); res.status(500).json({ error: 'Could not save the real cost' });
  } finally { if (client) client.release(); }
});

// For the auditor and the home strip. Never throws.
async function auditInfo(db) {
  try {
    const rows = await pendingRows(db);
    const over = rows.filter(r => r.age_days > OVERDUE_DAYS);
    let stock = [];
    try { stock = (await db.query(`SELECT o.item_code, o.name, p.stock_level FROM outside_items o JOIN products p ON p.item_code = o.item_code WHERE COALESCE(p.stock_level,0) <> 0`)).rows; } catch (e) { /* ignore */ }
    return { pending: rows.length, overdue: over.map(r => ({ id: r.id, item_code: r.item_code, item_name: r.item_name, age_days: r.age_days })), stock_not_zero: stock };
  } catch (e) { return { pending: 0, overdue: [], stock_not_zero: [] }; }
}

module.exports = router;
module.exports.auditInfo = auditInfo;
module.exports.check = check;
