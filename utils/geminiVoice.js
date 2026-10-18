'use strict';
// utils/geminiVoice.js
// A voice note (Sinhala, Tamil, English or mixed "Singlish") -> what was said, an English version, and, when the owner
// dictated a whole day's expenses or sales, the figures as a DRAFT shape. Pure helpers + one network call.
// Nothing here saves anything: the caller makes a Document Inbox draft and the owner presses Confirm.
// Never throws: a failure returns { ok:false, reason } so the chat can ask the owner to type it.

const MODEL_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const TIMEOUT_MS = 60000;

const PROMPT_BASE = `You are listening to a voice note from the owner of Royal Bath Hub, a bathroom accessories and tile shop on Kandy Road, Thihariya, Sri Lanka. He speaks Sri Lankan Sinhala, Tamil, English, or a mix (Sinhala or Tamil words with English numbers, names and item names). The clip may be very short (2-5 seconds) and noisy. Listen carefully and Output ONLY valid JSON, no markdown:
{"text":"exactly what was said, word for word, in the language spoken (Sinhala in Sinhala letters)","english":"a plain English version of the same words","language":"si|ta|en|mixed","entries":[{"kind":"expense_list|day_sheet|credit_given|credit_paid","party":"customer name or null","amount":number or null,"note":"what it was for or null","date":"YYYY-MM-DD or null","items":[{"name":"string","amount":number}],"total_expenses":number or null,"total_sale":number or null,"cash_sale":number or null,"card_sale":number or null,"online_sale":number or null,"credit_sale":number or null}],"confidence":"high|medium|low","notes":"anything unclear"}
ONE voice note can hold SEVERAL things: put each in its own object in "entries". Example: "tea 200, petrol 1500, and I gave Saman 1500 loan" = TWO entries: an expense_list (tea 200, petrol 1500) AND a credit_given (party Saman, amount 1500). Never fold a loan or credit to a person into the expense list, and never add it to the expenses total.
kind "expense_list" ONLY for money spent today (tea 200, petrol 1500). kind "day_sheet" ONLY for the day's sales figures. kind "credit_given" ONLY when he gave goods or money ON CREDIT or as a LOAN to a named customer ("give credit 1500 to Saman", "I gave Mr Saman 1500 loan"): party = the name as spoken, amount = the credit. kind "credit_paid" ONLY when a named customer PAID BACK something owed ("Saman paid 1000", "Saman gave me 1000 back"). Never use a credit kind without BOTH a name and an amount. If nothing is a money entry (question, reminder, bill, cheque, chat) return "entries":[].
Numbers: amounts are rupees as plain numbers, no commas. Sinhala: "දහස" = thousand, "සීයයි"/"සීයක්" = hundred, "ලක්ෂය" = 100000, "පන්සීයයි" = 500, "දෙදහස" = 2000. Tamil: "ஆயிரம்" = thousand, "நூறு" = hundred. English "fifteen hundred" = 1500, "two fifty" = 250. Do NOT turn a spoken name into a number (the name "Saman" is never "532"): if a word could be a name, treat it as a name. If you are not sure of a number or a name, set confidence to "low", say so in notes, and NEVER guess a figure. Dates are day/month/year in Sri Lanka; "today" or no date = null.`;

/** The prompt, with the shop's own names added so a name heard badly is matched to a real one. */
function buildPrompt(hints) {
    const h = hints && typeof hints === 'object' ? hints : {};
    const list = a => (Array.isArray(a) ? a : []).map(x => String(x || '').trim()).filter(Boolean).slice(0, 80).join(', ');
    const lines = [];
    if (list(h.customers)) lines.push(`Customer names this shop knows (prefer one of these when a name sounds close): ${list(h.customers)}.`);
    if (list(h.vendors)) lines.push(`Supplier names: ${list(h.vendors)}.`);
    lines.push('Words he often uses: tea, petrol, lunch, transport, labour, tiles, tap, shower, basin, commode, mirror, cheque, credit, loan, paid, GRN, cash, card.');
    return PROMPT_BASE + '\n' + lines.join('\n');
}
const PROMPT = PROMPT_BASE;

const num = v => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(String(v).replace(/[, ]/g, ''));
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
};
const day = v => { const s = String(v == null ? '' : v).trim().slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s)) ? s : ''; };

function cleanEntry(e, warnings) {
    e = e && typeof e === 'object' ? e : {};
    const kind = ['expense_list', 'day_sheet', 'credit_given', 'credit_paid'].includes(e.kind) ? e.kind : 'none';
    const items = (Array.isArray(e.items) ? e.items : []).slice(0, 60)
        .map(i => ({ name: String((i && i.name) || '').trim().slice(0, 120), amount: num(i && i.amount) }))
        .filter(i => i.name && i.amount != null);
    const itemSum = Math.round(items.reduce((s, i) => s + i.amount, 0) * 100) / 100;
    const entry = {
        kind, date: day(e.date), items,
        total_expenses: num(e.total_expenses), total_sale: num(e.total_sale), cash_sale: num(e.cash_sale),
        card_sale: num(e.card_sale), online_sale: num(e.online_sale), credit_sale: num(e.credit_sale),
        party: String(e.party || '').trim().slice(0, 150), amount: num(e.amount), note: String(e.note || '').trim().slice(0, 300),
    };
    // an expense list with no stated total: the total is the sum of the lines he said
    if (kind === 'expense_list' && entry.total_expenses == null && items.length) entry.total_expenses = itemSum;
    // a stated total that does not match the lines is not trusted silently: the owner is told
    if (kind === 'expense_list' && items.length && entry.total_expenses != null && Math.abs(entry.total_expenses - itemSum) > 0.5) {
        warnings.push(`The items add up to ${itemSum} but the total said is ${entry.total_expenses}. Check both.`);
    }
    if (kind === 'expense_list' && !entry.total_expenses) entry.kind = 'none';
    if (kind === 'day_sheet' && entry.total_sale == null) entry.kind = 'none';
    // a credit entry needs BOTH a name and a positive amount: otherwise it is not an entry at all (nothing is guessed)
    if ((kind === 'credit_given' || kind === 'credit_paid') && (!entry.party || !(entry.amount > 0))) entry.kind = 'none';
    return entry;
}

/** Cleans the model's answer into a predictable shape. One note can hold several entries (expenses AND a loan). Never throws. */
function cleanVoice(raw) {
    const r = raw && typeof raw === 'object' ? raw : {};
    const warnings = [];
    const list = Array.isArray(r.entries) ? r.entries : (r.entry ? [r.entry] : []);
    const cleaned = list.slice(0, 6).map(e => cleanEntry(e, warnings));
    const entries = cleaned.filter(e => e.kind !== 'none');
    const entry = entries[0] || cleaned[0] || cleanEntry({}, warnings);
    const text = String(r.text || '').trim().slice(0, 2000);
    return {
        text, english: String(r.english || '').trim().slice(0, 2000) || text,
        language: String(r.language || '').slice(0, 10), entry, entries, warnings,
        confidence: ['high', 'medium', 'low'].includes(r.confidence) ? r.confidence : 'low',
        notes: String(r.notes || '').slice(0, 300),
    };
}

const RANK = { high: 3, medium: 2, low: 1 };
let _pro = { at: 0, ids: [] };
/** Stronger (Pro) Gemini models this key can call, newest first. Used only for a second opinion on a doubtful clip. */
async function proModels(key, fetchFn = globalThis.fetch) {
    if (Date.now() - _pro.at < 3600e3 && _pro.ids.length) return _pro.ids;
    const r = await fetchFn(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}&pageSize=200`, { signal: AbortSignal.timeout(10000) });
    const d = (await r.json()).models || [];
    const ids = d.filter(m => /pro/i.test(m.name) && !/image|tts|live|audio|embedding|lite|vision|deep/i.test(m.name) && (m.supportedGenerationMethods || []).includes('generateContent'))
        .map(m => m.name.replace(/^models\//, '')).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    _pro = { at: Date.now(), ids };
    return ids;
}

async function callModel({ key, m, m0, buffer, hints, fetchFn, timeout }) {
    const r = await fetchFn(`${MODEL_URL}/${m}:generateContent?key=${encodeURIComponent(key)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(timeout),
        body: JSON.stringify({ contents: [{ parts: [{ text: buildPrompt(hints) }, { inline_data: { mime_type: m0, data: Buffer.from(buffer).toString('base64') } }] }], generationConfig: { temperature: 0, responseMimeType: 'application/json' } }),
    });
    const j = await r.json();
    if (!r.ok) { const e = new Error(`gemini ${r.status}: ${(j.error && j.error.message) || ''}`.slice(0, 200)); e.status = r.status; throw e; }
    const text = ((((j.candidates || [])[0] || {}).content || {}).parts || []).map(x => x.text || '').join('');
    const mm = text.match(/\{[\s\S]*\}/); if (!mm) throw new Error('gemini returned no JSON');
    return cleanVoice(JSON.parse(mm[0]));
}

/** Voice bytes -> { ok, text, english, language, entry, entries, warnings, confidence, model } via the Gemini free key.
 *  A doubtful answer (low confidence, or no entry although money words were heard) gets ONE second opinion from a Pro model; the better answer wins. */
async function geminiVoice({ key, buffer, mime, fetchFn = globalThis.fetch, model = process.env.GEMINI_VISION_MODEL, listModels, listPro, hints, budgetMs = 55000, sleep = ms => new Promise(r => setTimeout(r, ms)) }) {
    const t0 = Date.now();
    if (!key) return { ok: false, reason: 'no Gemini key' };
    if (!buffer || !buffer.length) return { ok: false, reason: 'empty audio' };
    const m0 = String(mime || 'audio/ogg').split(';')[0] || 'audio/ogg';
    const tried = []; let lastErr = 'no model';
    const order = model ? [model] : [];
    let best = null;
    for (let i = 0; i < 6; i++) {
        const left = budgetMs - (Date.now() - t0);
        if (left < 4000) { break; }
        let m = order[i];
        if (!m) { const ids = await (listModels || (() => require('../scripts/ocr_photo').geminiModels(key, fetchFn)))().catch(() => []); m = ids.find(x => !tried.includes(x)); if (!m) break; }
        tried.push(m);
        try {
            const c = await callModel({ key, m, m0, buffer, hints, fetchFn, timeout: Math.min(TIMEOUT_MS, left) });
            if (!c.text) return { ok: false, reason: 'no speech found' };
            best = { ok: true, ...c, model: 'gemini:' + m };
            break;
        } catch (e) { lastErr = e.message; if (![400, 404, 429, 500, 503].includes(e.status) && !/timeout|aborted/i.test(e.message)) break; if ([429, 503].includes(e.status)) await sleep(Math.min(1500 * (i + 1), 4000)); }
    }
    if (!best) return { ok: false, reason: String(lastErr).slice(0, 160) };
    // second opinion on a doubtful clip: low confidence, or money words / digits heard but no entry made
    const moneyWords = /\d|loan|credit|paid|tea|petrol|rs\b|rupee|දහස|සීය|ලක්ෂ|ஆயிரம்|நூறு/i.test(`${best.text} ${best.english}`);
    const doubtful = best.confidence === 'low' || (!best.entries.length && moneyWords);
    const left = budgetMs - (Date.now() - t0);
    if (doubtful && left > 12000) {
        try {
            const ids = await (listPro || (() => proModels(key, fetchFn)))().catch(() => []);
            const pm = ids.find(x => !tried.includes(x));
            if (pm) {
                const c = await callModel({ key, m: pm, m0, buffer, hints, fetchFn, timeout: Math.min(TIMEOUT_MS, left) });
                const better = c.text && (c.entries.length > best.entries.length || (c.entries.length === best.entries.length && RANK[c.confidence] > RANK[best.confidence]));
                if (better) best = { ok: true, ...c, model: 'gemini:' + pm + ' (2nd opinion)' };
            }
        } catch (e) { /* the Pro model may not be on the free plan: keep the first answer */ }
    }
    return best;
}

module.exports = { geminiVoice, cleanVoice, PROMPT, buildPrompt, proModels };
