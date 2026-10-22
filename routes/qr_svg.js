'use strict';
// GET /api/qr/<code>.svg -> a QR picture of the item code (error correction H so a small logo can sit in the middle).
// Uses the qrcode package the app already has. Login is required like every /api route.
const express = require('express');
const QRCode = require('qrcode');
const router = express.Router();
router.get('/qr/:code.svg', async (req, res) => {
  const text = String(req.params.code || '').trim();
  if (!/^[A-Za-z0-9._-]{1,40}$/.test(text)) return res.status(400).json({ error: 'bad code' });
  try {
    const svg = await QRCode.toString(text, { type: 'svg', errorCorrectionLevel: 'H', margin: 0 });
    res.type('image/svg+xml').set('Cache-Control', 'private, max-age=3600').send(svg);
  } catch (e) { res.status(500).json({ error: 'could not make the QR' }); }
});
module.exports = router;
