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
const INTERNAL_RE = /\b(?:cost\s+price|our\s+cost|unit\s+cost|landed\s+cost|avg[_\s-]?cost|buying\s+price|supplier\s+(?:price|cost)|wholesale|margin|mark-?up|net\s+profit|gross\s+profit|profit|loans?|lenders?|investors?|commissions?|salary|salaries|cheques?|credit\s+balance)\b|ලාභය?|ණය|කොමිස්|වැටුප්|පඩි|සැපයුම්කරු|ගැනුම් මිල|லாபம்|கடன்|கமிஷன்|சம்பளம்|கொள்முதல் விலை|விநியோகஸ்தர்|சப்ளையர்/gi;

const HALAL_RE = /\binterest\s*(?:rate|free|charge|%)|\d+(?:\.\d+)?\s*%\s*interest|\bwith\s+interest\b|\binterest[-\s]bearing\b|\bcompound(?:ed)?\s+interest\b|\b(?:riba|usury)\b|\b(?:late|penalty)\s+(?:fee|charge|interest)s?\b|\bgambl\w*|\blotter(?:y|ies)\b|\blottery\b|\braffle\b|\bguaranteed\s+(?:return|profit)s?\b|\bdouble\s+your\s+money\b|පොලී|வட்டி/gi;

const HEDGE_NUMBER_RE = /\b(?:probably|maybe|perhaps|i\s+think|i\s+guess|around|approximately|roughly|about)\b[^.\n]*\d/i;

const uniq = a => [...new Set(a.map(s => s.toLowerCase().replace(/\s+/g, ' ')))];

/**
 * @param {string} text    the draft reply
 * @param {object} ctx     { dataMissing: bool, internalValues: string[] (e.g. a product's cost, never to appear) }
 * @returns {{passed: boolean, checks: {id, label, pass, detail}[]}}
 */
function checkReply(text, ctx = {}) {
    const full = String(text || '');
    // Aj's internal "needs approval" note is not customer-facing: the leak / halal / don't-know checks read the customer text only.
    const t = full.split('\n').filter(l => !MARKER_RE.test(l)).join('\n');
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
    const marked = MARKER_RE.test(full);
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

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Screening of the INCOMING customer message (English, Sinhala, Tamil), before anything is answered.
//   override  : tries to change the agent's rules / reveal its instructions / force exact wording  -> blocked
//   internal  : fishes for cost, margin, supplier, loans, staff pay, profit, other customers' balances -> blocked
//   interest  : interest-based deals, guaranteed returns, investing in the shop (halal rule)         -> blocked
//   approval  : discount, special / bulk / wholesale price, credit or instalments                    -> answered but MARKED "needs Aj approval"
// ─────────────────────────────────────────────────────────────────────────────────────────────
const OVERRIDE_RE = /\b(?:ignore|disregard|forget|override|bypass)\b[^.\n]{0,40}\b(?:instructions?|rules?|prompts?|guidelines?|restrictions?|polic(?:y|ies))\b|\b(?:system|developer|admin)\s*(?:prompt|mode|message)\b|^\s*system\s*:|\byou\s+are\s+now\b|\bjailbreak\b|\b(?:print|show|reveal|repeat|tell\s+me|list|display|dump)\b[^.\n]{0,30}\b(?:rulebook|rules|instructions|system\s*prompt|prompt)\b|\b(?:reply|respond|answer|say|write)\s+(?:exactly|only)?\s*(?:with|:)\s*[:"']?\s*\S|\bpretend\s+(?:you|to)\b|\bact\s+as\b|උපදෙස්[^.\n]{0,20}(?:නොසලකා|අමතක)|(?:නීති|රීති)[^.\n]{0,20}(?:නොසලකා|අමතක)|வழிமுறை[^.\n]{0,25}(?:புறக்கணி|மறந்து)|விதிகள?[^.\n]{0,25}(?:புறக்கணி|மறந்து)/i;

const INTERNAL_ASK_RE = /\b(?:buying\s+rate|cost\s+rate|dealer\s+rate|what\s+(?:did|does|has)\s+\w+\s+(?:buy|bought|purchase\w*|order\w*)|(?:other|another)\s+customers?|customer\s+list|owner'?s?\s+(?:personal\s+)?(?:phone|number|address)|staff\s+(?:names?|phones?|numbers?|details)|cost\s+price|our\s+cost|your\s+cost|unit\s+cost|landed\s+cost|buying\s+price|purchase\s+price|wholesale\s+cost|what\s+(?:you|u)\s+(?:paid|pay)|how\s+much\s+did\s+you\s+(?:pay|buy)|margin|mark-?up|profit|supplier|suppliers|vendor|loans?|lenders?|investors?|commission|salary|salaries|wages|payroll|net\s+sales|credit\s+balance|owes?|owed|outstanding\s+balance|balance\s+of)\b|ලාභ|ණය|කොමිස්|වැටුප්|පඩි|සැපයුම්කරු|ගැනුම් මිල|පිරිවැය|லாபம்|கடன்|கமிஷன்|சம்பளம்|கொள்முதல் விலை|விநியோகஸ்தர்|சப்ளையர்/i;
// Letters-only version, to catch "c.o.s.t p.r.i.c.e" and "s u p p l i e r" style obfuscation (long words only).
const SQUASHED_INTERNAL_RE = /costprice|buyingprice|purchaseprice|supplier|commission|salary|salaries|profit|margin|investor|markup/;

const INTEREST_RE = /\b(?:riba|usury)\b|\binterest\b(?=[^.\n]*\b(?:instal+ments?|credit|pay|paying|loan|deal|rate|extra|more|borrow|finance|lease|month)\b)|\b(?:instal+ments?|credit|pay|paying|loan|deal|rate|extra|more|borrow|finance|lease)\b[^.\n]*\binterest\b|(?:\d+\s*%|percent)[^.\n]{0,20}\binterest\b|\binterest\b[^.\n]{0,12}%|\bpay(?:\s+you)?\s+back\s+more\b|\brepay\s+more\b|\bguaranteed\s+(?:profit|return|income)s?\b|\binvest(?:ing|ment)?\s+in\s+(?:your|the)\s+(?:shop|business|company)\b|\bdouble\s+my\s+money\b|පොලී|வட்டி/i;

const APPROVAL_RULES = [
    [/\b(?:discounts?|\d+\s*%\s*off|percent\s+off|off\s+the\s+price|reduce(?:d)?\s+(?:the\s+)?price|lower\s+(?:the\s+)?price|cheaper|best\s+price|special\s+price|last\s+price|negotiat\w*|bargain\w*|haggle|waive|free\s+delivery)\b|වට්ටම|අඩු මිලට|தள்ளுபடி|குறைந்த விலை/i, 'discount or special price request'],
    [/\b(?:wholesale|bulk|trade\s+price|dealer\s+price|contractor\s+price)\b|\b(?:[5-9]\d|\d{3,})\s*(?:boxes|box|pcs|pieces|tiles|sqm|sq\s*ft)\b/i, 'bulk / wholesale price request'],
    [/\b(?:on\s+credit|credit\s+(?:facility|terms|purchase)|pay\s+later|instal+ments?|pay\s+in\s+parts|cheque\s+later|post-?dated)\b/i, 'credit or instalment request'],
];

// -> { block: 'override'|'internal'|'interest'|null, reasons: [...], approval: [...] }
function screenIncoming(text) {
    const raw = String(text || '').normalize('NFKC').toLowerCase();
    const noZw = raw.replace(/[​‌⁠﻿]/g, '');            // zero-width tricks (ZWJ is kept: Sinhala uses it)
    const forms = [raw, noZw];
    const any = re => forms.some(f => re.test(f));
    const squashed = noZw.replace(/[^a-z]/g, '');

    const reasons = [];
    const override = any(OVERRIDE_RE);
    if (override) reasons.push("tries to override the agent's rules or reveal its instructions");
    const internal = any(INTERNAL_ASK_RE) || SQUASHED_INTERNAL_RE.test(squashed);
    if (internal) reasons.push("asks for internal data (cost, margin, supplier, loans, staff pay, profit or another customer's account)");
    const interest = any(INTEREST_RE);
    if (interest) reasons.push('asks for an interest-based or guaranteed-return arrangement (not halal)');
    const approval = APPROVAL_RULES.filter(([re]) => any(re)).map(([, why]) => why);

    return { block: override ? 'override' : internal ? 'internal' : interest ? 'interest' : null, reasons, approval };
}

// Puts the approval mark on top of a reply (once), with the reason, for Aj. It is stripped from the customer text.
function markApproval(text, reasons) {
    const t = String(text || '');
    if (MARKER_RE.test(t)) return t;
    return `[NEEDS AJ APPROVAL: ${reasons.join('; ')}]\n${t}`;
}

const OVERRIDE_REPLY = "I can only help with questions about Bath Hub's products and the shop. Aj will help you with anything else.";
const INTEREST_REPLY = "We don't offer anything that involves interest. Aj will be happy to talk to you about other ways to pay.";
const APPROVAL_SENTENCE = "Discounts, special prices and payment arrangements are decided by Aj. I've passed your request to him and he will reply to you.";

// Intents the LAYLA engine answers for the OWNER (profit, credit balances, cheques). A customer never gets these.
const INTERNAL_INTENTS = new Set(['net_profit_day', 'net_profit_range', 'net_profit_month', 'credit_balance', 'pending_cheques']);

const SAFE_REFUSAL = "I'm sorry, I can't share that. Aj will be happy to help you directly.";
const UNKNOWN_REPLY = `Thank you for contacting Bath Hub. ${DONT_KNOW} the answer to that yet, so I won't guess. Aj will reply to you shortly.`;

module.exports = {
    checkReply, markPriceIfNeeded, customerText, hasPrice,
    screenIncoming, markApproval, OVERRIDE_REPLY, INTEREST_REPLY, APPROVAL_SENTENCE,
    INTERNAL_INTENTS, SAFE_REFUSAL, UNKNOWN_REPLY, PRICE_MARKER, DONT_KNOW,
};
