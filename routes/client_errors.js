'use strict';
/**
 * FIX 3 (7 Nov 2026 audit): phone/PC screens report their own errors.
 * POST /api/client-error  (no login needed, small, rate limited). Keeps only: page path, message, short stack, time. No names, numbers or form text.
 * GET  /api/client-errors (owner/admin session only) = last 50 + today's count.
 * Own table client_errors (additive, created on first use).
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const pool = require('../utils/db');
const router = express.Router();

let ready = null;
const ensure = () => ready || (ready = pool.query(`CREATE TABLE IF NOT EXISTS client_errors (
  id SERIAL PRIMARY KEY, at TIMESTAMPTZ DEFAULT NOW(), page TEXT, message TEXT, stack TEXT, ua TEXT, count INT DEFAULT 1)`));

const clean = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').replace(/\b\d{9,}\b/g, '#').slice(0, n);
const limiter = rateLimit({ windowMs: 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { error: 'slow down' } });

router.post('/client-error', limiter, express.json({ limit: '8kb' }), async (req, res) => {
  try {
    const b = req.body || {};
    const message = clean(b.message, 300);
    if (!message) return res.status(204).end();
    const page = clean(String(b.page || '').split('?')[0].split('#')[0], 150);
    const stack = clean(b.stack, 800);
    const ua = clean(req.get('user-agent'), 120);
    await ensure();
    // same error on same page within a day = bump the counter instead of a new row
    const up = await pool.query(`UPDATE client_errors SET count = count + 1, at = NOW() WHERE page = $1 AND message = $2 AND at > NOW() - INTERVAL '1 day' RETURNING id`, [page, message]);
    if (!up.rowCount) await pool.query(`INSERT INTO client_errors (page, message, stack, ua) VALUES ($1,$2,$3,$4)`, [page, message, stack, ua]);
    res.status(204).end();
  } catch (e) { res.status(204).end(); }   // never make an error report cause another error
});

router.get('/client-errors', async (req, res) => {
  try {
    const u = req.session && req.session.user;
    const role = u && u.role;
    if (!role || !['admin', 'owner'].includes(String(role).toLowerCase())) return res.status(403).json({ error: 'Owner only.' });
    await ensure();
    const rows = (await pool.query(`SELECT id, at, page, message, count FROM client_errors ORDER BY at DESC LIMIT 50`)).rows;
    const today = (await pool.query(`SELECT COALESCE(SUM(count),0)::int AS n FROM client_errors WHERE at > NOW() - INTERVAL '1 day'`)).rows[0].n;
    res.json({ today, rows });
  } catch (e) { res.status(500).json({ error: 'Could not read the error log.' }); }
});

module.exports = router;
