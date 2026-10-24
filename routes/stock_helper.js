'use strict';
const express = require('express'); const pool = require('../utils/pool'); const PH = require('../utils/priceHelper'); const RO = require('../utils/reorder');
const router = express.Router();
router.get('/price-helper', async (req, res) => { try { res.json({ items: await PH.missing(pool) }); } catch (e) { res.status(500).json({ error: 'could not load' }); } });
router.post('/price-helper/apply', async (req, res) => { try { const b = req.body || {}; const r = await PH.apply(pool, String(b.item_code || ''), b.price); res.status(r.code || 200).json(r); } catch (e) { res.status(500).json({ error: 'could not save' }); } });
router.get('/reorder', async (req, res) => { try { res.json({ vendors: await RO.load(pool) }); } catch (e) { res.json({ vendors: [] }); } });
module.exports = router;
