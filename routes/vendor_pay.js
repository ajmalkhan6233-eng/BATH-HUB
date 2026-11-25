'use strict';
// "Add Payment to Supplier" -> Record Payment (AJ 25 Nov). POST /api/vendor-pay, owner only, one transaction (all or nothing).
// The amount goes to the supplier's OLDEST bills first. Never more than what is not yet paid and not yet covered by a waiting cheque.
// Cash / online -> vendor_payments. Cheque -> bill cheque(s) ISSUED + ONE line in the cheque register (so both lists stay equal).
const express = require('express');
const pool = require('../utils/pool');
const L = require('../utils/vendorLedger');
const audit = require('../utils/moneyAudit');
const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const METHODS = { cheque: 'CHEQUE', cash: 'CASH', 'online transfer': 'ONLINE' };

// bills: [{ id, bill_no, free }] oldest first -> [{ id, bill_no, amount }] ; null when the amount is more than the bills can take
function allocate(bills, amount) {
  let left = r2(amount); const out = [];
  for (const b of bills) {
    if (left <= 0) break;
    const take = r2(Math.min(left, Math.max(0, b.free)));
    if (take > 0) { out.push({ id: b.id, bill_no: b.bill_no, amount: take }); left = r2(left - take); }
  }
  return left > 0.005 ? null : out;
}
const stop = (code, msg) => Object.assign(new Error(msg), { http: code });

// client is inside a transaction; the caller commits or rolls back
async function record(client, input, who) {
  const method = METHODS[String(input.method || '').toLowerCase()]; if (!method) throw stop(400, 'Choose Cheque, Cash or Online Transfer');
  const amount = r2(input.amount); if (!(amount > 0)) throw stop(400, 'Type the amount');
  const date = String(input.date || ''); if (!L.isIso(date)) throw stop(400, 'Choose the date');
  const ref = String(input.ref || '').trim().slice(0, 60);
  const name = String(input.vendor || '').trim(); if (!name) throw stop(400, 'Choose the supplier');
  if (method === 'CHEQUE' && !ref) throw stop(400, 'Type the cheque number');
  await client.query('SELECT pg_advisory_xact_lock(2511202601)');
  const bills = (await client.query('SELECT id, bill_no, vendor_name, total, due_date, bill_date FROM vendor_bills WHERE LOWER(TRIM(vendor_name)) = LOWER($1) AND voided = FALSE ORDER BY COALESCE(due_date, bill_date), bill_date, id FOR UPDATE', [name])).rows;
  if (!bills.length) throw stop(404, 'No bills are saved for this supplier');
  for (const b of bills) {
    const ch = (await client.query('SELECT amount, status FROM vendor_bill_cheques WHERE bill_id = $1', [b.id])).rows;
    const pay = (await client.query('SELECT amount FROM vendor_payments WHERE bill_id = $1', [b.id])).rows;
    const cn = (await client.query('SELECT amount FROM vendor_credit_notes WHERE bill_id = $1', [b.id])).rows;
    b.free = L.billStatus(b, ch, pay, cn).uncovered;
  }
  const free = r2(bills.reduce((a, b) => a + b.free, 0));
  // 25 Nov (AJ): paying more than owed (rounding, or a bigger cheque and change back) is a WARNING, never a block
  const over = r2(Math.max(0, amount - free));
  if (over > 0 && input.confirm_over !== true) throw Object.assign(stop(409, 'You owe this supplier Rs ' + free.toFixed(2) + ' (not yet paid or covered). You are paying Rs ' + amount.toFixed(2) + ', which is Rs ' + over.toFixed(2) + ' MORE.'), { code: 'over' });
  const parts = allocate(bills, r2(amount - over));
  if (over > 0) { const last = parts[parts.length - 1]; if (last) last.amount = r2(last.amount + over); else { const b = bills[bills.length - 1]; parts.push({ id: b.id, bill_no: b.bill_no, amount: over }); } }
  const vendor = bills[0].vendor_name;
  if (method === 'CHEQUE') {
    const dup = await client.query("SELECT 1 FROM vendor_bill_cheques WHERE cheque_no = $1 AND status <> 'CANCELLED' UNION ALL SELECT 1 FROM cheque_register WHERE cheque_no = $1", [ref]);
    if (dup.rowCount) throw stop(409, 'Cheque number ' + ref + ' is already saved. It was not saved twice.');
    const due = L.nextClearingDate(date, { sameBank: false, lagWorkingDays: 1 });
    for (const p of parts) await client.query('INSERT INTO vendor_bill_cheques (branch_id, bill_id, cheque_no, payee, amount, cheque_date, due_date, created_by) VALUES (1,$1,$2,$3,$4,$5,$6,$7)', [p.id, ref, vendor, p.amount, date, due, who]);
    await client.query("INSERT INTO cheque_register (cheque_no, payee, amount, due_date, status, notes) VALUES ($1,$2,$3,$4,'pending',$5)", [ref, vendor, amount, due, 'Supplier payment: bill ' + parts.map((p) => p.bill_no).join(', ')]);
  } else {
    const same = await client.query("SELECT 1 FROM vendor_payments v JOIN vendor_bills b ON b.id = v.bill_id WHERE LOWER(TRIM(b.vendor_name)) = LOWER($1) AND v.paid_at = $2 AND v.method = $3 AND v.created_at > NOW() - INTERVAL '2 minutes' GROUP BY v.created_at HAVING SUM(v.amount) = $4", [name, date, method, amount]);
    if (same.rowCount && input.confirm_same !== true) throw Object.assign(stop(409, 'The same payment (same supplier, amount and date) was saved a moment ago.'), { code: 'same' });
    for (const p of parts) await client.query('INSERT INTO vendor_payments (branch_id, bill_id, amount, method, paid_at, note, created_by) VALUES (1,$1,$2,$3,$4,$5,$6)', [p.id, p.amount, method, date, ref || null, who]);
  }
  return { vendor, method, amount, parts, over, left_to_pay: r2(Math.max(0, free - amount)) };
}

const router = express.Router();
router.post('/', express.json(), async (req, res) => {
  if (!audit.isOwner(req)) return res.status(403).json({ error: 'Only the owner can record a supplier payment' });
  const who = (req.session && req.session.user && (req.session.user.username || req.session.user.name)) || 'owner';
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const out = await record(client, req.body || {}, who);
    await client.query('COMMIT');
    await audit.log(pool, { who, action: 'vendor_payment', table: out.method === 'CHEQUE' ? 'vendor_bill_cheques' : 'vendor_payments', id: out.parts[0].id, oldValue: null, newValue: out.method + ' ' + out.amount + ' ' + out.vendor, reason: null }).catch((e) => console.error('[vendor-pay] audit:', e.message));
    res.status(201).json(out);
  } catch (e) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    if (!e.http) console.error('[vendor-pay]', e.message);
    res.status(e.http || 500).json({ error: e.http ? e.message : 'Could not save the payment. Nothing was saved.', code: e.http ? e.code : undefined });
  } finally { if (client) client.release(); }
});

module.exports = router;
module.exports.allocate = allocate;
module.exports.record = record;
