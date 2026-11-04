'use strict';
// OVERSOLD ITEMS (AJ 24 Oct 2026): selling more than the stock is allowed. The shortfall is remembered as "owed to customer".
// When that item comes in next time the app asks how it was covered (local market cash / same vendor / still owe) so profit stays honest.
const round2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
let ready = null;
function ensure(db) {
  if (!ready) ready = db.query(`CREATE TABLE IF NOT EXISTS oversold_owed (
    id SERIAL PRIMARY KEY, item_code TEXT, item_name TEXT, bill_number TEXT, customer_name TEXT, customer_phone TEXT,
    qty_short NUMERIC NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), status TEXT NOT NULL DEFAULT 'OPEN',
    how TEXT, actual_cost NUMERIC, cost_adjust NUMERIC DEFAULT 0, resolved_at TIMESTAMPTZ, note TEXT)`).catch(e => { ready = null; throw e; });
  return ready;
}
const reset = () => { ready = null; };
const shortOf = (stock, qty) => round2(Math.max(0, Number(qty) - Math.max(0, Number(stock) || 0)));

// Inside the bill's transaction, BEFORE the stock is taken out.
async function record(client, { itemCode, itemName, qty, billNumber, name, phone }) {
  if (!itemCode) return 0;
  await ensure(client);
  const r = await client.query(`SELECT stock_level FROM products WHERE item_code = $1 AND active = true LIMIT 1`, [itemCode]);
  if (!r.rows.length) return 0;
  const short = shortOf(r.rows[0].stock_level, qty);
  if (short > 0) await client.query(`INSERT INTO oversold_owed (item_code,item_name,bill_number,customer_name,customer_phone,qty_short) VALUES ($1,$2,$3,$4,$5,$6)`, [itemCode, itemName, billNumber, name || null, phone || null, short]);
  return short;
}
async function open(db, itemCodes) {
  await ensure(db);
  const args = [], where = [`status = 'OPEN'`];
  if (itemCodes && itemCodes.length) { args.push(itemCodes); where.push(`item_code = ANY($1)`); }
  return (await db.query(`SELECT * FROM oversold_owed WHERE ${where.join(' AND ')} ORDER BY id`, args)).rows;
}
// how: local_cash (needs cost) | same_vendor | still_owe (stays open, marked reminded)
async function resolve(db, id, { how, cost }) {
  await ensure(db);
  const row = (await db.query(`SELECT o.*, p.avg_cost FROM oversold_owed o LEFT JOIN products p ON p.item_code = o.item_code WHERE o.id = $1`, [id])).rows[0];
  if (!row) return { error: 'not found', code: 404 };
  if (row.status !== 'OPEN') return { error: 'already sorted out', code: 409 };
  if (how === 'still_owe') { await db.query(`UPDATE oversold_owed SET note = 'still owe the customer' WHERE id = $1`, [id]); return { ok: true, status: 'OPEN' }; }
  if (how === 'same_vendor') { await db.query(`UPDATE oversold_owed SET status='DONE', how=$2, resolved_at=NOW() WHERE id=$1`, [id, how]); return { ok: true, status: 'DONE', cost_adjust: 0 }; }
  if (how === 'local_cash') {
    const c = Number(cost);
    if (!(c >= 0) || !isFinite(c) || cost === '' || cost == null) return { error: 'cost per piece needed', code: 400 };
    const adj = round2((c - Number(row.avg_cost || 0)) * Number(row.qty_short));   // extra cost over the normal cost
    await db.query(`UPDATE oversold_owed SET status='DONE', how=$2, actual_cost=$3, cost_adjust=$4, resolved_at=NOW() WHERE id=$1`, [id, how, c, adj]);
    return { ok: true, status: 'DONE', cost_adjust: adj };
  }
  return { error: 'how must be local_cash, same_vendor or still_owe', code: 400 };
}
// profit hook: [{day, amount}] extra (or saved) cost of goods
async function costAdjustments(db) {
  await ensure(db);
  return (await db.query(`SELECT resolved_at::date::text AS day, cost_adjust AS amount FROM oversold_owed WHERE status='DONE' AND COALESCE(cost_adjust,0) <> 0`)).rows;
}
module.exports = { ensure, reset, shortOf, record, open, resolve, costAdjustments };
