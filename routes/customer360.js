'use strict';
const MC = require('../utils/moneyCore');   // shared money core (void rule)
// Customer 360: one place to see a customer (invoices, credit owed, payments, advances held, returns, quotes). Owner or admin only.
// Reads POS bills (void bills out), credit_customers, advance orders, quotations. The ONE write: record a payment against a credit invoice
// (new table customer_payments, and credit_customers.paid goes up in the same transaction). Mounted at /api/customer360 in server.js.
const express = require('express');
const round2 = n => Math.round(Number(n || 0) * 100) / 100;

function createCustomer360Router({ pool, requireAuth } = {}) {
  const router = express.Router();
  const roleOf = req => (req.session && req.session.user && req.session.user.role) || 'staff';
  const owner = req => ['admin', 'owner'].includes(roleOf(req)) || process.env.LOGIN_DISABLED === 'true';
  if (requireAuth) router.use(requireAuth);
  router.use((req, res, next) => (owner(req) ? next() : res.status(403).json({ error: 'Owner only' })));
  const q = (sql, a) => pool.query(sql, a).then(r => r.rows).catch(() => []);   // a missing optional table gives an empty list, not an error
  const fail = (res, e) => res.status(500).json({ error: 'Could not load customer data' });
  const key = s => String(s || '').trim().toLowerCase();

  pool.query(`CREATE TABLE IF NOT EXISTS customer_payments (id SERIAL PRIMARY KEY, credit_id INT NOT NULL, customer_id INT, amount NUMERIC(14,2) NOT NULL, method VARCHAR(30), paid_at DATE NOT NULL DEFAULT CURRENT_DATE, note TEXT, created_by VARCHAR(100), created_at TIMESTAMP DEFAULT NOW())`).catch(() => {});

  const BILLS = `SELECT b.id, b.bill_number, b.customer_name, b.customer_phone, b.total, b.payment_method, b.created_at FROM pos_bills b
    WHERE ${MC.LIVE}`;

  router.get('/list', async (req, res) => {
    try {
      const map = new Map();
      const add = (name, phone) => { const k = key(name); if (!k) return null; if (!map.has(k)) map.set(k, { name: String(name).trim(), phone: phone || '', total_bills: 0, total_bought: 0, credit_owed: 0, advance_held: 0, last_bill_date: null }); const c = map.get(k); if (!c.phone && phone) c.phone = phone; return c; };
      for (const c of await q('SELECT id, name, phone FROM customers')) add(c.name, c.phone);
      for (const b of await q(BILLS)) { const c = add(b.customer_name, b.customer_phone); if (!c) continue; c.total_bills++; c.total_bought = round2(c.total_bought + Number(b.total)); if (!c.last_bill_date || b.created_at > c.last_bill_date) c.last_bill_date = b.created_at; }
      for (const r of await q(`SELECT lower(trim(c.name)) AS k, SUM(cc.amount - COALESCE(cc.paid,0)) AS owed FROM credit_customers cc JOIN customers c ON c.id = cc.customer_id WHERE cc.quarantined IS NOT TRUE GROUP BY 1`)) { const c = map.get(r.k); if (c) c.credit_owed = round2(r.owed); }
      for (const r of await q(`SELECT customer_name, advance_amount FROM pos_advance_orders WHERE status NOT IN ('settled','cancelled') AND status <> 'done'`)) { const c = add(r.customer_name, null); if (c) c.advance_held = round2(c.advance_held + Number(r.advance_amount)); }
      res.json({ customers: [...map.values()].sort((a, b) => b.credit_owed - a.credit_owed || a.name.localeCompare(b.name)) });
    } catch (e) { fail(res, e); }
  });

  router.get('/:name/overview', async (req, res) => {
    try {
      const name = String(req.params.name || '').trim(), k = key(name);
      const cust = (await q('SELECT id, name, phone, whatsapp, location, notes FROM customers WHERE lower(trim(name)) = $1 LIMIT 1', [k]))[0] || null;
      const bills = await q(`${BILLS} AND lower(trim(b.customer_name)) = $1 ORDER BY b.created_at DESC LIMIT 300`, [k]);
      const credit = cust ? await q(`SELECT id, invoice_no, invoice_date, due_date, amount, COALESCE(paid,0) AS paid, notes FROM credit_customers WHERE customer_id = $1 AND quarantined IS NOT TRUE ORDER BY invoice_date DESC, id DESC`, [cust.id]) : [];
      const payments = cust ? await q(`SELECT id, credit_id, amount, method, paid_at, note FROM customer_payments WHERE customer_id = $1 ORDER BY paid_at DESC, id DESC`, [cust.id]) : [];
      const advances = await q(`SELECT id, order_no, total, advance_amount, status, bill_number, created_at FROM pos_advance_orders WHERE lower(trim(customer_name)) = $1 ORDER BY id DESC`, [k]);
      const quotes = cust ? await q(`SELECT id, quote_no, quote_date, valid_until, status, total FROM quotations WHERE customer_id = $1 ORDER BY id DESC`, [cust.id]) : [];
      const owed = round2(credit.reduce((a, c) => a + Number(c.amount) - Number(c.paid), 0));
      const held = round2(advances.filter(a => !['settled', 'cancelled'].includes(a.status)).reduce((a, x) => a + Number(x.advance_amount), 0));
      res.json({ name, customer: cust, summary: { total_bought: round2(bills.reduce((a, b) => a + Number(b.total), 0)), bills: bills.length, credit_owed: owed, advance_held: held }, bills, credit, payments, advances, quotes });
    } catch (e) { fail(res, e); }
  });

  // Record a payment against one credit invoice. One transaction. Cannot pay more than is owed.
  router.post('/payment', express.json(), async (req, res) => {
    const b = req.body || {}, amount = Number(b.amount), id = Number(b.credit_id);
    if (!Number.isInteger(id) || !(amount > 0)) return res.status(400).json({ error: 'Choose the invoice and enter the amount.' });
    const paidAt = /^\d{4}-\d{2}-\d{2}$/.test(b.paid_at || '') ? b.paid_at : new Date().toISOString().slice(0, 10);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const cc = (await client.query('SELECT id, customer_id, amount, COALESCE(paid,0) AS paid FROM credit_customers WHERE id = $1 FOR UPDATE', [id])).rows[0];
      if (!cc) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Invoice not found.' }); }
      const left = round2(Number(cc.amount) - Number(cc.paid));
      if (amount > left + 0.001) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Only Rs. ' + left + ' is owed on this invoice.' }); }
      await client.query('UPDATE credit_customers SET paid = COALESCE(paid,0) + $1 WHERE id = $2', [amount, id]);
      await client.query('INSERT INTO customer_payments (credit_id, customer_id, amount, method, paid_at, note, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [id, cc.customer_id, amount, String(b.method || 'cash').slice(0, 30), paidAt, b.note ? String(b.note).slice(0, 200) : null, (req.session && req.session.user && req.session.user.username) || null]);
      await client.query('COMMIT');
      res.status(201).json({ ok: true, left: round2(left - amount) });
    } catch (e) { try { await client.query('ROLLBACK'); } catch (_) {} res.status(500).json({ error: 'Not saved. Try again.' }); } finally { client.release(); }
  });

  return router;
}
module.exports = createCustomer360Router;
