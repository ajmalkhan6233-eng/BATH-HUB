'use strict';
const express = require('express'); const pool = require('../utils/pool'); const P = require('../utils/chequePlan');
const router = express.Router();
router.get('/cheque-plan', async (req, res) => { try { res.json(P.plan(await P.load(pool))); } catch (e) { res.json({ rows: [], days: [] }); } });
module.exports = router;
