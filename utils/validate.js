'use strict';
// Shared input checks. isRealDate accepts only real calendar dates written YYYY-MM-DD:
// the old check (regex + Date.parse) let 2026-02-30 and 2026-04-31 through, and Postgres then failed with a 500.
function isRealDate(v) {
    const s = typeof v === 'string' ? v : (v instanceof Date ? null : String(v));
    if (s === null) return !isNaN(v);
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return false;
    const y = +m[1], mo = +m[2], d = +m[3];
    if (y < 1900 || y > 2999 || mo < 1 || mo > 12 || d < 1) return false;
    return d <= new Date(Date.UTC(y, mo, 0)).getUTCDate();
}

// Money in NUMERIC(12,2) columns: positive number, at most 9,999,999,999.99.
const MAX_MONEY = 9999999999.99;
const isMoneyInRange = v => Number.isFinite(Number(v)) && Math.abs(Number(v)) <= MAX_MONEY;

module.exports = { isRealDate, isMoneyInRange, MAX_MONEY };
