'use strict';
// Last safety check on every message that goes to a CUSTOMER (templated or model written).
// It does not decide what to say; it only blocks a reply that would break a truth or privacy rule:
//   - words that belong to the owner's books (profit, loans, cheques, salary, suppliers, cost price...)
//   - a rupee amount that is not one of the prices read from the database for this reply
//   - promises LAYLA must never make: opening hours, delivery times, warranties, free offers, discounts
// Returns {ok:true} or {ok:false, reason}. The engine then sends "let me check" and opens a staff task.

const BOOKS = /\b(?:profits?|margins?|mark-?ups?|loans?|investors?|payroll|salary|salaries|wages|suppliers?|cost\s*price|buying\s*price|purchase\s*price|turnover|revenue|cheques?|checks?\s+due|net\s+income|avg[_\s-]?cost)\b|ලාභය?|වැටුප්|සැපයුම්කරු|லாபம்|சம்பளம்|சப்ளையர்/iu;
const MONEY = /(?:\brs\.?|\blkr|රු\.?|ரூ\.?)\s*([\d][\d,]*(?:\.\d+)?)|(\d[\d,]*(?:\.\d+)?)\s*(?:\/=|rupees|rs\b|lkr\b)/giu;
const HOURS = /\b\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)\b|\b(?:open|opens|opened|closes?|closed)\s+(?:daily|every|from|at|on|until|till|between)\b|\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?\b/i;
const TIME_PROMISE = /\b(?:within|in|takes?|take|by)\s+\d+\s*(?:business\s+)?(?:days?|weeks?|hours?|minutes?)\b|\b(?:next|same)[-\s]day\b|\b\d+\s*-\s*\d+\s*(?:days?|weeks?)\b|\b(?:today|tomorrow)\s+(?:delivery|morning|evening)\b/i;
const PROMISES = /\b(?:free\s+(?:delivery|installation|shipping|gift|transport)|\d+\s*%\s*(?:off|discount)|discount\s+of|\d+\s*(?:years?|months?)\s+(?:warranty|guarantee)|lifetime\s+(?:warranty|guarantee)|(?:we|i)\s+(?:guarantee|promise)|money[-\s]back\s+guarantee)\b/i;

const norm = s => String(s).replace(/,/g, '').replace(/\.0+$/, '');

/**
 * @param {string} text
 * @param {{prices?: (number|string)[]}} facts  the prices (from the database) this reply may mention
 */
function checkCustomerReply(text, facts = {}) {
    const t = String(text || '');
    if (!t.trim()) return { ok: false, reason: 'empty' };
    if (BOOKS.test(t)) return { ok: false, reason: 'owner books wording' };
    const allowed = new Set((facts.prices || []).map(p => norm(p)));
    for (const m of t.matchAll(MONEY)) {
        const amount = norm(m[1] || m[2]);
        if (!allowed.has(amount)) return { ok: false, reason: 'an amount that is not from the database' };
    }
    if (HOURS.test(t)) return { ok: false, reason: 'opening hours or days' };
    if (TIME_PROMISE.test(t)) return { ok: false, reason: 'a delivery or time promise' };
    if (PROMISES.test(t)) return { ok: false, reason: 'a discount, free offer or warranty promise' };
    return { ok: true };
}

module.exports = { checkCustomerReply };