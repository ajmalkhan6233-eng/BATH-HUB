// utils/lkTime.js
// Sri Lanka time (Asia/Colombo, UTC+5:30, no daylight saving) for everything the shop calls "today".
// `new Date().toISOString().slice(0, 10)` is the UTC date, which is still yesterday between midnight
// and 05:30 in Colombo, so daily totals, cheque due dates and bill numbers landed on the wrong day.
// These helpers give the Colombo date regardless of the server's own timezone (laptop, Railway in UTC).
const TZ = process.env.APP_TIMEZONE || 'Asia/Colombo';

// 'en-CA' formats as YYYY-MM-DD.
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

const todayLK = (now = new Date()) => dayFmt.format(now);
const monthLK = (now = new Date()) => dayFmt.format(now).slice(0, 7);
// The Colombo date n days before `now` (Colombo has no DST, so whole days are exact).
const daysAgoLK = (n, now = new Date()) => dayFmt.format(new Date(now.getTime() - n * 86400000));

module.exports = { todayLK, monthLK, daysAgoLK, TZ };
