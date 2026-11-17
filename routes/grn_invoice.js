'use strict';
// GRN invoice page + edit (GRN module only). Owner/admin only. Mounted at /api/grn-invoice in server.js.
//   GET  /:vendor/:grn            invoice: header, lines, discount, other charges, total, paid, difference, reason, audit
//   PUT  /:vendor/:grn            edit qty / cost / discount / other charges / date (stock, payable and ledger follow; audit line per change)
//   PUT  /:vendor/:grn/reason     save the reason for a difference (never blocks)
// Ledger = vendor_bills (statement is built from it), so changing vendor_bills.total updates payable and ledger together.
const express = require('express');
const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const num = (v) => (v === '' || v === null || v === undefined ? 0 : Number(v));
const REASONS = ['No change given', 'Discount given', 'Goods returned', 'Short delivered', 'Other'];
const NORM = (c) => `regexp_replace(LOWER(${c}),'[^a-z0-9]','','g')`;
const KEY = (c) => `(CASE WHEN ${NORM(c)} ~ '^[0-9]+$' THEN COALESCE(NULLIF(ltrim(${NORM(c)},'0'),''),'0') ELSE ${NORM(c)} END)`;
const keyOf = (s) => { const n = String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); return /^[0-9]+$/.test(n) ? (n.replace(/^0+/, '') || '0') : n; };
const bad = (m, s) => { const e = new Error(m); e.status = s || 400; return e; };
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !isNaN(Date.parse(s));

async function ensureTables(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS grn_invoice_meta (bill_id INT PRIMARY KEY, discount_pct NUMERIC(7,3) NOT NULL DEFAULT 0, discount_amt NUMERIC(14,2) NOT NULL DEFAULT 0, other_charges NUMERIC(14,2) NOT NULL DEFAULT 0, other_note TEXT, updated_at TIMESTAMPTZ DEFAULT now())`);
  await db.query(`CREATE TABLE IF NOT EXISTS grn_audit (id SERIAL PRIMARY KEY, bill_id INT NOT NULL, field TEXT NOT NULL, old_value TEXT, new_value TEXT, changed_by TEXT, changed_at TIMESTAMPTZ DEFAULT now())`);
  await db.query(`CREATE TABLE IF NOT EXISTS grn_diff_reason (bill_id INT PRIMARY KEY, reason TEXT NOT NULL, note TEXT, difference NUMERIC(14,2), saved_by TEXT, saved_at TIMESTAMPTZ DEFAULT now())`);
}

// ---- pure maths (tested alone) ----
function totals(lines, discount_pct, discount_amt, other) {
  const subtotal = r2(lines.reduce((s, l) => s + r2(Number(l.qty) * Number(l.cost)), 0));
  const pct = num(discount_pct), amt = num(discount_amt);
  const discount = pct > 0 ? r2(subtotal * pct / 100) : r2(amt);
  const other_charges = r2(num(other));
  return { subtotal, discount, other_charges, total: r2(subtotal - discount + other_charges) };
}

async function findBill(db, vendor, grn, lock) {
  const b = await db.query(`SELECT id, vendor_name, bill_no, to_char(bill_date,'YYYY-MM-DD') AS bill_date, to_char(due_date,'YYYY-MM-DD') AS due_date, total, notes FROM vendor_bills
    WHERE voided=FALSE AND LOWER(vendor_name)=LOWER($1) AND ${KEY('bill_no')}=$2 ORDER BY id DESC LIMIT 1 ${lock ? 'FOR UPDATE' : ''}`, [vendor, keyOf(grn)]);
  return b.rows[0] || null;
}
async function findLines(db, vendor, grn, lock) {
  return (await db.query(`SELECT id, item_description, quantity, unit_cost, total_amount, to_char(grn_date,'YYYY-MM-DD') AS grn_date FROM grn_records
    WHERE (LOWER(supplier_name)=LOWER($1) OR supplier_id IN (SELECT id FROM suppliers WHERE LOWER(name)=LOWER($1))) AND ${KEY('grn_number')}=$2 ORDER BY id ${lock ? 'FOR UPDATE' : ''}`, [vendor, keyOf(grn)])).rows;
}

async function loadInvoice(db, vendor, grn) {
  await ensureTables(db);
  const lines = await findLines(db, vendor, grn);
  if (!lines.length) throw bad('GRN not found', 404);
  const bill = await findBill(db, vendor, grn);
  const meta = bill ? (await db.query('SELECT * FROM grn_invoice_meta WHERE bill_id=$1', [bill.id])).rows[0] : null;
  const t = totals(lines.map((l) => ({ qty: l.quantity, cost: l.unit_cost })), meta && meta.discount_pct, meta && meta.discount_amt, meta && meta.other_charges);
  const out = {
    vendor, grn_number: String(grn), bill_id: bill ? bill.id : null, bill_no: bill ? bill.bill_no : String(grn),
    date: bill ? bill.bill_date : lines[0].grn_date, grn_date: lines[0].grn_date, due_date: bill ? bill.due_date : null,
    terms: bill ? ((/(\d+) credit days/.exec(bill.notes || '') || [])[1] ? (/(\d+) credit days/.exec(bill.notes)[1] + ' days credit') : 'Credit') : '-',
    lines: lines.map((l) => { const d = String(l.item_description || ''), i = d.indexOf(' - '); return { id: l.id, code: i > 0 ? d.slice(0, i) : '', name: i > 0 ? d.slice(i + 3) : d, qty: Number(l.quantity), cost: Number(l.unit_cost), amount: r2(l.quantity * l.unit_cost) }; }),
    subtotal: t.subtotal, discount_pct: meta ? Number(meta.discount_pct) : 0, discount_amt: meta ? Number(meta.discount_amt) : 0, discount: t.discount,
    other_charges: t.other_charges, other_note: (meta && meta.other_note) || '', total: t.total, bill_total: bill ? Number(bill.total) : t.total,
    paid: null, cheques: [], cash: 0, cheques_total: 0, difference: null, reason: null, audit: [], reasons: REASONS,
  };
  if (bill) {
    const cash = Number((await db.query('SELECT COALESCE(SUM(amount),0) s FROM vendor_payments WHERE bill_id=$1', [bill.id])).rows[0].s);
    const ch = (await db.query(`SELECT cheque_no, bank, amount, to_char(cheque_date,'YYYY-MM-DD') AS cheque_date, status FROM vendor_bill_cheques WHERE bill_id=$1 AND status NOT IN ('CANCELLED','BOUNCED') ORDER BY cheque_date, id`, [bill.id])).rows;
    out.cash = r2(cash); out.cheques = ch.map((c) => ({ cheque_no: c.cheque_no, bank: c.bank, amount: Number(c.amount), cheque_date: c.cheque_date, status: c.status }));
    out.cheques_total = r2(ch.reduce((s, c) => s + Number(c.amount), 0)); out.paid = r2(out.cash + out.cheques_total);
    out.difference = r2(out.bill_total - out.paid);   // negative = we paid more than the bill
    out.reason = (await db.query('SELECT reason, note, difference, to_char(saved_at,\'YYYY-MM-DD HH24:MI\') AS saved_at FROM grn_diff_reason WHERE bill_id=$1', [bill.id])).rows[0] || null;
    out.audit = (await db.query(`SELECT field, old_value, new_value, changed_by, to_char(changed_at,'YYYY-MM-DD HH24:MI') AS at FROM grn_audit WHERE bill_id=$1 ORDER BY id DESC LIMIT 100`, [bill.id])).rows;
  }
  out.state = out.difference === null ? 'none' : out.difference === 0 ? 'green' : (out.reason ? 'green' : 'amber');
  return out;
}

// Runs inside the caller's transaction. Returns the number of changes made.
async function saveEdit(client, vendor, grn, body, who) {
  await ensureTables(client);
  await client.query('SELECT pg_advisory_xact_lock($1)', [774414]);
  const bill = await findBill(client, vendor, grn, true);
  if (!bill) throw bad('This GRN has no bill, so it cannot be edited here.', 404);
  const lines = await findLines(client, vendor, grn, true);
  const byId = new Map(lines.map((l) => [l.id, l]));
  const meta = (await client.query('SELECT * FROM grn_invoice_meta WHERE bill_id=$1', [bill.id])).rows[0] || { discount_pct: 0, discount_amt: 0, other_charges: 0, other_note: '' };
  const aud = []; const log = (field, o, n) => aud.push([bill.id, field, String(o), String(n), who || 'owner']);
  const newQty = new Map(lines.map((l) => [l.id, Number(l.quantity)])), newCost = new Map(lines.map((l) => [l.id, Number(l.unit_cost)]));
  for (const x of (body.lines || [])) {
    const l = byId.get(Number(x.id)); if (!l) throw bad('Line ' + x.id + ' is not on this GRN');
    const q = num(x.qty), c = num(x.cost);
    if (!Number.isFinite(q) || q <= 0) throw bad('Quantity must be more than 0');
    if (!Number.isFinite(c) || c < 0) throw bad('Cost must be 0 or more');
    const code = String(l.item_description || '').split(' - ')[0].trim(), name = String(l.item_description || '').split(' - ').slice(1).join(' - ');
    const q0 = Number(l.quantity), c0 = Number(l.unit_cost), label = (code || name) + ' ' + name;
    if (q === q0 && c === c0) continue;
    const p = code ? (await client.query('SELECT id, stock_level, avg_cost FROM products WHERE item_code=$1 FOR UPDATE', [code])).rows[0] : null;
    if (p) {
      const S = Number(p.stock_level || 0), A = Number(p.avg_cost || 0), S2 = S + q - q0;
      if (S2 < 0) throw bad('Stock of ' + label + ' would go below zero (some was already sold). Nothing was changed.', 409);
      const A2 = S2 > 0 ? r2(Math.max(0, (S * A - q0 * c0 + q * c)) / S2) : c;
      await client.query('UPDATE products SET stock_level=$1, avg_cost=$2 WHERE id=$3', [S2, A2, p.id]);
      try { await require('../utils/stock_ledger').recordSafe(client, { item_code: code, qty_change: q - q0, reason: 'grn_edit', ref_type: 'grn_record', ref_id: String(l.id) }); } catch (_) {}
    }
    await client.query('UPDATE grn_records SET quantity=$1, unit_cost=$2, total_amount=$3 WHERE id=$4', [q, c, r2(q * c), l.id]);
    if (q !== q0) log('qty ' + label, q0, q);
    if (c !== c0) log('cost ' + label, c0, c);
    newQty.set(l.id, q); newCost.set(l.id, c);
  }
  const pct = body.discount_pct === undefined ? Number(meta.discount_pct) : num(body.discount_pct);
  const amt = body.discount_amt === undefined ? Number(meta.discount_amt) : num(body.discount_amt);
  const oth = body.other_charges === undefined ? Number(meta.other_charges) : num(body.other_charges);
  if (pct < 0 || pct > 100 || amt < 0 || oth < 0) throw bad('Discount and other charges cannot be negative (discount at most 100%)');
  if (pct !== Number(meta.discount_pct)) log('discount %', meta.discount_pct, pct);
  if (amt !== Number(meta.discount_amt)) log('discount amount', meta.discount_amt, amt);
  if (oth !== Number(meta.other_charges)) log('other charges', meta.other_charges, oth);
  const note = body.other_note === undefined ? (meta.other_note || '') : String(body.other_note).slice(0, 200);
  await client.query(`INSERT INTO grn_invoice_meta (bill_id,discount_pct,discount_amt,other_charges,other_note) VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT (bill_id) DO UPDATE SET discount_pct=$2, discount_amt=$3, other_charges=$4, other_note=$5, updated_at=now()`, [bill.id, pct, amt, oth, note]);
  const t = totals(lines.map((l) => ({ qty: newQty.get(l.id), cost: newCost.get(l.id) })), pct, amt, oth);
  if (!(t.total > 0)) throw bad('Bill total must be more than 0');
  if (t.total !== Number(bill.total)) log('bill total (vendor payable)', bill.total, t.total);
  await client.query('UPDATE vendor_bills SET total=$1 WHERE id=$2', [t.total, bill.id]);
  if (body.date !== undefined && body.date !== null && body.date !== '') {
    if (!isDate(body.date)) throw bad('Date is not valid');
    if (body.date !== bill.bill_date) {
      const shift = Math.round((Date.parse(body.date) - Date.parse(bill.bill_date)) / 864e5);
      await client.query(`UPDATE vendor_bills SET bill_date=$1::date, due_date = CASE WHEN due_date IS NULL THEN NULL ELSE due_date + $2::int END WHERE id=$3`, [body.date, shift, bill.id]);
      log('date', bill.bill_date, body.date);
    }
    const old = lines[0] && lines[0].grn_date;
    if (lines.some((l) => l.grn_date !== body.date)) { await client.query(`UPDATE grn_records SET grn_date=$1::date WHERE id = ANY($2::int[])`, [body.date, lines.map((l) => l.id)]); if (old && old !== body.date && !aud.some((a) => a[1] === 'date')) log('GRN date', old, body.date); }
  }
  for (const a of aud) await client.query('INSERT INTO grn_audit (bill_id,field,old_value,new_value,changed_by) VALUES ($1,$2,$3,$4,$5)', a);
  return aud.length;
}

async function saveReason(client, vendor, grn, body, who) {
  await ensureTables(client);
  const bill = await findBill(client, vendor, grn, true);
  if (!bill) throw bad('No bill for this GRN', 404);
  const reason = String(body.reason || '').trim();
  if (!REASONS.includes(reason)) throw bad('Pick one of: ' + REASONS.join(', '));
  const note = String(body.note || '').trim().slice(0, 300);
  const inv = await loadInvoice(client, vendor, grn);
  await client.query(`INSERT INTO grn_diff_reason (bill_id,reason,note,difference,saved_by) VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT (bill_id) DO UPDATE SET reason=$2, note=$3, difference=$4, saved_by=$5, saved_at=now()`, [bill.id, reason, note, inv.difference, who || 'owner']);
  await client.query('INSERT INTO grn_audit (bill_id,field,old_value,new_value,changed_by) VALUES ($1,$2,$3,$4,$5)', [bill.id, 'difference reason', '', reason + (note ? ': ' + note : ''), who || 'owner']);
}

function createGrnInvoiceRouter({ pool } = {}) {
  const router = express.Router();
  const user = (req) => (req.session && req.session.user) || {};
  router.use((req, res, next) => (['admin', 'owner'].includes(user(req).role || 'staff') ? next() : res.status(403).json({ error: 'Owner only' })));
  const run = (fn) => async (req, res) => {
    const client = await pool.connect();
    try { await client.query('BEGIN'); const r = await fn(client, req); await client.query('COMMIT'); res.json(r); }
    catch (e) { await client.query('ROLLBACK').catch(() => {}); res.status(e.status || 500).json({ error: e.status ? e.message : 'Could not save (nothing was changed)' }); }
    finally { client.release(); }
  };
  router.get('/:vendor/:grn', async (req, res) => {
    try { res.json(await loadInvoice(pool, req.params.vendor, req.params.grn)); }
    catch (e) { res.status(e.status || 500).json({ error: e.status ? e.message : 'Could not load the GRN' }); }
  });
  router.put('/:vendor/:grn', express.json(), run(async (c, req) => { await saveEdit(c, req.params.vendor, req.params.grn, req.body || {}, user(req).username || user(req).name); return loadInvoice(c, req.params.vendor, req.params.grn); }));
  router.put('/:vendor/:grn/reason', express.json(), run(async (c, req) => { await saveReason(c, req.params.vendor, req.params.grn, req.body || {}, user(req).username || user(req).name); return loadInvoice(c, req.params.vendor, req.params.grn); }));
  return router;
}
module.exports = createGrnInvoiceRouter;
Object.assign(module.exports, { totals, loadInvoice, saveEdit, saveReason, ensureTables, REASONS });
