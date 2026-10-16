'use strict';
/**
 * Vendor credit view: pure functions, no database, no network. Built on utils/vendorLedger.js (same bill/cheque rules).
 * Plain words for the owner:
 *   owed            = what we still owe the vendor (only cleared cheques, cash or credit notes reduce it)
 *   notWritten      = owed, and NO cheque written yet for it  -> "payment pending"
 *   writtenNotClear = owed, a cheque is written but has not cleared yet
 *   After 1, 2, 3 months: owed minus the written cheques whose clearing date falls by then (cheques not written yet count as still owed).
 */
const L = require('./vendorLedger');
const { addMonths } = require('./payment_planner');

const round2 = L.round2;
const EPS = 0.005;
const LONG_DATED_DAYS = 90;   // a written cheque dated more than this far ahead is shown as long-dated

const STATE_TEXT = {
  UNPAID: 'Cheque not written, payment pending',
  PART_COVERED: 'Some cheques written, the rest still pending',
  CHEQUE_ISSUED: 'Cheques written, not cleared yet, still owed',
  PAID: 'Paid',
};
const stateText = (state) => STATE_TEXT[state] || state;

const dueOf = (c) => String(c.due_date).slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.UTC(...b.split('-').map((x, i) => (i === 1 ? Number(x) - 1 : Number(x)))) - Date.UTC(...a.split('-').map((x, i) => (i === 1 ? Number(x) - 1 : Number(x))))) / 86400000);

/** What is still owed on one bill if the written cheques due by `byISO` have cleared. */
function owedBy(bill, cheques, payments, credits, byISO) {
  const s = L.billStatus(bill, cheques, payments, credits);
  const issuedByThen = round2(cheques.filter((c) => c.status === 'ISSUED' && dueOf(c) <= byISO).reduce((a, c) => a + Number(c.amount || 0), 0));
  return round2(Math.max(0, s.outstanding - Math.min(s.outstanding, issuedByThen)));
}

/**
 * rows: [{ bill, cheques, payments, credits }]  (same shape vendorLedger.summarise takes)
 * -> { today, months, vendors:[{vendor, owed, notWritten, writtenNotClear, bills:[...], after:{1:..,2:..,3:..}, longDated:[...] }], totals, longDated }
 */
function creditView(rows, todayISO, { months = [1, 2, 3], onlyVendor = null } = {}) {
  const horizons = months.map((m) => ({ m, date: addMonths(todayISO, m) }));
  const byVendor = new Map();
  const longDatedAll = [];
  for (const r of rows) {
    if (r.bill.voided) continue;
    if (onlyVendor && String(r.bill.vendor_name).toLowerCase() !== String(onlyVendor).toLowerCase()) continue;
    const s = L.billStatus(r.bill, r.cheques, r.payments, r.credits);
    if (s.outstanding <= EPS) continue;     // paid bills are not credit any more
    const v = byVendor.get(r.bill.vendor_name) || { vendor: r.bill.vendor_name, owed: 0, notWritten: 0, writtenNotClear: 0, after: {}, bills: [], longDated: [], pastDue: 0 };
    v.owed = round2(v.owed + s.outstanding);
    v.notWritten = round2(v.notWritten + s.uncovered);
    v.writtenNotClear = round2(v.writtenNotClear + s.covered);
    for (const h of horizons) v.after[h.m] = round2((v.after[h.m] || 0) + owedBy(r.bill, r.cheques, r.payments, r.credits, h.date));
    const due = r.bill.due_date ? String(r.bill.due_date).slice(0, 10) : null;
    const overdue = !!(due && due < todayISO && s.outstanding > EPS);
    if (overdue) v.pastDue = round2(v.pastDue + s.outstanding);
    // the vendor's own deadline passes before our written cheques cover it
    const notCoveredAtDue = due && due >= todayISO ? owedBy(r.bill, r.cheques, r.payments, r.credits, due) : (overdue ? s.outstanding : 0);
    v.bills.push({
      id: r.bill.id, bill_no: r.bill.bill_no || null, bill_date: String(r.bill.bill_date).slice(0, 10), due_date: due,
      total: s.total, owed: s.outstanding, state: s.state, status_text: stateText(s.state),
      notWritten: s.uncovered, writtenNotClear: s.covered, overdue, notCoveredAtDue: round2(notCoveredAtDue),
      daysToDue: due ? daysBetween(todayISO, due) : null,
    });
    for (const c of r.cheques.filter((x) => x.status === 'ISSUED')) {
      const ahead = daysBetween(todayISO, dueOf(c));
      if (ahead > LONG_DATED_DAYS) {
        const item = { vendor: r.bill.vendor_name, cheque_no: c.cheque_no || null, amount: round2(c.amount), clears_on: dueOf(c), days_ahead: ahead };
        v.longDated.push(item); longDatedAll.push(item);
      }
    }
    byVendor.set(r.bill.vendor_name, v);
  }
  const vendors = [...byVendor.values()].sort((a, b) => b.owed - a.owed);
  const totals = { owed: 0, notWritten: 0, writtenNotClear: 0, pastDue: 0, after: {} };
  for (const h of horizons) totals.after[h.m] = 0;
  for (const v of vendors) {
    totals.owed = round2(totals.owed + v.owed); totals.notWritten = round2(totals.notWritten + v.notWritten);
    totals.writtenNotClear = round2(totals.writtenNotClear + v.writtenNotClear); totals.pastDue = round2(totals.pastDue + v.pastDue);
    for (const h of horizons) totals.after[h.m] = round2(totals.after[h.m] + v.after[h.m]);
  }
  return { today: todayISO, horizons, vendors, totals, longDated: longDatedAll.sort((a, b) => b.days_ahead - a.days_ahead) };
}

/**
 * Cheques on the PLANNER list (cheque_register, status pending) that are NOT in the vendor ledger. They are money going out too,
 * so they are shown beside the ledger view instead of being forgotten. A planner cheque whose number is already in the ledger is skipped (no double count).
 * rows: [{ cheque_no, payee, amount, due_date, status }]; ledgerNos: cheque numbers already in the ledger.
 */
function plannerView(rows, ledgerNos, todayISO, { months = [1, 2, 3] } = {}) {
  const known = new Set((ledgerNos || []).map((x) => String(x || '').trim()).filter(Boolean));
  const items = (rows || []).filter((r) => String(r.status || 'pending').toLowerCase() === 'pending' && !(r.cheque_no && known.has(String(r.cheque_no).trim())))
    .map((r) => ({ payee: r.payee, cheque_no: r.cheque_no || null, amount: round2(r.amount), due_date: String(r.due_date).slice(0, 10) }))
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
  const horizons = months.map((m) => ({ m, date: addMonths(todayISO, m) }));
  const out = { count: items.length, total: round2(items.reduce((a, i) => a + i.amount, 0)), dueBy: {}, items: items.slice(0, 30), note: 'On the cheque planner list but not linked to a vendor bill. They are NOT taken off what a vendor is owed above.' };
  for (const h of horizons) out.dueBy[h.m] = round2(items.filter((i) => i.due_date <= h.date).reduce((a, i) => a + i.amount, 0));
  return out;
}

/** One short plain sentence per vendor for WhatsApp or a toast. */
function oneLine(v) {
  const n = (x) => Number(x).toLocaleString('en-LK', { maximumFractionDigits: 0 });
  const a = v.after || {};
  return `${v.vendor}: owe Rs ${n(v.owed)}. Cheque not written for Rs ${n(v.notWritten)}; written, not cleared Rs ${n(v.writtenNotClear)}.` +
    (a[1] !== undefined ? ` After 1 month Rs ${n(a[1])}, 2 months Rs ${n(a[2])}, 3 months Rs ${n(a[3])}.` : '');
}

module.exports = { plannerView, creditView, owedBy, stateText, oneLine, LONG_DATED_DAYS };
