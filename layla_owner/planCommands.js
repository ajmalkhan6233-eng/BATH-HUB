'use strict';
/**
 * Payment-planner commands for the owner chat. Pure: text in, intent out, no database, no network.
 *   "plan 680000 Metro 4 months"        -> PLAN   (4 equal monthly cheques)
 *   "plan 100000 Eskema 6 weeks 3 cheques" -> PLAN (weeks; "N cheques" sets the number of parts)
 *   "move cheque 2 to 20th" / "move cheque 2 to 20 nov" -> MOVE_CHEQUE
 */
const T = require('./timeParse');
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const pad = (n) => String(n).padStart(2, '0');

/** "20th" -> the next 20th (this month if still ahead, else next month). Else falls back to the normal date parser. */
function parseDay(text, now) {
  const m = String(text).toLowerCase().match(/\b(\d{1,2})(?:st|nd|rd|th)\b(?!\s*(?:of\s+)?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec))/);
  if (!m) return T.parseDate(text, now);
  const day = +m[1]; if (day < 1 || day > 31) return null;
  const today = T.isoLocalDate(now); let y = +today.slice(0, 4), mo = +today.slice(5, 7);
  for (let i = 0; i < 14; i++) {
    const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    if (day <= last) { const d = `${y}-${pad(mo)}-${pad(day)}`; if (d > today) return d; }
    mo++; if (mo > 12) { mo = 1; y++; }
  }
  return null;
}
function parsePlanCommand(raw, now = new Date()) {
  const text = clean(raw), t = text.toLowerCase().replace(/^(layla[, ]*)/, '');
  let m;
  if ((m = t.match(/^move\s+cheque\s*#?(\d+)\s+(?:to|on)\s+(.+)$/))) {
    const od = m[2].match(/^\s*(\d{1,2})(?:st|nd|rd|th)\s*$/);                       // "20th" alone = the 20th of that cheque's own month (worked out in planHandler)
    if (od && +od[1] >= 1 && +od[1] <= 31) return { type: 'MOVE_CHEQUE', no: +m[1], day: +od[1], date: null };
    const date = parseDay(m[2], now);
    return date ? { type: 'MOVE_CHEQUE', no: +m[1], date } : { type: 'MOVE_CHEQUE', no: +m[1], date: null };
  }
  const orig = text.replace(/^layla[, ]*/i, '');
  if ((m = orig.match(/^plan\s+(\S+)\s+(.+?)\s+(\d+)\s*(months?|mths?|weeks?|wks?|days?)\b(.*)$/i))) {
    const total = T.parseAmount(m[1]); if (!total) return null;
    const n = +m[3], unit = m[4][0].toLowerCase() === 'm' ? 'months' : m[4][0].toLowerCase() === 'w' ? 'weeks' : 'days';
    const vendor = clean(m[2].replace(/[,.;:]+$/g, '')); if (!vendor) return null;
    const pc = m[5].toLowerCase().match(/(\d+)\s*(?:parts?|cheques?|installments?)/);
    const count = pc ? +pc[1] : (unit === 'days' ? 1 : n);
    if (!(n >= 1 && count >= 1 && count <= 24)) return null;
    return { type: 'PLAN', total, vendor, n, unit, count };
  }
  return null;
}
module.exports = { parsePlanCommand, parseDay };
