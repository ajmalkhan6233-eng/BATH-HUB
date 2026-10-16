'use strict';
/**
 * The real helpers for paperIntake: how a photo is read, and how an approved draft is saved.
 * Saving goes through the EXISTING route code (routes/grn_manual.js, routes/cheque_register.js), so every check in them still applies.
 * Reading: Tesseract is NOT installed on this PC (new tool, needs the owner's OK), so the existing free vision model is used (scripts/ocr_photo.js).
 */

/** Call an express Router directly with a fake request, as if it came from the app. Resolves { status, body }. */
function callRouter(router, method, url, body) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200, headers: {},
      status(c) { this.statusCode = c; return this; },
      set() { return this; }, setHeader() {}, getHeader() {},
      json(b) { resolve({ status: this.statusCode, body: b }); return this; },
      send(b) { resolve({ status: this.statusCode, body: b }); return this; },
      end() { resolve({ status: this.statusCode, body: null }); },
    };
    const req = { method, url, originalUrl: url, headers: {}, body, query: {}, params: {} };
    router.handle(req, res, (err) => resolve({ status: err ? 500 : 404, body: { error: err ? err.message : 'route not found' } }));
  });
}

const CHEQUE_PROMPT = `You are reading a photo of a Sri Lankan bank cheque. Output ONLY valid JSON, no markdown:
{"payee":"string or null","amount_digits":number or null,"amount_words":"the amount written in words, exactly as written, or null","date":"YYYY-MM-DD or null","bank":"string or null","cheque_no":"string or null","confidence":"high|medium|low"}
Dates in Sri Lanka are day/month/year. Amount digits have no commas. Never guess: use null for anything you cannot read.`;

function createPaperDeps({ lazy = require } = {}) {
  async function readPaper(file, kind) {
    try {
      if (kind === 'grn') {
        const { ocrPhoto } = lazy('../scripts/ocr_photo');
        const doc = await ocrPhoto(file);
        if (!doc || !['grn', 'invoice', 'manual_bill'].includes(doc.document_type) || !(doc.items || []).length) return { ok: false };
        return { ok: true, doc, engine: `free vision model ${doc._model || ''}`.trim() };
      }
      const fs = lazy('fs'); const { client } = lazy('../openrouter.config');
      const model = process.env.OCR_VISION_MODEL || 'nvidia/nemotron-nano-12b-v2-vl:free';
      const mime = /\.png$/i.test(file) ? 'image/png' : 'image/jpeg';
      const r = await client.chat.completions.create({ model, max_tokens: 600, messages: [{ role: 'user', content: [{ type: 'text', text: CHEQUE_PROMPT }, { type: 'image_url', image_url: { url: `data:${mime};base64,${fs.readFileSync(file).toString('base64')}` } }] }] }, { timeout: 45000 });
      const m = (r.choices?.[0]?.message?.content || '').match(/\{[\s\S]*\}/);
      if (!m) return { ok: false };
      return { ok: true, doc: JSON.parse(m[0]), engine: `free vision model ${model}` };
    } catch (e) { console.error('[paper-intake] read failed:', e.message); return { ok: false }; }
  }

  async function saveGrn(d) {
    const router = lazy('../routes/grn_manual');
    const payload = { source: 'whatsapp', supplier_name: d.supplier, grn_date: d.date, notes: `GRN from WhatsApp photo${d.invoice_no ? ' ' + d.invoice_no : ''}`, lines: d.lines.map((l) => ({ name: l.name, qty: l.qty, unit_cost: l.unit_cost })) };
    const r = await callRouter(router, 'POST', '/grn-manual', { payload: JSON.stringify(payload) });
    if (r.status >= 300) return { ok: false, message: (r.body && r.body.error) || `error ${r.status}` };
    return { ok: true, message: `GRN ${r.body.grn_number} saved: ${r.body.items.length} items, total ${r.body.total}. Credit days NOT set: add them in the GRN screen so the vendor due date is right.` };
  }

  async function saveCheque(d) {
    const router = lazy('../routes/cheque_register');
    const r = await callRouter(router, 'POST', '/cheque-register', { cheque_no: d.cheque_no, bank: d.bank, payee: d.payee, amount: d.amount_digits, due_date: d.date, notes: 'From WhatsApp photo' });
    if (r.status >= 300) return { ok: false, message: (r.body && r.body.error) || `error ${r.status}` };
    return { ok: true, message: `Cheque saved (id ${r.body.id}).` };
  }
  return { readPaper, saveGrn, saveCheque };
}
module.exports = { createPaperDeps, callRouter };
