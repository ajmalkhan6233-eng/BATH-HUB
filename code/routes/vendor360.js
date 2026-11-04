'use strict';
// Vendor 360: one place to see a vendor. READ-ONLY. Owner or admin only. Writes nothing.
// Money maths comes from utils/vendorLedger.js (same as the Vendor ledger page), so the two screens always agree.
// Mounted at /api/vendor360 in server.js.
const express = require('express');
const { billStatus } = require('../utils/vendorLedger');
const { round2, withRunningBalance, totalsOf } = require('../utils/vendor360');

function createVendor360Router({ pool, requireAuth } = {}) {
  const router = express.Router();
  const roleOf = req => (req.session && req.session.user && req.session.user.role) || 'staff';
  const ownerOnly = (req, res, next) => (['admin', 'owner'].includes(roleOf(req)) ? next() : res.status(403).json({ error: 'Owner only' }));
  if (requireAuth) router.use(requireAuth);
  router.use(ownerOnly);

  // The tables are made by scripts/migrate_vendor_ledger.js. Before that, answer "nothing yet" instead of an error.
  const noTable = e => e && (e.code === '42P01' || /does not exist/i.test(e.message || ''));
  const fail = (res, e) => (noTable(e) ? res.json({ empty: true, vendors: [], rows: [] }) : res.status(500).json({ error: 'Could not load vendor data' }));

  // Loads every bill of one vendor (or all vendors) with its cheques, payments and credit notes, then uses billStatus().
  async function loadBills(vendor) {
    const where = vendor ? 'AND vb.vendor_name = $1' : '';
    const args = vendor ? [vendor] : [];
    const bills = (await pool.query(`SELECT vb.id, vb.vendor_name, vb.bill_no, vb.bill_date, vb.due_date, vb.total, vb.grn_id, vb.notes, vb.created_at
      FROM vendor_bills vb WHERE vb.voided = FALSE ${where} ORDER BY vb.bill_date DESC, vb.id DESC`, args)).rows;
    if (!bills.length) return [];
    const ids = bills.map(b => b.id);
    const [ch, pa, cr] = await Promise.all([
      pool.query('SELECT * FROM vendor_bill_cheques WHERE bill_id = ANY($1::int[]) ORDER BY cheque_date, id', [ids]),
      pool.query('SELECT * FROM vendor_payments WHERE bill_id = ANY($1::int[]) ORDER BY paid_at, id', [ids]),
      pool.query('SELECT * FROM vendor_credit_notes WHERE bill_id = ANY($1::int[]) ORDER BY note_date, id', [ids]),
    ]);
    const by = (rows, id) => rows.filter(r => r.bill_id === id);
    return bills.map(b => {
      const cheques = by(ch.rows, b.id), payments = by(pa.rows, b.id), credits = by(cr.rows, b.id);
      return { bill: b, cheques, payments, credits, status: billStatus(b, cheques, payments, credits) };
    });
  }

  const today = () => new Date().toISOString().slice(0, 10);

  router.get('/list', async (req, res) => {
    try {
      const all = await loadBills(null);
      const map = new Map();
      for (const x of all) {
        const v = map.get(x.bill.vendor_name) || { vendor_name: x.bill.vendor_name, total_bills: 0, total_billed: 0, total_paid: 0, outstanding_balance: 0, cheques_pending: 0, overdue: 0, last_bill_date: null, has_bounced: false };
        v.total_bills += 1;
        v.total_billed = round2(v.total_billed + x.status.total);
        v.total_paid = round2(v.total_paid + x.status.cleared + x.status.paid + x.status.credited);
        v.outstanding_balance = round2(v.outstanding_balance + x.status.outstanding);
        v.cheques_pending = round2(v.cheques_pending + x.status.covered);
        if (x.status.outstanding > 0 && x.bill.due_date && String(x.bill.due_date).slice(0, 10) < today()) v.overdue = round2(v.overdue + x.status.outstanding);
        if (!v.last_bill_date || String(x.bill.bill_date) > String(v.last_bill_date)) v.last_bill_date = x.bill.bill_date;
        if (x.status.hasBounced) v.has_bounced = true;
        map.set(x.bill.vendor_name, v);
      }
      const vendors = [...map.values()].sort((a, b) => b.outstanding_balance - a.outstanding_balance || a.vendor_name.localeCompare(b.vendor_name));
      res.json({ vendors });
    } catch (e) { fail(res, e); }
  });

  router.get('/:vendor/bills', async (req, res) => {
    try {
      const all = await loadBills(req.params.vendor);
      res.json({ vendor: req.params.vendor, bills: all.map(x => Object.assign({}, x.bill, x.status, { overdue: x.status.outstanding > 0 && !!x.bill.due_date && String(x.bill.due_date).slice(0, 10) < today(), cheques: x.cheques, payments: x.payments })) });
    } catch (e) { fail(res, e); }
  });

  // Statement: bills are money owed (debit); cleared cheques, payments and credit notes are money off (credit). Oldest first with a running balance.
  router.get('/:vendor/statement', async (req, res) => {
    try {
      const all = await loadBills(req.params.vendor);
      const rows = [];
      for (const x of all) {
        const b = x.bill, ref = b.bill_no || ('#' + b.id);
        rows.push({ id: 'b' + b.id, tx_date: b.bill_date, created_at: b.created_at, tx_type: 'BILL', reference: ref, description: 'Bill ' + ref, debit: Number(b.total), credit: 0 });
        x.payments.forEach(p => rows.push({ id: 'p' + p.id, tx_date: p.paid_at, created_at: p.created_at, tx_type: 'PAYMENT', reference: p.method || 'payment', description: 'Payment (' + (p.method || 'cash') + ')' + (p.note ? ' - ' + p.note : '') + ' for ' + ref, debit: 0, credit: Number(p.amount) }));
        x.cheques.filter(c => c.status === 'CLEARED').forEach(c => rows.push({ id: 'c' + c.id, tx_date: c.cleared_at || c.due_date, created_at: c.created_at, tx_type: 'CHEQUE', reference: c.cheque_no || 'cheque', description: 'Cheque ' + (c.cheque_no || '') + ' cleared' + (c.bank ? ' (' + c.bank + ')' : '') + ' for ' + ref, debit: 0, credit: Number(c.amount) }));
        x.credits.forEach(n => rows.push({ id: 'n' + n.id, tx_date: n.note_date, created_at: n.created_at, tx_type: 'CREDIT_NOTE', reference: n.note_no || 'credit note', description: 'Credit note ' + (n.note_no || '') + (n.reason ? ' - ' + n.reason : '') + ' for ' + ref, debit: 0, credit: Number(n.amount) }));
      }
      const ledger = withRunningBalance(rows);
      const pending = [];
      all.forEach(x => x.cheques.filter(c => c.status === 'ISSUED').forEach(c => pending.push({ cheque_no: c.cheque_no, bank: c.bank, amount: Number(c.amount), due_date: c.due_date, bill_no: x.bill.bill_no })));
      res.json({ vendor: req.params.vendor, rows: ledger.slice().reverse(), totals: totalsOf(ledger), pending_cheques: pending });
    } catch (e) { fail(res, e); }
  });

  // GRN (goods received) from this vendor: matches the name typed on the GRN, or the supplier record with the same name.
  router.get('/:vendor/grns', async (req, res) => {
    try {
      const r = await pool.query(`SELECT g.grn_number, MAX(g.grn_date) AS grn_date, COUNT(*)::int AS lines, COALESCE(SUM(g.total_amount),0) AS total
        FROM grn_records g WHERE LOWER(g.supplier_name) = LOWER($1) OR g.supplier_id IN (SELECT id FROM suppliers WHERE LOWER(name) = LOWER($1))
        GROUP BY g.grn_number ORDER BY MAX(g.grn_date) DESC NULLS LAST, g.grn_number DESC LIMIT 200`, [req.params.vendor]);
      res.json({ vendor: req.params.vendor, grns: r.rows });
    } catch (e) { fail(res, e); }
  });

  return router;
}

module.exports = createVendor360Router;
