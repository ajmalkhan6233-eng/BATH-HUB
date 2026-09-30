// routes/tile_tools.js
// Counter tools for tile sales: how many tiles/boxes a room needs, and price per square metre.
// Pure calculation, no database. Sits behind the normal login like every other /api route.
const express = require('express');
const { estimateTiles, pricePerSqm } = require('../utils/tileMath');

const router = express.Router();

const run = fn => (req, res) => {
    try { res.json(fn(req.body || {})); }
    catch (e) { res.status(e.status || 500).json({ error: e.status ? e.message : 'Calculation failed' }); }
};

router.post('/tools/tile-estimate', run(estimateTiles));
router.post('/tools/price-per-sqm', run(pricePerSqm));

module.exports = router;
