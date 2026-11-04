// Cheque clearing + alert dates. Pure functions, no database. Holidays = ['YYYY-MM-DD'] (poya, bank holidays).
// Ajmal's rule: deposit Fri -> clears Mon. Deposit Sat/Sun -> clears Tue. Mon-Thu -> next working day (UNVERIFIED, confirm with bank).
const iso = d => d.toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(d.getTime()); x.setUTCDate(x.getUTCDate() + n); return x; };
const isWork = (d, hol) => d.getUTCDay() !== 0 && d.getUTCDay() !== 6 && !hol.includes(iso(d));
function nextWork(d, hol) { let x = addDays(d, 1); while (!isWork(x, hol)) x = addDays(x, 1); return x; }
function clearingDate(depositISO, hol = []) {
  const d = new Date(depositISO + 'T00:00:00Z'), dow = d.getUTCDay();
  let c = (dow === 6 || dow === 0) ? nextWork(nextWork(d, hol), hol) : nextWork(d, hol); // Sat/Sun -> Tue
  if (dow === 5) c = nextWork(d, hol);                                                      // Fri -> Mon
  return iso(c);
}
function alertDates(clearISO) {
  const c = new Date(clearISO + 'T00:00:00Z');
  return [{ when: iso(addDays(c, -3)), text: '3 days to clearing' }, { when: iso(addDays(c, -2)), text: '2 days to clearing' }, { when: iso(addDays(c, -1)), text: 'Tomorrow clears' }, { when: clearISO, text: 'Clears TODAY (morning)' }];
}
// status: owed (not deposited) | in_transit (deposited, before clear date) | cleared
function status(ch, todayISO, hol = []) {
  if (!ch.depositDate) return 'owed';
  return todayISO >= clearingDate(ch.depositDate, hol) ? 'cleared' : 'in_transit';
}
module.exports = { clearingDate, alertDates, status };
