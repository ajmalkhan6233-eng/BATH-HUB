'use strict';
// BLOCK: edit-search (AJ 24 Nov 2026). One search box for the Edit menu: type a bill number, GRN number, vendor bill number, cheque number,
// credit / return note, customer or vendor name. Read-only: it only FINDS; the menu opens the right screen where the real edit lives.
//   GET /api/edit-search?q=...  ->  { results:[{ type, label, ref, text, amount, date, id?, vendor? }] }   (owner/admin only)
const express = require('express');
const pool = require('../utils/pool');
const router = express.Router();
const roleOf = (req) => String((req.session && req.session.user && req.session.user.role) || '').toLowerCase();
const day = (d) => (d ? new Date(new Date(d).getTime() + 5.5 * 3600e3).toISOString().slice(0, 10) : '');
const run = async (sql, p) => { try { return (await pool.query(sql, p)).rows; } catch (e) { return []; } };

router.get('/edit-search', async (req, res) => {
  if (!['admin', 'owner'].includes(roleOf(req))) return res.status(403).json({ error: 'Only the owner or admin can use Edit' });
  const q = String(req.query.q || '').trim().slice(0, 60);
  if (q.length < 2) return res.json({ results: [] });
  const like = '%' + q.replace(/[%_]/g, ' ') + '%', out = [];
  (await run(`SELECT id, bill_number, customer_name, total, created_at FROM pos_bills WHERE bill_number ILIKE $1 OR customer_name ILIKE $1 OR customer_phone ILIKE $1 ORDER BY id DESC LIMIT 8`, [like]))
    .forEach((r) => out.push({ type: 'bill', label: 'Sales bill', ref: r.bill_number, id: r.id, text: r.customer_name || 'Walk-in', amount: Number(r.total), date: day(r.created_at) }));
  (await run(`SELECT grn_number, MAX(supplier_name) AS v, SUM(total_amount) AS t, MIN(grn_date) AS d FROM grn_records WHERE grn_number ILIKE $1 OR supplier_name ILIKE $1 GROUP BY grn_number ORDER BY MIN(grn_date) DESC LIMIT 8`, [like]))
    .forEach((r) => out.push({ type: 'grn', label: 'GRN', ref: r.grn_number, text: r.v, amount: Number(r.t), date: day(r.d), vendor: r.v }));
  (await run(`SELECT bill_no, vendor_name, total, bill_date FROM vendor_bills WHERE voided = FALSE AND (bill_no ILIKE $1 OR vendor_name ILIKE $1) ORDER BY bill_date DESC LIMIT 8`, [like]))
    .forEach((r) => out.push({ type: 'vendor_bill', label: 'Vendor bill', ref: r.bill_no, text: r.vendor_name, amount: Number(r.total), date: day(r.bill_date), vendor: r.vendor_name }));
  (await run(`SELECT c.cheque_no, c.amount, c.cheque_date, c.status, b.vendor_name FROM vendor_bill_cheques c JOIN vendor_bills b ON b.id = c.bill_id WHERE c.cheque_no ILIKE $1 ORDER BY c.cheque_date DESC LIMIT 8`, [like]))
    .forEach((r) => out.push({ type: 'cheque', label: 'Cheque (' + String(r.status).toLowerCase() + ')', ref: r.cheque_no, text: r.vendor_name, amount: Number(r.amount), date: day(r.cheque_date), vendor: r.vendor_name }));
  (await run(`SELECT cheque_no, payee, amount, due_date, status FROM cheque_register WHERE cheque_no ILIKE $1 OR payee ILIKE $1 ORDER BY due_date DESC LIMIT 8`, [like]))
    .forEach((r) => out.push({ type: 'cheque_reg', label: 'Cheque register (' + r.status + ')', ref: r.cheque_no || '-', text: r.payee, amount: Number(r.amount), date: String(r.due_date instanceof Date ? day(r.due_date) : r.due_date).slice(0, 10) }));
  (await run(`SELECT n.note_no, n.amount, n.note_date, n.reason, b.vendor_name, b.bill_no FROM vendor_credit_notes n JOIN vendor_bills b ON b.id = n.bill_id WHERE n.note_no ILIKE $1 OR n.reason ILIKE $1 OR b.vendor_name ILIKE $1 ORDER BY n.id DESC LIMIT 8`, [like]))
    .forEach((r) => out.push({ type: 'note', label: /^RET-/.test(r.note_no) ? 'Return note' : 'Credit note', ref: r.note_no, text: r.vendor_name + ' · bill ' + r.bill_no, amount: Number(r.amount), date: day(r.note_date), vendor: r.vendor_name }));
  res.json({ results: out.slice(0, 40) });
});
module.exports = router;
