'use strict';
// OUTSIDE ITEMS (AJ 24 Nov): an item the shop does not stock, bought from outside for one customer. ONE isolated module.
//   POST /api/outside-items               owner/admin (cashier too if the owner switches it on in Settings): name, qty, price (each),
//                                         profit (each) or cost (each) -> code OUT-001..., stock +qty
//   GET  /api/outside-items/allowed       anyone logged in: may this user see the "+ Outside" button?
//   GET  /api/outside-items/pending       owner/admin: cost still an ESTIMATE (oldest first, with age in days)
//   POST /api/outside-items/:id/real-cost owner/admin: real cost + reason -> sold lines and profit are recalculated
// The bill itself goes through the normal POS route (so it counts in sales, profit and the daily breakdown, mixed with the shop).
// Stock: with POS_DEDUCT_STOCK=true the sale takes qty out, so this module puts qty IN first and the item nets to 0.
// With it off, the sale does not touch stock, so this module does not either (also nets to 0).
// Cancelled bill: a VOID gives the stock back, so takeBackAfterVoid() (called from the void route) takes it out again;
// a bill that was never made (cart dropped) is swept after STALE_HOURS: sweep() takes the unsold qty out and cancels the entry.
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
const STALE_HOURS = 12;

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
// Settings > "Let the cashier use + Outside" (default OFF). The owner always may.
async function cashierOn() { try { return await require('../utils/appSettings').getBool(pool, 'pos_outside_cashier', null, false); } catch (e) { return false; } }
async function mayUse(req) { return isOwner(req) || (roleOf(req) === 'cashier' && await cashierOn()); }
const guardUse = async (req, res, next) => (await mayUse(req)) ? next() : res.status(403).json({ error: 'Special items are not switched on for this login' });

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

router.get('/outside-items/allowed', async (req, res) => { res.json({ allowed: await mayUse(req) }); });

router.post('/outside-items', guardUse, async (req, res) => {
  const v = check(req.body); if (v.error) return res.status(400).json({ error: v.error });
  let client;
  try {
    await ensure();
    await sweep(pool).catch(() => {});
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(24112024)');
    const key = keyOf(v.name);
    const mx = (await client.query(`SELECT item_code FROM outside_items`)).rows.reduce((m, r) => Math.max(m, parseInt(String(r.item_code).replace(/\D/g, ''), 10) || 0), 0);
    const code = 'SP-' + String(mx + 1).padStart(3, '0');   // 24 Nov (AJ): every special item is its own item (same name again = new code), SP-001...
    await client.query(`INSERT INTO outside_items (item_code, name, name_key) VALUES ($1,$2,$3)`, [code, v.name, key + '|' + code]);
    const p = await client.query(`SELECT item_code FROM products WHERE item_code = $1 LIMIT 1`, [code]);
    if (p.rows.length) await client.query(`UPDATE products SET name = $2, selling_price = $3, avg_cost = $4, active = true WHERE item_code = $1`, [code, v.name, v.price, v.cost]);
    else await client.query(`INSERT INTO products (item_code, name, category, stock_level, reorder_threshold, selling_price, avg_cost, active) VALUES ($1,$2,'Special',0,0,$3,$4,true)`, [code, v.name, v.price, v.cost]);
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
    console.error('[outside-items]', e.message); res.status(500).json({ error: 'Could not save the special item' });
  } finally { if (client) client.release(); }
});

async function pendingRows(db) {
  await ensure();
  const rows = (await db.query(`SELECT id, item_code, item_name, qty, sell_price, est_cost, est_profit, created_at FROM outside_cost_pending WHERE status = 'pending' ORDER BY created_at, id`)).rows;
  const now = Date.now();
  return rows.map(r => ({ ...r, age_days: Math.floor((now - new Date(r.created_at).getTime()) / 86400000) }));
}
// AJ 24 Nov (v1.0.1): open an outside item again from the bill (double-click) and change its name, price or cost
// 25 Nov (AJ): money of ONE saved bill, owner only: what to pay the shops for its special items, profit, margin
router.get('/outside-items/bill/:id', guard, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10); if (!(id > 0)) return res.status(400).json({ error: 'Bad bill' });
    const b = (await pool.query('SELECT total FROM pos_bills WHERE id = $1', [id])).rows[0]; if (!b) return res.status(404).json({ error: 'Bill not found' });
    const r = (await pool.query(`SELECT i.item_code AS code, i.qty, COALESCE(NULLIF(i.unit_cost,0), p.avg_cost, 0) AS cost FROM pos_bill_items i LEFT JOIN products p ON p.item_code = i.item_code WHERE i.bill_id = $1`, [id])).rows;
    res.json(billMoney(Number(b.total), r));
  } catch (e) { console.error('[outside-items]', e.message); res.status(500).json({ error: 'Could not read the bill' }); }
});
function billMoney(total, lines) {
  const r2 = (n) => Math.round(n * 100) / 100;
  const cost = lines.reduce((a, l) => a + Number(l.qty) * Number(l.cost), 0);
  const shops = lines.filter((l) => /^(SP|OSH|OUT)-/.test(String(l.code || ''))).reduce((a, l) => a + Number(l.qty) * Number(l.cost), 0);
  return { shops_to_pay: r2(shops), profit: r2(total - cost), margin: total > 0 ? Math.round((total - cost) / total * 1000) / 10 : 0, no_cost: lines.filter((l) => !Number(l.cost)).length };
}

router.get('/outside-items/item/:code', guard, async (req, res) => {
  try {
    const code = String(req.params.code); if (!/^(OUT|OSH|SP)-\d+$/.test(code)) return res.status(400).json({ error: 'Not a special item' });
    const it = (await pool.query(`SELECT name FROM outside_items WHERE item_code = $1`, [code])).rows[0]; if (!it) return res.status(404).json({ error: 'Special item not found' });
    const p = (await pool.query(`SELECT selling_price, avg_cost FROM products WHERE item_code = $1`, [code])).rows[0] || {};
    const e = (await pool.query(`SELECT id, status, real_cost FROM outside_cost_pending WHERE item_code = $1 ORDER BY id DESC LIMIT 1`, [code])).rows[0] || {};
    res.json({ item_code: code, name: it.name, price: Number(p.selling_price || 0), cost: Number(p.avg_cost || 0), pending_id: e.status === 'pending' ? e.id : null, status: e.status || null });
  } catch (e) { res.status(500).json({ error: 'Could not read the outside item' }); }
});
router.put('/outside-items/:code', guard, async (req, res) => {
  const code = String(req.params.code); if (!/^(OUT|OSH|SP)-\d+$/.test(code)) return res.status(400).json({ error: 'Not a special item' });
  const v = check({ ...(req.body || {}), qty: 1 }); if (v.error) return res.status(400).json({ error: v.error });
  let client;
  try {
    await ensure(); client = await pool.connect(); await client.query('BEGIN');
    if (!(await client.query(`SELECT 1 FROM outside_items WHERE item_code = $1`, [code])).rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Special item not found' }); }
    const key = keyOf(v.name);
    await client.query(`UPDATE outside_items SET name = $2, name_key = $3 WHERE item_code = $1`, [code, v.name, key + '|' + code]);
    await client.query(`UPDATE products SET name = $2, selling_price = $3, avg_cost = $4 WHERE item_code = $1`, [code, v.name, v.price, v.cost]);
    const pend = await client.query(`UPDATE outside_cost_pending SET item_name = $2, sell_price = $3, est_cost = $4, est_profit = $5 WHERE id = (SELECT MAX(id) FROM outside_cost_pending WHERE item_code = $1 AND status = 'pending') RETURNING id`, [code, v.name, v.price, v.cost, v.profit]);
    await client.query('COMMIT');
    res.json({ item_code: code, name: v.name, price: v.price, cost: v.cost, pending_id: pend.rows[0] ? pend.rows[0].id : null });
  } catch (e) { if (client) await client.query('ROLLBACK').catch(() => {}); console.error('[outside-items edit]', e.message); res.status(500).json({ error: 'Could not save the change' }); }
  finally { if (client) client.release(); }
});
// AJ 24 Nov: how much we must pay the outside shops for the items taken today (real cost once typed, else the estimate x qty)
router.get('/outside-items/today-pay', guard, async (req, res) => {
  try {
    const r = await pool.query(`SELECT item_name, qty, COALESCE(real_cost, est_cost) AS cost, (real_cost IS NOT NULL) AS real FROM outside_cost_pending WHERE created_at::date = CURRENT_DATE AND status <> 'cancelled' ORDER BY id`);
    const items = r.rows.map(x => ({ name: x.item_name, qty: Number(x.qty), cost: Number(x.cost), real: x.real, pay: Math.round(Number(x.qty) * Number(x.cost) * 100) / 100 }));
    const all = (await pool.query(`SELECT COALESCE(SUM(qty * COALESCE(real_cost, est_cost)), 0) AS t FROM outside_cost_pending WHERE status <> 'cancelled'`)).rows[0];
    res.json({ total: Math.round(items.reduce((t, i) => t + i.pay * 100, 0)) / 100, all_total: Math.round(Number(all.t) * 100) / 100, items });
  } catch (e) { res.json({ total: 0, items: [] }); }
});
router.get('/outside-items/pending', guard, async (req, res) => {
  try { await sweep(pool).catch(() => {}); const rows = await pendingRows(pool); res.json({ pending: rows, overdue: rows.filter(r => r.age_days > OVERDUE_DAYS).length }); }
  catch (e) { res.json({ pending: [], overdue: 0 }); }
});

// The bill lines sold under one estimate entry: from its time until the next entry for the same code. Voided bills are marked.
async function windowLines(db, e) {
  const later = (await db.query(`SELECT id, created_at FROM outside_cost_pending WHERE item_code = $1 AND id > $2 ORDER BY id`, [e.item_code, e.id])).rows;
  const from = new Date(e.created_at).getTime(), lim = later.length ? new Date(later[0].created_at).getTime() : null;
  const bm = new Map((await db.query(`SELECT id, created_at FROM pos_bills`)).rows.map(r => [r.id, new Date(r.created_at).getTime()]));
  let voided = new Set(); try { voided = new Set((await db.query(`SELECT bill_id FROM pos_bill_voids`)).rows.map(r => r.bill_id)); } catch (err) { /* no void table yet */ }
  const lines = [];
  for (const it of (await db.query(`SELECT id, bill_id, qty, unit_cost FROM pos_bill_items WHERE item_code = $1`, [e.item_code])).rows) {
    const t = bm.get(it.bill_id); if (t === undefined || t < from || (lim !== null && t >= lim)) continue;
    lines.push({ id: it.id, qty: Number(it.qty), unit_cost: it.unit_cost, voided: voided.has(it.bill_id) });
  }
  return { lines, hasLater: later.length > 0 };
}

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
    const real = money2(cost), est = Number(e.est_cost);
    const w = await windowLines(client, e);
    let lines = 0, qtySum = 0;
    for (const it of w.lines) {
      if (it.unit_cost != null && Math.abs(Number(it.unit_cost) - est) > 0.005) continue;   // only lines still on the estimate
      await client.query(`UPDATE pos_bill_items SET unit_cost = $2 WHERE id = $1`, [it.id, real]); lines++; if (!it.voided) qtySum += it.qty;
    }
    if (!w.hasLater) await client.query(`UPDATE products SET avg_cost = $2 WHERE item_code = $1`, [e.item_code, real]);
    const by = (req.session && req.session.user && (req.session.user.username || req.session.user.name)) || null;
    await client.query(`UPDATE outside_cost_pending SET status = 'confirmed', real_cost = $2, reason = $3, confirmed_by = $4, confirmed_at = CURRENT_TIMESTAMP WHERE id = $1`, [id, real, reason.slice(0, 300), by]);
    await client.query('COMMIT');
    res.json({ ok: true, lines_updated: lines, old_cost: est, real_cost: real, profit_change: money2((est - real) * qtySum) });
  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('[outside-items real-cost]', err.message); res.status(500).json({ error: 'Could not save the real cost' });
  } finally { if (client) client.release(); }
});

// A bill was voided: the void gave the stock back (+qty), but an outside item must stay at 0, so take it out again.
// Called inside the void transaction with the list the void restored. Never breaks the void.
async function takeBackAfterVoid(client, restored) {
  if (!deductOn() || !Array.isArray(restored)) return 0;
  let n = 0;
  await client.query('SAVEPOINT outside_void');
  try {
    for (const r of restored) {
      const code = String(r && r.item_code || ''); if (!/^(OUT|OSH|SP)-\d+$/.test(code)) continue;
      const q = Number(r.qty); if (!(q > 0)) continue;
      await client.query(`UPDATE products SET stock_level = COALESCE(stock_level, 0) - $2 WHERE item_code = $1`, [code, q]);
      await require('../utils/stock_ledger').recordSafe(client, { item_code: code, qty_change: -q, reason: 'outside_void', ref_type: 'outside_item', ref_id: code, note: 'bill voided: outside item stays at 0' }); n++;
    }
    await client.query('RELEASE SAVEPOINT outside_void');
  } catch (e) { await client.query('ROLLBACK TO SAVEPOINT outside_void').catch(() => {}); console.error('[outside void]', e.message); return 0; }
  return n;
}

// A cart that was dropped (never billed): after STALE_HOURS the unsold qty is taken back out and the entry is cancelled.
async function sweep(db) {
  if (!deductOn()) return 0;
  await ensure();
  const cutoff = Date.now() - STALE_HOURS * 3600000;
  const items = (await db.query(`SELECT o.item_code, p.stock_level FROM outside_items o JOIN products p ON p.item_code = o.item_code WHERE COALESCE(p.stock_level,0) > 0`)).rows;
  let freed = 0;
  for (const it of items) {
    const ents = (await db.query(`SELECT * FROM outside_cost_pending WHERE item_code = $1 AND status = 'pending' ORDER BY id`, [it.item_code])).rows;
    const lastAny = (await db.query(`SELECT created_at FROM outside_cost_pending WHERE item_code = $1 ORDER BY id DESC LIMIT 1`, [it.item_code])).rows[0];
    if (!lastAny || new Date(lastAny.created_at).getTime() > cutoff) continue;   // a bill may still be on its way
    const c = await db.connect();
    try {
      await c.query('BEGIN');
      const now = Number((await c.query(`SELECT stock_level FROM products WHERE item_code = $1`, [it.item_code])).rows[0].stock_level);
      if (now > 0) {
        await c.query(`UPDATE products SET stock_level = stock_level - $2 WHERE item_code = $1`, [it.item_code, now]);
        await require('../utils/stock_ledger').recordSafe(c, { item_code: it.item_code, qty_change: -now, reason: 'outside_cancel', ref_type: 'outside_item', ref_id: it.item_code, note: 'never billed: outside item put back to 0' });
        freed += now;
      }
      for (const e of ents) {
        if (new Date(e.created_at).getTime() > cutoff) continue;
        const w = await windowLines(c, e);
        if (!w.lines.some(l => !l.voided)) await c.query(`UPDATE outside_cost_pending SET status = 'cancelled' WHERE id = $1`, [e.id]);
      }
      await c.query('COMMIT');
    } catch (e) { await c.query('ROLLBACK').catch(() => {}); console.error('[outside sweep]', e.message); }
    finally { c.release(); }
  }
  return freed;
}

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
module.exports.takeBackAfterVoid = takeBackAfterVoid;
module.exports.sweep = sweep;
module.exports.billMoney = billMoney;
