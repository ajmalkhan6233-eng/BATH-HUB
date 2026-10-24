'use strict';
// STAFF LOGINS (admin only; the global gate already keeps cashiers out): create a cashier with a PIN, change a PIN, turn a login off or on.
const express = require('express'); const bcrypt = require('bcryptjs'); const pool = require('../utils/pool'); const G = require('../utils/cashierGate');
const router = express.Router();
const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 16);
router.get('/staff-logins', async (req, res) => { try { res.json({ items: (await pool.query(`SELECT id, username, name, active, created_at FROM users WHERE role = 'cashier' ORDER BY id`)).rows }); } catch (e) { res.status(500).json({ error: 'could not load' }); } });
router.post('/staff-logins', async (req, res) => {
  try {
    const name = String((req.body || {}).name || '').trim().slice(0, 40), pin = String((req.body || {}).pin || '');
    if (!name) return res.status(400).json({ error: 'name needed' });
    if (G.weakPin(pin)) return res.status(400).json({ error: 'PIN must be 4 to 8 digits and not easy to guess (not 1234, 1111, ...)' });
    let username = 'cashier_' + (slug(name) || 'staff'), n = 1; const base = username;
    while ((await pool.query('SELECT 1 FROM users WHERE username=$1', [username])).rows.length) username = base + (++n);
    const r = await pool.query(`INSERT INTO users (username, name, password_hash, role, active) VALUES ($1,$2,$3,'cashier',true) RETURNING id, username, name`, [username, name, await bcrypt.hash(pin, 10)]);
    res.status(201).json({ ok: true, user: r.rows[0] });
  } catch (e) { res.status(500).json({ error: 'could not save' }); }
});
router.post('/staff-logins/:id/pin', async (req, res) => {
  try { const pin = String((req.body || {}).pin || ''); if (G.weakPin(pin)) return res.status(400).json({ error: 'PIN must be 4 to 8 digits and not easy to guess' });
    const r = await pool.query(`UPDATE users SET password_hash=$2 WHERE id=$1 AND role='cashier' RETURNING id`, [Number(req.params.id), await bcrypt.hash(pin, 10)]);
    res.status(r.rows.length ? 200 : 404).json(r.rows.length ? { ok: true } : { error: 'not found' }); } catch (e) { res.status(500).json({ error: 'could not save' }); }
});
router.post('/staff-logins/:id/active', async (req, res) => {
  try { const on = !!(req.body || {}).active; const r = await pool.query(`UPDATE users SET active=$2 WHERE id=$1 AND role='cashier' RETURNING id`, [Number(req.params.id), on]);
    res.status(r.rows.length ? 200 : 404).json(r.rows.length ? { ok: true, active: on } : { error: 'not found' }); } catch (e) { res.status(500).json({ error: 'could not save' }); }
});
module.exports = router;
