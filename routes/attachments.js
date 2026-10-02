// routes/attachments.js
// ATTACHMENTS (isolated module): photo / file attached to any record, listed per record, downloaded back byte-for-byte.
//   POST /api/attachments                      multipart: file, record_type, record_id [, client_uuid]   (admin only)
//   GET  /api/attachments?record_type=&record_id=                                                          list
//   GET  /api/attachments/:id/download                                                                     one file
//   GET  /api/attachments/zip?record_type=&record_id=                                                      all of one record as .zip
// Login is required (server.js gate). New table only (attachments); nothing existing is altered. Files live in uploads/attachments.
// client_uuid is the idempotency key for the offline queue: the same key sent twice returns the first result, never a duplicate.
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');
const { fromBuffer: fileTypeFromBuffer } = require('file-type');
let archiver = null;
try { archiver = require('archiver'); } catch (e) { archiver = null; }     // zip is optional: the route says so if it is missing

const router = express.Router();
const pool = new Pool({
    host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
});

const DIR = path.join(__dirname, '..', 'uploads', 'attachments');
if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

const MAX_BYTES = 10 * 1024 * 1024;
const RECORD_TYPES = new Set(['daily_sales', 'stock', 'grn', 'expense', 'cheque', 'vendor', 'pos_bill', 'money_control', 'loan', 'salary', 'document_inbox', 'general']);
const BINARY_OK = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', pdf: 'application/pdf',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };

pool.query(`
    CREATE TABLE IF NOT EXISTS attachments (
        id          SERIAL PRIMARY KEY,
        record_type VARCHAR(40)  NOT NULL,
        record_id   VARCHAR(100) NOT NULL,
        filename    VARCHAR(255) NOT NULL,
        mime        VARCHAR(100) NOT NULL,
        size        INTEGER      NOT NULL,
        uploaded_by VARCHAR(100),
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        stored_name VARCHAR(80)  NOT NULL,
        client_uuid VARCHAR(64)
    )`)
  .then(() => pool.query(`CREATE INDEX IF NOT EXISTS attachments_record_idx ON attachments (record_type, record_id)`))
  .then(() => pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS attachments_client_uuid_idx ON attachments (client_uuid) WHERE client_uuid IS NOT NULL`))
  .catch(e => console.error('[attachments] migration failed:', e.message));

const roleOf = req => (req.session && req.session.user && req.session.user.role) || 'staff';
const whoOf = req => (req.session && req.session.user && (req.session.user.username || req.session.user.name)) || 'unknown';
const adminOnly = (req, res, next) => roleOf(req) === 'admin' ? next() : res.status(403).json({ error: 'Only the admin can attach files.' });

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: 1 } });
const uploadOne = (req, res, next) => upload.single('file')(req, res, err => {
    if (!err) return next();
    res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'The file is bigger than 10 MB.' : err.message });
});

const cleanName = n => String(n || 'file').replace(/[\r\n\\/]/g, '_').replace(/[^\w.\- ()\u0D80-\u0DFF\u0B80-\u0BFF]/g, '_').slice(0, 200) || 'file';
const isRecordId = v => /^[\w.:\- ]{1,100}$/.test(String(v || ''));
const looksLikeCsv = buf => { const s = buf.slice(0, 4096); return s.length > 0 && !s.includes(0) && /^[\x09\x0A\x0D\x20-\x7E\u00A0-\uFFFF]*$/.test(s.toString('utf8')); };

const shape = r => ({ id: r.id, record_type: r.record_type, record_id: r.record_id, filename: r.filename, mime: r.mime, size: r.size,
    uploaded_by: r.uploaded_by, created_at: r.created_at, download_url: `/api/attachments/${r.id}/download` });

router.post('/attachments', adminOnly, uploadOne, async (req, res) => {
    try {
        const { record_type, record_id } = req.body || {};
        const client_uuid = req.body && req.body.client_uuid ? String(req.body.client_uuid).slice(0, 64) : null;
        if (client_uuid) {                                                            // already received: return the first result
            const seen = await pool.query(`SELECT * FROM attachments WHERE client_uuid = $1`, [client_uuid]);
            if (seen.rows.length) return res.json({ ...shape(seen.rows[0]), duplicate: true });
        }
        if (!RECORD_TYPES.has(record_type)) return res.status(400).json({ error: 'record_type is not recognised.' });
        if (!isRecordId(record_id)) return res.status(400).json({ error: 'record_id is missing or has odd characters.' });
        if (!req.file || !req.file.buffer || !req.file.buffer.length) return res.status(400).json({ error: 'Choose a file first.' });

        // type is decided by the file's own bytes, never by its name
        const buf = req.file.buffer, ft = await fileTypeFromBuffer(buf);
        let ext, mime;
        if (ft && BINARY_OK[ft.ext]) { ext = ft.ext; mime = BINARY_OK[ft.ext]; }
        else if (!ft && /\.csv$/i.test(req.file.originalname) && looksLikeCsv(buf)) { ext = 'csv'; mime = 'text/csv'; }
        else return res.status(400).json({ error: 'Only photos (jpg, png, webp, heic), PDF, Excel (xlsx) and CSV files are allowed.' });

        const stored = crypto.randomUUID() + '.' + ext;
        fs.writeFileSync(path.join(DIR, stored), buf);
        const base = cleanName(req.file.originalname).replace(/\.[^.]*$/, '') || 'file';
        try {
            const r = await pool.query(
                `INSERT INTO attachments (record_type, record_id, filename, mime, size, uploaded_by, stored_name, client_uuid) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
                [record_type, String(record_id), `${base}.${ext}`, mime, buf.length, whoOf(req), stored, client_uuid]);
            res.status(201).json(shape(r.rows[0]));
        } catch (e) {
            fs.unlink(path.join(DIR, stored), () => {});
            if (e.code === '23505' && client_uuid) {                                  // lost a race with the same key
                const seen = await pool.query(`SELECT * FROM attachments WHERE client_uuid = $1`, [client_uuid]);
                return res.json({ ...shape(seen.rows[0]), duplicate: true });
            }
            throw e;
        }
    } catch (e) { res.status(500).json({ error: `Could not save the file: ${e.message}` }); }
});

router.get('/attachments', async (req, res) => {
    try {
        const { record_type, record_id } = req.query;
        if (!RECORD_TYPES.has(record_type) || !isRecordId(record_id)) return res.status(400).json({ error: 'record_type and record_id are required.' });
        const r = await pool.query(`SELECT * FROM attachments WHERE record_type = $1 AND record_id = $2 ORDER BY id DESC`, [record_type, String(record_id)]);
        res.json(r.rows.map(shape));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// must stay above /attachments/:id/download
router.get('/attachments/zip', async (req, res) => {
    try {
        if (!archiver) return res.status(501).json({ error: 'Zip download is not available on this server.' });
        const { record_type, record_id } = req.query;
        if (!RECORD_TYPES.has(record_type) || !isRecordId(record_id)) return res.status(400).json({ error: 'record_type and record_id are required.' });
        const r = await pool.query(`SELECT * FROM attachments WHERE record_type = $1 AND record_id = $2 ORDER BY id`, [record_type, String(record_id)]);
        if (!r.rows.length) return res.status(404).json({ error: 'No files attached here yet.' });
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${cleanName(record_type + '-' + record_id)}.zip"`);
        const zip = archiver('zip', { zlib: { level: 6 } });
        zip.on('error', () => res.destroy());
        zip.pipe(res);
        const used = new Set();
        for (const row of r.rows) {
            const p = path.join(DIR, row.stored_name);
            if (!fs.existsSync(p)) continue;
            let name = row.filename, n = 1;
            while (used.has(name)) name = row.filename.replace(/(\.[^.]*)?$/, `-${++n}$1`);
            used.add(name);
            zip.file(p, { name });
        }
        zip.finalize();
    } catch (e) { if (!res.headersSent) res.status(500).json({ error: e.message }); }
});

router.get('/attachments/:id/download', async (req, res) => {
    try {
        if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ error: 'not found' });
        const r = await pool.query(`SELECT filename, mime, stored_name FROM attachments WHERE id = $1`, [req.params.id]);
        if (!r.rows.length) return res.status(404).json({ error: 'not found' });
        const p = path.join(DIR, r.rows[0].stored_name);
        if (!fs.existsSync(p)) return res.status(404).json({ error: 'The file is missing on disk.' });
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.type(r.rows[0].mime);
        res.download(r.rows[0].stored_name, r.rows[0].filename, { root: DIR });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;