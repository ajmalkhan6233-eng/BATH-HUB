'use strict';
/**
 * Vendor ledger routes. Mount with ONE line in server.js (after the session middleware):
 *   app.use('/api/vendor-ledger', require('./routes/vendor_ledger')({ pool, requireAuth: <the same middleware cheque_register.js uses> }));
 * ADAPT: copy how routes/cheque_register.js gets `pool` and the auth middleware. Nothing else needs changing.
 * Inputs are validated, errors are clean 400s, no stack traces leave the server.
 */
const express = require('express');
const L = require('../utils/vendorLedger');

const isNum = (v) => v !== '' && v !== null && v !== undefined && Number.isFinite(Number(v));
const bad = (res, msg) => res.status(400).json({ error: msg });
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' }); // YYYY-MM-DD
const STATUSES = ['ISSUED', 'CLEARED', 'BOUNCED', 'CANCELLED'];

module.exports = function createVendorLedgerRouter({ pool, requireAuth, branchOf = () => 1, userOf = (req) => (req.session && req.session.user && req.session.user.username) || null }) {
  const r = express.Router();
  r.use(express.json({ limit: '100kb' }));
  if (requireAuth) r.use(requireAuth);
  const wrap = (fn) => (req, res) => fn(req, res).catch((e) => { console.error('[vendor-ledger]', e.message); res.status(500).json({ error: 'Something went wrong' }); });

  // node-postgres returns NUMERIC as text and DATE as a JS Date: normalise both here, once.
  const isoDate = (v) => (v instanceof Date ? `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}` : v == null ? v : String(v).slice(0, 10));
  const fix = (row, dates = [], nums = []) => { const o = { ...row }; dates.forEach((k) => { if (k in o) o[k] = isoDate(o[k]); }); nums.forEach((k) => { if (k in o) o[k] = Number(o[k]); }); return o; };

  async function loadRows(branch, { vendor, includeVoided = false } = {}) {
    const params = [branch]; if (vendor) params.push(vendor);
    const bills = (await pool.query(`SELECT * FROM vendor_bills WHERE branch_id=$1 ${includeVoided ? '' : 'AND voided=FALSE'} ${vendor ? 'AND vendor_name=$2' : ''} ORDER BY bill_date DESC, id DESC`, params)).rows
      .map((b) => fix(b, ['bill_date', 'due_date'], ['total']));
    if (!bills.length) return [];
    const ph = bills.map((_, i) => `$${i + 1}`).join(',');
    const ids = bills.map((b) => b.id);
    const q = (t) => pool.query(`SELECT * FROM ${t} WHERE bill_id IN (${ph})`, ids).then((x) => x.rows);
    const [ch, pay, cn] = await Promise.all([q('vendor_bill_cheques'), q('vendor_payments'), q('vendor_credit_notes')]);
    const by = (rows, id) => rows.filter((x) => Number(x.bill_id) === id);
    return bills.map((b) => ({
      bill: b,
      cheques: by(ch, b.id).map((c) => fix(c, ['cheque_date', 'due_date'], ['amount'])),
      payments: by(pay, b.id).map((p) => fix(p, ['paid_at'], ['amount'])),
      credits: by(cn, b.id).map((n) => fix(n, ['note_date'], ['amount'])),
    }));
  }
  const allCheques = (rows) => rows.flatMap((x) => x.cheques.map((c) => ({ ...c, vendor_name: x.bill.vendor_name })));

  r.get('/summary', wrap(async (req, res) => {
    const rows = await loadRows(branchOf(req));
    res.json(L.summarise(rows));
  }));

  r.get('/bills', wrap(async (req, res) => {
    const rows = await loadRows(branchOf(req), { vendor: req.query.vendor });
    let out = rows.map((x) => ({ ...x.bill, ...L.billStatus(x.bill, x.cheques, x.payments, x.credits), cheques: x.cheques }));
    if (req.query.state) out = out.filter((b) => b.state === String(req.query.state));
    res.json(out);
  }));

  r.post('/bills', wrap(async (req, res) => {
    const b = req.body || {};
    if (!b.vendor_name || !String(b.vendor_name).trim()) return bad(res, 'vendor_name is required');
    if (!isNum(b.total) || Number(b.total) <= 0) return bad(res, 'total must be a positive number');
    if (!L.isIso(b.bill_date)) return bad(res, 'bill_date must be YYYY-MM-DD');
    if (b.due_date && !L.isIso(b.due_date)) return bad(res, 'due_date must be YYYY-MM-DD');
    const { rows } = await pool.query(
      `INSERT INTO vendor_bills (branch_id, vendor_name, bill_no, bill_date, due_date, total, grn_id, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [branchOf(req), String(b.vendor_name).trim(), b.bill_no || null, b.bill_date, b.due_date || null, Number(b.total), b.grn_id || null, b.notes || null, userOf(req)]);
    res.status(201).json(rows[0]);
  }));

  r.post('/bills/:id/cheques', wrap(async (req, res) => {
    const id = Number(req.params.id); const c = req.body || {};
    if (!Number.isInteger(id)) return bad(res, 'bad bill id');
    if (!isNum(c.amount) || Number(c.amount) <= 0) return bad(res, 'amount must be a positive number');
    if (!L.isIso(c.cheque_date)) return bad(res, 'cheque_date must be YYYY-MM-DD');
    const bill = (await pool.query('SELECT * FROM vendor_bills WHERE id=$1 AND branch_id=$2 AND voided=FALSE', [id, branchOf(req)])).rows[0];
    if (!bill) return res.status(404).json({ error: 'bill not found' });
    const due = c.due_date && L.isIso(c.due_date) ? c.due_date : L.nextClearingDate(c.cheque_date, { sameBank: !!c.same_bank, lagWorkingDays: c.lag_days === undefined ? 1 : Number(c.lag_days) });
    const warnings = L.validateCheque({ payee: c.payee || bill.vendor_name, amount: c.amount, amountWords: c.amount_words, date: c.cheque_date }, { today: today() });
    const { rows } = await pool.query(
      `INSERT INTO vendor_bill_cheques (branch_id, bill_id, cheque_no, bank, payee, amount, cheque_date, due_date, same_bank, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [branchOf(req), id, c.cheque_no || null, c.bank || null, c.payee || bill.vendor_name, Number(c.amount), c.cheque_date, due, !!c.same_bank, userOf(req)]);
    res.status(201).json({ cheque: rows[0], warnings, words: L.amountInWords(c.amount) });
  }));

  async function setStatus(req, res, status) {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || !STATUSES.includes(status)) return bad(res, 'bad request');
    const cur = (await pool.query('SELECT * FROM vendor_bill_cheques WHERE id=$1 AND branch_id=$2', [id, branchOf(req)])).rows[0];
    if (!cur) return res.status(404).json({ error: 'cheque not found' });
    if (cur.status === status) return res.json(cur); // idempotent: clearing twice changes nothing
    if (cur.status === 'CLEARED' && status !== 'CLEARED') return bad(res, 'a cleared cheque cannot be changed');
    const { rows } = await pool.query(`UPDATE vendor_bill_cheques SET status=$1, cleared_at=${status === 'CLEARED' ? 'NOW()' : 'NULL'} WHERE id=$2 RETURNING *`, [status, id]);
    res.json(rows[0]);
  }
  r.post('/cheques/:id/clear', wrap((req, res) => setStatus(req, res, 'CLEARED')));
  r.post('/cheques/:id/bounce', wrap((req, res) => setStatus(req, res, 'BOUNCED')));
  r.post('/cheques/:id/cancel', wrap((req, res) => setStatus(req, res, 'CANCELLED')));

  r.post('/bills/:id/payments', wrap(async (req, res) => {
    const id = Number(req.params.id); const p = req.body || {};
    if (!Number.isInteger(id)) return bad(res, 'bad bill id');
    if (!isNum(p.amount) || Number(p.amount) <= 0) return bad(res, 'amount must be a positive number');
    const paidAt = p.paid_at || today(); if (!L.isIso(paidAt)) return bad(res, 'paid_at must be YYYY-MM-DD');
    const bill = (await pool.query('SELECT id FROM vendor_bills WHERE id=$1 AND branch_id=$2', [id, branchOf(req)])).rows[0];
    if (!bill) return res.status(404).json({ error: 'bill not found' });
    const { rows } = await pool.query('INSERT INTO vendor_payments (branch_id, bill_id, amount, method, paid_at, note, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *', [branchOf(req), id, Number(p.amount), p.method || 'CASH', paidAt, p.note || null, userOf(req)]);
    res.status(201).json(rows[0]);
  }));

  r.post('/bills/:id/credit-notes', wrap(async (req, res) => {
    const id = Number(req.params.id); const n = req.body || {};
    if (!Number.isInteger(id)) return bad(res, 'bad bill id');
    if (!isNum(n.amount) || Number(n.amount) <= 0) return bad(res, 'amount must be a positive number');
    const d = n.note_date || today(); if (!L.isIso(d)) return bad(res, 'note_date must be YYYY-MM-DD');
    const bill = (await pool.query('SELECT id FROM vendor_bills WHERE id=$1 AND branch_id=$2', [id, branchOf(req)])).rows[0];
    if (!bill) return res.status(404).json({ error: 'bill not found' });
    const { rows } = await pool.query('INSERT INTO vendor_credit_notes (branch_id, bill_id, note_no, amount, note_date, reason, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *', [branchOf(req), id, n.note_no || null, Number(n.amount), d, n.reason || null, userOf(req)]);
    res.status(201).json(rows[0]);
  }));

  r.post('/bills/:id/void', wrap(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return bad(res, 'bad bill id');
    const { rows } = await pool.query('UPDATE vendor_bills SET voided=TRUE WHERE id=$1 AND branch_id=$2 RETURNING *', [id, branchOf(req)]);
    if (!rows[0]) return res.status(404).json({ error: 'bill not found' });
    res.json(rows[0]);
  }));

  r.get('/calendar', wrap(async (req, res) => {
    const rows = await loadRows(branchOf(req));
    const bulk = isNum(req.query.bulk) ? Number(req.query.bulk) : 300000;
    res.json(L.chequeCalendar(allCheques(rows), today(), { bulkThreshold: bulk }));
  }));

  r.get('/cash-gap', wrap(async (req, res) => {
    const rows = await loadRows(branchOf(req));
    const days = isNum(req.query.days) ? Math.min(30, Math.max(1, Number(req.query.days))) : 2;
    res.json(L.cashGap(allCheques(rows), { cashOnHand: Number(req.query.cash || 0), expectedReceipts: Number(req.query.receipts || 0) }, today(), days));
  }));

  r.get('/checks', wrap(async (req, res) => {
    const rows = await loadRows(branchOf(req));
    const ch = allCheques(rows);
    res.json({ duplicates: L.findDuplicates(ch), warnings: ch.filter((c) => c.status === 'ISSUED').map((c) => ({ id: c.id, flags: L.validateCheque({ payee: c.payee, amount: c.amount, date: String(c.cheque_date).slice(0, 10) }, { today: today() }) })).filter((x) => x.flags.length) });
  }));

  r.get('/export.csv', wrap(async (req, res) => {
    const rows = await loadRows(branchOf(req));
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [['vendor', 'bill_no', 'bill_date', 'total', 'cleared', 'paid', 'credited', 'outstanding', 'covered_by_cheque', 'uncovered', 'state'].join(',')];
    for (const x of rows) { const s = L.billStatus(x.bill, x.cheques, x.payments, x.credits); lines.push([x.bill.vendor_name, x.bill.bill_no, String(x.bill.bill_date).slice(0, 10), s.total, s.cleared, s.paid, s.credited, s.outstanding, s.covered, s.uncovered, s.state].map(esc).join(',')); }
    res.set('Content-Type', 'text/csv; charset=utf-8').set('Content-Disposition', 'attachment; filename="vendor-ledger.csv"').send(lines.join('\n'));
  }));

  return r;
};
