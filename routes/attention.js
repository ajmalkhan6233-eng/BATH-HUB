'use strict';
const express = require('express'); const pool = require('../utils/pool'); const A = require('../utils/attention');
const router = express.Router();
router.get('/attention', async (req, res) => { try { res.json({ items: await A.collect(pool) }); } catch (e) { res.json({ items: [] }); } });
module.exports = router;
