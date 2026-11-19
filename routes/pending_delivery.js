'use strict';
const express = require('express');
const pool = require('../utils/pool');
const D = require('../utils/pendingDelivery');
const router = express.Router();
router.get('/pending-delivery', async (req, res) => { try { res.json({ items: await D.list(pool, req.query.status ? String(req.query.status).toUpperCase() : null) }); } catch (e) { res.status(500).json({ error: 'could not load' }); } });
router.post('/pending-delivery', async (req, res) => { try { const r = await D.add(pool, req.body || {}); res.status(r.code || 201).json(r); } catch (e) { res.status(500).json({ error: 'could not save' }); } });
router.post('/pending-delivery/:id/deliver', async (req, res) => { try { const r = await D.deliver(pool, Number(req.params.id)); res.status(r.code || 200).json(r); } catch (e) { res.status(500).json({ error: 'could not save' }); } });
module.exports = router;
