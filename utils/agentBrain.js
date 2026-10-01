// utils/agentBrain.js
// M9 AGENT BRAIN, pure logic: the checks every customer reply must pass before it is saved as a draft,
// and the helpers that build a safe draft. No database, no network, and nothing here can send a message.
//
// The four checks (all must pass for Aj to be able to approve):
//   a) no_internal_data   no cost, margin, supplier price, loan, commission, salary, profit or cheque data
//   b) price_marked       any price in the reply is marked "needs Aj approval"
//   c) halal              no interest / riba, late-payment penalties, gambling or guaranteed-return talk
//   d) says_dont_know     when the data is missing the reply says "I don't know" and does not guess

const PRICE_MARKER = '[NEEDS AJ APPROVAL: this reply quotes a price]';
const MARKER_RE = /needs\s+aj\s+approval/i;
const DONT_KNOW = "I don't know";
const DONT_KNOW_RE = /\bI\s+(?:do\s*not|don't|dont)\s+know\b/i;

// Same idea as M6's price flag: Rs / LKR amounts, "4500/=", "per sqm / box / piece".
const PRICE_RE = /\b(?:rs\.?|lkr)\s*\d|\d[\d,]*\s*(?:\/=|rs\b|lkr\b|per\s*(?:sq|sqm|box|piece|pc))|\bper\s*(?:sq\s*ft|sqft|sqm|sq\.?\s*m)\b/i;
const hasPrice = t => PRICE_RE.test(String(t || ''));

// Things a customer must never be told. "cost" alone is allowed ("delivery cost"); our cost is not.
const INTERNAL_RE = /\b(?:cost\s+price|our\s+cost|unit\s+cost|landed\s+cost|avg[_\s-]?cost|buying\s+price|supplier\s+(?:price|cost)|wholesale|margin|mark-?up|net\s+profit|gross\s+profit|profit|loans?|lenders?|investors?|commissions?|salary|salaries|cheques?|credit\s+balance)\b/gi;

const HALAL_RE = /\binterest\s*(?:rate|free|charge|%)|\d+(?:\.\d+)?\s*%\s*interest|\bwith\s+interest\b|\binterest[-\s]bearing\b|\bcompound(?:ed)?\s+interest\b|\b(?:riba|usury)\b|\b(?:late|penalty)\s+(?:fee|charge|interest)s?\b|\bgambl\w*|\blotter(?:y|ies)\b|\blottery\b|\braffle\b|\bguaranteed\s+(?:return|profit)s?\b|\bdouble\s+your\s+money\b/gi;

const HEDGE_NUMBER_RE = /\b(?:probably|maybe|perhaps|i\s+think|i\s+guess|around|approximately|roughly|about)\b[^.\n]*\d/i;

const uniq = a => [...new Set(a.map(s => s.toLowerCase().replace(/\s+/g, ' ')))];

/**
 * @param {string} text    the draft reply
 * @param {object} ctx     { dataMissing: bool, internalValues: string[] (e.g. a product's cost, never to appear) }
 * @returns {{passed: boolean, checks: {id, label, pass, detail}[]}}
 */
function checkReply(text, ctx = {}) {
    const t = String(text || '');
    const checks = [];

    // a) internal data
    const found = uniq([...(t.match(INTERNAL_RE) || [])]);
    const leakedValues = (ctx.internalValues || []).map(v => String(v).trim()).filter(v => v.length >= 3 && t.replace(/,/g, '').includes(v.replace(/,/g, '')));
    checks.push({
        id: 'no_internal_data', label: 'No cost, margin, loan or commission data',
        pass: !found.length && !leakedValues.length,
        detail: found.length || leakedValues.length
            ? `Found: ${[...found, ...leakedValues.map(v => `internal figure ${v}`)].join(', ')}`
            : 'Nothing internal found',
    });

    // b) price marker
    const priced = hasPrice(t);
    const marked = MARKER_RE.test(t);
    checks.push({
        id: 'price_marked', label: 'Any price is marked "needs Aj approval"',
        pass: !priced || marked,
        detail: !priced ? 'No price in the reply' : marked ? 'Price is marked for Aj to approve' : 'A price is quoted without the "needs Aj approval" mark',
    });

    // c) halal
    const haram = uniq([...(t.match(HALAL_RE) || [])]);
    checks.push({
        id: 'halal', label: 'No halal-rule breach',
        pass: !haram.length,
        detail: haram.length ? `Found: ${haram.join(', ')}` : 'No interest, penalty-fee, gambling or guaranteed-return wording',
    });

    // d) don't know
    const missing = !!ctx.dataMissing;
    const saysDontKnow = DONT_KNOW_RE.test(t);
    const guessing = missing && HEDGE_NUMBER_RE.test(t);
    checks.push({
        id: 'says_dont_know', label: 'Says "I don\'t know" when data is missing',
        pass: !missing || (saysDontKnow && !guessing),
        detail: !missing ? 'The data needed was found' : guessing ? 'Data is missing but the reply hedges with a number (a guess)' : saysDontKnow ? 'Data is missing and the reply says so' : 'Data is missing but the reply does not say "I don\'t know"',
    });

    return { passed: checks.every(c => c.pass), checks };
}

// Adds the approval mark on top of a reply that quotes a price (once).
function markPriceIfNeeded(text) {
    const t = String(text || '');
    return hasPrice(t) && !MARKER_RE.test(t) ? `${PRICE_MARKER}\n${t}` : t;
}

// What Aj copies to the customer: the draft without the internal approval mark.
function customerText(text) {
    return String(text || '').split('\n').filter(l => !MARKER_RE.test(l)).join('\n').trim();
}

// Intents the LAYLA engine answers for the OWNER (profit, credit balances, cheques). A customer never gets these.
const INTERNAL_INTENTS = new Set(['net_profit_day', 'net_profit_range', 'net_profit_month', 'credit_balance', 'pending_cheques']);

const SAFE_REFUSAL = "I'm sorry, I can't share that. Aj will be happy to help you directly.";
const UNKNOWN_REPLY = `Thank you for contacting Bath Hub. ${DONT_KNOW} the answer to that yet, so I won't guess. Aj will reply to you shortly.`;

module.exports = {
    checkReply, markPriceIfNeeded, customerText, hasPrice,
    INTERNAL_INTENTS, SAFE_REFUSAL, UNKNOWN_REPLY, PRICE_MARKER, DONT_KNOW,
};
