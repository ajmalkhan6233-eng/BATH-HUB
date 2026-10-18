'use strict';
// utils/geminiVoice.js
// A voice note (Sinhala, Tamil, English or mixed "Singlish") -> what was said, an English version, and, when the owner
// dictated a whole day's expenses or sales, the figures as a DRAFT shape. Pure helpers + one network call.
// Nothing here saves anything: the caller makes a Document Inbox draft and the owner presses Confirm.
// Never throws: a failure returns { ok:false, reason } so the chat can ask the owner to type it.

const MODEL_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const TIMEOUT_MS = 60000;

const PROMPT = `You are listening to a voice note from the owner of a small tile and bathroom shop in Sri Lanka. He speaks Sinhala, Tamil, English, or a mix (Sinhala words with English numbers and item names). Output ONLY valid JSON, no markdown:
{"text":"exactly what was said, in the language spoken (Sinhala in Sinhala letters)","english":"a plain English version of the same words","language":"si|ta|en|mixed","entry":{"kind":"expense_list|day_sheet|credit_given|credit_paid|none","party":"customer name or null","amount":number or null,"note":"what it was for or null","date":"YYYY-MM-DD or null","items":[{"name":"string","amount":number}],"total_expenses":number or null,"total_sale":number or null,"cash_sale":number or null,"card_sale":number or null,"online_sale":number or null,"credit_sale":number or null},"confidence":"high|medium|low","notes":"anything unclear"}
Use kind "expense_list" ONLY when he is listing money spent today (tea 200, petrol 1500). Use kind "day_sheet" ONLY when he is giving the day's sales figures. Use kind "credit_given" ONLY when he says he gave goods or money ON CREDIT to a named customer ("give credit 1500 to Sam for tiles"): party = the customer name as spoken, amount = the credit. Use kind "credit_paid" ONLY when a named customer PAID BACK something they owed ("Sam paid 1000"): party and amount the same way. Never use credit kinds without both a name and an amount. Use kind "none" for everything else (questions, reminders, bills, cheques, chat): then leave the other entry fields null and items empty.
Amounts are rupees as plain numbers (no commas). "දහස" = thousand, "සීයයි" / "සීයක්" = hundred, "ලක්ෂය" = 100000. Say "two thousand five hundred" as 2500. If you are not sure of a number, set confidence to "low" and explain in notes: NEVER guess a figure. Dates are day/month/year in Sri Lanka; if he says "today" or gives no date, use null.`;

const num = v => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(String(v).replace(/[, ]/g, ''));
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
};
const day = v => { const s = String(v == null ? '' : v).trim().slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s)) ? s : ''; };

/** Cleans the model's answer into a predictable shape. Never throws. */
function cleanVoice(raw) {
    const r = raw && typeof raw === 'object' ? raw : {};
    const e = r.entry && typeof r.entry === 'object' ? r.entry : {};
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
    const warnings = [];
    if (kind === 'expense_list' && items.length && entry.total_expenses != null && Math.abs(entry.total_expenses - itemSum) > 0.5) {
        warnings.push(`The items add up to ${itemSum} but the total said is ${entry.total_expenses}. Check both.`);
    }
    if (kind === 'expense_list' && !entry.total_expenses) entry.kind = 'none';
    if (kind === 'day_sheet' && entry.total_sale == null) entry.kind = 'none';
    // a credit entry needs BOTH a name and a positive amount: otherwise it is not an entry at all (nothing is guessed)
    if ((kind === 'credit_given' || kind === 'credit_paid') && (!entry.party || !(entry.amount > 0))) entry.kind = 'none';
    const text = String(r.text || '').trim().slice(0, 2000);
    return {
        text, english: String(r.english || '').trim().slice(0, 2000) || text,
        language: String(r.language || '').slice(0, 10), entry, warnings,
        confidence: ['high', 'medium', 'low'].includes(r.confidence) ? r.confidence : 'low',
        notes: String(r.notes || '').slice(0, 300),
    };
}

/** Voice bytes -> { ok, text, english, language, entry, warnings, confidence, model } via the Gemini free key. */
async function geminiVoice({ key, buffer, mime, fetchFn = globalThis.fetch, model = process.env.GEMINI_VISION_MODEL, listModels }) {
    if (!key) return { ok: false, reason: 'no Gemini key' };
    if (!buffer || !buffer.length) return { ok: false, reason: 'empty audio' };
    const m0 = String(mime || 'audio/ogg').split(';')[0] || 'audio/ogg';
    const tried = []; let lastErr = 'no model';
    const order = model ? [model] : [];
    for (let i = 0; i < 4; i++) {
        let m = order[i];
        if (!m) { const ids = await (listModels || (() => require('../scripts/ocr_photo').geminiModels(key, fetchFn)))().catch(() => []); m = ids.find(x => !tried.includes(x)); if (!m) break; }
        tried.push(m);
        try {
            const r = await fetchFn(`${MODEL_URL}/${m}:generateContent?key=${encodeURIComponent(key)}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS),
                body: JSON.stringify({ contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: m0, data: Buffer.from(buffer).toString('base64') } }] }], generationConfig: { temperature: 0, responseMimeType: 'application/json' } }),
            });
            const j = await r.json();
            if (!r.ok) { const e = new Error(`gemini ${r.status}: ${(j.error && j.error.message) || ''}`.slice(0, 200)); e.status = r.status; throw e; }
            const text = ((((j.candidates || [])[0] || {}).content || {}).parts || []).map(x => x.text || '').join('');
            const mm = text.match(/\{[\s\S]*\}/); if (!mm) throw new Error('gemini returned no JSON');
            const c = cleanVoice(JSON.parse(mm[0]));
            if (!c.text) return { ok: false, reason: 'no speech found' };
            return { ok: true, ...c, model: 'gemini:' + m };
        } catch (e) { lastErr = e.message; if (![400, 404, 429, 500, 503].includes(e.status) && !/timeout|aborted/i.test(e.message)) break; }
    }
    return { ok: false, reason: String(lastErr).slice(0, 160) };
}

module.exports = { geminiVoice, cleanVoice, PROMPT };
