'use strict';
// CUSTOMER RETURN / REFUND (AJ 27 Nov): a sold item comes back. Isolated module, new table only.
// How: a RETURN BILL (number RBH-R001...) with negative lines and a negative payment is written into the SAME pos_bills tables,
// so every existing total (sales, profit, cash, stock, commission) moves the right way on the DAY OF THE RETURN with no other change.
// Exchange = return (refund) + a normal new bill for the new item; the drawer nets out by itself.
// Owner/admin only, reason required. Not for voided bills. Not for bills with a credit part (settle those in the credit screen).
// Stock: only when POS_DEDUCT_STOCK=true and the original bill took stock out; the cost of each line is the ORIGINAL line's cost (profit reverses exactly).
const express = require('express');
const router = express.Router();
const pool = require('../utils/pool');
const money2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const roleOf = req => (req.session && req.session.user && req.session.user.role) || 'staff';
const ownerOnly = (req, res, next) => (['admin', 'owner'].includes(roleOf(req)) && !(req.session.user && req.session.user.username === 'uncle')) ? next() : res.status(403).json({ error: 'Only the owner can take a return.' });
const deducts = () => String(process.env.POS_DEDUCT_STOCK).toLowerCase() === 'true';
const METHODS = ['cash', 'card', 'online'];

const ready = pool.query(`CREATE TABLE IF NOT EXISTS pos_sale_returns (id SERIAL PRIMARY KEY, return_bill_id INT NOT NULL, orig_bill_id INT NOT NULL, reason TEXT NOT NULL, refund_method VARCHAR(20) NOT NULL, created_by VARCHAR(60), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
  .catch(e => console.error('[pos_returns] schema', e.message));

// Bill + what can still come back, and the money per unit (after the bill's own discount).
async function returnable(billNumber) {
  const b = (await pool.query('SELECT * FROM pos_bills WHERE bill_number = $1', [billNumber])).rows[0];
  if (!b) return { error: 'No bill with that number.', status: 404 };
  if (/^RBH-R/.test(b.bill_number)) return { error: 'That is a return note, not a sale.', status: 400 };
  const voided = (await pool.query('SELECT 1 FROM pos_bill_voids WHERE bill_id=$1', [b.id]).catch(() => ({ rows: [] }))).rows.length > 0;
  if (voided) return { error: 'That bill is VOID.', status: 409 };
  const pays = (await pool.query('SELECT method, amount FROM pos_bill_payments WHERE bill_id=$1', [b.id]).catch(() => ({ rows: [] }))).rows;
  if (pays.some(p => ['credit', 'cheque'].includes(String(p.method).toLowerCase()))) return { error: 'This bill has a credit or cheque part. Settle it in the credit screen first.', status: 409 };
  const items = (await pool.query('SELECT id, item_name, item_code, qty, unit_price, line_total, unit_cost FROM pos_bill_items WHERE bill_id=$1 ORDER BY id', [b.id])).rows;
  const back = (await pool.query(`SELECT i.item_code, i.item_name, SUM(-i.qty) AS q FROM pos_bill_items i JOIN pos_bills r ON r.id=i.bill_id JOIN pos_sale_returns s ON s.return_bill_id=r.id WHERE s.orig_bill_id=$1 GROUP BY i.item_code, i.item_name`, [b.id])).rows;
  const ratio = Number(b.subtotal) > 0 ? Number(b.total) / Number(b.subtotal) : 1;
  const lines = items.map(i => {
    const key = i.item_code || i.item_name, got = back.filter(x => (x.item_code || x.item_name) === key).reduce((s, x) => s + Number(x.q), 0);
    const sold = Number(i.qty);
    return { line_id: i.id, item_code: i.item_code, item_name: i.item_name, sold, returned: got, left: Math.max(0, money2(sold - got)), refund_each: money2(Number(i.line_total) * ratio / (sold || 1)), unit_cost: i.unit_cost };
  });
  return { bill: { id: b.id, bill_number: b.bill_number, customer_name: b.customer_name, customer_phone: b.customer_phone, total: Number(b.total), created_at: b.created_at, salesman: b.salesman, stock_deducted: b.stock_deducted }, lines, payments: pays.map(p => ({ method: p.method, amount: Number(p.amount) })) };
}

router.get('/pos-returns/bill', ownerOnly, async (req, res) => {
  try { await ready; const r = await returnable(String(req.query.number || '').trim().toUpperCase()); if (r.error) return res.status(r.status).json({ error: r.error }); res.json(r); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/pos-returns', ownerOnly, async (req, res) => {
  try {
    await ready; const date = String(req.query.date || '');
    const r = await pool.query(`SELECT s.id, s.reason, s.refund_method, s.created_at, rb.bill_number AS return_number, rb.total, ob.bill_number AS orig_number, ob.customer_name
      FROM pos_sale_returns s JOIN pos_bills rb ON rb.id=s.return_bill_id JOIN pos_bills ob ON ob.id=s.orig_bill_id
      WHERE ($1::date IS NULL OR s.created_at::date = $1::date) ORDER BY s.id DESC LIMIT 200`, [/^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null]);
    res.json(r.rows.map(x => ({ ...x, total: Number(x.total) })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/pos-returns', ownerOnly, async (req, res) => {
  const client = await pool.connect();
  try {
    await ready;
    const b = req.body || {}, reason = String(b.reason || '').trim(), method = String(b.refund_method || 'cash').toLowerCase();
    if (!reason) return res.status(400).json({ error: 'Give the reason for the return.' });
    if (!METHODS.includes(method)) return res.status(400).json({ error: 'Refund method must be cash, card or online.' });
    const info = await returnable(String(b.bill_number || '').trim().toUpperCase());
    if (info.error) return res.status(info.status).json({ error: info.error });
    const want = (Array.isArray(b.lines) ? b.lines : []).map(l => ({ line_id: Number(l.line_id), qty: money2(l.qty) })).filter(l => l.qty > 0);
    if (!want.length) return res.status(400).json({ error: 'Pick at least one item to return.' });
    const take = [];
    for (const w of want) {
      const l = info.lines.find(x => x.line_id === w.line_id);
      if (!l) return res.status(400).json({ error: 'Item is not on that bill.' });
      if (w.qty > l.left) return res.status(400).json({ error: `${l.item_name}: only ${l.left} can still be returned.` });
      take.push({ ...l, qty: w.qty, amount: money2(l.refund_each * w.qty) });
    }
    const total = money2(take.reduce((s, l) => s + l.amount, 0));
    if (total <= 0) return res.status(400).json({ error: 'Nothing to refund.' });
    const user = (req.session && req.session.user && req.session.user.username) || null;
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(774413)');
    const n = (await client.query(`SELECT COALESCE(MAX(SUBSTRING(bill_number FROM '^RBH-R([0-9]+)$')::int),0)+1 AS n FROM pos_bills WHERE bill_number ~ '^RBH-R[0-9]+$'`)).rows[0].n;
    const no = 'RBH-R' + String(n).padStart(3, '0');
    const rb = (await client.query(`INSERT INTO pos_bills (bill_number, customer_name, customer_phone, subtotal, discount_pct, discount_amount, total, payment_method, notes, discount_override, stock_deducted, salesman)
      VALUES ($1,$2,$3,$4,0,0,$4,$5,$6,false,$7,$8) RETURNING id`, [no, info.bill.customer_name, info.bill.customer_phone, -total, method, 'Return of ' + info.bill.bill_number + ': ' + reason.slice(0, 200), deducts() && info.bill.stock_deducted === true, info.bill.salesman]).catch(e => { throw e; })).rows[0].id;
    await client.query('INSERT INTO pos_bill_payments (bill_id, method, amount, reference) VALUES ($1,$2,$3,$4)', [rb, method, -total, 'refund of ' + info.bill.bill_number]);
    for (const l of take) {
      await client.query('INSERT INTO pos_bill_items (bill_id, item_name, item_code, qty, unit_price, line_total, unit_cost) VALUES ($1,$2,$3,$4,$5,$6,$7)', [rb, l.item_name, l.item_code, -l.qty, l.refund_each, -l.amount, l.unit_cost]);
      if (deducts() && info.bill.stock_deducted === true && l.item_code) {
        await client.query('UPDATE products SET stock_level = COALESCE(stock_level,0) + $1 WHERE item_code=$2 AND active=true', [l.qty, l.item_code]);
        await require('../utils/stock_ledger').recordSafe(client, { item_code: l.item_code, qty_change: l.qty, reason: 'sale_return', ref_type: 'pos_bill', ref_id: no });
      }
    }
    await client.query('INSERT INTO pos_sale_returns (return_bill_id, orig_bill_id, reason, refund_method, created_by) VALUES ($1,$2,$3,$4,$5)', [rb, info.bill.id, reason.slice(0, 300), method, user]);
    await client.query('COMMIT');
    res.json({ return_number: no, orig_number: info.bill.bill_number, refund: total, method, customer_name: info.bill.customer_name, lines: take.map(l => ({ item_name: l.item_name, qty: l.qty, amount: l.amount })), reason });
  } catch (e) { await client.query('ROLLBACK').catch(() => {}); res.status(500).json({ error: 'Could not save the return: ' + e.message }); }
  finally { client.release(); }
});

module.exports = router;
