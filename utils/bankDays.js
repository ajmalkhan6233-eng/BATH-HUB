'use strict';
// Sri Lanka bank days and cheque clearing (AJ 24 Oct 2026).
// Weekends are bank holidays. Holiday list: Government of Sri Lanka 2026 calendar (documents.gov.lk/view/calander/2026/2026_E.pdf, read 24 Oct 2026).
// Dates can change (Poya and festival days are announced); update HOLIDAYS each January.
// AJ's rule: deposited Fri -> clears Mon; deposited Sat or Sun -> counts from Mon, clears Tue. So: deposit counts on the next bank day on/after the
// deposit date, and a cheque on another bank clears on the NEXT bank day after that. A cheque on the same bank clears on the day it counts.
const HOLIDAYS = new Set(['2026-01-03', '2026-01-15', '2026-02-01', '2026-02-04', '2026-02-15', '2026-03-02', '2026-03-21', '2026-04-01', '2026-04-03', '2026-04-13', '2026-04-14', '2026-05-01', '2026-05-02', '2026-05-28', '2026-05-30', '2026-06-29', '2026-07-29', '2026-08-26', '2026-08-27', '2026-09-26', '2026-10-25', '2026-11-08', '2026-11-24', '2026-12-23', '2026-12-25']);
const addDays = (s, n) => new Date(Date.parse(s + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const dow = s => new Date(s + 'T00:00:00Z').getUTCDay();
const isBankDay = s => { const d = dow(s); return d !== 0 && d !== 6 && !HOLIDAYS.has(s); };
function onOrAfter(s) { let d = s, n = 0; while (!isBankDay(d) && n++ < 14) d = addDays(d, 1); return d; }
function nextBankDay(s) { return onOrAfter(addDays(s, 1)); }
function clearingDate(depositDate, sameBank = false) { const eff = onOrAfter(depositDate); return sameBank ? eff : nextBankDay(eff); }
function weekStart(s) { const d = dow(s); return addDays(s, -((d + 6) % 7)); }   // Monday
module.exports = { HOLIDAYS, isBankDay, onOrAfter, nextBankDay, clearingDate, addDays, weekStart, dow };
