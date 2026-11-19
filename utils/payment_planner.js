// Vendor cheque payment planner. Pure functions, no database.
// Halal guardrails (Ajmal):
//  1 No bounced cheques: warn when cash will not cover a cheque on its clearing date.
//  2 Honest dating: the cheque date is the real date. No back-dating; a weekend/holiday date is moved to the next working day and shown.
//  3 Same price as cash: the cheques add up to exactly the invoice total. No surcharge, ever.
//  4 The payable stays open until a cheque has cleared (not when it is written).
const { clearingDate } = require('./cheque_clearing');
const iso = d => d.toISOString().slice(0, 10);
const addDays = (s, n) => { const x = new Date(s + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return iso(x); };
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s)) && !isNaN(new Date(s + 'T00:00:00Z'));
const cents = v => Math.round(Number(v) * 100);
function workDay(s, hol) {
  let d = s;
  for (;;) { const w = new Date(d + 'T00:00:00Z').getUTCDay(); if (w !== 0 && w !== 6 && !hol.includes(d)) return d; d = addDays(d, 1); }
}
function addMonths(s, n) {
  const d = new Date(s + 'T00:00:00Z'), day = d.getUTCDate();
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last)); return iso(d);
}
// A non-working date moves forward. With a vendor due date it moves BACK instead, so no cheque lands after the agreed date (guardrail 3).
function workDayBack(s, hol) {
  let d = s;
  for (;;) { const w = new Date(d + 'T00:00:00Z').getUTCDay(); if (w !== 0 && w !== 6 && !hol.includes(d)) return d; d = addDays(d, -1); }
}
/** total (Rs), count, firstDate, todayISO; every: everyMonths or everyDays; parts?: custom amounts; vendorDueDate?: last allowed date.
 *  -> { ok, errors, installments:[{no,date,moved,amount,clears}], sum } */
function planSchedule({ total, count, firstDate, everyDays = 30, everyMonths = 0, parts = null, vendorDueDate = null, todayISO, holidays = [] }) {
  const errors = [];
  if (!(cents(total) > 0)) errors.push('total must be more than 0');
  if (!Number.isInteger(count) || count < 1 || count > 24) errors.push('count must be a whole number from 1 to 24');
  if (!isDate(firstDate) || !isDate(todayISO)) errors.push('dates must be YYYY-MM-DD');
  else if (firstDate < todayISO) errors.push('first cheque date is in the past (no back-dating)');
  if (!Number.isInteger(everyDays) || everyDays < 1) errors.push('everyDays must be 1 or more');
  if (!Number.isInteger(everyMonths) || everyMonths < 0) errors.push('everyMonths must be 0 or more');
  if (vendorDueDate && !isDate(vendorDueDate)) errors.push('vendor due date must be YYYY-MM-DD');
  if (parts) {
    if (!Array.isArray(parts) || parts.length !== count || parts.some(x => !(cents(x) > 0))) errors.push('parts must be one amount above 0 for each cheque');
    else if (parts.reduce((a, x) => a + cents(x), 0) !== cents(total)) errors.push('parts must add up exactly to the total (no extra for credit)');
  }
  if (errors.length) return { ok: false, errors };
  const tc = cents(total), base = Math.floor(tc / count), installments = [];
  for (let i = 0; i < count; i++) {
    const raw = everyMonths ? addMonths(firstDate, i * everyMonths) : addDays(firstDate, i * everyDays);
    const date = vendorDueDate ? workDayBack(raw, holidays) : workDay(raw, holidays);
    const amt = parts ? cents(parts[i]) : (i === count - 1 ? tc - base * (count - 1) : base);
    installments.push({ no: i + 1, date, moved: date !== raw ? raw : null, amount: amt / 100, clears: clearingDate(date, holidays) });
  }
  const bad = installments.filter(x => x.date < todayISO || (vendorDueDate && x.date > vendorDueDate));
  if (bad.length) return { ok: false, errors: bad.map(x => x.date < todayISO ? `cheque ${x.no} would be dated in the past` : `cheque ${x.no} (${x.date}) is after the vendor due date ${vendorDueDate}`) };
  return { ok: true, errors: [], installments, sum: installments.reduce((s, x) => s + cents(x.amount), 0) / 100 };
}
/** Weekly cash to set aside so every cheque is covered when it clears: total / weeks until the last one clears (at least 1 week). */
function weeklySetAside(installments, todayISO) {
  if (!installments.length) return 0;
  const last = installments.reduce((m, x) => x.clears > m ? x.clears : m, todayISO);
  const days = Math.max(1, Math.round((new Date(last + 'T00:00:00Z') - new Date(todayISO + 'T00:00:00Z')) / 86400000));
  const total = installments.reduce((s, x) => s + cents(x.amount), 0);
  return Math.ceil(total / 100 / Math.max(1, days / 7));
}
/** Move one cheque to a new date. Same honesty rules: not in the past, weekend/holiday moves forward and is shown. */
function moveCheque(installments, no, newDateISO, todayISO, holidays = []) {
  const i = installments.findIndex(x => x.no === no);
  if (i < 0) return { ok: false, errors: [`no cheque ${no} in this plan`] };
  if (!isDate(newDateISO)) return { ok: false, errors: ['date must be YYYY-MM-DD'] };
  if (newDateISO < todayISO) return { ok: false, errors: ['that date is in the past (no back-dating)'] };
  const date = workDay(newDateISO, holidays);
  const out = installments.map(x => ({ ...x }));
  out[i] = { ...out[i], date, moved: date !== newDateISO ? newDateISO : null, clears: clearingDate(date, holidays) };
  return { ok: true, errors: [], installments: out };
}
/** Guardrail 1. openingCash + inflows [{date,amount}] vs cheques [{clears,amount}] -> warnings (empty = safe). */
function cashWarnings({ openingCash = 0, inflows = [], cheques }) {
  const ev = [];
  inflows.forEach(i => ev.push({ d: i.date, a: cents(i.amount), o: 0 }));
  cheques.forEach(c => ev.push({ d: c.clears, a: -cents(c.amount), o: 1 }));
  ev.sort((x, y) => x.d < y.d ? -1 : x.d > y.d ? 1 : x.o - y.o); // money in before money out on the same day
  let bal = cents(openingCash); const out = [];
  for (const e of ev) { bal += e.a; if (e.a < 0 && bal < 0) out.push({ date: e.d, shortBy: -bal / 100, text: `Short by Rs ${(-bal / 100).toFixed(2)} on ${e.d}: cheque may bounce` }); }
  return out;
}
/** Guardrail 4. rows = cheque_register rows of one plan. Only cleared cheques reduce what is owed. */
function outstanding(total, rows) {
  const paid = rows.filter(r => r.status === 'cleared').reduce((s, r) => s + cents(r.amount), 0);
  return { paid: paid / 100, owed: (cents(total) - paid) / 100, open: cents(total) - paid > 0 };
}
module.exports = { planSchedule, weeklySetAside, moveCheque, addMonths, cashWarnings, outstanding };
