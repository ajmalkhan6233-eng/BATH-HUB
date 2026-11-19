// routes/grn_read.js — POST /api/grn-read-photo
// Reads a photo of a supplier invoice / GRN with the free AI reader and returns the lines
// for the GRN screen to show for review. SAVES NOTHING.
const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const multer = require('multer');
const { fromBuffer: fileTypeFromBuffer } = require('file-type');
const GrnImport = require('../public/lib/grn_import');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 1 } });

function createRouter({ ocr } = {}) {
  const router = express.Router();
  router.post('/grn-read-photo', (req, res, next) => upload.single('file')(req, res, e => e ? res.status(400).json({ error: 'Photo too large (max 8 MB) or bad upload' }) : next()), async (req, res) => {
    const f = req.file;
    if (!f) return res.status(400).json({ error: 'No photo received' });
    const ft = await fileTypeFromBuffer(f.buffer).catch(() => null);
    const kind = ft && ft.mime;
    if (kind !== 'image/jpeg' && kind !== 'image/png') return res.status(400).json({ error: 'Send a JPG or PNG photo. For a PDF or Excel use Fill from file.' });
    const tmp = path.join(os.tmpdir(), `grnread_${Date.now()}_${Math.random().toString(36).slice(2)}.${kind === 'image/png' ? 'png' : 'jpg'}`);
    try {
      fs.writeFileSync(tmp, f.buffer);
      const reader = ocr || require('../scripts/ocr_photo').ocrPhoto;
      const doc = await reader(tmp);
      if (!doc || !Array.isArray(doc.items) || !doc.items.length) return res.status(422).json({ error: 'The AI could not find item lines in this photo. Try a clearer, flatter photo or type it.' });
      res.json(GrnImport.fromOcr(doc));
    } catch (e) {
      console.error('[grn-read-photo]', e.message);
      res.status(502).json({ error: 'AI reader failed: ' + String(e.message || e).slice(0, 140) + ' (use Fill from file meanwhile)' });
    } finally { try { fs.unlinkSync(tmp); } catch (_) {} }
  });
  return router;
}
module.exports = createRouter();
module.exports.createRouter = createRouter;
