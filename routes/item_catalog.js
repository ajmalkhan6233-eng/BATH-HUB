// routes/item_catalog.js
// ITEM CATALOG for Royal Bath Hub Thihariya: add items with auto-generated sequential
// item codes (001, 002, 003...) and an optional photo.
//
// - Writes to the existing `products` table (item_code, name, category, stock_level,
//   reorder_threshold, active, selling_price, avg_cost). The only schema change is
//   ADD COLUMN IF NOT EXISTS photo_url — nothing is created, dropped or altered otherwise.
// - createItem() is exported (router.createItem) so the manual GRN module can reuse the
//   same code generator: one numbering source, no duplicate item codes.
// - Photos are stored under uploads/item_photos and served at /api/item-photos/<file>.

require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { Pool } = require('pg');

const router = express.Router();

const pool = require('../utils/pool');

const PHOTO_DIR = path.join(__dirname, '..', 'uploads', 'item_photos');
fs.mkdirSync(PHOTO_DIR, { recursive: true });

pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS photo_url TEXT`)
    .catch(e => console.error('[item_catalog] photo_url migration failed:', e.message));

// ─── Photo handling ──────────────────────────────────────────────────────────
const photoUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

// Detect the real image type from the first bytes (don't trust the filename/mimetype).
function sniffImageExt(buf) {
    if (buf.length > 12 && buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'jpg';
    if (buf.length > 8 && buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) return 'png';
    if (buf.length > 12 && buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return 'webp';
    return null;
}

// Saves a photo buffer, returns its public URL. Throws an Error with .status=400 on bad input.
function savePhoto(buf) {
    const ext = sniffImageExt(buf);
    if (!ext) {
        const err = new Error('Photo must be a JPG, PNG or WEBP image');
        err.status = 400;
        throw err;
    }
    const name = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
    fs.writeFileSync(path.join(PHOTO_DIR, name), buf);
    return `/api/item-photos/${name}`;
}

router.use('/item-photos', express.static(PHOTO_DIR, { index: false, dotfiles: 'deny' }));

// ─── Item code generation ────────────────────────────────────────────────────
// Next code = highest all-digit item_code + 1, zero-padded to 3 digits. Non-numeric
// legacy codes are ignored. Callers must hold the advisory lock (see createItem) so
// two simultaneous saves can't get the same number.
const CODE_LOCK_ID = 774411;

async function nextItemCode(db) {
    const r = await db.query(`SELECT COALESCE(MAX(item_code::int), 0) + 1 AS n FROM products WHERE item_code ~ '^[0-9]{1,9}$'`);
    return String(r.rows[0].n).padStart(3, '0');
}

// Creates a product with the next sequential code. `opts.client` lets a caller (GRN)
// run this inside its own transaction; otherwise a transaction is opened here.
// Comparison key for item names: lower case; letters, digits and combining marks only (so Sinhala/Tamil vowel signs count).
const sameNameKey = n => String(n || '').toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, '');

async function createItem(fields, opts = {}) {
    const name = String(fields.name || '').trim();
    if (!name) { const e = new Error('Item name is required'); e.status = 400; throw e; }
    const num = (v, label) => {
        if (v === undefined || v === null || v === '') return 0;
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0) { const e = new Error(`${label} must be a number, 0 or more`); e.status = 400; throw e; }
        return n;
    };
    const vals = {
        category: String(fields.category || '').trim() || null,
        stock_level: num(fields.stock_level, 'Opening stock'),
        reorder_threshold: num(fields.reorder_threshold, 'Reorder level'),
        selling_price: num(fields.selling_price, 'Selling price'),
        avg_cost: num(fields.avg_cost, 'Cost'),
    };

    const own = !opts.client;
    const db = opts.client || await pool.connect();
    try {
        if (own) await db.query('BEGIN');
        await db.query('SELECT pg_advisory_xact_lock($1)', [CODE_LOCK_ID]);
        // Same name ignoring case, spaces, dashes and punctuation ("Floor Tile 60x60" = "floor-tile 60 x 60").
        const existing = await db.query(`SELECT item_code, name FROM products WHERE active = true`);
        const want = sameNameKey(name);
        const dup = existing.rows.find(x => sameNameKey(x.name) === want);
        if (dup && !fields.allowDuplicate) {
            const e = new Error(`An item named "${dup.name}" already exists (code ${dup.item_code})`);
            e.status = 409;
            throw e;
        }
        const item_code = await nextItemCode(db);
        const r = await db.query(
            `INSERT INTO products (item_code, name, category, stock_level, reorder_threshold, selling_price, avg_cost, photo_url, active)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true) RETURNING *`,
            [item_code, name, vals.category, vals.stock_level, vals.reorder_threshold,
             vals.selling_price, vals.avg_cost, fields.photo_url || null]);
        if (own) await db.query('COMMIT');
        return r.rows[0];
    } catch (e) {
        if (own) await db.query('ROLLBACK').catch(() => {});
        throw e;
    } finally {
        if (own) db.release();
    }
}

// ─── Routes ──────────────────────────────────────────────────────────────────
router.get('/items/next-code', async (req, res) => {
    try { res.json({ next_code: await nextItemCode(pool) }); }
    catch (e) { res.status(500).json({ error: `Could not work out the next item code: ${e.message}` }); }
});

// ─── Item lookup (search box / barcode / stock check) ───────────────────────
// Selling price and stock only: the cost price is deliberately not returned here.
const ITEM_COLS = `item_code, name, category, stock_level, reorder_threshold, selling_price, photo_url,
                   (stock_level <= reorder_threshold) AS low_stock`;

// GET /items?q=floor&category=Tiles&low=1&limit=50  -> active items, name or code contains q
router.get('/items', async (req, res) => {
    try {
        const q = String(req.query.q || '').trim().toLowerCase().replace(/[\\%_]/g, m => '\\' + m);
        const category = String(req.query.category || '').trim();
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
        const r = await pool.query(
            `SELECT ${ITEM_COLS} FROM products
             WHERE active = true
               AND ($1 = '' OR LOWER(name) LIKE '%' || $1 || '%' OR item_code LIKE '%' || $1 || '%')
               AND ($2 = '' OR category = $2)
               AND ($3::boolean = false OR stock_level <= reorder_threshold)
             ORDER BY item_code
             LIMIT ${limit}`,
            [q, category, req.query.low === '1' || req.query.low === 'true']);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: `Could not search items: ${e.message}` }); }
});

// GET /items/reorder -> items at or below their reorder level, most urgent first, with a suggested order
// quantity that tops the item back up to twice its reorder level (at least 1).
router.get('/items/reorder', async (req, res) => {
    try {
        const r = await pool.query(
            `SELECT item_code, name, category, stock_level, reorder_threshold FROM products
             WHERE active = true AND stock_level <= reorder_threshold ORDER BY item_code`);
        const items = r.rows.map(x => {
            const stock = Number(x.stock_level), level = Number(x.reorder_threshold);
            return { item_code: x.item_code, name: x.name, category: x.category, stock_level: stock, reorder_threshold: level,
                     suggested_order_qty: Math.max(1, Math.ceil(level * 2 - stock)) };
        }).sort((a, b) => (a.stock_level - a.reorder_threshold) - (b.stock_level - b.reorder_threshold) || a.item_code.localeCompare(b.item_code));
        res.json(items);
    } catch (e) { res.status(500).json({ error: `Could not build the reorder list: ${e.message}` }); }
});

// GET /items/export.csv -> a stock-take sheet: code, name, category, system stock, and a blank "counted" column.
router.get('/items/export.csv', async (req, res) => {
    try {
        const { csvRow } = require('../utils/csv');
        const r = await pool.query(`SELECT item_code, name, category, stock_level FROM products WHERE active = true ORDER BY item_code`);
        const lines = [csvRow(['Code', 'Name', 'Category', 'System stock', 'Counted'])];
        for (const x of r.rows) lines.push(csvRow([[x.item_code, true], [x.name, true], [x.category, true], x.stock_level, '']));
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="stock-take.csv"');
        res.send(lines.join('\r\n') + '\r\n');
    } catch (e) { res.status(500).json({ error: `Could not build the stock-take sheet: ${e.message}` }); }
});

router.get('/items/:code', async (req, res) => {
    try {
        const r = await pool.query(`SELECT ${ITEM_COLS} FROM products WHERE active = true AND item_code = $1`, [String(req.params.code)]);
        if (!r.rows.length) return res.status(404).json({ error: 'Item not found' });
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: `Could not load the item: ${e.message}` }); }
});

function photoMiddleware(req, res, next) {
    photoUpload.single('photo')(req, res, err => {
        if (!err) return next();
        const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Photo is too large (max 5 MB)' : `Photo upload problem: ${err.message}`;
        res.status(400).json({ error: msg });
    });
}

router.post('/items', photoMiddleware, async (req, res) => {
    let photo_url = null;
    try {
        // Validate the fields first so a bad form doesn't leave an orphan photo on disk.
        const b = req.body || {};
        if (!String(b.name || '').trim()) return res.status(400).json({ error: 'Item name is required' });
        if (req.file) photo_url = savePhoto(req.file.buffer);
        // allowDuplicate is an internal switch for server-side callers; a web request must not be able to set it
        // (it would bypass the duplicate-name check and later make GRN stock land on the wrong twin).
        const { allowDuplicate, photo_url: _ignored, ...fields } = b;
        const item = await createItem({ ...fields, photo_url });
        res.status(201).json(item);
    } catch (e) {
        if (photo_url) fs.unlink(path.join(PHOTO_DIR, path.basename(photo_url)), () => {});
        res.status(e.status || 500).json({ error: e.status ? e.message : `Could not save the item: ${e.message}` });
    }
});

module.exports = router;
module.exports.createItem = createItem;
module.exports.savePhoto = savePhoto;
module.exports.photoMiddleware = photoMiddleware;
