// routes/documents.js
// DOCUMENTS AND REPORTS (isolated module, owner only: role admin / owner; staff and logged-out visitors are refused).
//   GET  /api/documents/reports                     the reports that can be made
//   POST /api/documents/generate                    { report, from, to, formats: ['pdf','csv'] } -> saves the files, returns their records
//   GET  /api/documents                             the saved documents, newest first (?type=pnl)
//   GET  /api/documents/:id/download                downloads one (looked up by id only; ?view=1 shows a PDF in the browser)
//   DELETE /api/documents/:id                       removes the record and the file
//   POST /api/documents/:id/send                    { recipient_id, purpose } WhatsApp, allow-list only, DRY RUN unless the live flags are on
//   GET  /api/documents/sends                       log of every send attempt
//   GET/POST/PUT/DELETE /api/documents/recipients   the allow-list (starts empty; phone shown as last 3 digits)
//   GET  /api/documents/inbox                       quarantined inbound files with a suggested place
//   POST /api/documents/inbox/upload                owner uploads a test file (multipart "file")
//   GET  /api/documents/inbox/:id/file              look at a quarantined file
//   POST /api/documents/inbox/:id/confirm           { place } hands it to the existing Document Inbox (still checked there before any filing)
//   POST /api/documents/inbox/:id/reject            deletes the file
// New tables only (reverse: scripts/documents_down.sql). Files: uploads/documents/YYYY/MM/<random>.pdf|csv, uploads/inbox/<random>.<ext>.
// No ledger is ever written by this module. Reports are read-only SELECTs.
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const schema = require('../utils/documents/schema');
const reports = require('../utils/documents/reports');
const render = require('../utils/documents/render');
const store = require('../utils/documents/store');
const sender = require('../utils/documents/sender');
const Q = require('../utils/documents/quarantine');
const { parseRange } = require('../utils/documents/format');
const { todayLK } = require('../utils/lkTime');

const FORMATS = ['pdf', 'csv'];
const userName = req => (req.session && req.session.user && (req.session.user.username || req.session.user.name)) || null;
function ownerOnly(req, res, next) {
    const u = req.session && req.session.user;
    if (!u) return res.status(401).json({ error: 'Not logged in' });
    if (u.role !== 'admin' && u.role !== 'owner') return res.status(403).json({ error: 'Only the owner can use Documents.' });
    next();
}
const presentDoc = r => ({ id: r.id, type: r.type, title: r.title, period: r.period, created_at: r.created_at, format: r.format, bytes: r.bytes, sha256: r.sha256, created_by: r.created_by });
const idOf = v => (/^\d{1,9}$/.test(String(v)) ? Number(v) : 0);
const fail = (res, e, fallback) => {
    if (e && e.status) return res.status(e.status).json({ error: e.message });
    console.error('[documents]', e && e.message);
    res.status(500).json({ error: fallback });       // never the raw database / stack text
};

// Hand a confirmed quarantine file to the existing Document Inbox (routes/document_inbox.js) as a paper "to check". Returns the inbox row id.
async function defaultHandoff({ row, abs, place, user }) {
    const inbox = require('./document_inbox').getInbox();
    const base = path.resolve(process.env.DROP_ROOT ? path.join(process.env.DROP_ROOT, 'inbox') : path.join(__dirname, '..', 'data', 'drop', 'inbox'));
    const dir = path.join(base, todayLK());
    fs.mkdirSync(dir, { recursive: true });
    const dest = path.join(dir, `${Date.now()}-quarantine-${crypto.randomBytes(3).toString('hex')}.${row.ext}`);
    fs.copyFileSync(abs, dest);
    try {
        const rec = await inbox.record({ source: 'documents_quarantine', from_ref: row.from_ref || user || '', original_name: row.original_name, file_path: dest, doc_type: Q.PLACES[place].inbox_type, reader_note: 'Confirmed from quarantine by the owner. Check every detail before filing.' });
        return rec.id;
    } catch (e) { fs.unlink(dest, () => {}); throw e; }
}

function createRouter(pool, opts = {}) {
    const router = express.Router();
    const root = path.resolve(opts.root || store.defaultRoot());
    const inboxRoot = path.resolve(opts.inboxRoot || Q.defaultRoot());
    const makePdf = opts.makePdf || (rep => render.makePdf(rep));
    const handoff = opts.handoff || defaultHandoff;
    const getTransport = () => opts.transport || undefined;     // undefined -> the sender picks (dry run unless both live flags and keys)
    const ready = schema.ensureTables(pool);
    ready.catch(() => {});

    router.use('/documents', ownerOnly, (req, res, next) => ready.then(() => next(), () => res.status(500).json({ error: 'Documents are not available right now.' })));

    // ───────── reports ─────────
    router.get('/documents/reports', (req, res) => res.json(reports.list()));

    router.post('/documents/generate', async (req, res) => {
        try {
            const b = req.body || {};
            const range = parseRange(String(b.from || ''), String(b.to || ''));
            if (!reports.REPORTS[b.report] || typeof b.report !== 'string') return res.status(400).json({ error: 'Choose a report.' });
            const formats = Array.isArray(b.formats) && b.formats.length ? [...new Set(b.formats.map(String))] : ['pdf', 'csv'];
            if (formats.some(f => !FORMATS.includes(f))) return res.status(400).json({ error: 'Format must be pdf or csv.' });
            const rep = await reports.build(pool, b.report, range);
            const made = [], problems = [];
            for (const f of formats) {
                let saved = null;
                try {
                    const buf = f === 'csv' ? Buffer.from(render.toCsv(rep), 'utf8') : await makePdf(rep);
                    saved = store.save(root, buf, f);
                    const r = await pool.query(
                        `INSERT INTO documents (type, title, period, path, sha256, created_by, format, bytes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
                        [b.report, `${rep.title} ${rep.period}`.slice(0, 200), rep.period.slice(0, 40), saved.rel, saved.sha256, userName(req), f, saved.bytes]);
                    made.push(presentDoc(r.rows[0]));
                } catch (e) {
                    if (saved) store.remove(root, saved.rel);
                    console.error('[documents] could not make the', f, e && e.message);
                    problems.push(`The ${f.toUpperCase()} could not be made.`);
                }
            }
            if (!made.length) return res.status(500).json({ error: problems.join(' ') || 'Could not make the document.' });
            res.status(201).json({ documents: made, problems });
        } catch (e) { fail(res, e, 'Could not make the document.'); }
    });

    // ───────── saved documents ─────────
    router.get('/documents', async (req, res) => {
        try {
            const t = req.query.type ? String(req.query.type) : null;
            const r = t ? await pool.query(`SELECT * FROM documents WHERE type = $1 ORDER BY id DESC LIMIT 300`, [t]) : await pool.query(`SELECT * FROM documents ORDER BY id DESC LIMIT 300`);
            res.json(r.rows.map(presentDoc));
        } catch (e) { fail(res, e, 'Could not load the documents.'); }
    });

    // ───────── recipients (allow-list) ─────────
    const keys = () => Object.keys(reports.REPORTS);
    router.get('/documents/recipients', async (req, res) => {
        try { res.json((await pool.query(`SELECT * FROM document_recipients ORDER BY id`)).rows.map(sender.presentRecipient)); }
        catch (e) { fail(res, e, 'Could not load the recipients.'); }
    });
    router.post('/documents/recipients', async (req, res) => {
        try {
            const c = sender.cleanRecipient(req.body, keys());
            const r = await pool.query(`INSERT INTO document_recipients (name, role, phone, allowed_types) VALUES ($1,$2,$3,$4) RETURNING *`, [c.name, c.role, c.phone, c.allowed_types]);
            res.status(201).json(sender.presentRecipient(r.rows[0]));
        } catch (e) { fail(res, e, 'Could not add the recipient.'); }
    });
    router.put('/documents/recipients/:id', async (req, res) => {
        try {
            const id = idOf(req.params.id);
            const cur = id ? (await pool.query(`SELECT * FROM document_recipients WHERE id = $1`, [id])).rows[0] : null;
            if (!cur) return res.status(404).json({ error: 'Not found' });
            const b = { name: cur.name, role: cur.role, phone: cur.phone, allowed_types: sender.parseTypes(cur.allowed_types), ...(req.body || {}) };
            const c = sender.cleanRecipient(b, keys());
            const active = req.body && req.body.active !== undefined ? !!req.body.active : !!cur.active;
            const r = await pool.query(`UPDATE document_recipients SET name=$1, role=$2, phone=$3, allowed_types=$4, active=$5 WHERE id=$6 RETURNING *`, [c.name, c.role, c.phone, c.allowed_types, active, id]);
            res.json(sender.presentRecipient(r.rows[0]));
        } catch (e) { fail(res, e, 'Could not change the recipient.'); }
    });
    router.delete('/documents/recipients/:id', async (req, res) => {
        try {
            const id = idOf(req.params.id);
            const r = id ? await pool.query(`DELETE FROM document_recipients WHERE id = $1 RETURNING id`, [id]) : { rows: [] };
            if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
            res.json({ ok: true });
        } catch (e) { fail(res, e, 'Could not remove the recipient.'); }
    });

    router.get('/documents/sends', async (req, res) => {
        try {
            const r = await pool.query(`SELECT id, document_id, document_title, recipient_id, purpose, status, to_last3, detail, requested_by, created_at FROM document_sends ORDER BY id DESC LIMIT 200`);
            res.json(r.rows.map(x => ({ ...x, to: x.to_last3 ? '***' + x.to_last3 : null, to_last3: undefined })));
        } catch (e) { fail(res, e, 'Could not load the send log.'); }
    });

    // ───────── inbound files (quarantine) ─────────
    const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: Q.MAX_BYTES, files: 1 } });
    router.post('/documents/inbox/upload', (req, res, next) => upload.single('file')(req, res, err => {
        if (!err) return next();
        res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'The file is too large (the limit is 10 MB).' : 'The upload did not work.' });
    }), async (req, res) => {
        try {
            if (!req.file) return res.status(400).json({ error: 'Choose a file to upload.' });
            const row = await Q.intake(pool, { buffer: req.file.buffer, originalName: req.file.originalname, source: 'owner_upload', fromRef: userName(req) || '', caption: req.body && req.body.caption, root: inboxRoot, detect: opts.detectType });
            res.status(row.duplicate ? 200 : 201).json(Q.present(row));
        } catch (e) { fail(res, e, 'Could not accept the file.'); }
    });
    router.get('/documents/inbox', async (req, res) => {
        try {
            const st = String(req.query.status || 'quarantined');
            if (!['quarantined', 'confirmed', 'rejected', 'all'].includes(st)) return res.status(400).json({ error: 'status must be quarantined, confirmed, rejected or all' });
            const r = await pool.query(`SELECT * FROM document_quarantine WHERE ($1 = 'all' OR status = $1) ORDER BY id DESC LIMIT 200`, [st]);
            res.json({ places: Object.entries(Q.PLACES).map(([key, v]) => ({ key, label: v.label })), items: r.rows.map(Q.present) });
        } catch (e) { fail(res, e, 'Could not load the inbox.'); }
    });
    router.get('/documents/inbox/:id/file', async (req, res) => {
        try {
            const id = idOf(req.params.id);
            const row = id ? (await pool.query(`SELECT * FROM document_quarantine WHERE id = $1 AND status = 'quarantined'`, [id])).rows[0] : null;
            const abs = row && Q.filePathOf(inboxRoot, row);
            if (!abs || !fs.existsSync(abs)) return res.status(404).json({ error: 'Not found' });
            res.set({ 'Content-Type': row.mime, 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "sandbox; default-src 'none'", 'Cache-Control': 'no-store',
                'Content-Disposition': `${req.query.view && row.mime.startsWith('image/') ? 'inline' : 'attachment'}; filename="quarantine-${row.id}.${row.ext}"` });
            fs.createReadStream(abs).pipe(res);
        } catch (e) { fail(res, e, 'Could not open the file.'); }
    });
    router.post('/documents/inbox/:id/confirm', async (req, res) => {
        const id = idOf(req.params.id);
        let claimed = null;
        try {
            const place = String((req.body && req.body.place) || '') || null;
            if (place && !Q.PLACES[place]) return res.status(400).json({ error: 'Unknown place. Choose GRN, expense sheet, supplier bill or cheque photo.' });
            const cur = id ? (await pool.query(`SELECT * FROM document_quarantine WHERE id = $1`, [id])).rows[0] : null;
            if (!cur) return res.status(404).json({ error: 'Not found' });
            const chosen = place || cur.suggested_place;
            if (!chosen) return res.status(400).json({ error: 'Choose where this file belongs first.' });
            const c = await pool.query(`UPDATE document_quarantine SET status = 'confirming' WHERE id = $1 AND status = 'quarantined' RETURNING *`, [id]);   // claim: two taps cannot file it twice
            if (!c.rows[0]) return res.status(409).json({ error: `This file is already ${cur.status}.` });
            claimed = c.rows[0];
            const abs = Q.filePathOf(inboxRoot, claimed);
            if (!abs || !fs.existsSync(abs)) throw Object.assign(new Error('The quarantined file is missing.'), { status: 404 });
            const inboxId = await handoff({ row: claimed, abs, place: chosen, user: userName(req) });
            await pool.query(`UPDATE document_quarantine SET status = 'confirmed', inbox_id = $2, decided_at = NOW(), decided_by = $3, suggested_place = $4 WHERE id = $1`, [id, inboxId, userName(req), chosen]);
            fs.unlink(abs, () => {});
            res.json({ ok: true, inbox_id: inboxId, message: 'Sent to the Document Inbox. Check the details there, then file it.' });
        } catch (e) {
            if (claimed) await pool.query(`UPDATE document_quarantine SET status = 'quarantined' WHERE id = $1 AND status = 'confirming'`, [id]).catch(() => {});
            fail(res, e, 'Could not hand the file over. Nothing was filed.');
        }
    });
    router.post('/documents/inbox/:id/reject', async (req, res) => {
        try {
            const id = idOf(req.params.id);
            const r = id ? await pool.query(`UPDATE document_quarantine SET status = 'rejected', decided_at = NOW(), decided_by = $2 WHERE id = $1 AND status = 'quarantined' RETURNING *`, [id, userName(req)]) : { rows: [] };
            if (!r.rows[0]) return res.status(404).json({ error: 'Not found, or already decided.' });
            const abs = Q.filePathOf(inboxRoot, r.rows[0]);
            if (abs) fs.unlink(abs, () => {});
            res.json({ ok: true });
        } catch (e) { fail(res, e, 'Could not reject the file.'); }
    });

    // ───────── one document (keep these LAST: :id would otherwise swallow the words above) ─────────
    const loadDoc = async idRaw => { const id = idOf(idRaw); return id ? (await pool.query(`SELECT * FROM documents WHERE id = $1`, [id])).rows[0] : null; };

    router.get('/documents/:id/download', async (req, res) => {
        try {
            const doc = await loadDoc(req.params.id);
            const abs = doc && store.resolveStored(root, doc.path);
            if (!abs || !fs.existsSync(abs)) return res.status(404).json({ error: 'Not found' });
            const buf = fs.readFileSync(abs);
            if (crypto.createHash('sha256').update(buf).digest('hex') !== doc.sha256) return res.status(409).json({ error: 'The saved file no longer matches its record, so it was not sent. Make the document again.' });
            const safe = doc.title.replace(/[^\w .-]+/g, '_').slice(0, 80) || 'document';
            res.set({ 'Content-Type': store.EXT[doc.format] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store',
                'Content-Disposition': `${req.query.view && doc.format === 'pdf' ? 'inline' : 'attachment'}; filename="${safe}.${doc.format}"` });
            res.send(buf);
        } catch (e) { fail(res, e, 'Could not download the document.'); }
    });

    router.delete('/documents/:id', async (req, res) => {
        try {
            const doc = await loadDoc(req.params.id);
            if (!doc) return res.status(404).json({ error: 'Not found' });
            await pool.query(`DELETE FROM documents WHERE id = $1`, [doc.id]);
            store.remove(root, doc.path);
            console.log(`[documents] deleted document ${doc.id} by ${userName(req) || '-'}`);
            res.json({ ok: true });
        } catch (e) { fail(res, e, 'Could not delete the document.'); }
    });

    router.post('/documents/:id/send', async (req, res) => {
        try {
            const doc = await loadDoc(req.params.id);
            if (!doc) return res.status(404).json({ error: 'Not found' });
            const b = req.body || {};
            const out = await sender.sendDocument(pool, { doc, recipientId: b.recipient_id, purpose: b.purpose, by: userName(req), root, transport: getTransport(), env: opts.env });
            res.status(out.status).json(out.body);
        } catch (e) { fail(res, e, 'Could not send the document.'); }
    });

    return router;
}

module.exports = createRouter(require('../utils/pool'));
module.exports.createRouter = createRouter;
