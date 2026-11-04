// Item pop-up window (search box > double click): cost, price, margin, name, category, photo. Owner only.
// Uses columns that already exist (products.name, avg_cost, selling_price, category, photo_url). Nothing new in the database.
const express = require('express');
const pool = require('../utils/pool');
const { savePhoto, schemaReady } = require('./item_catalog');
const router = express.Router();
const roleOf = req => (req.session && req.session.user && req.session.user.role) || 'staff';
const ownerOnly = (req, res, next) => (['admin', 'owner'].includes(roleOf(req)) ? next() : res.status(403).json({ error: 'Owner only' }));
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
        if (!sets.length) return res.status(400).json({ error: 'Nothing to save' });
        vals.push(String(req.params.code));
        const r = await pool.query(`UPDATE products SET ${sets.join(', ')} WHERE item_code = $${vals.length} RETURNING ${COLS}`, vals);
        if (!r.rows.length) return res.status(404).json({ error: 'Item not found' });
        res.json(shape(r.rows[0]));
    } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
module.exports = router;
