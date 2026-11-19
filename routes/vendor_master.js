'use strict';
// Vendor master: GET /api/vendors-master (list), POST /api/vendors-master {name, phone?, notes?}. Mounted from routes/stock_helper.js (no server.js edit).
const express = require('express'); const pool = require('../utils/pool'); const VM = require('../utils/vendor_master');
const router = express.Router();
VM.ensure(pool).then(() => VM.backfill(pool)).catch((e) => console.error('[vendor_master]', e.message));
router.get('/vendors-master', async (req, res) => { try { await VM.ensure(pool); await VM.backfill(pool); res.json({ vendors: await VM.list(pool) }); } catch (e) { res.json({ vendors: [] }); } });
router.post('/vendors-master', async (req, res) => { try { await VM.ensure(pool); res.json({ vendor: await VM.upsert(pool, req.body || {}) }); } catch (e) { res.status(400).json({ error: e.message }); } });
module.exports = router;
