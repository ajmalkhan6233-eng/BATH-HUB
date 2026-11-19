'use strict';
// CHEQUE PLAN (AJ 24 Oct 2026): when will each issued cheque really leave the bank account, and how much cash must be there.
// Worst case: the vendor deposits on the cheque date. Uses utils/bankDays.js for weekends and holidays.
const B = require('./bankDays');
const fmt = n => 'Rs ' + Math.round(n).toLocaleString('en-US');
const DAYNAME = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// cheques: [{vendor, cheque_no, amount, due_date, same_bank}]
function plan(cheques) {
  const rows = cheques.map(c => ({ ...c, amount: Number(c.amount) || 0, due: String(c.due_date).slice(0, 10), clears: B.clearingDate(String(c.due_date).slice(0, 10), !!c.same_bank) }));
  const byDay = {}; rows.forEach(r => { (byDay[r.clears] = byDay[r.clears] || { day: r.clears, total: 0, count: 0 }); byDay[r.clears].total += r.amount; byDay[r.clears].count++; });
  return { rows, days: Object.values(byDay).sort((a, b) => (a.day < b.day ? -1 : 1)) };
}
// today = Sri Lanka date. Friday/Saturday: show the whole next week; every day: anything clearing in the next 3 days.
function lines(p, today) {
  const L = [], dw = B.dow(today), soon = B.addDays(today, 3);
  const hot = p.days.filter(d => d.day >= today && d.day <= soon);
  hot.forEach(d => L.push('🔴 CHEQUES CLEAR ' + DAYNAME[B.dow(d.day)] + ' ' + d.day.slice(5) + ': ' + fmt(d.total) + ' (' + d.count + ') — have this in the bank'));
  if (dw === 5 || dw === 6) {
    const mon = B.addDays(B.weekStart(today), 7), end = B.addDays(mon, 6), wk = p.days.filter(d => d.day >= mon && d.day <= end);
    if (wk.length) L.push('🧾 NEXT WEEK cheques: ' + fmt(wk.reduce((a, d) => a + d.total, 0)) + ' — ' + wk.map(d => DAYNAME[B.dow(d.day)] + ' ' + fmt(d.total)).join(', '));
  }
  return L;
}
async function load(pool) {
  const r = await pool.query(`SELECT c.cheque_no, c.amount, c.due_date::text AS due_date, c.same_bank, b.vendor_name AS vendor FROM vendor_bill_cheques c LEFT JOIN vendor_bills b ON b.id = c.bill_id WHERE c.status = 'ISSUED' ORDER BY c.due_date`);
  return r.rows;
}
module.exports = { plan, lines, load, fmt };
