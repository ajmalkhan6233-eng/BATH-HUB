'use strict';
// AWAITING DELIVERY (AJ 24 Oct 2026): a vendor bill can include items the vendor has not delivered yet (e.g. ref PR7554).
// The bill total is right; the stock-in only covers what arrived. These lines are the checklist: tick DELIVERED and the stock goes up.
const { lineTotal, weightedAvgCost, round2 } = require('./grn_math');
let ready = null;
function ensure(db) {
  if (!ready) ready = db.query(`CREATE TABLE IF NOT EXISTS vendor_pending_items (
    id SERIAL PRIMARY KEY, bill_no TEXT NOT NULL, vendor_name TEXT, ref TEXT, item_name TEXT NOT NULL, qty NUMERIC NOT NULL CHECK (qty > 0),
    unit_cost NUMERIC NOT NULL DEFAULT 0, amount NUMERIC NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'WAITING',
    created_at TIMESTAMPTZ DEFAULT NOW(), delivered_at TIMESTAMPTZ, note TEXT)`).catch(e => { ready = null; throw e; });
  return ready;
}
const reset = () => { ready = null; };
function clean(l) {
  const name = String((l && l.name) || '').trim(), qty = Number(l && l.qty), cost = Number(l && l.unit_cost);
  if (!name || !(qty > 0) || !(cost >= 0) || !isFinite(cost)) return null;
  return { name, qty, cost, amount: lineTotal(qty, cost) };
}
async function add(db, { bill_no, vendor_name, ref, lines }) {
  await ensure(db);
  if (!String(bill_no || '').trim()) return { error: 'bill number needed', code: 400 };
  const ok = (lines || []).map(clean).filter(Boolean);
  if (!ok.length) return { error: 'add at least one item with name, quantity and cost', code: 400 };
  const out = [];
  for (const l of ok) out.push((await db.query(`INSERT INTO vendor_pending_items (bill_no,vendor_name,ref,item_name,qty,unit_cost,amount) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [String(bill_no).trim(), vendor_name || null, ref || null, l.name, l.qty, l.cost, l.amount])).rows[0]);
  return { ok: true, items: out };
}
async function list(db, status) {
  await ensure(db);
  return (await db.query(`SELECT * FROM vendor_pending_items WHERE ($1::text IS NULL OR status = $1) ORDER BY status DESC, id`, [status || null])).rows;
}
// Delivered: stock goes up (weighted cost, same maths as a normal stock-in). The money is NOT counted twice: the vendor bill already holds it.
async function deliver(pool, id) {
  await ensure(pool);
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const r = (await c.query(`SELECT * FROM vendor_pending_items WHERE id = $1 FOR UPDATE`, [id])).rows[0];
    if (!r) { await c.query('ROLLBACK'); return { error: 'not found', code: 404 }; }
    if (r.status !== 'WAITING') { await c.query('ROLLBACK'); return { error: 'already delivered', code: 409 }; }
    const p = (await c.query(`SELECT id, stock_level, avg_cost FROM products WHERE LOWER(name) = LOWER($1) AND active = true LIMIT 1 FOR UPDATE`, [r.item_name])).rows[0];
    let stock = 'item not in the catalogue yet, add the stock-in by hand';
    if (p) {
      await c.query(`UPDATE products SET stock_level = COALESCE(stock_level,0) + $1, avg_cost = $2 WHERE id = $3`, [r.qty, weightedAvgCost(p.stock_level, p.avg_cost, r.qty, r.unit_cost), p.id]);
      stock = 'stock increased by ' + r.qty;
    }
    await c.query(`UPDATE vendor_pending_items SET status='DELIVERED', delivered_at=NOW(), note=$2 WHERE id=$1`, [id, stock]);
    await c.query('COMMIT');
    return { ok: true, status: 'DELIVERED', stock };
  } catch (e) { try { await c.query('ROLLBACK'); } catch (x) {} throw e; } finally { c.release(); }
}
module.exports = { ensure, reset, add, list, deliver, clean, round2 };
