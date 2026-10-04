'use strict';
/** Natural time and money parsing for the owner assistant. Sri Lanka is UTC+5:30 all year (no daylight saving). */
const OFFSET_MIN = 330;
const toLocal = (d) => new Date(d.getTime() + OFFSET_MIN * 60000);              // read UTC fields of the result as local clock
const fromLocal = (y, m, d, hh = 0, mm = 0) => new Date(Date.UTC(y, m, d, hh, mm) - OFFSET_MIN * 60000);
const pad = (n) => String(n).padStart(2, '0');
const isoLocalDate = (d) => { const l = toLocal(d); return `${l.getUTCFullYear()}-${pad(l.getUTCMonth() + 1)}-${pad(l.getUTCDate())}`; };
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const PARTS = { morning: [8, 0], noon: [12, 0], afternoon: [14, 0], evening: [17, 30], eod: [17, 30], 'end of day': [17, 30], tonight: [20, 0], night: [20, 0] };

/** Returns a local calendar date { y, m, d } or null. Handles today, tomorrow, weekday names, dd/mm(/yyyy), "12 oct". */
function parseDateParts(text, now) {
  const t = String(text).toLowerCase(); const l = toLocal(now);
  const base = (add) => { const x = new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate() + add)); return { y: x.getUTCFullYear(), m: x.getUTCMonth(), d: x.getUTCDate() }; };
  let m;
  if ((m = t.match(/\b(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\b/))) {
    const d = +m[1], mo = +m[2] - 1; let y = m[3] ? +m[3] : l.getUTCFullYear(); if (y < 100) y += 2000;
    if (mo >= 0 && mo < 12 && d >= 1 && d <= 31) { let r = { y, m: mo, d }; if (!m[3] && Date.UTC(y, mo, d) < Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate())) r = { y: y + 1, m: mo, d }; return r; }
  }
  if ((m = t.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTHS.join('|')})[a-z]*\\b`)))) {
    let y = l.getUTCFullYear(); const mo = MONTHS.indexOf(m[2]), d = +m[1];
    if (Date.UTC(y, mo, d) < Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate())) y += 1; return { y, m: mo, d };
  }
  if (/\bday after tomorrow\b/.test(t)) return base(2);
  if (/\btomorrow\b|\btmrw\b/.test(t)) return base(1);
  if (/\btoday\b|\btonight\b/.test(t)) return base(0);
  for (let i = 0; i < 7; i++) if (new RegExp(`\\b${DAYS[i]}\\b`).test(t)) { let add = (i - l.getUTCDay() + 7) % 7; if (add === 0) add = 7; return base(add); }
  return null;
}
const dateIso = (p) => p && `${p.y}-${pad(p.m + 1)}-${pad(p.d)}`;
const parseDate = (text, now = new Date()) => dateIso(parseDateParts(text, now));

/** Time of day { h, min } from "5pm", "5:30 pm", "17:30", or words like evening. */
function parseClock(text) {
  const t = String(text).toLowerCase(); let m;
  if ((m = t.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/))) { let h = +m[1] % 12; if (m[3] === 'pm') h += 12; return { h, min: m[2] ? +m[2] : 0 }; }
  if ((m = t.match(/\b(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/))) return { h: +m[1], min: +m[2] };
  for (const k of ['end of day', 'eod', 'tonight', 'evening', 'afternoon', 'noon', 'morning', 'night']) if (t.includes(k)) return { h: PARTS[k][0], min: PARTS[k][1] };
  return null;
}

/** When should a reminder fire? Returns { at: Date, label } or null. Default clock: 17:30 for a bare "evening", 09:00 for a bare date. */
function parseWhen(text, now = new Date()) {
  const t = String(text).toLowerCase(); let m;
  if ((m = t.match(/\b(?:in|after)\s+(\d+(?:\.\d+)?)\s*(minutes?|mins?|hours?|hrs?|days?)\b/))) {
    const n = parseFloat(m[1]); const unit = m[2][0] === 'd' ? 1440 : m[2][0] === 'h' ? 60 : 1;
    return { at: new Date(now.getTime() + n * unit * 60000), label: `in ${m[1]} ${m[2]}` };
  }
  const dp = parseDateParts(t, now); const clock = parseClock(t);
  if (!dp && !clock) return null;
  const l = toLocal(now);
  const today = { y: l.getUTCFullYear(), m: l.getUTCMonth(), d: l.getUTCDate() };
  const date = dp || today; const c = clock || { h: 9, min: 0 };
  let at = fromLocal(date.y, date.m, date.d, c.h, c.min);
  if (!dp && at.getTime() <= now.getTime()) at = new Date(at.getTime() + 86400000);          // a bare time that already passed means tomorrow
  return { at, label: `${dateIso(parseDateParts(isoLocalDate(at), at))} ${pad(c.h)}:${pad(c.min)}` };
}

/** Rupee amounts: "1 million", "1.5m", "500k", "5 lakhs", "Rs 520,000", "520000". Returns the first amount found or null. */
function parseAmount(text) {
  const t = String(text).toLowerCase().replace(/,/g, '');
  let m;
  if ((m = t.match(/(\d+(?:\.\d+)?)\s*(million|mn|m)\b/))) return Math.round(parseFloat(m[1]) * 1e6);
  if ((m = t.match(/(\d+(?:\.\d+)?)\s*(lakhs?|lks?|lacs?)\b/))) return Math.round(parseFloat(m[1]) * 1e5);
  if ((m = t.match(/(\d+(?:\.\d+)?)\s*(thousand|k)\b/))) return Math.round(parseFloat(m[1]) * 1e3);
  if ((m = t.match(/(?:rs\.?|lkr|rupees)\s*(\d+(?:\.\d+)?)/))) return parseFloat(m[1]);
  if ((m = t.match(/\b(\d{4,9})(?:\.\d+)?\b/))) return parseFloat(m[1]);
  return null;
}
const fmtLocal = (d) => { const l = toLocal(d); const h = l.getUTCHours(); return `${isoLocalDate(d)} ${pad(h % 12 || 12)}:${pad(l.getUTCMinutes())} ${h >= 12 ? 'pm' : 'am'}`; };
module.exports = { OFFSET_MIN, toLocal, fromLocal, isoLocalDate, parseDate, parseWhen, parseClock, parseAmount, fmtLocal };
