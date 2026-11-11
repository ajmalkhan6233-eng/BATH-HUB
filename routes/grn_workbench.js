'use strict';
// routes/grn_workbench.js  (NEW FILE, touches no golden-core file)
// Saves one approved GRN from the side-by-side workbench screen: photo + stock + prices + vendor bill.
// POST /api/grn-workbench       body = approved package JSON (see validatePackage)
// GET  /api/grn-workbench/check?vendor=..&bill_no=..   -> {exists:true|false}
// GET  /api/grn-workbench/bills   -> keyed bills list (data/grn_bills.json, behind the login gate)
// GET  /api/grn-photos/<file>   -> saved bill photo
// All-or-nothing: one transaction. A bill already saved (same vendor + bill number) is refused (409).
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { lineTotal, weightedAvgCost, round2 } = require('../utils/grn_math');
const catalog = require('./item_catalog');
const pool = require('../utils/pool');

const router = express.Router();
const PHOTO_DIR = path.join(__dirname, '..', 'uploads', 'grn_photos');
const LOCK_ID = 774413;
const MAX_LINES = 120;
const MAX_PHOTO = 8 * 1024 * 1024;

function bad(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !isNaN(Date.parse(s));
function addDays(d, n) { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }

function validatePackage(p) {
    p = p || {};
    const vendor = String((p.vendor && p.vendor.name) || '').trim();
    const bill_no = String(p.bill_no || '').trim().slice(0, 60);
    if (!vendor) throw bad('Vendor name is missing');
    if (!bill_no) throw bad('Bill number is missing');
    if (!isDate(p.bill_date)) throw bad('Bill date is not valid');
    const received = isDate(p.received_date) ? p.received_date : p.bill_date;
    const credit_days = Math.max(0, Math.min(365, Math.round(Number(p.credit_days) || 0)));
    const payment_type = ['BILL', 'CHEQUE', 'CASH'].includes(p.payment_type) ? p.payment_type : 'BILL';
    const mode = p.mode === 'BILL_ONLY' ? 'BILL_ONLY' : 'GRN';
    const lines = Array.isArray(p.lines) ? p.lines : [];
    if (mode === 'GRN' && !lines.length) throw bad('No item lines');
    if (lines.length > MAX_LINES) throw bad('Too many lines (max ' + MAX_LINES + ')');
    const seen = new Set();
    const clean = lines.map((l, i) => {
        const n = i + 1;
        const name = String(l.name || '').trim();
        const qty = Number(l.qty), cost = Number(l.unit_cost);
        const sp = l.selling_price === null || l.selling_price === undefined || l.selling_price === '' ? null : Number(l.selling_price);
        if (!name) throw bad('Line ' + n + ': item name is empty');
        if (seen.has(name.toLowerCase())) throw bad('Line ' + n + ': "' + name + '" is listed twice, combine it');
        seen.add(name.toLowerCase());
        if (!Number.isFinite(qty) || qty <= 0) throw bad('Line ' + n + ' (' + name + '): quantity must be more than 0');
        if (!Number.isFinite(cost) || cost < 0) throw bad('Line ' + n + ' (' + name + '): cost must be 0 or more');
        if (sp !== null && (!Number.isFinite(sp) || sp < 0)) throw bad('Line ' + n + ' (' + name + '): selling price must be 0 or more');
        return { name, qty, cost, sp: sp && sp > 0 ? sp : null, vendor_code: String(l.vendor_code || '').trim().slice(0, 40), category: l.category || null };
    });
    const total = mode === 'BILL_ONLY' ? round2(Number(p.total)) : round2(clean.reduce((s, l) => s + lineTotal(l.qty, l.cost), 0));
    if (!(total > 0)) throw bad('Bill total must be more than 0');
    if (mode === 'GRN' && p.total !== undefined && Math.abs(Number(p.total) - total) > 0.5) throw bad('Total on screen (' + p.total + ') does not match the lines (' + total + ')');
    return { vendor, bill_no, bill_date: p.bill_date, received, credit_days, due: addDays(received, credit_days), payment_type, mode, lines: clean, total, notes: String(p.notes || '').trim().slice(0, 500), photo: p.photo_data_url || '' };
}

function savePhotoDataUrl(url) {
    if (!url) return null;
    const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(url);
    if (!m) throw bad('Photo must be a JPG, PNG or WEBP image');
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > MAX_PHOTO) throw bad('Photo is too large (max 8 MB)');
    fs.mkdirSync(PHOTO_DIR, { recursive: true });
    const name = Date.now() + '-' + crypto.randomBytes(4).toString('hex') + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1]);
    fs.writeFileSync(path.join(PHOTO_DIR, name), buf);
    return '/api/grn-photos/' + name;
}

router.use('/grn-photos', express.static(PHOTO_DIR, { index: false, dotfiles: 'deny' }));

// Bill numbers are compared ignoring case, spaces, dashes and slashes: ME2026-1757 = ME2026/1757 = me20261757.
const NORM = (c) => `regexp_replace(LOWER(${c}),'[^a-z0-9]','','g')`;
const normNo = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
// Number-aware key: 001 = 01 = 1 (same vendor, same GRN number), paper numbers like ME2026/1757 keep letters and digits only.
const KEY = (c) => `(CASE WHEN ${NORM(c)} ~ '^[0-9]+$' THEN COALESCE(NULLIF(ltrim(${NORM(c)},'0'),''),'0') ELSE ${NORM(c)} END)`;
const keyNo = (s) => { const n = normNo(s); return /^[0-9]+$/.test(n) ? (n.replace(/^0+/, '') || '0') : n; };
async function billExists(db, vendor, bill_no, exceptId) {
    const a = await db.query(`SELECT 1 FROM vendor_bills WHERE voided=FALSE AND LOWER(vendor_name)=LOWER($1) AND ${KEY('bill_no')}=$2 AND ($3::int IS NULL OR id<>$3) LIMIT 1`, [vendor, keyNo(bill_no), exceptId || null]);
    if (a.rows.length) return true;
    if (exceptId) return false;
    const b = await db.query(`SELECT 1 FROM grn_records WHERE ${KEY('grn_number')}=$1 AND LOWER(supplier_name)=LOWER($2) LIMIT 1`, [keyNo(bill_no), vendor]);
    return b.rows.length > 0;
}

// ---- Receiving details kept next to a bill (additive table, nothing existing is altered) ----
// A GRN line can be: not delivered yet (arrived=false), short (some missing), returned, or damaged-and-returned.
// Stock and the bill total follow the NET quantity (ordered - short - returned - damaged; 0 if not arrived). The paper total stays for reference.
const num = (x) => { const n = Number(x); return Number.isFinite(n) && n > 0 ? n : 0; };
function cleanExtra(body) {
    const e = (body && body.extra) || {};
    const lines = (Array.isArray(e.lines) ? e.lines : []).slice(0, MAX_LINES).map(l => ({
        name: String(l.name || '').trim().slice(0, 200), vendor_code: String(l.vendor_code || '').trim().slice(0, 40),
        ordered: num(l.ordered), short: num(l.short), ret: num(l.ret), dmg: num(l.dmg), arrived: l.arrived !== false,
        unit: num(l.unit), disc: num(l.disc), sell: num(l.sell)
    })).filter(l => l.name);
    return { paper_total: round2(num(e.paper_total)), lines };
}
async function saveExtra(db, billId, body) {
    const x = cleanExtra(body);
    await db.query(`CREATE TABLE IF NOT EXISTS grn_bill_extra (bill_id INT PRIMARY KEY, paper_total NUMERIC, lines JSONB, updated_at TIMESTAMPTZ DEFAULT NOW())`);
    await db.query(`INSERT INTO grn_bill_extra (bill_id, paper_total, lines, updated_at) VALUES ($1,$2,$3::jsonb,NOW()) ON CONFLICT (bill_id) DO UPDATE SET paper_total=EXCLUDED.paper_total, lines=EXCLUDED.lines, updated_at=NOW()`, [billId, x.paper_total, JSON.stringify(x.lines)]);
}
async function loadExtra(db, billId) {
    try { const r = await db.query(`SELECT paper_total, lines FROM grn_bill_extra WHERE bill_id=$1`, [billId]); return r.rows[0] ? { paper_total: Number(r.rows[0].paper_total) || 0, lines: r.rows[0].lines || [] } : null; } catch (e) { return null; }
}

// Drafts waiting for Ajmal (bills Claude read from photos): drafts_inbox/*.json. Shown as drafts in the workbench; once the bill is saved it stops showing.
const INBOX = path.join(__dirname, '..', 'drafts_inbox');
router.use('/grn-inbox', express.static(INBOX, { index: false, dotfiles: 'deny', extensions: ['jpg'] }));
const DISMISSED_FILE = path.join(__dirname, '..', 'data', 'grn_dismissed.json');
const readDismissed = () => { try { return new Set(JSON.parse(fs.readFileSync(DISMISSED_FILE, 'utf8'))); } catch (e) { return new Set(); } };
router.post('/grn-workbench/dismiss', express.json(), (req, res) => {   // "Delete draft" on a draft that comes from the server lists: it must stay deleted after a refresh
    const id = String((req.body || {}).id || '').slice(0, 120);
    if (!id) return res.status(400).json({ error: 'No draft chosen' });
    try { const set = readDismissed(); set.add(id); fs.mkdirSync(path.dirname(DISMISSED_FILE), { recursive: true }); fs.writeFileSync(DISMISSED_FILE, JSON.stringify([...set])); res.json({ ok: true }); }
    catch (e) { res.status(500).json({ error: 'Could not remember that: ' + e.message }); }
});
router.get('/grn-workbench/bills', async (req, res) => {
    let list = [];
    try { list = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'grn_bills.json'), 'utf8')); } catch (e) { list = []; }
    try {
        for (const f of fs.readdirSync(INBOX).filter(x => x.endsWith('.json'))) {
            for (const b of JSON.parse(fs.readFileSync(path.join(INBOX, f), 'utf8'))) list.push(b);
        }
    } catch (e) { /* no inbox folder: fine */ }
    const gone = readDismissed(), out = [];
    for (const b of list) {   // a bill already saved in the app, or one Ajmal deleted, is not offered again
        if (gone.has(String(b.id))) continue;
        let saved = false;
        try { saved = await billExists(pool, b.vendor, b.no); } catch (_) { /* keep it */ }
        if (!saved) out.push(b);
    }
    res.json(out);
});

// Next free number for a vendor. Looks at the vendor's own numbers (saved bills + GRN records), read only.
// Numeric style (001, 002 ...) keeps the width of what was typed (at least 3). Paper style numbers (ME2026/1757) get no suggestion.
async function nextFreeNumber(db, vendor, typed) {
    const t = String(typed || '').trim();
    if (t && !/^\d+$/.test(t)) return null;
    if (!vendor) return t ? null : '001';
    const rows = await db.query(`SELECT bill_no AS n FROM vendor_bills WHERE voided=FALSE AND LOWER(vendor_name)=LOWER($1)
        UNION SELECT grn_number AS n FROM grn_records WHERE LOWER(supplier_name)=LOWER($1)`, [vendor]);
    const used = new Set(rows.rows.map(r => String(r.n || '').trim()).filter(x => /^\d+$/.test(x)).map(x => parseInt(x, 10)));
    const width = Math.max(3, t.length, ...rows.rows.map(r => /^\d+$/.test(String(r.n || '').trim()) ? String(r.n).trim().length : 0));
    let n = used.size ? Math.max(...used) + 1 : 1;
    while (used.has(n)) n++;
    return String(n).padStart(width, '0');
}

router.get('/grn-workbench/check', async (req, res) => {
    try {
        const no = String(req.query.bill_no || '').trim(), v = String(req.query.vendor || '').trim();
        if (!no) return res.json({ exists: false, next_free: v ? await nextFreeNumber(pool, v, '') : null });
        // Bill number is the main key. Same number from the same vendor = duplicate; same number from another vendor = warning.
        const r = await pool.query(`SELECT id, vendor_name, bill_no, to_char(bill_date,'YYYY-MM-DD') AS bill_date, total, created_at FROM vendor_bills WHERE voided=FALSE AND ${KEY('bill_no')}=$1 ORDER BY id DESC LIMIT 5`, [keyNo(no)]);
        const same = r.rows.find(x => !v || x.vendor_name.toLowerCase() === v.toLowerCase());
        if (same) return res.json({ exists: true, bill: same, next_free: await nextFreeNumber(pool, same.vendor_name, no) });
        // GRN records of this vendor (filtered in SQL, so another vendor's row with the same number can never hide it).
        const g = await pool.query(`SELECT grn_number, supplier_name, to_char(grn_date,'YYYY-MM-DD') AS grn_date, SUM(total_amount) AS total FROM grn_records WHERE ${KEY('grn_number')}=$1 AND ($2='' OR LOWER(supplier_name)=LOWER($2)) GROUP BY 1,2,3 ORDER BY grn_date DESC LIMIT 1`, [keyNo(no), v]);
        if (g.rows.length) return res.json({ exists: true, bill: { vendor_name: g.rows[0].supplier_name, bill_no: g.rows[0].grn_number, bill_date: g.rows[0].grn_date, total: g.rows[0].total }, next_free: await nextFreeNumber(pool, g.rows[0].supplier_name, no) });
        res.json({ exists: false, other_vendor: r.rows[0] || null });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/grn-workbench/open-bills', async (req, res) => {
    try {
        const r = await pool.query(`SELECT b.id, b.bill_no, b.bill_date, b.due_date, b.total,
              b.total - COALESCE((SELECT SUM(amount) FROM vendor_payments WHERE bill_id=b.id),0) - COALESCE((SELECT SUM(amount) FROM vendor_credit_notes WHERE bill_id=b.id),0) AS owed
            FROM vendor_bills b WHERE b.voided=FALSE AND LOWER(b.vendor_name)=LOWER($1) ORDER BY b.bill_date DESC, b.id DESC LIMIT 60`, [String(req.query.vendor || '')]);
        res.json(r.rows.filter(x => Number(x.owed) > 0.5));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/grn-workbench/cheque', express.json({ limit: '14mb' }), async (req, res) => {
    let photo_url = null;
    try {
        const b = req.body || {};
        const bill_id = Number(b.bill_id), amount = round2(Number(b.amount));
        if (!Number.isInteger(bill_id) || bill_id <= 0) throw bad('Pick which bill this cheque pays');
        if (!(amount > 0)) throw bad('Cheque amount must be more than 0');
        if (!isDate(b.cheque_date)) throw bad('Cheque date is not valid');
        const due = isDate(b.due_date) ? b.due_date : b.cheque_date;
        const cheque_no = String(b.cheque_no || '').trim().slice(0, 40);
        const bank = String(b.bank || '').trim().slice(0, 60);
        const bill = (await pool.query(`SELECT id, vendor_name FROM vendor_bills WHERE id=$1 AND voided=FALSE`, [bill_id])).rows[0];
        if (!bill) throw bad('That bill was not found', 404);
        if (cheque_no) {
            const dup = await pool.query(`SELECT 1 FROM vendor_bill_cheques WHERE cheque_no=$1 AND COALESCE(bank,'')=$2 AND status<>'CANCELLED' LIMIT 1`, [cheque_no, bank]);
            if (dup.rows.length) throw bad('Cheque ' + cheque_no + (bank ? ' (' + bank + ')' : '') + ' is already entered. Nothing was changed.', 409);
        }
        photo_url = savePhotoDataUrl(b.photo_data_url || '');
        const r = await pool.query(
            `INSERT INTO vendor_bill_cheques (branch_id, bill_id, cheque_no, bank, payee, amount, cheque_date, due_date, same_bank, photo_path, created_by)
             VALUES (1,$1,$2,$3,$4,$5,$6,$7,$8,$9,'grn-workbench') RETURNING id`,
            [bill_id, cheque_no || null, bank || null, bill.vendor_name, amount, b.cheque_date, due, !!b.same_bank, photo_url]);
        res.status(201).json({ ok: true, cheque_id: r.rows[0].id, vendor: bill.vendor_name, amount, due_date: due });
    } catch (e) {
        if (photo_url) fs.unlink(path.join(PHOTO_DIR, path.basename(photo_url)), () => {});
        res.status(e.status || 500).json({ error: e.status ? e.message : 'Could not save the cheque (nothing was saved): ' + e.message });
    }
});

// ---- Generate: read a photo with the app's existing free vision reader (OpenRouter). Best effort, everything stays editable. ----
const READ_PROMPT = `You are reading a photo of paperwork for Royal Bath Hub, a bathroom-fittings shop in Thihariya, Sri Lanka. The photo may be rotated or sideways: read it anyway. Output ONLY valid JSON, no markdown.
Decide "kind":
- "vendor_bill": a bill, invoice, credit invoice, cash memo or GRN from a SUPPLIER selling goods TO Royal Bath Hub (Royal Bath Hub / Royal Bathhub is the customer). Examples: Fazaal Hardware, Maheshan Hardware, Metro Enterprises, Cool Lanka Impex.
- "sale_bill": a bill where Royal Bath Hub is the SELLER to a customer (not a purchase).
- "cheque": a cheque or a cheque note.
- "unknown": anything else.
Dates are day/month/year in Sri Lanka ("23/10/2026" = 2026-10-23). Numbers plain, no commas, no trailing "/-". Never guess: use null for anything you cannot read.
For vendor_bill output: {"kind":"vendor_bill","vendor_name":"supplier company name exactly as printed","bill_number":"the invoice number (e.g. G1CR008312, 26OCT_0039_01384, ME2026/1797) or the cash memo number","bill_date":"YYYY-MM-DD or null","credit_days":number or null,"total":number or null,"items":[{"vendor_code":"code printed beside the line or null","description":"...","qty":number,"unit_cost":number,"amount":number}],"confidence":"high|medium|low","notes":"anything unclear"}
For cheque output: {"kind":"cheque","cheque_number":"..." ,"bank":"...","amount":number or null,"cheque_date":"YYYY-MM-DD or null","payee":"...","confidence":"high|medium|low","notes":"..."}
Otherwise {"kind":"sale_bill"} or {"kind":"unknown"}.`;

function normName(x) { return String(x || '').toLowerCase().replace(/\b(pvt|ltd|limited|private|\(pvt\)|co|company|the)\b/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }

// Free vision models come and go on OpenRouter. Ask OpenRouter which free image-reading models exist right now (newest first),
// keep the answer for 6 hours, and try them one by one. OCR_VISION_MODEL (if set) is tried first.
let _vm = { at: 0, list: [] };
async function visionModels() {
    const first = [process.env.OCR_VISION_MODEL, 'nvidia/nemotron-3.5-super-vl:free'].filter(Boolean);
    if (Date.now() - _vm.at < 6 * 3600 * 1000 && _vm.list.length) return _vm.list;
    let found = [];
    try {
        const r = await fetch('https://openrouter.ai/api/v1/models', { signal: AbortSignal.timeout(15000) });
        const j = await r.json();
        found = (j.data || []).filter(m => m.id && /:free$/.test(m.id) && ((m.architecture || {}).input_modalities || []).includes('image') && !/safety|inkling|dots|reasoning/.test(m.id))
            .sort((a, b) => (b.created || 0) - (a.created || 0)).map(m => m.id);
    } catch (_) {}
    const list = [...new Set(first.concat(found))];
    if (found.length) _vm = { at: Date.now(), list };
    return list;
}
// A free reader that says "too many requests" (429 / quota) is busy, not broken: the screen offers a plain Retry.
function isRateLimit(e) { return !!e && (e.status === 429 || e.rateLimited === true || /\b429\b|rate.?limit|too many requests|quota|RESOURCE_EXHAUSTED/i.test(String(e.message || ''))); }
function readFailure(e) {
    if (isRateLimit(e)) return { ok: false, retry: true, code: 'busy', message: 'The free photo reader is busy right now (too many requests). Wait about a minute, then press Retry. Nothing was lost.' };
    return { ok: false, retry: true, code: 'error', message: 'Could not read the photo automatically (' + String((e && e.message) || e).slice(0, 80) + '). Press Retry, or type it using the photo on the left.' };
}
async function readWithVision(content) {
    const { client } = require('../openrouter.config');
    let lastErr = null, sawRate = false;
    const mark = (e) => { if (isRateLimit(e)) sawRate = true; return e; };
    // Gemini free tier first (own key, no OpenRouter rate limit); falls through to OpenRouter on any error.
    if (process.env.GEMINI_API_KEY) {
        try {
            const g = new (require('openai'))({ apiKey: process.env.GEMINI_API_KEY, baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/' });
            const r = await g.chat.completions.create({ model: process.env.GEMINI_VISION_MODEL || 'gemini-2.5-flash', max_tokens: 3500, messages: [{ role: 'user', content }] }, { timeout: 90000 });
            const raw = (r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content) || '';
            if (raw.match(/\{[\s\S]*\}/)) return raw;
            lastErr = new Error('no JSON from gemini');
        } catch (e) { lastErr = mark(e); }
    }
    for (const model of (await visionModels()).slice(0, 4)) {
        try {
            const r = await client.chat.completions.create({ model, max_tokens: 3500, messages: [{ role: 'user', content }] }, { timeout: 90000 });
            const raw = (r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content) || '';
            if (raw.match(/\{[\s\S]*\}/)) return raw;
            lastErr = new Error('no JSON from ' + model);
        } catch (e) { lastErr = mark(e); if (_vm.list.length) _vm.at = 0; }
    }
    const fail = lastErr || new Error('no free vision model available');
    try { fail.rateLimited = sawRate; } catch (_) {}
    throw fail;
}

router.post('/grn-workbench/read', express.json({ limit: '14mb' }), async (req, res) => {
    try {
        const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String((req.body || {}).photo_data_url || ''));
        if (!m) return res.status(400).json({ error: 'Add a JPG, PNG or WEBP photo first' });
        const raw = await readWithVision([{ type: 'text', text: READ_PROMPT }, { type: 'image_url', image_url: { url: req.body.photo_data_url } }]);
        const jm = raw.match(/\{[\s\S]*\}/);
        if (!jm) return res.json({ ok: false, retry: true, code: 'empty', message: 'The reader could not read this photo. Press Retry, or type it using the photo on the left.' });
        const o = JSON.parse(jm[0]);
        const out = { ok: true, kind: String(o.kind || 'unknown'), confidence: o.confidence || null, notes: o.notes || '' };
        if (out.kind === 'vendor_bill') {
            out.vendor = String(o.vendor_name || '').trim(); out.bill_no = String(o.bill_number || '').trim(); out.bill_date = isDate(o.bill_date) ? o.bill_date : null;
            out.credit_days = Number.isFinite(Number(o.credit_days)) && o.credit_days !== null ? Number(o.credit_days) : null; out.total = Number(o.total) || null;
            out.lines = (Array.isArray(o.items) ? o.items : []).slice(0, MAX_LINES).map(i => ({ code: String(i.vendor_code || '').trim(), name: String(i.description || '').trim(), qty: Number(i.qty) || 1, unit: Number(i.unit_cost) || (Number(i.amount) && Number(i.qty) ? Number(i.amount) / Number(i.qty) : 0) }));
            out.lines_total = round2(out.lines.reduce((t, l) => t + l.qty * l.unit, 0));
            if (!out.total && out.lines_total > 0) { out.total = out.lines_total; out.total_from_lines = true; }
            try { // known vendor? match against the vendors already in the app
                const names = (await pool.query(`SELECT name FROM suppliers`)).rows.map(x => x.name);
                const want = normName(out.vendor), first = want.split(' ')[0];
                const hit = names.find(n => normName(n) === want) || (first && first.length > 2 ? names.find(n => normName(n).split(' ')[0] === first) : null);
                out.vendor_known = !!hit; if (hit) out.vendor = hit;
            } catch (_) { out.vendor_known = false; }
        } else if (out.kind === 'cheque') {
            out.cheque_no = String(o.cheque_number || ''); out.bank = String(o.bank || ''); out.amount = Number(o.amount) || null; out.cheque_date = isDate(o.cheque_date) ? o.cheque_date : null; out.vendor = String(o.payee || '');
        }
        res.json(out);
    } catch (e) { res.json(readFailure(e)); }
});

async function applyLines(client, p, supplier_id, photo_url) {
    const results = []; let firstGrnId = null; const touched = [];
    for (const l of (p.mode === 'BILL_ONLY' ? [] : p.lines)) {
        let item, isNew;
        const ex = await client.query(`SELECT * FROM products WHERE LOWER(name)=LOWER($1) AND active=true LIMIT 1 FOR UPDATE`, [l.name]);
        if (ex.rows.length) {
            isNew = false;
            const u = await client.query(
                `UPDATE products SET stock_level=COALESCE(stock_level,0)+$1, avg_cost=$2, selling_price=COALESCE($3, selling_price), photo_url=COALESCE(photo_url,$4) WHERE id=$5 RETURNING *`,
                [l.qty, weightedAvgCost(ex.rows[0].stock_level, ex.rows[0].avg_cost, l.qty, l.cost), l.sp, photo_url, ex.rows[0].id]);
            item = u.rows[0];
            await require('../utils/stock_ledger').recordSafe(client, { item_code: item.item_code, qty_change: Number(l.qty), reason: 'grn', ref_type: 'grn_workbench', ref_id: String(supplier_id || '') });
        } else {
            isNew = true;
            item = await catalog.createItem({ name: l.name, category: l.category, selling_price: l.sp || 0, avg_cost: l.cost, stock_level: l.qty, photo_url: null }, { client });
    }
        const note = ['Workbench GRN', 'bill ' + p.bill_no, 'received ' + p.received, l.vendor_code ? 'vendor code ' + l.vendor_code : '', p.notes].filter(Boolean).join('; ');
        const g = await client.query(
            `INSERT INTO grn_records (grn_number, supplier_id, supplier_name, grn_date, item_description, quantity, unit_cost, total_amount, source_file_path, status, notes)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'PENDING_REVIEW',$10) RETURNING id`,
            [p.bill_no, supplier_id, p.vendor, p.received, item.item_code + ' - ' + item.name, l.qty, l.cost, lineTotal(l.qty, l.cost), photo_url, note]);
        if (firstGrnId === null) firstGrnId = g.rows[0].id;
        touched.push(item.id); results.push({ item_code: item.item_code, name: item.name, qty: l.qty, unit_cost: l.cost, selling_price: item.selling_price, is_new: isNew });
    }
    return { results, firstGrnId, touched };
}

router.post('/grn-workbench', express.json({ limit: '14mb' }), async (req, res) => {
    let client, photo_url = null;
    try {
        const p = validatePackage(req.body);
        client = await pool.connect();
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock($1)', [LOCK_ID]);
        if (await billExists(client, p.vendor, p.bill_no)) throw bad('Bill ' + p.bill_no + ' from ' + p.vendor + ' is already saved. Nothing was changed.', 409);
        photo_url = savePhotoDataUrl(p.photo);
        const sup = await client.query(`SELECT id FROM suppliers WHERE LOWER(name)=LOWER($1) LIMIT 1`, [p.vendor]);
        let supplier_id = sup.rows.length ? sup.rows[0].id : null;
        if (!supplier_id) { const ns = await client.query(`INSERT INTO suppliers (name, active) VALUES ($1, true) RETURNING id`, [p.vendor]); supplier_id = ns.rows[0].id; }
        const { results, firstGrnId, touched } = await applyLines(client, p, supplier_id, photo_url);
        const bill = await client.query(
            `INSERT INTO vendor_bills (branch_id, vendor_name, bill_no, bill_date, due_date, total, grn_id, photo_path, notes, created_by)
             VALUES (1,$1,$2,$3,$4,$5,$6,$7,$8,'grn-workbench') RETURNING id`,
            [p.vendor, p.bill_no, p.bill_date, p.due, p.total, firstGrnId, photo_url,
             [p.mode === 'BILL_ONLY' ? 'Bill only (no stock)' : 'From workbench GRN', 'paid by ' + p.payment_type, p.credit_days + ' credit days'].join('; ')]);
        if (p.payment_type === 'CASH') {
            await client.query(`INSERT INTO vendor_payments (branch_id, bill_id, amount, method, paid_at, note, created_by) VALUES (1,$1,$2,'CASH',$3,'Paid cash at receipt','grn-workbench')`, [bill.rows[0].id, p.total, p.received]);
        }
        await saveExtra(client, bill.rows[0].id, req.body);
        await client.query('COMMIT');
        res.status(201).json({ ok: true, grn_number: p.bill_no, vendor: p.vendor, total: p.total, due_date: p.due, bill_id: bill.rows[0].id, photo: photo_url, items: results });
    } catch (e) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        if (photo_url) fs.unlink(path.join(PHOTO_DIR, path.basename(photo_url)), () => {});
        res.status(e.status || 500).json({ error: e.status ? e.message : 'Could not save (nothing was saved): ' + e.message });
    } finally { if (client) client.release(); }
});


// ---- Edit / cancel a saved bill ----
// Lines of a bill = grn_records of the same vendor and (normalised) number, starting at the bill's own grn_id
// and stopping before the next bill with the same number (so two copies of one number never mix).
async function billLines(db, b) {
    if (!b.grn_id) {
        const same = await db.query(`SELECT COUNT(*) AS n FROM vendor_bills WHERE voided=FALSE AND LOWER(vendor_name)=LOWER($1) AND ${NORM('bill_no')}=$2`, [b.vendor_name, normNo(b.bill_no)]);
        if (Number(same.rows[0].n) !== 1) return [];
        return (await db.query(`SELECT * FROM grn_records WHERE LOWER(supplier_name)=LOWER($1) AND ${NORM('grn_number')}=$2 ORDER BY id`, [b.vendor_name, normNo(b.bill_no)])).rows;
    }
    const nxt = await db.query(`SELECT MIN(grn_id) AS n FROM vendor_bills WHERE voided=FALSE AND id<>$1 AND LOWER(vendor_name)=LOWER($2) AND ${NORM('bill_no')}=$3 AND grn_id>$4`, [b.id, b.vendor_name, normNo(b.bill_no), b.grn_id]);
    const r = await db.query(`SELECT * FROM grn_records WHERE id>=$1 AND ($2::int IS NULL OR id<$2) AND LOWER(supplier_name)=LOWER($3) AND ${NORM('grn_number')}=$4 ORDER BY id`, [b.grn_id, nxt.rows[0].n, b.vendor_name, normNo(b.bill_no)]);
    return r.rows;
}
async function takeStockBack(client, recs, allowUnmatched) {
    const ids = [], unmatched = [];
    for (const g of recs) {
        const desc = String(g.item_description || '').trim();
        const code = desc.split(' - ')[0].trim();
        let u = code ? await client.query(`UPDATE products SET stock_level=COALESCE(stock_level,0)-$1 WHERE item_code=$2 RETURNING id, item_code`, [g.quantity, code]) : { rows: [] };
        if (u.rows.length) await require('../utils/stock_ledger').recordSafe(client, { item_code: u.rows[0].item_code, qty_change: -Number(g.quantity), reason: 'grn_reverse', ref_type: 'grn_record', ref_id: String(g.id) });
        if (!u.rows.length && desc) u = await client.query(`UPDATE products SET stock_level=COALESCE(stock_level,0)-$1 WHERE id=(SELECT id FROM products WHERE LOWER(name)=LOWER($2) AND active=true LIMIT 1) RETURNING id`, [g.quantity, desc]);
        if (u.rows.length) ids.push(u.rows[0].id); else unmatched.push(desc || ('line ' + g.id));
    }
    if (unmatched.length && !allowUnmatched) { const e = bad(unmatched.length + ' of ' + recs.length + ' lines do not match an item in the shop (for example: ' + unmatched[0] + '), so stock cannot be taken back automatically. Nothing was changed.', 409); e.unmatched = true; throw e; }
    return ids;
}
async function noNegative(client, ids) {
    if (!ids.length) return;
    const n = await client.query(`SELECT item_code, name, stock_level FROM products WHERE id = ANY($1::int[]) AND stock_level<0`, [ids]);
    if (n.rows.length) throw bad('Cannot do this: item ' + n.rows[0].item_code + ' ' + n.rows[0].name + ' would go below zero stock (some was already sold). Nothing was changed.', 409);
}

router.get('/grn-workbench/saved/:id', async (req, res) => {
    try {
        const b = (await pool.query(`SELECT *, to_char(bill_date,'YYYY-MM-DD') AS bill_date_s FROM vendor_bills WHERE id=$1`, [Number(req.params.id) || 0])).rows[0];
        if (!b) return res.status(404).json({ error: 'Bill not found' });
        const recs = await billLines(pool, b);
        const gd = recs.length ? (await pool.query(`SELECT to_char(grn_date,'YYYY-MM-DD') AS d FROM grn_records WHERE id=$1`, [recs[0].id])).rows[0].d : null;
        const lines = [];
        for (const g of recs) {
            const desc = String(g.item_description || '').trim(), hasCode = desc.includes(' - ');
            const code = hasCode ? desc.split(' - ')[0].trim() : '';
            const p = code ? (await pool.query(`SELECT name, selling_price FROM products WHERE item_code=$1 LIMIT 1`, [code])).rows[0] : null;
            lines.push({ code: code, vendor_code: '', name: p ? p.name : (hasCode ? desc.split(' - ').slice(1).join(' - ') : desc), qty: Number(g.quantity), unit: Number(g.unit_cost), sell: p ? Number(p.selling_price) || 0 : 0 });
        }
        const note = String(b.notes || '');
        const cd = /(\d+) credit days/.exec(note);
        const pt = /paid by (BILL|CHEQUE|CASH)/.exec(note);
        const received = gd || b.bill_date_s;
        const iso = (d) => (d instanceof Date ? d.toISOString() : String(d || '')).slice(0, 10);
        const paid = (await pool.query(`SELECT COALESCE((SELECT SUM(amount) FROM vendor_payments WHERE bill_id=$1),0) AS p, (SELECT COUNT(*) FROM vendor_bill_cheques WHERE bill_id=$1 AND status<>'CANCELLED') AS c`, [b.id])).rows[0];
        res.json({ id: b.id, vendor: b.vendor_name, bill_no: b.bill_no, bill_date: b.bill_date_s, received: iso(received), credit_days: cd ? Number(cd[1]) : 90, ptype: pt ? pt[1] : 'BILL', total: Number(b.total), mode: recs.length ? 'GRN' : 'BILL_ONLY', lines, photo: b.photo_path || '', paid: Number(paid.p), cheques: Number(paid.c), voided: b.voided, extra: await loadExtra(pool, b.id) });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/grn-workbench/bill/:id', express.json({ limit: '14mb' }), async (req, res) => {
    let client, photo_url = null;
    try {
        const p = validatePackage(req.body);
        client = await pool.connect();
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock($1)', [LOCK_ID]);
        const b = (await client.query(`SELECT * FROM vendor_bills WHERE id=$1 AND voided=FALSE FOR UPDATE`, [Number(req.params.id)])).rows[0];
        if (!b) throw bad('This bill is not in the app any more (it may be cancelled).', 404);
        if (await billExists(client, p.vendor, p.bill_no, b.id)) throw bad('Another saved bill has the same number (' + p.bill_no + ', ' + p.vendor + '). If it is a duplicate, cancel that copy first. Nothing was changed.', 409);
        const old = await billLines(client, b);
        const ids = await takeStockBack(client, old, false);
        if (old.length) await client.query(`DELETE FROM grn_records WHERE id = ANY($1::int[])`, [old.map(x => x.id)]);
        photo_url = p.photo ? savePhotoDataUrl(p.photo) : null;
        const keepPhoto = photo_url || b.photo_path || null;
        let sup = (await client.query(`SELECT id FROM suppliers WHERE LOWER(name)=LOWER($1) LIMIT 1`, [p.vendor])).rows[0];
        if (!sup) sup = (await client.query(`INSERT INTO suppliers (name, active) VALUES ($1, true) RETURNING id`, [p.vendor])).rows[0];
        const { results, firstGrnId, touched } = await applyLines(client, p, sup.id, keepPhoto);
        await noNegative(client, ids.concat(touched));
        await client.query(
            `UPDATE vendor_bills SET vendor_name=$1, bill_no=$2, bill_date=$3, due_date=$4, total=$5, grn_id=$6, photo_path=$7, notes=$8 WHERE id=$9`,
            [p.vendor, p.bill_no, p.bill_date, p.due, p.total, firstGrnId, keepPhoto,
             [p.mode === 'BILL_ONLY' ? 'Bill only (no stock)' : 'From workbench GRN', 'paid by ' + p.payment_type, p.credit_days + ' credit days', 'edited ' + new Date().toISOString().slice(0, 10)].join('; '), b.id]);
        if (p.payment_type === 'CASH') {
            const has = await client.query(`SELECT id FROM vendor_payments WHERE bill_id=$1 AND note='Paid cash at receipt'`, [b.id]);
            if (has.rows.length) await client.query(`UPDATE vendor_payments SET amount=$1 WHERE id=$2`, [p.total, has.rows[0].id]);
            else await client.query(`INSERT INTO vendor_payments (branch_id, bill_id, amount, method, paid_at, note, created_by) VALUES (1,$1,$2,'CASH',$3,'Paid cash at receipt','grn-workbench')`, [b.id, p.total, p.received]);
        }
        await saveExtra(client, b.id, req.body);
        await client.query('COMMIT');
        res.json({ ok: true, bill_id: b.id, grn_number: p.bill_no, vendor: p.vendor, total: p.total, due_date: p.due, photo: keepPhoto, items: results });
    } catch (e) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        if (photo_url) fs.unlink(path.join(PHOTO_DIR, path.basename(photo_url)), () => {});
        res.status(e.status || 500).json({ error: e.status ? e.message : 'Could not save the change (nothing was changed): ' + e.message });
    } finally { if (client) client.release(); }
});

router.delete('/grn-workbench/bill/:id', async (req, res) => {
    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock($1)', [LOCK_ID]);
        const b = (await client.query(`SELECT * FROM vendor_bills WHERE id=$1 AND voided=FALSE FOR UPDATE`, [Number(req.params.id)])).rows[0];
        if (!b) throw bad('Bill not found or already cancelled.', 404);
        const pay = (await client.query(`SELECT (SELECT COUNT(*) FROM vendor_payments WHERE bill_id=$1 AND COALESCE(note,'')<>'Paid cash at receipt') AS p, (SELECT COUNT(*) FROM vendor_bill_cheques WHERE bill_id=$1 AND status<>'CANCELLED') AS c, (SELECT COUNT(*) FROM vendor_credit_notes WHERE bill_id=$1) AS n`, [b.id])).rows[0];
        if (Number(pay.p) + Number(pay.c) + Number(pay.n) > 0) throw bad('This bill already has a payment, cheque or credit note. Remove those first. Nothing was changed.', 409);
        const old = await billLines(client, b);
        const ids = await takeStockBack(client, old, req.query.keep_stock === '1');
        await noNegative(client, ids);
        if (old.length) await client.query(`DELETE FROM grn_records WHERE id = ANY($1::int[])`, [old.map(x => x.id)]);
        await client.query(`DELETE FROM vendor_payments WHERE bill_id=$1 AND note='Paid cash at receipt'`, [b.id]);
        await client.query(`UPDATE vendor_bills SET voided=TRUE, notes=COALESCE(notes,'') || '; CANCELLED from workbench ' || $2 WHERE id=$1`, [b.id, new Date().toISOString().slice(0, 10)]);
        await client.query('COMMIT');
        res.json({ ok: true, cancelled: b.bill_no, vendor: b.vendor_name, stock_taken_back: old.length });
    } catch (e) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        res.status(e.status || 500).json({ error: e.status ? e.message : 'Could not cancel (nothing was changed): ' + e.message, unmatched: !!e.unmatched });
    } finally { if (client) client.release(); }
});


// ---- Vendor summary + register / edit / delete ----
// Extra vendor details. Additive only (ADD COLUMN IF NOT EXISTS), runs once, never drops or changes anything.
let colsReady = null;
function ensureSupplierCols() {
    if (!colsReady) colsReady = pool.query(`ALTER TABLE suppliers
        ADD COLUMN IF NOT EXISTS contact_person TEXT, ADD COLUMN IF NOT EXISTS whatsapp TEXT, ADD COLUMN IF NOT EXISTS email TEXT,
        ADD COLUMN IF NOT EXISTS address TEXT, ADD COLUMN IF NOT EXISTS city TEXT, ADD COLUMN IF NOT EXISTS tin TEXT,
        ADD COLUMN IF NOT EXISTS default_credit_days INTEGER, ADD COLUMN IF NOT EXISTS pay_note TEXT`).catch(e => { colsReady = null; throw e; });
    return colsReady;
}
router.get('/grn-workbench/vendors', async (req, res) => {
    try { res.json((await pool.query(`SELECT name FROM suppliers WHERE COALESCE(active,true) ORDER BY name`)).rows.map(r => r.name)); }
    catch (e) { res.json([]); }
});

router.get('/grn-workbench/summary', async (req, res) => {
    try {
        await ensureSupplierCols();
        const v = await pool.query(`
          SELECT s.id, s.name, s.phone, s.category, s.notes, s.contact_person, s.whatsapp, s.email, s.address, s.city, s.tin, s.default_credit_days, s.pay_note, COALESCE(s.active,true) AS active,
            (SELECT COUNT(DISTINCT grn_number) FROM grn_records g WHERE g.supplier_id=s.id OR LOWER(g.supplier_name)=LOWER(s.name)) AS grns,
            (SELECT COUNT(*) FROM vendor_bills b WHERE b.voided=FALSE AND LOWER(b.vendor_name)=LOWER(s.name)) AS bills,
            COALESCE((SELECT SUM(b.total) FROM vendor_bills b WHERE b.voided=FALSE AND LOWER(b.vendor_name)=LOWER(s.name)),0) AS billed,
            COALESCE((SELECT SUM(b.total) FROM vendor_bills b WHERE b.voided=FALSE AND LOWER(b.vendor_name)=LOWER(s.name)),0)
              - COALESCE((SELECT SUM(p.amount) FROM vendor_payments p JOIN vendor_bills b ON b.id=p.bill_id WHERE b.voided=FALSE AND LOWER(b.vendor_name)=LOWER(s.name)),0)
              - COALESCE((SELECT SUM(c.amount) FROM vendor_credit_notes c JOIN vendor_bills b ON b.id=c.bill_id WHERE b.voided=FALSE AND LOWER(b.vendor_name)=LOWER(s.name)),0) AS owed,
            (SELECT MIN(d) FROM (SELECT MIN(bill_date) AS d FROM vendor_bills b WHERE LOWER(b.vendor_name)=LOWER(s.name) UNION ALL SELECT MIN(grn_date) FROM grn_records g WHERE LOWER(g.supplier_name)=LOWER(s.name)) x) AS first_seen
          FROM suppliers s ORDER BY first_seen NULLS LAST, s.id`);
        const t = await pool.query(`SELECT COUNT(DISTINCT grn_number) AS grns FROM grn_records`);
        const it = await pool.query(`SELECT COUNT(*) AS n, MIN(item_code::int) AS first, MAX(item_code::int) AS last FROM products WHERE active=true AND item_code ~ '^[0-9]{1,9}$'`);
        const last = Number(it.rows[0].last) || 0;
        const gl = await pool.query(`SELECT grn_number, MAX(supplier_name) AS vendor, to_char(MIN(grn_date),'YYYY-MM-DD') AS grn_date, SUM(total_amount) AS total, COUNT(*) AS lines FROM grn_records GROUP BY grn_number ORDER BY MIN(grn_date) DESC, grn_number LIMIT 300`);
        const bl = await pool.query(`SELECT b.id, b.vendor_name AS vendor, b.bill_no, to_char(b.bill_date,'YYYY-MM-DD') AS bill_date, b.total,
              b.total - COALESCE((SELECT SUM(amount) FROM vendor_payments WHERE bill_id=b.id),0) - COALESCE((SELECT SUM(amount) FROM vendor_credit_notes WHERE bill_id=b.id),0) AS owed,
              (SELECT COUNT(*) FROM vendor_bills x WHERE x.voided=FALSE AND LOWER(x.vendor_name)=LOWER(b.vendor_name) AND ${NORM('x.bill_no')}=${NORM('b.bill_no')}) AS copies
            FROM vendor_bills b WHERE b.voided=FALSE ORDER BY b.bill_date DESC, b.id DESC LIMIT 300`);
        const ri = await pool.query(`SELECT item_code, name, stock_level FROM products WHERE active=true AND item_code ~ '^[0-9]{1,9}$' ORDER BY item_code::int DESC LIMIT 15`);
        res.json({ bill_list: bl.rows, grn_list: gl.rows, recent_items: ri.rows, vendors: v.rows, grns: Number(t.rows[0].grns), items: { count: Number(it.rows[0].n), first: it.rows[0].first == null ? null : String(it.rows[0].first).padStart(3, '0'), last: last ? String(last).padStart(3, '0') : null, next: String(last + 1).padStart(3, '0') } });
    } catch (e) { res.status(500).json({ error: 'Could not build the summary: ' + e.message }); }
});

function vendorFields(b) {
    const name = String((b || {}).name || '').trim().replace(/\s+/g, ' ').slice(0, 120);
    if (!name) throw bad('Vendor name is required');
    const t = (k, n) => String(b[k] || '').trim().slice(0, n) || null;
    const dcd = b.default_credit_days === '' || b.default_credit_days == null ? null : Math.max(0, Math.min(365, Math.round(Number(b.default_credit_days) || 0)));
    return { name, phone: t('phone', 40), category: t('category', 60), notes: t('notes', 300), contact_person: t('contact_person', 80), whatsapp: t('whatsapp', 40), email: t('email', 120), address: t('address', 200), city: t('city', 60), tin: t('tin', 40), default_credit_days: dcd, pay_note: t('pay_note', 200) };
}
router.post('/grn-workbench/vendor', express.json(), async (req, res) => {
    try {
        await ensureSupplierCols();
        const f = vendorFields(req.body);
        const dup = await pool.query(`SELECT id FROM suppliers WHERE LOWER(name)=LOWER($1) LIMIT 1`, [f.name]);
        if (dup.rows.length) throw bad('Vendor "' + f.name + '" is already registered', 409);
        const r = await pool.query(`INSERT INTO suppliers (name, phone, category, notes, contact_person, whatsapp, email, address, city, tin, default_credit_days, pay_note, active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true) RETURNING id`, [f.name, f.phone, f.category, f.notes, f.contact_person, f.whatsapp, f.email, f.address, f.city, f.tin, f.default_credit_days, f.pay_note]);
        res.status(201).json({ ok: true, id: r.rows[0].id });
    } catch (e) { res.status(e.status || 500).json({ error: e.status ? e.message : e.message }); }
});
router.put('/grn-workbench/vendor/:id', express.json(), async (req, res) => {
    try {
        await ensureSupplierCols();
        const id = Number(req.params.id), f = vendorFields(req.body);
        const dup = await pool.query(`SELECT id FROM suppliers WHERE LOWER(name)=LOWER($1) AND id<>$2 LIMIT 1`, [f.name, id]);
        if (dup.rows.length) throw bad('Another vendor already has the name "' + f.name + '"', 409);
        const old = await pool.query(`SELECT name FROM suppliers WHERE id=$1`, [id]);
        if (!old.rows.length) throw bad('Vendor not found', 404);
        if (old.rows[0].name.toLowerCase() !== f.name.toLowerCase()) {
            const used = await pool.query(`SELECT (SELECT COUNT(*) FROM vendor_bills WHERE LOWER(vendor_name)=LOWER($1)) + (SELECT COUNT(*) FROM grn_records WHERE LOWER(supplier_name)=LOWER($1)) AS n`, [old.rows[0].name]);
            if (Number(used.rows[0].n) > 0) throw bad('This vendor already has bills, so the name cannot be changed (the bills would no longer match). You can change phone, category and notes.', 409);
        }
        await pool.query(`UPDATE suppliers SET name=$1, phone=$2, category=$3, notes=$4, contact_person=$5, whatsapp=$6, email=$7, address=$8, city=$9, tin=$10, default_credit_days=$11, pay_note=$12 WHERE id=$13`, [f.name, f.phone, f.category, f.notes, f.contact_person, f.whatsapp, f.email, f.address, f.city, f.tin, f.default_credit_days, f.pay_note, id]);
        res.json({ ok: true });
    } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
router.delete('/grn-workbench/vendor/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        const s = await pool.query(`SELECT name FROM suppliers WHERE id=$1`, [id]);
        if (!s.rows.length) throw bad('Vendor not found', 404);
        const used = await pool.query(`SELECT (SELECT COUNT(*) FROM vendor_bills WHERE LOWER(vendor_name)=LOWER($1)) + (SELECT COUNT(*) FROM grn_records WHERE LOWER(supplier_name)=LOWER($1)) AS n`, [s.rows[0].name]);
        if (Number(used.rows[0].n) > 0) { await pool.query(`UPDATE suppliers SET active=false WHERE id=$1`, [id]); return res.json({ ok: true, hidden: true, message: 'This vendor has bills, so it was hidden, not deleted. Its bills are safe.' }); }
        await pool.query(`DELETE FROM suppliers WHERE id=$1`, [id]);
        res.json({ ok: true, hidden: false, message: 'Vendor deleted.' });
    } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
router.post('/grn-workbench/vendor/:id/show', async (req, res) => {
    try { await pool.query(`UPDATE suppliers SET active=true WHERE id=$1`, [Number(req.params.id)]); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
module.exports.validatePackage = validatePackage;
module.exports.READ_PROMPT = READ_PROMPT;
module.exports.readWithVision = readWithVision;
module.exports.readFailure = readFailure;
module.exports.isRateLimit = isRateLimit;
module.exports.nextFreeNumber = nextFreeNumber;
module.exports.keyNo = keyNo;
module.exports.cleanExtra = cleanExtra;
