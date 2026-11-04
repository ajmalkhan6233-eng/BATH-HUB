// GET /api/test-mode -> {test:boolean}. Read-only; the banner script asks this.
const express = require('express');
const { isTest } = require('../utils/testMode');
const router = express.Router();
router.get('/test-mode', (req, res) => res.json({ test: isTest() }));
module.exports = router;
