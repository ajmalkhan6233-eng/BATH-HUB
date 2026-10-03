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
    return null;
}

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
const bad = (status, msg) => { const e = new Error(msg); e.status = status; return e; };

function createRouter(pool, { ocr, inboxRoot, fileDaySheet } = {}) {
    const router = express.Router();
    // what the screen gets: the row, plus (for a GRN waiting to be checked) which supplier / items were recognised
    const view = async row => {
        const p = present(row);
        if (p.doc_type === 'grn' && p.status === 'to_check') p.match = await matchGrn(pool, p.extracted);
        return p;
    };
    const ROOT = path.resolve(inboxRoot || path.join(process.env.DROP_ROOT || path.join(__dirname, '..', 'data', 'drop'), 'inbox'));
    const reader = ocr || (async (p) => require('../scripts/ocr_photo').ocrPhoto(p));

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
            if (!ext) return res.status(400).json({ error: 'That file is not a photo (JPG or PNG) or a PDF' });
            const hint = String(req.body && req.body.doc_type || '').trim();
            if (hint && hint !== 'auto' && !F.DOC_TYPES[hint]) return res.status(400).json({ error: 'Unknown paper type' });
            const dir = path.join(ROOT, todayLK());
            fs.mkdirSync(dir, { recursive: true });
            const file = path.join(dir, `${Date.now()}-upload-${crypto.randomBytes(3).toString('hex')}.${ext}`);
            fs.writeFileSync(file, req.file.buffer);
            const hintType = hint && hint !== 'auto' ? hint : null;
            const read = ext === 'pdf'
                ? { doc_type: hintType || 'unknown', extracted: F.normalize(hintType || 'unknown', {}), confidence: '', reader_note: 'PDFs are saved but not read. Choose the type and type the details in, or send a photo.' }
                : await readPhoto(file, hintType);
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
