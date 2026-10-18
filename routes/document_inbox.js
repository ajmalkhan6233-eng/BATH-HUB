// routes/document_inbox.js
// DOCUMENT INBOX: every photo of a paper (a manual bill, a GRN, a cheque, a sales or expense sheet) lands here, from a
// direct upload or from WhatsApp. The reader looks for the heading Aj writes at the top (BILL / GRN / CHEQUE /
// EXPENSES / DAILY SALES), fills in the fields, and shows the photo beside them. NOTHING is filed until Aj checks the
// fields and presses Confirm; then it goes to the right table:
//   manual_bill -> pos_bills (+ items), marked source 'manual_photo', dated as written on the paper, photo attached
//   grn         -> grn_records, status PENDING_REVIEW (never touches stock)
//   cheque      -> cheque_register, status pending
//   day_sheet / expense_sheet -> daily_summary through the same careful merge the WhatsApp YES reply uses
// A paper that cannot be read is still kept: Aj can pick the type and type the fields in by hand.
// Owner/admin only. Own table `document_inbox`.

require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { Pool } = require('pg');
const { todayLK } = require('../utils/lkTime');
const { safeInboxPath } = require('../middleware/webhookAuth');
const F = require('../utils/documentFiling');

const MAX_BYTES = 10 * 1024 * 1024;

function ownerOnly(req, res, next) {
    const u = req.session && req.session.user;
    if (!u || (u.role !== 'admin' && u.role !== 'owner')) return res.status(403).json({ error: 'Owner only' });
    next();
}

// The real file type from the first bytes (the filename is not trusted).
function sniff(buf) {
    if (buf.length > 12 && buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'jpg';
    if (buf.length > 8 && buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) return 'png';
    if (buf.length > 5 && buf.slice(0, 5).toString() === '%PDF-') return 'pdf';
    // voice notes (WhatsApp .ogg/.opus, phone recorder .m4a/.mp3/.wav, browser recorder .webm)
    if (buf.length > 12 && buf.slice(0, 4).toString() === 'OggS') return 'ogg';
    if (buf.length > 12 && buf.slice(4, 8).toString() === 'ftyp') return 'm4a';
    if (buf.length > 12 && (buf.slice(0, 3).toString() === 'ID3' || (buf[0] === 0xFF && (buf[1] & 0xE0) === 0xE0))) return 'mp3';
    if (buf.length > 12 && buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WAVE') return 'wav';
    if (buf.length > 12 && buf[0] === 0x1A && buf[1] === 0x45 && buf[2] === 0xDF && buf[3] === 0xA3) return 'webm';
    return null;
}

const isAudioExt = e => ['ogg', 'm4a', 'mp3', 'wav', 'webm'].includes(e);
const AUDIO_MIME = { ogg: 'audio/ogg', m4a: 'audio/mp4', mp3: 'audio/mpeg', wav: 'audio/wav', webm: 'audio/webm' };
const parse = r => ({ ...r, extracted: (() => { try { return JSON.parse(r.extracted); } catch (e) { return {}; } })() });
const present = r => {
    const p = parse(r), meta = F.DOC_TYPES[p.doc_type] || F.DOC_TYPES.unknown;
    return { ...p, type_label: meta.label, files_to: meta.files_to, fileable: !!meta.files_to, has_photo: true };
};
// GRN: which supplier is this, and which catalogue item is each line? Items are created in the catalogue first, so a
// line is matched by its item code (exact), else by its exact name. Reads only; a missing table just means "no match".
async function matchGrn(db, ex) {
    const out = { supplier: null, items: [] };
    try {
        const want = String(ex.supplier_name || '').trim().toLowerCase();
        if (want) {
            const all = (await db.query(`SELECT id, name FROM suppliers`)).rows;
            const low = r => String(r.name || '').trim().toLowerCase();
            out.supplier = all.find(r => low(r) === want)
                || (want.length >= 3 ? all.find(r => low(r).length >= 3 && (low(r).includes(want) || want.includes(low(r)))) : null) || null;
            if (out.supplier) out.supplier = { id: out.supplier.id, name: out.supplier.name };
        }
    } catch (e) { /* no suppliers table */ }
    for (const i of ex.items) {
        let p = null;
        try {
            if (i.item_code) p = (await db.query(`SELECT item_code, name FROM products WHERE item_code = $1 LIMIT 1`, [i.item_code])).rows[0] || null;
            if (!p && i.description) p = (await db.query(`SELECT item_code, name FROM products WHERE LOWER(name) = LOWER($1) LIMIT 1`, [i.description])).rows[0] || null;
        } catch (e) { /* no products table */ }
        out.items.push({ item_code: i.item_code || '', matched: p ? { item_code: p.item_code, name: p.name } : null });
    }
    return out;
}
// Credit entries: which customer is this? Exact name first, else a name that contains / is contained (min 3 letters). Reads only.
async function matchCustomer(db, name) {
    const want = String(name || '').trim().toLowerCase();
    if (!want) return { found: 'none', customers: [] };
    let all = [];
    try { all = (await db.query(`SELECT id, name, phone FROM customers`)).rows; } catch (e) { return { found: 'none', customers: [] }; }
    const low = r => String(r.name || '').trim().toLowerCase();
    let hits = all.filter(r => low(r) === want);
    if (!hits.length && want.length >= 3) hits = all.filter(r => low(r).length >= 3 && (low(r).includes(want) || want.includes(low(r))));
    return { found: hits.length === 1 ? 'one' : hits.length ? 'many' : 'none', customers: hits.slice(0, 5).map(r => ({ id: r.id, name: r.name, phone: r.phone })) };
}
async function openInvoices(db, customerId, lock) {
    const sql = lock
        ? 'SELECT id, invoice_no, invoice_date, amount, paid FROM credit_customers WHERE customer_id = $1 AND quarantined IS NOT TRUE ORDER BY invoice_date, id FOR UPDATE'
        : 'SELECT id, invoice_no, invoice_date, amount, paid FROM credit_customers WHERE customer_id = $1 AND quarantined IS NOT TRUE ORDER BY invoice_date, id';
    return (await db.query(sql, [customerId])).rows;
}
const bad = (status, msg) => { const e = new Error(msg); e.status = status; return e; };

function createRouter(pool, { ocr, inboxRoot, fileDaySheet, voice } = {}) {
    const router = express.Router();
    // what the screen gets: the row, plus (for a GRN waiting to be checked) which supplier / items were recognised
    const view = async row => {
        const p = present(row);
        if (p.doc_type === 'grn' && p.status === 'to_check') p.match = await matchGrn(pool, p.extracted);
        if ((p.doc_type === 'credit_given' || p.doc_type === 'credit_paid') && p.status === 'to_check') {
            const c = await matchCustomer(pool, p.extracted.customer_name);
            p.match = { ...c };
            if (c.found === 'one') {
                try {
                    const inv = await openInvoices(pool, c.customers[0].id);
                    const a = F.allocatePayment(inv, p.doc_type === 'credit_paid' ? (p.extracted.amount || 0) : 0);
                    p.match.outstanding = a.outstanding;
                    if (p.doc_type === 'credit_paid') { p.match.applied = a.applied; p.match.remaining = a.remaining; }
                } catch (e) { /* no credit table: no preview */ }
            }
        }
        return p;
    };
    const ROOT = path.resolve(inboxRoot || path.join(process.env.DROP_ROOT || path.join(__dirname, '..', 'data', 'drop'), 'inbox'));
    const reader = ocr || (async (p) => require('../scripts/ocr_photo').ocrPhoto(p));
    const listenVoice = voice || (async (buffer, mime) => require('../utils/geminiVoice').geminiVoice({ key: process.env.GEMINI_API_KEY, buffer, mime }));

    const ready = pool.query(`CREATE TABLE IF NOT EXISTS document_inbox (
        id SERIAL PRIMARY KEY,
        source TEXT NOT NULL DEFAULT 'upload',
        from_ref TEXT NOT NULL DEFAULT '',
        original_name TEXT NOT NULL DEFAULT '',
        file_path TEXT NOT NULL,
        doc_type TEXT NOT NULL DEFAULT 'unknown',
        status TEXT NOT NULL DEFAULT 'to_check',
        extracted TEXT NOT NULL DEFAULT '{}',
        confidence TEXT NOT NULL DEFAULT '',
        reader_note TEXT NOT NULL DEFAULT '',
        filed_to TEXT,
        filed_id TEXT,
        filed_note TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        filed_at TIMESTAMPTZ)`).catch(e => console.error('[document_inbox] init failed:', e.message));

    // Reads a saved photo and returns the row fields to store. Never throws: a failed read keeps the photo for manual entry.
    async function readPhoto(filePath, hintType) {
        try {
            const o = await reader(filePath);
            const type = hintType || F.typeFromOcr(o);
            return { doc_type: type, extracted: F.normalize(type, o), confidence: String(o.confidence || ''), reader_note: String(o.notes || o.ocr_notes || '').slice(0, 500) };
        } catch (e) {
            const type = hintType || 'unknown';
            return { doc_type: type, extracted: F.normalize(type, {}), confidence: '', reader_note: `Could not read the photo (${String(e.message).slice(0, 160)}). Choose the type and type the details in.` };
        }
    }

    // Used by the WhatsApp webhook and the upload route: one inbox row per photo.
    async function record({ source, from_ref = '', original_name = '', file_path, ocr_result = null, doc_type = null, reader_note = '' }) {
        await ready;
        let type = doc_type, ex = {}, conf = '', note = reader_note;
        if (ocr_result) {
            type = type || F.typeFromOcr(ocr_result);
            ex = F.normalize(type, ocr_result); conf = String(ocr_result.confidence || ''); note = note || String(ocr_result.notes || ocr_result.ocr_notes || '').slice(0, 500);
        } else {
            type = type || 'unknown';
            ex = F.normalize(type, {});
        }
        const r = await pool.query(
            `INSERT INTO document_inbox (source, from_ref, original_name, file_path, doc_type, extracted, confidence, reader_note) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
            [source, String(from_ref), String(original_name).slice(0, 200), file_path, type, JSON.stringify(ex), conf, note]);
        return present(r.rows[0]);
    }
    router.record = record;

    // A voice note (the owner dictated a day's expenses or sales) -> ONE inbox row, with the audio kept beside it so it can be played back.
    // It is a DRAFT like every other paper: nothing is filed until Confirm, and the daily-summary merge still refuses to overwrite figures already there.
    async function recordVoice({ entry, buffer, mime = 'audio/ogg', original = '', english = '', warnings = [], confidence = '', from = '', engine = '' }) {
        await ready;
        if (!entry || !['expense_list', 'day_sheet', 'credit_given', 'credit_paid'].includes(entry.kind)) throw bad(400, 'Not an expense list, a day sheet or a credit entry');
        const ext = /mp4|m4a|aac/.test(mime) ? 'm4a' : /mpeg|mp3/.test(mime) ? 'mp3' : /webm/.test(mime) ? 'webm' : /wav/.test(mime) ? 'wav' : 'ogg';
        const dir = path.join(ROOT, todayLK()); fs.mkdirSync(dir, { recursive: true });
        const file = path.join(dir, `${Date.now()}-voice-${crypto.randomBytes(3).toString('hex')}.${ext}`);
        fs.writeFileSync(file, buffer);
        const type = entry.kind === 'expense_list' ? 'expense_sheet' : entry.kind;
        const usedToday = !entry.date;
        const isCredit = entry.kind === 'credit_given' || entry.kind === 'credit_paid';
        const ex = isCredit ? F.normalize(type, { customer_name: entry.party, amount: entry.amount, date: entry.date || todayLK(), notes: entry.note }) : F.normalize(type, {
            date: entry.date || todayLK(), total_expenses: entry.total_expenses, total_sale: entry.total_sale, cash_sale: entry.cash_sale,
            card_sale: entry.card_sale, online_sale: entry.online_sale, credit_sale: entry.credit_sale,
            expense_items: (entry.items || []).map(i => `${i.name} ${i.amount}`).join('; '),
        });
        const note = [`Voice note${engine ? ' (' + engine + ')' : ''}. Said: "${String(original).slice(0, 300)}"`, english && english !== original ? `English: "${String(english).slice(0, 300)}"` : '', usedToday ? 'No date was said: today was used.' : '', ...(warnings || [])].filter(Boolean).join(' ').slice(0, 500);
        const r = await pool.query(
            `INSERT INTO document_inbox (source, from_ref, original_name, file_path, doc_type, extracted, confidence, reader_note) VALUES ('voice',$1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [String(from), 'voice note', file, type, JSON.stringify(ex), String(confidence || ''), note]);
        return present(r.rows[0]);
    }
    router.recordVoice = recordVoice;

    // ── intake: direct upload ───────────────────────────────────────────────
    const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: 1 } });
    router.post('/document-inbox/upload', ownerOnly, (req, res, next) => upload.single('photo')(req, res, err => {
        if (!err) return next();
        res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'The photo is too large (max 10 MB)' : `Upload problem: ${err.message}` });
    }), async (req, res) => {
        try {
            await ready;
            if (!req.file) return res.status(400).json({ error: 'Choose a photo to upload' });
            const ext = sniff(req.file.buffer);
            if (!ext) return res.status(400).json({ error: 'That file is not a photo (JPG or PNG), a PDF or a voice note' });
            const hint = String(req.body && req.body.doc_type || '').trim();
            if (hint && hint !== 'auto' && !F.DOC_TYPES[hint]) return res.status(400).json({ error: 'Unknown paper type' });
            const dir = path.join(ROOT, todayLK());
            fs.mkdirSync(dir, { recursive: true });
            const file = path.join(dir, `${Date.now()}-upload-${crypto.randomBytes(3).toString('hex')}.${ext}`);
            fs.writeFileSync(file, req.file.buffer);
            const hintType = hint && hint !== 'auto' ? hint : null;
            let read;
            if (isAudioExt(ext)) {
                // a voice note: listen (Sinhala / Tamil / English), and when a day's expenses or sales were dictated, fill the figures. A draft only.
                const v = await Promise.resolve(listenVoice(req.file.buffer, AUDIO_MIME[ext])).catch(e => ({ ok: false, reason: e.message }));
                if (v && v.ok && v.entry && v.entry.kind !== 'none') {
                    fs.unlinkSync(file);
                    const row = await recordVoice({ entry: v.entry, buffer: req.file.buffer, mime: AUDIO_MIME[ext], original: v.text, english: v.english, warnings: v.warnings, confidence: v.confidence, from: String((req.session.user && req.session.user.username) || ''), engine: v.model });
                    return res.status(201).json(await view((await pool.query(`SELECT * FROM document_inbox WHERE id = $1`, [row.id])).rows[0]));
                }
                const said = v && v.ok ? `Heard: "${String(v.text).slice(0, 300)}"${v.english && v.english !== v.text ? ` (English: "${String(v.english).slice(0, 300)}")` : ''}. It was not a list of the day's expenses or sales, so nothing was filled in. Choose the type and type the details in.` : `Could not listen to the voice note (${String((v && v.reason) || 'unknown').slice(0, 120)}). Choose the type and type the details in.`;
                read = { doc_type: hintType || 'unknown', extracted: F.normalize(hintType || 'unknown', {}), confidence: '', reader_note: said };
            } else if (ext === 'pdf' && !process.env.GEMINI_API_KEY && !ocr) {
                read = { doc_type: hintType || 'unknown', extracted: F.normalize(hintType || 'unknown', {}), confidence: '', reader_note: 'PDFs can only be read when the Gemini key is set. It is saved: choose the type and type the details in, or send a photo.' };
            } else {
                read = await readPhoto(file, hintType);   // photos, and PDFs (Gemini reads a PDF directly)
            }
            const row = await pool.query(
                `INSERT INTO document_inbox (source, from_ref, original_name, file_path, doc_type, extracted, confidence, reader_note) VALUES ('upload',$1,$2,$3,$4,$5,$6,$7) RETURNING *`,
                [String((req.session.user && req.session.user.username) || ''), String(req.file.originalname || '').slice(0, 200), file, read.doc_type, JSON.stringify(read.extracted), read.confidence, read.reader_note]);
            res.status(201).json(await view(row.rows[0]));
        } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
    });

    // ── review ──────────────────────────────────────────────────────────────
    router.get('/document-inbox', ownerOnly, async (req, res) => {
        try {
            await ready;
            const st = String(req.query.status || 'to_check');
            if (!['to_check', 'filed', 'rejected', 'all'].includes(st)) return res.status(400).json({ error: 'status must be to_check, filed, rejected or all' });
            const r = await pool.query(`SELECT * FROM document_inbox WHERE ($1 = 'all' OR status = $1) ORDER BY id DESC LIMIT 200`, [st]);
            res.json(await Promise.all(r.rows.map(view)));
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.get('/document-inbox/:id/photo', ownerOnly, async (req, res) => {
        try {
            await ready;
            const r = await pool.query(`SELECT id, file_path FROM document_inbox WHERE id = $1`, [Number(req.params.id) || 0]);
            if (!r.rows[0]) return res.status(404).json({ error: 'Not found' });
            const full = path.resolve(r.rows[0].file_path);
            if (!full.startsWith(ROOT + path.sep) || !fs.existsSync(full)) return res.status(404).json({ error: 'The photo file is missing' });
            if (req.query.download) return res.download(path.relative(ROOT, full), `document-${r.rows[0].id || req.params.id}${path.extname(full)}`, { root: ROOT, dotfiles: 'allow' });   // the Download button
            res.sendFile(path.relative(ROOT, full), { root: ROOT, dotfiles: 'allow' });     // root option: works even when the path has a dot folder
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    async function load(id, client) {
        const r = await (client || pool).query(`SELECT * FROM document_inbox WHERE id = $1${client ? ' FOR UPDATE' : ''}`, [Number(id) || 0]);
        return r.rows[0];
    }

    // Aj changes the type and/or the fields.
    router.put('/document-inbox/:id', ownerOnly, async (req, res) => {
        try {
            await ready;
            const row = await load(req.params.id);
            if (!row) return res.status(404).json({ error: 'Not found' });
            if (row.status !== 'to_check') return res.status(409).json({ error: `This paper is already ${row.status}` });
            const b = req.body || {};
            const type = b.doc_type !== undefined ? String(b.doc_type) : row.doc_type;
            if (!F.DOC_TYPES[type]) return res.status(400).json({ error: 'Unknown paper type' });
            const ex = F.normalize(type, b.extracted !== undefined ? b.extracted : (type === row.doc_type ? parse(row).extracted : {}));
            const u = await pool.query(`UPDATE document_inbox SET doc_type = $1, extracted = $2 WHERE id = $3 RETURNING *`, [type, JSON.stringify(ex), row.id]);
            res.json(await view(u.rows[0]));
        } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
    });

    // Read the photo again (e.g. the reader was down the first time).
    router.post('/document-inbox/:id/reread', ownerOnly, async (req, res) => {
        try {
            await ready;
            const row = await load(req.params.id);
            if (!row) return res.status(404).json({ error: 'Not found' });
            if (row.status !== 'to_check') return res.status(409).json({ error: `This paper is already ${row.status}` });
            if (/\.pdf$/i.test(row.file_path)) return res.status(400).json({ error: 'PDFs cannot be read' });
            const read = await readPhoto(row.file_path, null);
            const u = await pool.query(`UPDATE document_inbox SET doc_type = $1, extracted = $2, confidence = $3, reader_note = $4 WHERE id = $5 RETURNING *`,
                [read.doc_type, JSON.stringify(read.extracted), read.confidence, read.reader_note, row.id]);
            res.json(await view(u.rows[0]));
        } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
    });

    router.post('/document-inbox/:id/reject', ownerOnly, async (req, res) => {
        try {
            await ready;
            const row = await load(req.params.id);
            if (!row) return res.status(404).json({ error: 'Not found' });
            if (row.status !== 'to_check') return res.status(409).json({ error: `This paper is already ${row.status}` });
            const u = await pool.query(`UPDATE document_inbox SET status = 'rejected', filed_at = NOW() WHERE id = $1 RETURNING *`, [row.id]);
            res.json(await view(u.rows[0]));
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ── confirm and file ────────────────────────────────────────────────────
    router.post('/document-inbox/:id/file', ownerOnly, async (req, res) => {
        let client;
        try {
            await ready;
            client = await pool.connect();
            await client.query('BEGIN');
            const row = await load(req.params.id, client);
            if (!row) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Not found' }); }
            if (row.status !== 'to_check') { await client.query('ROLLBACK'); return res.status(409).json({ error: `This paper is already ${row.status}` }); }

            const type = row.doc_type, ex = F.normalize(type, parse(row).extracted);
            let match = null;
            const extraWarnings = [];
            if (type === 'grn') {
                match = await matchGrn(pool, ex);      // own connection: a missing table must not abort this transaction
                ex.items.forEach((i, n) => {
                    const m = match.items[n] && match.items[n].matched;
                    if (m && !i.description) i.description = m.name;
                    if (m) i.item_code = m.item_code;
                    else extraWarnings.push(i.item_code ? `Item code ${i.item_code} (${i.description || 'no name'}) is not in your catalogue. Create the item first, or file anyway.` : `Item ${n + 1} (${i.description || 'no name'}) has no item code that matches your catalogue.`);
                });
                if (ex.supplier_name && !match.supplier) extraWarnings.push(`Supplier "${ex.supplier_name}" is not in your Suppliers list. It is filed under that name only.`);
            }
            const v = F.validateForFiling(type, ex);
            v.warnings.push(...extraWarnings);
            if (!v.ok) { await client.query('ROLLBACK'); return res.status(400).json({ error: v.errors[0], errors: v.errors }); }
            if (v.warnings.length && (req.body || {}).accept_warnings !== true) {
                await client.query('ROLLBACK');
                return res.status(409).json({ error: v.warnings[0], code: 'needs_confirmation', warnings: v.warnings });
            }

            let filed_to, filed_id, note = '';
            if (type === 'manual_bill') {
                const t = F.billTotals(ex);
                let number = `MAN-${(ex.bill_number || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 24) || ex.date.replace(/-/g, '') + '-D' + row.id}`;
                if ((await client.query(`SELECT 1 FROM pos_bills WHERE bill_number = $1`, [number])).rows.length) number = `${number}-D${row.id}`;
                const pct = t.subtotal > 0 ? F.money2(t.discount_amount / t.subtotal * 100) : 0;
                const bill = await client.query(
                    `INSERT INTO pos_bills (bill_number, customer_name, customer_phone, subtotal, discount_pct, discount_amount, total, payment_method, notes, created_at, source, attachment_path)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'manual_photo',$11) RETURNING id, bill_number`,
                    [number, ex.customer_name || null, ex.customer_phone || null, t.subtotal, pct, t.discount_amount, t.total, ex.payment_method,
                        `Manual bill from paper${ex.bill_number ? ' no. ' + ex.bill_number : ''} (document #${row.id}). ${ex.notes}`.trim(), `${ex.date} 12:00:00`, row.file_path]);
                for (const l of t.lines) {
                    await client.query(`INSERT INTO pos_bill_items (bill_id, item_name, qty, unit_price, line_total) VALUES ($1,$2,$3,$4,$5)`, [bill.rows[0].id, l.item_name, l.qty, l.unit_price, l.line_total]);
                }
                filed_to = 'pos_bills'; filed_id = String(bill.rows[0].id); note = `Bill ${bill.rows[0].bill_number}, total ${t.total}`;
            } else if (type === 'grn') {
                const rows = F.grnRows(ex);
                const grnNumber = ex.grn_number || `DOC-${row.id}`;
                const supplierId = match && match.supplier ? match.supplier.id : null;
                const supplierName = match && match.supplier ? match.supplier.name : ex.supplier_name;
                let firstId = null;
                for (const g of rows) {
                    const desc = g.item_code && !String(g.item_description).startsWith(g.item_code) ? `${g.item_code} - ${g.item_description}` : g.item_description;
                    const ins = await client.query(
                        `INSERT INTO grn_records (grn_number, supplier_id, supplier_name, grn_date, item_description, quantity, unit_cost, total_amount, source_file_path, status, notes)
                         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'PENDING_REVIEW',$10) RETURNING id`,
                        [grnNumber, supplierId, supplierName, ex.date, desc, g.quantity, g.unit_cost, g.total_amount, row.file_path, `From paper GRN (document #${row.id}). Stock is not changed until reviewed. ${ex.notes}`.trim()]);
                    if (firstId === null) firstId = ins.rows[0].id;
                }
                filed_to = 'grn_records'; filed_id = String(firstId); note = `GRN ${grnNumber} from ${supplierName}: ${rows.length} item(s), pending review, stock not changed`;
            } else if (type === 'cheque') {
                const ins = await client.query(
                    `INSERT INTO cheque_register (cheque_no, bank, payee, amount, due_date, notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
                    [ex.cheque_number || null, ex.bank || null, ex.payee, F.money2(ex.amount), ex.due_date, `From paper (document #${row.id})${ex.direction ? ', ' + ex.direction : ''}. ${ex.notes}`.trim()]);
                filed_to = 'cheque_register'; filed_id = String(ins.rows[0].id); note = `Cheque to ${ex.payee}, ${F.money2(ex.amount)}, due ${ex.due_date}`;
            } else if (type === 'credit_given' || type === 'credit_paid') {
                const c = await matchCustomer(pool, ex.customer_name);
                if (c.found === 'none') throw bad(400, `Customer "${ex.customer_name}" is not in your Customers list. Add them in Customers first, or correct the name.`);
                if (c.found === 'many') throw bad(400, `More than one customer matches "${ex.customer_name}" (${c.customers.map(x => x.name).join(', ')}). Type the full name exactly as in Customers.`);
                const cust = c.customers[0];
                if (type === 'credit_given') {
                    const ins = await client.query(
                        `INSERT INTO credit_customers (customer_id, invoice_date, invoice_no, amount, paid, due_date, notes) VALUES ($1,$2,$3,$4,0,$5,$6) RETURNING id`,
                        [cust.id, ex.date, `VOICE-${row.id}`, F.money2(ex.amount), ex.due_date || null, `From ${row.source === 'voice' ? 'a voice note' : 'a paper'} (document #${row.id}). ${ex.notes}`.trim()]);
                    filed_to = 'credit_customers'; filed_id = String(ins.rows[0].id); note = `Credit of ${F.money2(ex.amount)} to ${cust.name} (invoice VOICE-${row.id})`;
                } else {
                    const a = F.allocatePayment(await openInvoices(client, cust.id, true), ex.amount);
                    if (!a.applied.length) throw bad(400, `${cust.name} owes nothing on credit, so there is nothing to settle.`);
                    if (a.remaining > 0) throw bad(400, `${cust.name} owes only ${a.outstanding}, but ${F.money2(ex.amount)} was paid. Check the amount.`);
                    for (const x of a.applied) await client.query(`UPDATE credit_customers SET paid = COALESCE(paid, 0) + $1 WHERE id = $2`, [x.apply, x.id]);
                    filed_to = 'credit_customers'; filed_id = a.applied.map(x => x.id).join(',');
                    note = `${cust.name} paid ${F.money2(ex.amount)}: settled ${a.applied.map(x => `${x.invoice_no || '#' + x.id} (${x.apply}${x.left > 0 ? ', ' + x.left + ' still owed' : ''})`).join(', ')}. Cash received is NOT added to the day's sales: enter it on the day sheet.`;
                }
            } else if (type === 'day_sheet' || type === 'expense_sheet') {
                if (!fileDaySheet) throw bad(501, 'Filing daily sheets is not available here');
                const out = await fileDaySheet(ex);
                filed_to = 'daily_summary'; filed_id = ex.date; note = String((out && out.message) || `Saved for ${ex.date}`).slice(0, 400);
            }

            const done = await client.query(`UPDATE document_inbox SET status = 'filed', filed_to = $1, filed_id = $2, filed_note = $3, filed_at = NOW(), extracted = $4 WHERE id = $5 RETURNING *`,
                [filed_to, filed_id, note, JSON.stringify(ex), row.id]);
            await client.query('COMMIT');
            res.json({ ...present(done.rows[0]), warnings: v.warnings });
        } catch (e) {
            if (client) await client.query('ROLLBACK').catch(() => {});
            res.status(e.status || 500).json({ error: e.status ? e.message : `Could not file it (nothing was saved): ${e.message}` });
        } finally {
            if (client) client.release();
        }
    });

    return router;
}

let _router, _opts = {};
function init() {
    if (!_router) _router = createRouter(require('../utils/pool'), _opts);
    return _router;
}
module.exports = function (req, res, next) { init()(req, res, next); };
module.exports.createRouter = createRouter;
module.exports.getInbox = () => init();                         // .record(...) for the WhatsApp webhook
module.exports.configure = opts => { _opts = { ..._opts, ...opts }; };   // server.js hands in fileDaySheet before the first request
module.exports.sniff = sniff;
