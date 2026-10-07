// routes/grn_manual.js
// MANUAL GRN entry for Royal Bath Hub Thihariya: type in a supplier delivery (supplier, date,
// several item rows, a photo per item) instead of waiting for the Excel-drop watcher.
//
// - Same tables as the watcher path: one grn_records row per item line, plus products.
//   The watcher path is untouched; both write PENDING_REVIEW rows.
// - A line whose name matches an existing active product RESTOCKS that product (no new
//   code, stock_level += qty). Any other line creates a product with the next sequential
//   item_code via item_catalog.createItem, so codes are never duplicated.
// - Everything runs in one transaction: if any line is invalid nothing is saved and any
//   photos written for the request are removed.

const { todayLK } = require('../utils/lkTime');
const { lineTotal, weightedAvgCost, round2 } = require('../utils/grn_math');
require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { Pool } = require('pg');
const catalog = require('./item_catalog');

const router = express.Router();

const pool = require('../utils/pool');

const PHOTO_DIR = path.join(__dirname, '..', 'uploads', 'item_photos');
const MAX_LINES = 50;
const GRN_NUMBER_LOCK_ID = 774412;

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: MAX_LINES },
});

function badRequest(msg) { const e = new Error(msg); e.status = 400; return e; }

function uploadMiddleware(req, res, next) {
    upload.any()(req, res, err => {
        if (!err) return next();
        const msg = err.code === 'LIMIT_FILE_SIZE' ? 'One of the photos is too large (max 5 MB each)'
            : err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT' ? `Too many photos (max ${MAX_LINES})`
            : `Photo upload problem: ${err.message}`;
        res.status(400).json({ error: msg });
    });
}

router.post('/grn-manual', uploadMiddleware, async (req, res) => {
    const savedPhotos = [];
    let client;
    try {
        let payload;
        try { payload = JSON.parse((req.body || {}).payload || ''); }
        catch (_) { throw badRequest('The GRN form data was not readable — reload the page and try again'); }

        const supplier_name = String(payload.supplier_name || '').trim();
        const grn_date = String(payload.grn_date || '').trim();
        if (!supplier_name) throw badRequest('Enter the supplier');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(grn_date) || isNaN(Date.parse(grn_date))) throw badRequest('Enter a valid GRN date');
        if (grn_date > todayLK()) throw badRequest('GRN date cannot be in the future');
        const lines = Array.isArray(payload.lines) ? payload.lines : [];
        if (!lines.length) throw badRequest('Add at least one item');
        if (lines.length > MAX_LINES) throw badRequest(`Too many item rows (max ${MAX_LINES})`);

        // Validate every line before touching the DB.
        const files = {};
        (req.files || []).forEach(f => { files[f.fieldname] = f; });
        const seenNames = new Set();
        const clean = lines.map((l, i) => {
            const n = i + 1;
            const name = String(l.name || '').trim();
            const qty = Number(l.qty);
            const cost = Number(l.unit_cost);
            if (!name) throw badRequest(`Row ${n}: enter the item name`);
            if (seenNames.has(name.toLowerCase())) throw badRequest(`"${name}" is listed twice — combine it into one row`);
            seenNames.add(name.toLowerCase());
            if (!Number.isFinite(qty) || qty <= 0) throw badRequest(`Row ${n} (${name}): quantity must be more than 0`);
            if (!Number.isFinite(cost) || cost < 0) throw badRequest(`Row ${n} (${name}): unit cost must be 0 or more`);
            if (l.selling_price !== undefined && l.selling_price !== null && l.selling_price !== '' && (!Number.isFinite(Number(l.selling_price)) || Number(l.selling_price) < 0)) throw badRequest(`Row ${n} (${name}): selling price must be 0 or more`);
            return { name, qty, cost, category: l.category, selling_price: l.selling_price, file: files[`photo_${i}`] };
        });

        client = await pool.connect();
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock($1)', [GRN_NUMBER_LOCK_ID]);

        let supplier_id = null;
        const sid = Number(payload.supplier_id);
        if (Number.isInteger(sid) && sid > 0) supplier_id = sid;

        const c = await client.query(`SELECT COUNT(DISTINCT grn_number) AS n FROM grn_records WHERE grn_number LIKE $1`, [`MG-${grn_date.replace(/-/g, '')}-%`]);
        const grn_number = `MG-${grn_date.replace(/-/g, '')}-${String(Number(c.rows[0].n) + 1).padStart(2, '0')}`;

        const results = [];
        for (const l of clean) {
            const photo_url = l.file ? catalog.savePhoto(l.file.buffer) : null;
            if (photo_url) savedPhotos.push(photo_url);

            let item, isNew;
            const ex = await client.query(`SELECT * FROM products WHERE LOWER(name) = LOWER($1) AND active = true LIMIT 1 FOR UPDATE`, [l.name]);
            if (ex.rows.length) {
                isNew = false;
                const u = await client.query(
                    `UPDATE products SET stock_level = COALESCE(stock_level,0) + $1,
                            avg_cost = $4,
                            photo_url = COALESCE(photo_url, $2) WHERE id = $3 RETURNING *`,
                    [l.qty, photo_url, ex.rows[0].id, weightedAvgCost(ex.rows[0].stock_level, ex.rows[0].avg_cost, l.qty, l.cost)]);
                item = u.rows[0];
            } else {
                isNew = true;
                item = await catalog.createItem({
                    name: l.name, category: l.category, selling_price: l.selling_price,
                    avg_cost: l.cost, stock_level: l.qty, photo_url,
                }, { client });
            }
            await client.query(
                `INSERT INTO grn_records (grn_number, supplier_id, supplier_name, grn_date, item_description,
                                          quantity, unit_cost, total_amount, source_file_path, status, notes)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'PENDING_REVIEW',$10)`,
                [grn_number, supplier_id, supplier_name, grn_date, `${item.item_code} - ${item.name}`,
                 l.qty, l.cost, lineTotal(l.qty, l.cost), item.photo_url || null,
                 String(payload.notes || '').trim() || 'Manual GRN entry']);
            results.push({ item_code: item.item_code, name: item.name, qty: l.qty, unit_cost: l.cost, is_new: isNew });
        }
        await client.query('COMMIT');
        res.status(201).json({ grn_number, supplier_name, grn_date, total: round2(results.reduce((s, r) => s + lineTotal(r.qty, r.unit_cost), 0)), items: results });
    } catch (e) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        savedPhotos.forEach(u => fs.unlink(path.join(PHOTO_DIR, path.basename(u)), () => {}));
        res.status(e.status || 500).json({ error: e.status ? e.message : `Could not save the GRN (nothing was saved): ${e.message}` });
    } finally {
        if (client) client.release();
    }
});

module.exports = router;
