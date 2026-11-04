'use strict';
// Owner screen "Prices": see cost, selling price and margin for every live item, and save new prices / categories in one go.
//   GET  /api/item-prices        -> live items (owner or admin only)
//   POST /api/item-prices/save   -> { changes: [{ item_code, selling_price?, category? }] } all-or-nothing, nothing else is touched
const express = require('express');
const pool = require('../utils/pool');
const router = express.Router();
const roleOf = req => (req.session && req.session.user && req.session.user.role) || 'staff';
const ownerOnly = (req, res, next) => (['admin', 'owner'].includes(roleOf(req)) ? next() : res.status(403).json({ error: 'Owner only' }));
router.get('/item-prices', ownerOnly, async (req, res) => {
  try {
    const r = await pool.query(`SELECT item_code, name, category, stock_level, avg_cost, selling_price FROM products WHERE active = true ORDER BY item_code`);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: 'could not load items' }); }
});
router.post('/item-prices/save', ownerOnly, async (req, res) => {
  const changes = Array.isArray(req.body && req.body.changes) ? req.body.changes : null;
  if (!changes || !changes.length) return res.status(400).json({ error: 'nothing to save' });
  if (changes.length > 500) return res.status(400).json({ error: 'at most 500 items at once' });
  const clean = [];
  for (const [i, c] of changes.entries()) {
    const code = String((c && c.item_code) || '').trim();
    if (!/^[A-Za-z0-9-]{1,20}$/.test(code)) return res.status(400).json({ error: `row ${i + 1}: bad item code` });
    const out = { code };
    if (c.selling_price !== undefined) {
      if (c.selling_price === null || c.selling_price === '') out.price = null;
      else { const p = Number(c.selling_price); if (!Number.isFinite(p) || p <= 0 || p > 99999999) return res.status(400).json({ error: `${code}: price must be more than 0` }); out.price = Math.round(p * 100) / 100; }
    }
    if (c.category !== undefined) { const k = String(c.category || '').trim().slice(0, 40); out.cat = k || null; }
    if (out.price === undefined && out.cat === undefined) continue;
    clean.push(out);
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let n = 0;
    for (const o of clean) {
      const sets = [], vals = [];
      if (o.price !== undefined) { vals.push(o.price); sets.push(`selling_price = $${vals.length}`); }
      if (o.cat !== undefined) { vals.push(o.cat); sets.push(`category = $${vals.length}`); }
      vals.push(o.code);
      const r = await client.query(`UPDATE products SET ${sets.join(', ')} WHERE item_code = $${vals.length} AND active = true`, vals);
      if (!r.rowCount) throw new Error(`${o.code}: no live item with this code`);
      n += r.rowCount;
    }
    await client.query('COMMIT');
    res.json({ ok: true, saved: n });
  } catch (e) { await client.query('ROLLBACK').catch(() => {}); res.status(400).json({ error: e.message }); }
  finally { client.release(); }
});
module.exports = router;
