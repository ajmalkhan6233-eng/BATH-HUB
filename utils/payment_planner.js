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
/** total (Rs), count, firstDate, everyDays, todayISO -> { ok, errors, installments:[{no,date,moved,amount,clears}], sum } */
function planSchedule({ total, count, firstDate, everyDays = 30, todayISO, holidays = [] }) {
  const errors = [];
  if (!(cents(total) > 0)) errors.push('total must be more than 0');
  if (!Number.isInteger(count) || count < 1 || count > 24) errors.push('count must be a whole number from 1 to 24');
  if (!isDate(firstDate) || !isDate(todayISO)) errors.push('dates must be YYYY-MM-DD');
  else if (firstDate < todayISO) errors.push('first cheque date is in the past (no back-dating)');
  if (!Number.isInteger(everyDays) || everyDays < 1) errors.push('everyDays must be 1 or more');
  if (errors.length) return { ok: false, errors };
  const tc = cents(total), base = Math.floor(tc / count), installments = [];
  for (let i = 0; i < count; i++) {
    const raw = addDays(firstDate, i * everyDays), date = workDay(raw, holidays);
    const amt = i === count - 1 ? tc - base * (count - 1) : base;
    installments.push({ no: i + 1, date, moved: date !== raw ? raw : null, amount: amt / 100, clears: clearingDate(date, holidays) });
  }
  return { ok: true, errors: [], installments, sum: installments.reduce((s, x) => s + cents(x.amount), 0) / 100 };
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
module.exports = { planSchedule, cashWarnings, outstanding };
