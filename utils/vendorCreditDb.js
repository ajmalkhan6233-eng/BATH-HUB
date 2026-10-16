'use strict';
/** Reads vendor bills with their cheques, payments and credit notes (read only). Used by the credit view and the GRN screen. */
const isoDate = (v) => (v instanceof Date ? `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}` : v == null ? v : String(v).slice(0, 10));
const fix = (row, dates = [], nums = []) => { const o = { ...row }; dates.forEach((k) => { if (k in o) o[k] = isoDate(o[k]); }); nums.forEach((k) => { if (k in o) o[k] = Number(o[k]); }); return o; };

async function loadVendorRows(pool, { branch = 1, vendor = null } = {}) {
  const params = [branch]; if (vendor) params.push(vendor);
  const bills = (await pool.query(`SELECT * FROM vendor_bills WHERE branch_id=$1 AND voided=FALSE ${vendor ? 'AND LOWER(vendor_name)=LOWER($2)' : ''} ORDER BY bill_date DESC, id DESC`, params)).rows
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
/** Pending cheques of the planner list + every cheque number already in the ledger. Missing table = nothing to add. */
async function loadPlannerRows(pool) {
  try {
    const planner = (await pool.query(`SELECT cheque_no, payee, amount, due_date, status FROM cheque_register WHERE status = 'pending'`)).rows.map((r) => fix(r, ['due_date'], ['amount']));
    const nos = (await pool.query(`SELECT cheque_no FROM vendor_bill_cheques WHERE cheque_no IS NOT NULL`)).rows.map((r) => r.cheque_no);
    return { planner, ledgerNos: nos };
  } catch (e) { return { planner: [], ledgerNos: [] }; }
}
module.exports = { loadVendorRows, loadPlannerRows };
