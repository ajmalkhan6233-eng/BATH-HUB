'use strict';
// Item codes in vendor arrival order, from a button in the GRN workbench (Vendors & summary). Admin only.
// GET  /api/item-renumber/plan   -> what WOULD change (changes nothing)
// POST /api/item-renumber/apply  -> does it (one transaction; a copy of products is kept first)
// POST /api/item-renumber/undo   -> puts the previous codes back
const express = require('express');
const pool = require('../utils/pool');
const R = require('../scripts/renumber_item_codes');
const router = express.Router();
const admin = (req, res, next) => (req.session && req.session.user && ['admin','owner'].includes(req.session.user.role)) ? next() : res.status(403).json({ error: 'Only the owner (admin) can do this.' });
router.use('/item-renumber', admin);

router.get('/item-renumber/plan', async (req, res) => {
    try {
        const p = await R.plan(pool), per = {};
        p.map.forEach(m => { per[m.vendor] = (per[m.vendor] || 0) + 1; });
        res.json({ total: p.map.length, metro_kept: p.metroCount, will_change: p.map.filter(m => m.changed).length, skipped: p.skipped.length, next_free: p.nextFree, per_vendor: per,
            rows: p.map.map(m => ({ vendor: m.vendor, old: m.old, new: m.new, name: m.name, changed: m.changed })) });
    } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/item-renumber/apply', async (req, res) => {
    const c = await pool.connect();
    try {
        const p = await R.plan(c);
        const n = p.map.filter(m => m.changed).length;
        if (!n) return res.json({ ok: true, changed: 0, message: 'Already in order. Nothing to change.' });
        await c.query(`CREATE TABLE IF NOT EXISTS products_bak_renumber AS SELECT * FROM products WHERE FALSE`);
        await c.query(`DELETE FROM products_bak_renumber; INSERT INTO products_bak_renumber SELECT * FROM products`);
        const r = await R.apply(c, p.map);
        res.json({ ok: true, changed: r.changed, message: r.changed + ' item codes put in vendor order. Press Undo if you want the old codes back.' });
    } catch (e) { res.status(500).json({ error: 'Nothing was changed: ' + e.message }); } finally { c.release(); }
});
router.post('/item-renumber/undo', async (req, res) => {
    const c = await pool.connect();
    try { const r = await R.undo(c); try { await require('./item_codes_fix').restamp(c); } catch (e) { /* codes are back; text re-stamp is a nicety */ } res.json({ ok: true, changed: r.changed, message: r.changed ? 'Old codes are back (' + r.changed + ').' : 'Nothing to undo.' }); }
    catch (e) { res.status(500).json({ error: 'Nothing was changed: ' + e.message }); } finally { c.release(); }
});
module.exports = router;
