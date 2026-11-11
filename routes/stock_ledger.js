'use strict';
// GET /api/stock-ledger/:code = the stock history of one item. Mounted from routes/stock_helper.js.
const express = require('express'); const pool = require('../utils/pool'); const SL = require('../utils/stock_ledger');
const router = express.Router();
SL.ensure(pool).catch((e) => console.error('[stock_ledger]', e.message));
router.get('/stock-ledger/:code', async (req, res) => { try { res.json({ item_code: req.params.code, movements: await SL.history(pool, req.params.code, req.query.limit) }); } catch (e) { res.json({ item_code: req.params.code, movements: [] }); } });
module.exports = router;
