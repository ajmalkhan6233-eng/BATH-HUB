// Shared OCR helper: extracts sale/expense figures from a photo of a handwritten
// day sheet or petty cash sheet, via OpenRouter's vision model
// (nvidia/nemotron-nano-12b-vl:free). Used by both the Nature upload
// endpoint (server.js) and the WhatsApp photo pipeline (whatsapp-bridge.js).
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') }); // don't rely on the caller having loaded it
const { client } = require('../openrouter.config');

const VISION_MODEL = process.env.OCR_VISION_MODEL || 'nvidia/nemotron-nano-12b-v2-vl:free';
const OCR_TIMEOUT_MS = 45000; // free vision models can be slow/flaky - fail fast rather than hang the caller (e.g. LAYLA)

// document_type classification added 2026-07-04 (Item 3B) so cheque notes and
// invoices don't get force-fit into the day-sheet schema or silently rejected.
// Each type gets its own extraction fields; unrecognized fields for a given
// type are simply absent, not fabricated.
const PROMPT = `You are reading a photo from a Sri Lankan retail shop's paperwork. First classify what KIND of document this is, then extract only the fields that apply to that type. Output ONLY valid JSON, no markdown, no explanation.

Possible document_type values: "day_sheet" (daily sales/petty cash sheet), "expense_sheet" (handwritten expense list), "cheque_note" (a handwritten note recording a cheque being issued - has a cheque number, payee, amount, bank), "invoice" (a supplier/vendor invoice or receipt), "unknown" (anything else - a person, product photo, room, random object).

For document_type "day_sheet" or "expense_sheet", output:
{"document_type":"day_sheet","date":"YYYY-MM-DD or null","total_sale":number or null,"cash_sale":number or null,"card_sale":number or null,"online_sale":number or null,"credit_sale":number or null,"total_expenses":number or null,"expense_items":"short text description of expense line items, or null","confidence":"high|medium|low","notes":"anything unclear or illegible"}

For document_type "cheque_note", output:
{"document_type":"cheque_note","cheque_number":"string or null","bank":"string or null","amount":number or null,"payee":"string or null","due_date":"YYYY-MM-DD or null","confidence":"high|medium|low","notes":"anything unclear or illegible"}

For document_type "invoice", output:
{"document_type":"invoice","invoice_number":"string or null","payee":"supplier/vendor name or null","amount":number or null,"date":"YYYY-MM-DD or null","confidence":"high|medium|low","notes":"anything unclear or illegible"}

For document_type "unknown", output:
{"document_type":"unknown"}

Rules: never guess a number, date, or name you cannot actually read - use null instead. If a field is genuinely illegible, set confidence to "low" and say why in notes. Do not invent a document_type just to fill in fields - if genuinely unsure between two types, pick the closer one and lower confidence rather than fabricate.`;

// Standing rule: never guess - flag uncertain fields, don't fabricate.
async function ocrPhoto(filePath) {
    const imageBuffer = fs.readFileSync(filePath);
    const base64 = imageBuffer.toString('base64');
    const ext = filePath.split('.').pop().toLowerCase();
    const mime = ext === 'png' ? 'image/png' : 'image/jpeg';

    const response = await client.chat.completions.create({
        model: VISION_MODEL,
        messages: [{
            role: 'user',
            content: [
                { type: 'text', text: PROMPT },
                { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } },
            ],
        }],
        max_tokens: 500,
    }, { timeout: OCR_TIMEOUT_MS });

    const raw = response.choices?.[0]?.message?.content || '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error(`OCR returned no parseable JSON. Raw: ${raw.slice(0, 200)}`);
    const parsed = JSON.parse(jsonMatch[0]);
    return { ...parsed, _raw: raw, _model: VISION_MODEL, _file: filePath };
}

module.exports = { ocrPhoto };
