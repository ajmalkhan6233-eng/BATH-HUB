'use strict';
/**
 * Vendor ledger: pure functions, no database, no network.
 * Rule: a vendor payable only drops when a cheque is CLEARED (or cash paid, or a credit note applied).
 * A cheque that is ISSUED but not cleared is "covered", still owed.
 */
const EPS = 0.005;
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const sum = (arr, f) => round2(arr.reduce((a, x) => a + (Number(f(x)) || 0), 0));

/* ---------- dates (ISO strings only, UTC math, no time zone surprises) ---------- */
const toUTC = (iso) => { const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return Date.UTC(y, m - 1, d); };
const fromUTC = (ms) => new Date(ms).toISOString().slice(0, 10);
const addDays = (iso, n) => fromUTC(toUTC(iso) + n * 86400000);
const dow = (iso) => new Date(toUTC(iso)).getUTCDay(); // 0 Sun .. 6 Sat
const isIso = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s)) && fromUTC(toUTC(s)) === String(s);
const isWorkingDay = (iso, holidays = []) => dow(iso) >= 1 && dow(iso) <= 5 && !holidays.includes(iso);
function nextWorkingDay(iso, holidays = []) { let d = iso; while (!isWorkingDay(d, holidays)) d = addDays(d, 1); return d; }

/**
 * BATHCO rule (owner's own correction, ledger page item 20): clearing is worked out from the DATE WRITTEN ON THE CHEQUE.
 *  - Same bank as ours: clears on the cheque date, rolled forward to the next business day if that date is a weekend or bank holiday.
 *  - Another bank: clears on the next business day AFTER that rolled date.
 * Examples (no holidays): Friday cheque, other bank -> Monday. Saturday -> Tuesday. Sunday -> Tuesday.
 * Holidays default to the Sri Lankan list in utils/slBankHolidays.js. Pass `holidays` to override.
 * Use nextClearingInfo() when you also want a warning for years whose holidays are not loaded.
 */
const SLH = require('./slBankHolidays');
function nextClearingInfo(chequeDate, { sameBank = false, holidays, lagWorkingDays = 1 } = {}) {
  const hol = holidays || SLH.all();
  const warned = new Set();
  const roll = (iso) => { let d = iso; for (;;) { warned.add(!holidays && !SLH.yearLoaded(Number(d.slice(0, 4))) ? Number(d.slice(0, 4)) : undefined); if (isWorkingDay(d, hol)) return d; d = addDays(d, 1); } };
  let d = roll(String(chequeDate).slice(0, 10));
  if (!sameBank) for (let i = 0; i < lagWorkingDays; i++) d = roll(addDays(d, 1));
  warned.delete(undefined);
  return { date: d, warnedYears: [...warned].sort() };
}
const nextClearingDate = (chequeDate, opts) => nextClearingInfo(chequeDate, opts).date;

/* ---------- bill state ---------- */
function billStatus(bill, cheques = [], payments = [], credits = []) {
  const total = round2(bill.total);
  const cleared = sum(cheques.filter((c) => c.status === 'CLEARED'), (c) => c.amount);
  const paid = sum(payments, (p) => p.amount);
  const credited = sum(credits, (c) => c.amount);
  const settled = round2(cleared + paid + credited);
  const outstanding = Math.max(0, round2(total - settled));
  const overpaid = Math.max(0, round2(settled - total));
  const issued = sum(cheques.filter((c) => c.status === 'ISSUED'), (c) => c.amount);
  const covered = round2(Math.min(outstanding, issued));
  const uncovered = round2(outstanding - covered);
  const hasBounced = cheques.some((c) => c.status === 'BOUNCED');
  let state;
  if (outstanding <= EPS) state = 'PAID';
  else if (uncovered <= EPS) state = 'CHEQUE_ISSUED';
  else if (covered > EPS) state = 'PART_COVERED';
  else state = 'UNPAID';
  return { total, cleared, paid, credited, outstanding, overpaid, covered, uncovered, hasBounced, state };
}

/** rows: [{ bill, cheques, payments, credits }] */
function summarise(rows) {
  const byVendor = new Map();
  for (const r of rows) {
    if (r.bill.voided) continue;
    const s = billStatus(r.bill, r.cheques, r.payments, r.credits);
    const v = byVendor.get(r.bill.vendor_name) || { vendor: r.bill.vendor_name, outstanding: 0, covered: 0, uncovered: 0, bills: 0 };
    v.outstanding = round2(v.outstanding + s.outstanding);
    v.covered = round2(v.covered + s.covered);
    v.uncovered = round2(v.uncovered + s.uncovered);
    if (s.outstanding > EPS) v.bills += 1;
    byVendor.set(r.bill.vendor_name, v);
  }
  const vendors = [...byVendor.values()].sort((a, b) => b.outstanding - a.outstanding);
  const totals = vendors.reduce((t, v) => ({ outstanding: round2(t.outstanding + v.outstanding), covered: round2(t.covered + v.covered), uncovered: round2(t.uncovered + v.uncovered) }), { outstanding: 0, covered: 0, uncovered: 0 });
  return { vendors, totals };
}

/* ---------- cheque calendar and cash gap (ISSUED cheques carry due_date) ---------- */
const dueOf = (c) => String(c.due_date).slice(0, 10);
const issuedOnly = (cheques) => cheques.filter((c) => c.status === 'ISSUED' && isIso(dueOf(c)));

function chequeCalendar(cheques, todayISO, { bulkThreshold = 300000, windows = [7, 14, 30] } = {}) {
  const live = issuedOnly(cheques);
  const total = (list) => sum(list, (c) => c.amount);
  const inRange = (from, to) => live.filter((c) => dueOf(c) >= from && dueOf(c) <= to);
  const overdue = live.filter((c) => dueOf(c) < todayISO);
  const win = {};
  for (const w of windows) win[w] = total(inRange(todayISO, addDays(todayISO, w - 1))); // N days including today
  const byDay = [];
  for (let i = 0; i <= 14; i++) {
    const date = addDays(todayISO, i);
    const list = live.filter((c) => dueOf(c) === date);
    const amount = total(list);
    byDay.push({ date, amount, count: list.length, bulk: amount >= bulkThreshold });
  }
  let monday = addDays(todayISO, 1);
  while (dow(monday) !== 1) monday = addDays(monday, 1);
  const on = (d) => total(live.filter((c) => dueOf(c) === d));
  return {
    today: on(todayISO), tomorrow: on(addDays(todayISO, 1)), monday: { date: monday, amount: on(monday) },
    overdue: { amount: total(overdue), count: overdue.length },
    windows: win, byDay, bulkDays: byDay.filter((d) => d.bulk),
  };
}

/** Cash that must be found for cheques due in the next `days` days (overdue included). */
function cashGap(cheques, { cashOnHand = 0, expectedReceipts = 0 } = {}, todayISO, days = 2) {
  const live = issuedOnly(cheques).filter((c) => dueOf(c) <= addDays(todayISO, days - 1)); // N days including today
  const due = sum(live, (c) => c.amount);
  const gap = Math.max(0, round2(due - Number(cashOnHand) - Number(expectedReceipts)));
  return { due, cashOnHand: round2(cashOnHand), expectedReceipts: round2(expectedReceipts), gap, days, count: live.length };
}

/* ---------- cheque writing helpers ---------- */
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
function below1000(n) {
  const out = [];
  if (n >= 100) { out.push(ONES[Math.floor(n / 100)], 'Hundred'); n %= 100; }
  if (n >= 20) { out.push(TENS[Math.floor(n / 10)]); n %= 10; }
  if (n > 0) out.push(ONES[n]);
  return out.join(' ');
}
function amountInWords(amount) {
  const a = round2(amount);
  if (!(a > 0) || a >= 1e9) throw new RangeError('amount must be between 0.01 and 999,999,999.99');
  let rupees = Math.floor(a); const cents = Math.round((a - rupees) * 100);
  const parts = [];
  for (const [size, name] of [[1e6, 'Million'], [1e3, 'Thousand']]) {
    if (rupees >= size) { parts.push(below1000(Math.floor(rupees / size)), name); rupees %= size; }
  }
  if (rupees > 0) parts.push(below1000(rupees));
  let words = parts.join(' ');
  if (cents > 0) words += `${words ? ' and ' : ''}${below1000(cents)} Cents`;
  return `${words} Only`;
}
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z]/g, '');

function validateCheque({ payee, amount, amountWords, date } = {}, { today } = {}) {
  const w = [];
  if (!payee || !String(payee).trim()) w.push('MISSING_PAYEE');
  else if (/^(cash|bearer|self)$/i.test(String(payee).trim())) w.push('PAYEE_IS_CASH');
  if (amount === undefined || amount === null || amount === '') w.push('MISSING_AMOUNT');
  else if (!(Number(amount) > 0)) w.push('AMOUNT_NOT_POSITIVE');
  else if (amountWords && norm(amountWords) !== norm(amountInWords(amount))) w.push('WORDS_MISMATCH');
  if (!date || !isIso(String(date).slice(0, 10))) w.push('DATE_INVALID');
  else if (today && toUTC(today) - toUTC(String(date).slice(0, 10)) > 180 * 86400000) w.push('DATE_STALE_OVER_6_MONTHS');
  return w;
}

/* ---------- duplicate detection (the Excel register had these) ---------- */
function editDistanceAtMostOne(a, b) {
  a = String(a); b = String(b);
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : b.slice(i + 1) === a.slice(i);
}
function findDuplicates(cheques) {
  const live = cheques.filter((c) => c.status !== 'CANCELLED');
  const sameNumber = []; const likely = [];
  for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
    const a = live[i], b = live[j];
    const na = String(a.cheque_no || '').trim(), nb = String(b.cheque_no || '').trim();
    if (na && na === nb) sameNumber.push([a.id, b.id]);
    else if (na && nb && editDistanceAtMostOne(na, nb) && round2(a.amount) === round2(b.amount) && dueOf(a) === dueOf(b)) likely.push([a.id, b.id]);
  }
  return { sameNumber, likely };
}

module.exports = { round2, addDays, dow, isIso, isWorkingDay, nextWorkingDay, nextClearingDate, nextClearingInfo, billStatus, summarise, chequeCalendar, cashGap, amountInWords, validateCheque, findDuplicates };
