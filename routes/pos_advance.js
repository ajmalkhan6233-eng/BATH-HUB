'use strict';
const MC = require('../utils/moneyCore');   // shared money core (void rule)
// ADVANCE ORDERS (AJ 27 Nov): a customer pays part first, goods are NOT delivered, the bill stays OPEN.
// Design: NEW table only. An open order is not a sale, takes no stock and is in no sales total. When the customer pays the rest,
// the POS screen creates the normal bill through the normal /pos-bills route (stock, totals, receipt as always), then calls /settled.
const express = require('express');
const router = express.Router();
const pool = require('../utils/pool');
const money2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const roleOf = req => (req.session && req.session.user && req.session.user.role) || 'staff';
const ADV_METHODS = ['cash', 'card', 'online', 'cheque'];

const deductsStock = () => String(process.env.POS_DEDUCT_STOCK).toLowerCase() === 'true';
// 27 Nov (AJ): a reserved item is taken OUT of stock when the advance is saved (the customer has reserved it). Giving it back is exact:
// on cancel, and on settle (the real bill takes it out again, so net = one deduction). Only when POS_DEDUCT_STOCK=true, like normal bills.
async function moveStock(items, sign, orderNo, reason) {
  if (!deductsStock()) return false;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const l of items) {
      if (!l.item_code) continue;
      await client.query('UPDATE products SET stock_level = COALESCE(stock_level, 0) + $1 WHERE item_code = $2 AND active = true', [sign * Number(l.qty), l.item_code]);
      await require('../utils/stock_ledger').recordSafe(client, { item_code: l.item_code, qty_change: sign * Number(l.qty), reason, ref_type: 'pos_advance', ref_id: orderNo });
    }
    await client.query('COMMIT');
    return true;
  } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; } finally { client.release(); }
}
const ready = pool.query(`CREATE TABLE IF NOT EXISTS pos_advance_orders (
  id SERIAL PRIMARY KEY, order_no VARCHAR(20) UNIQUE, customer_name VARCHAR(150), customer_phone VARCHAR(30),
  items JSONB NOT NULL, subtotal NUMERIC(12,2) NOT NULL, discount_pct NUMERIC(12,6) NOT NULL DEFAULT 0, total NUMERIC(12,2) NOT NULL,
  advance_amount NUMERIC(12,2) NOT NULL, advance_method VARCHAR(20) NOT NULL, advance_ref TEXT, salesman VARCHAR(30), notes TEXT,
  status VARCHAR(12) NOT NULL DEFAULT 'open', bill_id INT, bill_number VARCHAR(30), cancel_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, settled_at TIMESTAMP, cancelled_at TIMESTAMP)`)
  .then(() => pool.query('ALTER TABLE pos_advance_orders ADD COLUMN IF NOT EXISTS stock_reserved BOOLEAN NOT NULL DEFAULT false'))
  .then(() => pool.query(`CREATE TABLE IF NOT EXISTS pos_advance_payments (id SERIAL PRIMARY KEY, order_id INT NOT NULL REFERENCES pos_advance_orders(id), amount NUMERIC(12,2) NOT NULL, method VARCHAR(20) NOT NULL, reference TEXT, paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)).catch(e => console.error('[pos_advance] schema', e.message));

router.post('/pos-advance', async (req, res) => {
  try {
    await ready;
    const b = req.body || {};
    const name = String(b.customer_name || '').trim(), phone = String(b.customer_phone || '').trim();
    if (!name && !phone) return res.status(400).json({ error: 'An advance order needs the customer name or phone.' });
    if (name.length > 150 || phone.length > 30) return res.status(400).json({ error: 'customer name or phone is too long' });
    if (!Array.isArray(b.items) || !b.items.length || b.items.length > 100) return res.status(400).json({ error: 'items (1 to 100) are required' });
    const items = [];
    for (const [i, it] of b.items.entries()) {
      const item_name = String(it && it.item_name || '').trim(), qty = money2(it && it.qty), price = money2(it && it.unit_price);
      if (!item_name || item_name.length > 200) return res.status(400).json({ error: `item ${i + 1}: item_name is required` });
      if (!Number.isFinite(qty) || qty <= 0) return res.status(400).json({ error: `item ${i + 1} (${item_name}): qty must be more than 0` });
      if (!Number.isFinite(price) || price < 0) return res.status(400).json({ error: `item ${i + 1} (${item_name}): price must be 0 or more` });
      const code = it.item_code == null || it.item_code === '' ? null : String(it.item_code).trim().slice(0, 50);
      items.push({ item_name, item_code: code, qty, unit_price: price, line_total: money2(qty * price) });
    }
    const subtotal = money2(items.reduce((s, l) => s + l.line_total, 0));
    const pct = Number(b.discount_pct) || 0;
    if (pct < 0 || pct > 100) return res.status(400).json({ error: 'discount_pct must be between 0 and 100' });
    const total = money2(subtotal - money2(subtotal * pct / 100));
    if (total <= 0) return res.status(400).json({ error: 'the order total must be more than 0' });
    const adv = money2(b.advance_amount), method = String(b.advance_method || 'cash').toLowerCase();
    if (!Number.isFinite(adv) || adv <= 0) return res.status(400).json({ error: 'The advance paid must be more than 0.' });
    if (adv > total) return res.status(400).json({ error: 'The advance is more than the order total.' });
    if (!ADV_METHODS.includes(method)) return res.status(400).json({ error: 'advance_method must be cash, card, online or cheque' });
    const ref = String(b.advance_ref || '').trim().slice(0, 120) || null;
    if (method === 'cheque' && !ref) return res.status(400).json({ error: 'A cheque advance needs the cheque number or bank and date.' });
    const salesman = ['Ajmal', 'Jazeel'].includes(String(b.salesman || '')) ? String(b.salesman) : null;
    const r = await pool.query(`INSERT INTO pos_advance_orders (customer_name, customer_phone, items, subtotal, discount_pct, total, advance_amount, advance_method, advance_ref, salesman, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`, [name || null, phone || null, JSON.stringify(items), subtotal, pct, total, adv, method, ref, salesman, String(b.notes || '').slice(0, 500) || null]);
    const no = 'ADV-' + String(r.rows[0].id).padStart(3, '0');
    await pool.query('UPDATE pos_advance_orders SET order_no=$1 WHERE id=$2', [no, r.rows[0].id]);
    await pool.query('INSERT INTO pos_advance_payments (order_id, amount, method, reference) VALUES ($1,$2,$3,$4)', [r.rows[0].id, adv, method, ref]);
    if (await moveStock(items, -1, no, 'reserve')) await pool.query('UPDATE pos_advance_orders SET stock_reserved=true WHERE id=$1', [r.rows[0].id]);
    res.json(await load(r.rows[0].id));
  } catch (e) { res.status(500).json({ error: 'Could not save the advance order: ' + e.message }); }
});

async function load(id) {
  const r = await pool.query('SELECT * FROM pos_advance_orders WHERE id=$1', [id]);
  const o = r.rows[0]; if (!o) return null;
  o.payments = (await pool.query('SELECT amount, method, reference, paid_at FROM pos_advance_payments WHERE order_id=$1 ORDER BY id', [id])).rows.map(p => ({ ...p, amount: Number(p.amount) }));
  o.advance_amount = Number(o.advance_amount); o.total = Number(o.total); o.subtotal = Number(o.subtotal); o.balance = money2(o.total - o.advance_amount);
  return o;
}

router.get('/pos-advance', async (req, res) => {
  try {
    await ready;
    const st = String(req.query.status || 'open');
    const r = await pool.query(`SELECT id, order_no, customer_name, customer_phone, total, advance_amount, advance_method, status, bill_number, created_at FROM pos_advance_orders
      ${st === 'all' ? '' : 'WHERE status = $1'} ORDER BY id DESC LIMIT 200`, st === 'all' ? [] : [st]);
    const rows = r.rows.map(o => ({ ...o, total: Number(o.total), advance_amount: Number(o.advance_amount), balance: money2(Number(o.total) - Number(o.advance_amount)) }));
    res.json({ orders: rows, count: rows.length, advance_held: money2(rows.filter(o => o.status === 'open').reduce((s, o) => s + o.advance_amount, 0)) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/pos-advance/:id/pdf', async (req, res) => {   // 27 Nov (AJ): the advance receipt is drawn with the SAME design as the normal bill
  try {
    await ready; const id = Number(req.params.id); if (!Number.isInteger(id) || id < 1) return res.status(404).json({ error: 'not found' });
    const o = await load(id); if (!o) return res.status(404).json({ error: 'not found' });
    const items = (o.items || []).map(l => ({ item_name: l.item_name, item_code: l.item_code, qty: l.qty, unit_price: l.unit_price, line_total: l.line_total != null ? Number(l.line_total) : Number(l.qty) * Number(l.unit_price) }));
    const bill = { bill_number: o.order_no, created_at: o.created_at, customer_name: o.customer_name, customer_phone: o.customer_phone, items, subtotal: o.subtotal, total: o.total, payment_method: o.advance_method };
    const disc = money2(Number(o.subtotal) - Number(o.total));
    const paid = (o.payments || []).filter(p => Number(p.amount) > 0).map(p => String(p.method).toUpperCase()).filter((v, i, a) => a.indexOf(v) === i).join(' + ') || String(o.advance_method).toUpperCase();
    await require('./pos_bills').renderBillPdf(res, bill, { docLabel: o.status === 'cancelled' ? 'ADVANCE RECEIPT (CANCELLED)' : 'ADVANCE RECEIPT', numberLabel: 'Order No',
      pre: disc > 0 ? [['Total', o.subtotal], ['Discount', disc]] : [], totalLabel: 'Net total',
      post: [['Advance received', o.advance_amount], ['BALANCE TO PAY', o.balance, true]], payLabel: 'Advance paid by: ' + paid,
      note: o.status === 'open' ? 'ORDER OPEN · GOODS NOT DELIVERED' : o.status === 'settled' ? 'PAID IN FULL · bill ' + (o.bill_number || '') : 'ORDER CANCELLED' });
  } catch (e) { if (!res.headersSent) res.status(500).json({ error: e.message }); }
});

router.get('/pos-advance/:id', async (req, res) => {
  try {
    await ready; const pid = Number(req.params.id); if (!Number.isInteger(pid) || pid < 1) return res.status(404).json({ error: 'not found' }); const o = await load(pid);
    if (!o) return res.status(404).json({ error: 'not found' });
    // retry safety: if the bill was already made for this order but the order was not marked, say so (never bill twice)
    const b = await pool.query(`SELECT b.id, b.bill_number FROM pos_bills b WHERE b.notes = $1 AND ${MC.LIVE} ORDER BY b.id DESC LIMIT 1`, ['Advance order ' + o.order_no]).catch(() => ({ rows: [] }));
    o.existing_bill = b.rows[0] || null;
    res.json(o);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/pos-advance/:id/settled', async (req, res) => {
  try {
    await ready; const id = Number(req.params.id); if (!Number.isInteger(id) || id < 1) return res.status(404).json({ error: 'not found' }); const o = await load(id);
    if (!o) return res.status(404).json({ error: 'not found' });
    if (o.status !== 'open') return res.status(409).json({ error: 'This order is already ' + o.status + '.' });
    const bill = await pool.query('SELECT id, bill_number, notes FROM pos_bills WHERE id=$1', [Number(req.body && req.body.bill_id)]);
    if (!bill.rows[0] || bill.rows[0].notes !== 'Advance order ' + o.order_no) return res.status(400).json({ error: 'That bill is not this order\'s bill.' });
    await pool.query(`UPDATE pos_advance_orders SET status='settled', bill_id=$1, bill_number=$2, settled_at=CURRENT_TIMESTAMP WHERE id=$3 AND status='open'`, [bill.rows[0].id, bill.rows[0].bill_number, id]);
    if (o.stock_reserved) { await moveStock(o.items, +1, o.order_no, 'reserve_release'); await pool.query('UPDATE pos_advance_orders SET stock_reserved=false WHERE id=$1', [id]); }
    res.json(await load(id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/pos-advance/:id/cancel', async (req, res) => {
  try {
    if (!['admin', 'owner'].includes(roleOf(req))) return res.status(403).json({ error: 'Only the owner can cancel an advance order.' });
    await ready; const id = Number(req.params.id); if (!Number.isInteger(id) || id < 1) return res.status(404).json({ error: 'not found' }); const o = await load(id);
    if (!o) return res.status(404).json({ error: 'not found' });
    if (o.status !== 'open') return res.status(409).json({ error: 'This order is already ' + o.status + '.' });
    const reason = String(req.body && req.body.reason || '').trim();
    if (!reason) return res.status(400).json({ error: 'Give the reason (and say how the advance is returned).' });
    await pool.query(`UPDATE pos_advance_orders SET status='cancelled', cancel_reason=$1, cancelled_at=CURRENT_TIMESTAMP WHERE id=$2 AND status='open'`, [reason.slice(0, 300), id]);
    if (o.stock_reserved) { await moveStock(o.items, +1, o.order_no, 'reserve_release'); await pool.query('UPDATE pos_advance_orders SET stock_reserved=false WHERE id=$1', [id]); }
    // the advance goes back to the customer: one negative row per method so the day cash shows the money leaving
    const net = await pool.query('SELECT method, SUM(amount) AS s FROM pos_advance_payments WHERE order_id=$1 GROUP BY method HAVING SUM(amount) <> 0', [id]);
    for (const x of net.rows) await pool.query('INSERT INTO pos_advance_payments (order_id, amount, method, reference) VALUES ($1,$2,$3,$4)', [id, -Number(x.s), x.method, 'advance returned: ' + reason.slice(0, 80)]);
    res.json(await load(id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/pos-advance/:id/topup', async (req, res) => {
  try {
    await ready; const id = Number(req.params.id); if (!Number.isInteger(id) || id < 1) return res.status(404).json({ error: 'not found' });
    const o = await load(id); if (!o) return res.status(404).json({ error: 'not found' });
    if (o.status !== 'open') return res.status(409).json({ error: 'This order is already ' + o.status + '.' });
    const amt = money2(req.body && req.body.amount), method = String(req.body && req.body.method || 'cash').toLowerCase(), ref = String(req.body && req.body.reference || '').trim().slice(0, 120) || null;
    if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ error: 'The amount must be more than 0.' });
    if (!ADV_METHODS.includes(method)) return res.status(400).json({ error: 'method must be cash, card, online or cheque' });
    if (method === 'cheque' && !ref) return res.status(400).json({ error: 'A cheque needs its number or bank and date.' });
    if (money2(o.advance_amount + amt) > o.total) return res.status(400).json({ error: 'That is more than the balance (' + o.balance.toFixed(2) + ').' });
    await pool.query('INSERT INTO pos_advance_payments (order_id, amount, method, reference) VALUES ($1,$2,$3,$4)', [id, amt, method, ref]);
    await pool.query('UPDATE pos_advance_orders SET advance_amount = advance_amount + $1 WHERE id=$2 AND status=\'open\'', [amt, id]);
    res.json(await load(id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/pos-advance/:id/reopen', async (req, res) => {
  try {
    if (!['admin', 'owner'].includes(roleOf(req))) return res.status(403).json({ error: 'Only the owner can reopen an advance order.' });
    await ready; const id = Number(req.params.id); if (!Number.isInteger(id) || id < 1) return res.status(404).json({ error: 'not found' });
    const o = await load(id); if (!o) return res.status(404).json({ error: 'not found' });
    if (o.status === 'open') return res.status(409).json({ error: 'This order is already open.' });
    if (o.status === 'settled') {   // only when its bill was voided
      const v = await pool.query('SELECT 1 FROM pos_bill_voids WHERE bill_id=$1', [o.bill_id]).catch(() => ({ rows: [] }));
      if (!v.rows.length) return res.status(409).json({ error: 'The bill for this order is still active. Void the bill first if it must be reopened.' });
    }
    await pool.query(`UPDATE pos_advance_orders SET status='open', bill_id=NULL, bill_number=NULL, settled_at=NULL, cancelled_at=NULL, cancel_reason=NULL, advance_amount=(SELECT COALESCE(SUM(amount),0) FROM pos_advance_payments WHERE order_id=$1) WHERE id=$1`, [id]);
    if (!o.stock_reserved && await moveStock(o.items, -1, o.order_no, 'reserve')) await pool.query('UPDATE pos_advance_orders SET stock_reserved=true WHERE id=$1', [id]);
    res.json(await load(id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
