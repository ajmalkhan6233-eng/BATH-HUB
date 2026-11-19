'use strict';
const express = require('express');
const pool = require('../utils/pool');
const O = require('../utils/oversold');
const router = express.Router();
// GET /api/oversold/open?codes=A,B   POST /api/oversold/:id/resolve {how, cost}
router.get('/oversold/open', async (req, res) => {
  try { const codes = String(req.query.codes || '').split(',').map(s => s.trim()).filter(Boolean); res.json({ items: await O.open(pool, codes) }); }
  catch (e) { res.status(500).json({ error: 'could not load' }); }
});
router.post('/oversold/:id/resolve', async (req, res) => {
  try { const r = await O.resolve(pool, Number(req.params.id), req.body || {}); res.status(r.code || 200).json(r); }
  catch (e) { res.status(500).json({ error: 'could not save' }); }
});
module.exports = router;
