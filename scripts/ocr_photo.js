// Shared OCR helper: extracts sale/expense figures from a photo of a handwritten
// day sheet or petty cash sheet, via OpenRouter's vision model
// (nvidia/nemotron-nano-12b-vl:free). Used by both the Nature upload
// endpoint (server.js) and the WhatsApp photo pipeline (whatsapp-bridge.js).
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') }); // don't rely on the caller having loaded it
const { client } = require('../openrouter.config');

const VISION_MODEL = process.env.OCR_VISION_MODEL || 'nvidia/nemotron-nano-12b-v2-vl:free';
// Free vision models come and go on OpenRouter ("404 No endpoints found"). Try the configured
// one first, then ask OpenRouter which free image-reading models exist right now.
// real vision models first; some free models are restricted to "agentic harnesses" (403) and are tried last
const PREFERRED = /gemma|qwen.*vl|llama.*(vision|4)|pixtral|mistral.*(small|3)|nemotron.*vl|molmo|internvl|glm.*v/i;
let _freeCache = { at: 0, ids: [] };
async function discoverFreeVisionModels(fetchFn = globalThis.fetch) {
    if (Date.now() - _freeCache.at < 3600e3 && _freeCache.ids.length) return _freeCache.ids;
    try {
        const r = await fetchFn('https://openrouter.ai/api/v1/models', { signal: AbortSignal.timeout(10000) });
        const d = (await r.json()).data || [];
        const ids = d.filter(m => m.pricing && String(m.pricing.prompt) === '0' && String(m.pricing.completion) === '0'
            && ((m.architecture || {}).input_modalities || []).includes('image') && ((m.architecture || {}).output_modalities || ['text']).includes('text'))
            .sort((a, b) => (PREFERRED.test(b.id) - PREFERRED.test(a.id)) || ((b.context_length || 0) - (a.context_length || 0))).map(m => m.id);
        if (ids.length) _freeCache = { at: Date.now(), ids };
        return ids;
    } catch (e) { return _freeCache.ids; }
}
const OCR_TIMEOUT_MS = 45000; // free vision models can be slow/flaky - fail fast rather than hang the caller (e.g. LAYLA)

// document_type classification added 2026-07-04 (Item 3B) so cheque notes and
// invoices don't get force-fit into the day-sheet schema or silently rejected.
// Each type gets its own extraction fields; unrecognized fields for a given
// type are simply absent, not fabricated.
const PROMPT = `You are reading a photo from a Sri Lankan retail shop's paperwork. First classify what KIND of document this is, then extract only the fields that apply to that type. Output ONLY valid JSON, no markdown, no explanation.

FIRST look for a HEADING written or printed at the top of the paper. The shop writes one of these: "BILL" (a manual customer bill), "GRN" or "GOODS RECEIVED" (goods received from a supplier), "CHEQUE" (a cheque note), "EXPENSES" (an expense list), "DAILY SALES" or "DAY SHEET" (the day's sales). The heading decides the type. If there is no heading, decide from the content.

DATES are written day/month/year in Sri Lanka: "09/07/2026" or "09-07-2026" means 9 July 2026, so output "2026-07-09". Never read them month-first. If the year is missing, use null.
Amounts are written like "25000/-" or "1150001-": the slash or dash after the number is not part of it. Numbers must be plain (no commas).

Possible document_type values: "manual_bill" (heading BILL: a handwritten customer bill with items and a total), "grn" (heading GRN: goods received from a supplier, with items and quantities), "day_sheet" (daily sales/petty cash sheet: date, petty cash, expenses list, payouts/payments list, total sale, total cash/card/online, cash in, cash out, cash in hand, cash banked), "expense_sheet" (handwritten expense list), "salary_note" (a list of staff names with an amount each, usually headed Salary), "cheque_note" (heading CHEQUE: a handwritten note recording a cheque - has a cheque number, payee, amount, bank), "invoice" (a printed supplier/vendor invoice or receipt with no GRN heading), "unknown" (anything else - a person, product photo, room, random object).

For document_type "manual_bill", output:
{"document_type":"manual_bill","bill_number":"string or null","date":"YYYY-MM-DD or null","customer_name":"string or null","customer_phone":"string or null","items":[{"name":"string","qty":number,"unit_price":number or null,"amount":number or null}],"subtotal":number or null,"discount":number or null,"total":number or null,"payment_method":"cash|card|online|cheque|credit or null","confidence":"high|medium|low","notes":"anything unclear or illegible"}

For document_type "grn", output:
{"document_type":"grn","grn_number":"string or null","date":"YYYY-MM-DD or null","supplier_name":"string or null","items":[{"item_code":"the item code/number written beside the line, or null","description":"string","qty":number,"unit_cost":number or null,"amount":number or null}],"total":number or null,"confidence":"high|medium|low","notes":"anything unclear or illegible"}
On a GRN the supplier (company) name is usually written at the top or on the supplier's invoice; copy it exactly. Copy each item code exactly as written, digits and letters.

For document_type "day_sheet" or "expense_sheet", output:
{"document_type":"day_sheet","date":"YYYY-MM-DD or null","total_sale":number or null,"cash_sale":number or null,"card_sale":number or null,"online_sale":number or null,"credit_sale":number or null,"total_expenses":number or null,"expense_items":"short text description of expense line items, or null","petty_cash":number or null,"payouts":"short text of the payouts/payments lines (who and how much), or null","total_payouts":number or null,"cash_in":number or null,"cash_out":number or null,"cash_in_hand":number or null,"cash_banked":number or null,"confidence":"high|medium|low","notes":"anything unclear or illegible, and any totals that do not add up"}

For document_type "salary_note", output:
{"document_type":"salary_note","date":"YYYY-MM-DD or null","lines":[{"name":"string","amount":number,"note":"e.g. advance, or null"}],"total":number or null,"confidence":"high|medium|low","notes":"anything unclear, crossed out or illegible"}

For document_type "cheque_note", output:
{"document_type":"cheque_note","cheque_number":"string or null","bank":"string or null","amount":number or null,"payee":"string or null","due_date":"YYYY-MM-DD or null","confidence":"high|medium|low","notes":"anything unclear or illegible"}

For document_type "invoice", output:
{"document_type":"invoice","invoice_number":"string or null","payee":"supplier/vendor name or null","amount":number or null,"date":"YYYY-MM-DD or null","confidence":"high|medium|low","notes":"anything unclear or illegible"}

For document_type "unknown", output:
{"document_type":"unknown"}

Rules: never guess a number, date, or name you cannot actually read - use null instead. If a field is genuinely illegible, set confidence to "low" and say why in notes. Do not invent a document_type just to fill in fields - if genuinely unsure between two types, pick the closer one and lower confidence rather than fabricate.`;


// ── Gemini (Google AI Studio free key) is tried FIRST when GEMINI_API_KEY is in .env: far steadier than the free OpenRouter models.
// Model: GEMINI_VISION_MODEL, else the newest "flash" model the key can use (looked up live, so a retired name never breaks it).
let _gemModels = { at: 0, ids: [] };
async function geminiModels(key, fetchFn = globalThis.fetch) {
    if (Date.now() - _gemModels.at < 3600e3 && _gemModels.ids.length) return _gemModels.ids;
    const r = await fetchFn(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}&pageSize=200`, { signal: AbortSignal.timeout(10000) });
    const d = (await r.json()).models || [];
    const ids = d.filter(m => /flash/i.test(m.name) && !/image|tts|live|audio|embedding|thinking-exp/i.test(m.name) && (m.supportedGenerationMethods || []).includes('generateContent'))
        .map(m => m.name.replace(/^models\//, '')).sort((a, b) => /lite/i.test(a) - /lite/i.test(b) || b.localeCompare(a, undefined, { numeric: true }));
    if (ids.length) _gemModels = { at: Date.now(), ids };
    return ids;
}
async function geminiOcr({ key, base64, mime, fetchFn = globalThis.fetch, model = process.env.GEMINI_VISION_MODEL }) {
    const tried = []; let lastErr;
    const order = model ? [model] : [];
    for (let i = 0; i < 4; i++) {
        let m = order[i];
        if (!m) { const ids = await geminiModels(key, fetchFn).catch(() => []); m = ids.find(x => !tried.includes(x)); if (!m) break; }
        tried.push(m);
        try {
            const r = await fetchFn(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${encodeURIComponent(key)}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(OCR_TIMEOUT_MS),
                body: JSON.stringify({ contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: mime, data: base64 } }] }], generationConfig: { temperature: 0, responseMimeType: 'application/json' } }),
            });
            const j = await r.json();
            if (!r.ok) { const e = new Error(`gemini ${r.status}: ${(j.error && j.error.message) || ''}`.slice(0, 200)); e.status = r.status; throw e; }
            const raw = (((j.candidates || [])[0] || {}).content || {}).parts || [];
            const text = raw.map(x => x.text || '').join('');
            const mm = text.match(/\{[\s\S]*\}/); if (!mm) throw new Error('gemini returned no JSON');
            return { parsed: JSON.parse(mm[0]), raw: text, model: 'gemini:' + m };
        } catch (e) { lastErr = e; if (![400, 404, 429, 500, 503].includes(e.status) && !/timeout|aborted/i.test(e.message)) break; }
    }
    throw lastErr || new Error('no Gemini model available');
}

// Standing rule: never guess - flag uncertain fields, don't fabricate.
async function ocrPhoto(filePath) {
    const imageBuffer = fs.readFileSync(filePath);
    const base64 = imageBuffer.toString('base64');
    const ext = filePath.split('.').pop().toLowerCase();
    const mime = ext === 'png' ? 'image/png' : 'image/jpeg';

    if (process.env.GEMINI_API_KEY) {
        try { const g = await geminiOcr({ key: process.env.GEMINI_API_KEY, base64, mime }); return { ...g.parsed, _raw: g.raw, _model: g.model, _file: filePath }; }
        catch (e) { console.error('[ocr] Gemini failed, trying OpenRouter:', e.message); }
    }
    const body = model => ({
        model,
        messages: [{ role: 'user', content: [
            { type: 'text', text: PROMPT },
            { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } },
        ] }],
        max_tokens: 1800,          // a manual bill or GRN lists every item
    });
    let response, usedModel = VISION_MODEL, lastErr;
    const tried = [VISION_MODEL];
    for (let i = 0; i < 8; i++) {
        try { response = await client.chat.completions.create(body(usedModel), { timeout: OCR_TIMEOUT_MS }); lastErr = null; break; }
        catch (e) {
            lastErr = e;
            if (![404, 429, 502, 503, 400, 403, 408].includes(e.status) && !/No endpoints|timed out|timeout/i.test(e.message || '')) break;
            const next = (await discoverFreeVisionModels()).find(id => !tried.includes(id));
            if (!next) break;
            tried.push(next); usedModel = next;
        }
    }
    if (lastErr) throw lastErr;
    const raw = response.choices?.[0]?.message?.content || '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error(`OCR returned no parseable JSON. Raw: ${raw.slice(0, 200)}`);
    const parsed = JSON.parse(jsonMatch[0]);
    return { ...parsed, _raw: raw, _model: usedModel, _file: filePath };
}

module.exports = { ocrPhoto, PROMPT, discoverFreeVisionModels, geminiOcr, _resetGeminiCache: () => { _gemModels = { at: 0, ids: [] }; } };
