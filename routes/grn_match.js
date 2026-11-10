'use strict';
// GRN smart match: POST /api/grn-match (which shop item is each bill line?) and POST /api/grn-match/remember (learn a vendor's wording).
// Reads products (read-only). Writes only its own table grn_match_memory. Saves no stock and no bill: the GRN screen still does that.
const express = require('express');
const pool = require('../utils/pool');
const M = require('../utils/grnMatch');
const router = express.Router();
router.use('/grn-match', express.json({ limit: '200kb' }));
let ready = null;
const ensure = () => { if (!ready) ready = pool.query(`CREATE TABLE IF NOT EXISTS grn_match_memory (vendor_key TEXT NOT NULL, text_key TEXT NOT NULL, item_code TEXT NOT NULL, updated_at TIMESTAMP NOT NULL DEFAULT NOW(), PRIMARY KEY (vendor_key, text_key))`).catch(e => { ready = null; throw e; }); return ready; };
const vkey = v => M.norm(v).slice(0, 120);

router.post('/grn-match', async (req, res) => {
  try {
    const lines = Array.isArray(req.body && req.body.lines) ? req.body.lines.slice(0, 200) : null;
    if (!lines) return res.status(400).json({ error: 'lines needed' });
    const products = (await pool.query(`SELECT item_code, name FROM products WHERE active = true AND item_code IS NOT NULL LIMIT 5000`)).rows;
    let memory = new Map();
    try { await ensure(); const vk = vkey(req.body.vendor); if (vk) (await pool.query('SELECT text_key, item_code FROM grn_match_memory WHERE vendor_key = $1', [vk])).rows.forEach(r => memory.set(r.text_key, r.item_code)); } catch (e) { memory = new Map(); }
    const results = lines.map(l => M.matchLine({ name: String((l && l.name) || '').slice(0, 200), code: String((l && l.code) || '').slice(0, 50) }, products, memory));
    res.json({ results, green: results.filter(r => r.status === 'green').length, amber: results.filter(r => r.status === 'amber').length, fresh: results.filter(r => r.status === 'new').length });
  } catch (e) { console.error('[grn_match]', e.message); res.status(500).json({ error: 'Could not match the items' }); }
});

router.post('/grn-match/remember', async (req, res) => {
  try {
    const b = req.body || {}, vk = vkey(b.vendor), tk = M.norm(b.text).slice(0, 200), code = String(b.item_code || '').trim().slice(0, 50);
    if (!vk || !tk || !code) return res.status(400).json({ error: 'vendor, text and item_code needed' });
    const p = (await pool.query('SELECT item_code FROM products WHERE item_code = $1 AND active = true LIMIT 1', [code])).rows[0];
    if (!p) return res.status(404).json({ error: 'No such item' });
    await ensure();
    await pool.query('DELETE FROM grn_match_memory WHERE vendor_key = $1 AND text_key = $2', [vk, tk]);
    await pool.query('INSERT INTO grn_match_memory (vendor_key, text_key, item_code) VALUES ($1,$2,$3)', [vk, tk, p.item_code]);
    res.json({ ok: true });
  } catch (e) { console.error('[grn_match] remember:', e.message); res.status(500).json({ error: 'Could not remember that' }); }
});
module.exports = router;
