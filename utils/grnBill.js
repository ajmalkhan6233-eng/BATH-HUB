'use strict';
/**
 * A saved GRN becomes a vendor payable ("bill"), so "payment pending" shows from the first minute.
 * Own file. Never blocks a GRN: if the vendor tables are not there yet, it returns { skipped } and the GRN still saves.
 * credit_days: whole number of days the vendor allows (blank = decide later, no due date).  paid_now: paid in cash on delivery.
 */
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const addDays = (iso, n) => new Date(Date.UTC(...iso.split('-').map((x, i) => (i === 1 ? Number(x) - 1 : Number(x)))) + n * 86400000).toISOString().slice(0, 10);

function readTerms(payload = {}, grnDate) {
  const out = { creditDays: null, paidNow: payload.paid_now === true || payload.paid_now === 'true', dueDate: null, error: null };
  const raw = payload.credit_days;
  if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0 || n > 1095) { out.error = 'Credit days must be a whole number from 0 to 1095 (or leave it blank)'; return out; }
    out.creditDays = n; out.dueDate = addDays(grnDate, n);
  }
  return out;
}

/** client = the open transaction client of the GRN save. Returns { bill_id } | { skipped: reason } | { exists: bill_id }. */
async function createBillForGrn(client, { vendor_name, grn_number, grn_date, total, terms, user = null, branch = 1 }) {
  if (!(Number(total) > 0)) return { skipped: 'total is 0' };
  const t = await client.query(`SELECT 1 FROM information_schema.tables WHERE table_name = 'vendor_bills' LIMIT 1`);
  if (!t.rows.length) return { skipped: 'vendor tables not created yet (run scripts/migrate_vendor_ledger.js)' };
  const have = await client.query(`SELECT id FROM vendor_bills WHERE bill_no = $1 AND LOWER(vendor_name) = LOWER($2) AND voided = FALSE LIMIT 1`, [grn_number, vendor_name]);
  if (have.rows.length) return { exists: have.rows[0].id };
  const ins = await client.query(
    `INSERT INTO vendor_bills (branch_id, vendor_name, bill_no, bill_date, due_date, total, notes, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [branch, vendor_name, grn_number, grn_date, terms && terms.dueDate ? terms.dueDate : null, round2(total), `From GRN ${grn_number}`, user]);
  const id = ins.rows[0].id;
  if (terms && terms.paidNow) {
    await client.query(`INSERT INTO vendor_payments (branch_id, bill_id, amount, method, paid_at, note, created_by) VALUES ($1,$2,$3,'CASH',$4,$5,$6)`,
      [branch, id, round2(total), grn_date, 'Paid in cash on delivery', user]);
  }
  return { bill_id: id };
}

module.exports = { createBillForGrn, readTerms, addDays };
