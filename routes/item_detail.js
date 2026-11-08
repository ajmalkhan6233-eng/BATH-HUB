// Item pop-up window (search box > double click): cost, price, margin, name, category, photo. Owner only.
// Uses columns that already exist (products.name, avg_cost, selling_price, category, photo_url). Nothing new in the database.
const express = require('express');
const pool = require('../utils/pool');
const { savePhoto, schemaReady } = require('./item_catalog');
const router = express.Router();
const roleOf = req => (req.session && req.session.user && req.session.user.role) || 'staff';
const ownerOnly = (req, res, next) => (['admin', 'owner'].includes(roleOf(req)) ? next() : res.status(403).json({ error: 'Owner only' }));
// BLOCK: stock edits are logged with a reason and time (additive table, never changes old tables)
const STOCK_REASONS = ['count fix', 'damage', 'loss', 'found', 'other'];
const editsReady = pool.query(`CREATE TABLE IF NOT EXISTS product_stock_edits (id SERIAL PRIMARY KEY, item_code VARCHAR(40) NOT NULL, old_qty NUMERIC(14,3), new_qty NUMERIC(14,3), reason VARCHAR(20), edited_by VARCHAR(60), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`).catch(e => console.error('[item_detail] stock edit log table failed:', e.message));
const COLS = 'item_code, name, category, stock_level, avg_cost, selling_price, photo_url, vendor_code';
const shape = r => {
    const cost = Number(r.avg_cost) || 0, sell = Number(r.selling_price) || 0;
    return { ...r, avg_cost: cost, selling_price: sell, margin: sell > 0 ? Math.round((sell - cost) * 100) / 100 : null,
             margin_pct: sell > 0 ? Math.round(((sell - cost) / sell) * 1000) / 10 : null };
};
router.get('/item-detail/:code', ownerOnly, async (req, res) => {
    try {
        await schemaReady;
        const r = await pool.query(`SELECT ${COLS} FROM products WHERE item_code = $1`, [String(req.params.code)]);
        if (!r.rows.length) return res.status(404).json({ error: 'Item not found' });
        res.json(shape(r.rows[0]));
    } catch (e) { res.status(500).json({ error: 'Could not load the item: ' + e.message }); }
});
router.post('/item-detail/:code', ownerOnly, express.json({ limit: '8mb' }), async (req, res) => {
    try {
        await schemaReady;
        const b = req.body || {}, sets = [], vals = [];
        if (b.name !== undefined) { const n = String(b.name).trim().replace(/\s+/g, ' ').slice(0, 160); if (!n) return res.status(400).json({ error: 'Name cannot be empty' }); vals.push(n); sets.push(`name = $${vals.length}`); }
        if (b.category !== undefined) { vals.push(String(b.category).trim().slice(0, 40) || null); sets.push(`category = $${vals.length}`); }
        if (b.selling_price !== undefined && b.selling_price !== '') { const p = Number(b.selling_price); if (!Number.isFinite(p) || p <= 0 || p > 99999999) return res.status(400).json({ error: 'Price must be more than 0' }); vals.push(Math.round(p * 100) / 100); sets.push(`selling_price = $${vals.length}`); }
        if (b.photo_data_url) {
            const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(b.photo_data_url));
            if (!m) return res.status(400).json({ error: 'Photo must be JPG, PNG or WEBP' });
            const buf = Buffer.from(m[2], 'base64'); if (buf.length > 5 * 1024 * 1024) return res.status(400).json({ error: 'Photo too large (max 5 MB)' });
            vals.push(savePhoto(buf)); sets.push(`photo_url = $${vals.length}`);
        }
        if (b.vendor_code !== undefined) { vals.push(String(b.vendor_code).trim().slice(0, 60) || null); sets.push(`vendor_code = $${vals.length}`); }
        let newStock; const reason = STOCK_REASONS.includes(String(b.stock_reason || '').toLowerCase()) ? String(b.stock_reason).toLowerCase() : 'count fix';
        if (b.stock_level !== undefined && b.stock_level !== '' && b.stock_level !== null) {
            const q = Number(b.stock_level);
            if (!Number.isFinite(q) || Math.abs(q) > 1000000) return res.status(400).json({ error: 'Stock must be a number' });
            newStock = Math.round(q * 1000) / 1000; vals.push(newStock); sets.push(`stock_level = $${vals.length}`);
        }
        const oldCode = String(req.params.code);
        const newCode = b.new_code === undefined ? oldCode : String(b.new_code).trim();
        if (newCode !== oldCode && !/^[A-Za-z0-9-]{1,20}$/.test(newCode)) return res.status(400).json({ error: 'Item code: letters, numbers and - only (max 20)' });
        if (!sets.length && newCode === oldCode) return res.status(400).json({ error: 'Nothing to save' });
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const same = await client.query(`SELECT id, stock_level FROM products WHERE item_code = $1 FOR UPDATE`, [oldCode]);
            if (same.rows.length > 1 && newCode !== oldCode) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Two items share code ' + oldCode + '. Fix that first (tell Claude). Nothing was changed.' }); }
            if (newCode !== oldCode) {
                const dup = await client.query(`SELECT item_code, name FROM products WHERE UPPER(item_code) = UPPER($1) AND item_code <> $2`, [newCode, oldCode]);
                if (dup.rows.length) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Item code ' + newCode + ' is already used by ' + dup.rows[0].item_code + ' (' + dup.rows[0].name + '). Nothing was changed.' }); }
                vals.push(newCode); sets.push(`item_code = $${vals.length}`);
            }
            vals.push(oldCode);
            const r = await client.query(`UPDATE products SET ${sets.join(', ')} WHERE item_code = $${vals.length} RETURNING ${COLS}`, vals);
            if (!r.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Item not found' }); }
            if (newCode !== oldCode) {   // keep every record that points at this code in step (bills, quotations, price history, GRN lines)
                const t = await client.query(`SELECT table_name FROM information_schema.columns WHERE column_name='item_code' AND table_schema='public' AND table_name NOT IN ('products') AND table_name NOT LIKE 'audit\\_%'`);
                for (const row of t.rows) await client.query(`UPDATE "${row.table_name}" SET item_code = $1 WHERE item_code = $2`, [newCode, oldCode]);
                await client.query(`UPDATE grn_records SET item_description = $1 || substr(item_description, $2) WHERE item_description LIKE $3`, [newCode, oldCode.length + 1, oldCode + ' - %']);
            }
            if (newStock !== undefined) {
                const oldQ = Number(same.rows[0] && same.rows[0].stock_level) || 0;
                if (oldQ !== newStock) { await editsReady; await client.query(`INSERT INTO product_stock_edits (item_code, old_qty, new_qty, reason, edited_by) VALUES ($1,$2,$3,$4,$5)`, [newCode, oldQ, newStock, reason, roleOf(req)]); }
            }
            await client.query('COMMIT');
            res.json(shape(r.rows[0]));
        } catch (e) { try { await client.query('ROLLBACK'); } catch (x) { /* ignore */ } throw e; } finally { client.release(); }
    } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
module.exports = router;
