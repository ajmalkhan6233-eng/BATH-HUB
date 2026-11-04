'use strict';
const express = require('express');
const pool = require('../utils/pool');
const W = require('../utils/billWatch');
const router = express.Router();
router.get('/bill-watch', async (req, res) => { try { res.json({ items: await W.list(pool, req.query.status ? String(req.query.status).toUpperCase() : null) }); } catch (e) { res.status(500).json({ error: 'could not load' }); } });
router.post('/bill-watch', async (req, res) => { try { const r = await W.add(pool, req.body || {}); res.status(r.code || 201).json(r); } catch (e) { res.status(500).json({ error: 'could not save' }); } });
router.post('/bill-watch/:id/close', async (req, res) => { try { const r = await W.close(pool, Number(req.params.id), (req.body || {}).note); res.status(r.code || 200).json(r); } catch (e) { res.status(500).json({ error: 'could not save' }); } });
module.exports = router;
