'use strict';
// Due board: vendor bills and cheques by due date. READ-ONLY (owner/admin only). Writes nothing.
const express = require('express');
const pool = require('../utils/pool');
const router = express.Router();
const roleOf = req => (req.session && req.session.user && req.session.user.role) || 'staff';
const ownerOnly = (req, res, next) => (['admin', 'owner'].includes(roleOf(req)) ? next() : res.status(403).json({ error: 'Owner only' }));
const q = (sql, p) => pool.query(sql, p).then(r => r.rows);
const d = v => (v ? (v instanceof Date ? `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}` : String(v).slice(0, 10)) : null);

router.get('/due-board', ownerOnly, async (_req, res) => {
  const out = { bills: [], cheques: [] };
  try {
    out.bills = (await q(`SELECT b.id, b.vendor_name, b.bill_no, b.due_date, b.total - COALESCE(p.paid,0) - COALESCE(n.cn,0) AS owed FROM vendor_bills b
      LEFT JOIN (SELECT bill_id, SUM(amount) AS paid FROM vendor_payments GROUP BY bill_id) p ON p.bill_id = b.id
      LEFT JOIN (SELECT bill_id, SUM(amount) AS cn FROM vendor_credit_notes GROUP BY bill_id) n ON n.bill_id = b.id
      WHERE b.voided = false AND b.total - COALESCE(p.paid,0) - COALESCE(n.cn,0) > 0 ORDER BY b.due_date NULLS LAST, b.id LIMIT 200`))
      .map(r => ({ id: r.id, vendor: r.vendor_name, bill_no: r.bill_no, due: d(r.due_date), amount: Number(r.owed) }));
  } catch (e) { console.error('[due_board] bills:', e.message); }
  try {
    out.cheques = (await q(`SELECT id, payee, cheque_no, amount, due_date, status FROM cheque_register WHERE status IN ('pending','held') ORDER BY due_date, id LIMIT 200`))
      .map(r => ({ id: r.id, payee: r.payee, cheque_no: r.cheque_no, due: d(r.due_date), amount: Number(r.amount), status: r.status }));
  } catch (e) { console.error('[due_board] cheques:', e.message); }
  out.today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' });
  res.json(out);
});

module.exports = router;
