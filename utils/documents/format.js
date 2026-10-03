'use strict';
// Small formatting helpers shared by the report builders and the PDF / CSV writers.
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const group = (n, dp) => Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
// 1234567.5 -> 'Rs 1,234,567.50'   -1000 -> '-Rs 1,000.00'
const rs = v => { const n = num(v); return (n < 0 && Math.round(Math.abs(n) * 100) > 0 ? '-' : '') + 'Rs ' + group(n, 2); };
const int = v => group(Math.round(num(v)), 0);
const qty = v => { const n = num(v); return group(n, Number.isInteger(n) ? 0 : 2); };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// A JS Date or a 'YYYY-MM-DD...' string -> 'YYYY-MM-DD' (local clock, the same clock the database timestamps were written in)
const ymd = v => {
    if (!v) return '';
    if (typeof v === 'string') return v.slice(0, 10);
    const d = v instanceof Date ? v : new Date(v);
    if (isNaN(d)) return '';
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const hm = v => { const d = v instanceof Date ? v : new Date(v); if (!v || isNaN(d)) return ''; const p = n => String(n).padStart(2, '0'); return `${p(d.getHours())}:${p(d.getMinutes())}`; };
const isDay = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s)) && ymd(new Date(s + 'T00:00:00Z')) !== '' && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
const MAX_DAYS = 731;
// -> { from, to } or throws an Error(status 400) with a message the owner can read
function parseRange(from, to) {
    if (!isDay(from) || !isDay(to)) { const e = new Error('Choose a start date and an end date.'); e.status = 400; throw e; }
    if (from > to) { const e = new Error('The start date is after the end date.'); e.status = 400; throw e; }
    const days = (Date.parse(to) - Date.parse(from)) / 86400000 + 1;
    if (days > MAX_DAYS) { const e = new Error('Choose a period of at most 2 years.'); e.status = 400; throw e; }
    return { from, to, days };
}
module.exports = { num, rs, int, qty, esc, ymd, hm, isDay, parseRange, MAX_DAYS };
