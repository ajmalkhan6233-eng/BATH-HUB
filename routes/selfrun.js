'use strict';
// Self-run status (owner only, read-only): the last 7 daily self-checks.
const express = require('express');
const pool = require('../utils/pool');
const router = express.Router();
const roleOf = req => (req.session && req.session.user && req.session.user.role) || 'staff';
const ownerOnly = (req, res, next) => (['admin', 'owner'].includes(roleOf(req)) ? next() : res.status(403).json({ error: 'Owner only' }));
router.get('/selfrun', ownerOnly, async (_req, res) => {
  try {
    const r = await pool.query(`SELECT run_day, status, line, detail, created_at FROM selfrun_log ORDER BY id DESC LIMIT 7`);
    res.json({ runs: r.rows });
  } catch (_) { res.json({ runs: [] }); }
});
module.exports = router;
