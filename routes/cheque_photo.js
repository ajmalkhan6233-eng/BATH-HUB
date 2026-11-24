'use strict';
// BLOCK: cheque-photo (AJ 24 Nov 2026). "Upload cheque": the photo is saved in uploads/cheques/<date>/ and read by the LOCAL Tesseract
// program on this PC (nothing goes to any cloud). The page gets the cheque number, date, amount, payee and bank as a PREFILLED form;
// the owner checks it and taps Save, which uses the normal cheque-register route (duplicate guard, money maths unchanged).
//   POST /api/cheque-photo/read  { photo_data_url: "data:image/jpeg;base64,..." }  ->  { photo, fields:{cheque_no,date,amount,payee,bank}, note }
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');

const router = express.Router();
const ROOT = path.join(__dirname, '..', 'uploads', 'cheques');
const TESS = process.env.TESSERACT_PATH || 'C:\Program Files\Tesseract-OCR\tesseract.exe';
const MAX = 8 * 1024 * 1024;

function parseCheque(text) {
  const t = String(text || '');
  const f = { cheque_no: null, date: null, amount: null, payee: null, bank: null };
  const flat = t.replace(/(\d)[ \t]+(?=\d)/g, '$1'); // HNB prints the date in boxes: "2 5 0 2 2 0 2 7"
  let m = /\b(\d{2})[\/\-.](\d{2})[\/\-.](20\d{2})\b/.exec(flat) || /\b(\d{2})(\d{2})(20\d{2})\b/.exec(flat);
  if (m && +m[1] >= 1 && +m[1] <= 31 && +m[2] >= 1 && +m[2] <= 12) f.date = `${m[3]}-${m[2]}-${m[1]}`; // Sri Lanka writes day first
  const noDate = flat.replace(/\b\d{2}[\/\-.]\d{2}[\/\-.]20\d{2}\b/g, ' ').replace(/\b\d{8}\b/g, ' ');
  m = /(?:^|[^\d])(\d{6})(?!\d)/.exec(noDate); if (m) f.cheque_no = m[1];
  m = /(\d{1,3}(?:,\d{3})+|\d{4,})(?:\.\d{2})?\s*\/?\s*[-=]/.exec(noDate.replace(/(\d{6})/, (x) => (x === f.cheque_no ? ' ' : x)));
  if (!m) { const c = (noDate.match(/\d{1,3}(?:,\d{3})+(?:\.\d{2})?/g) || []).map((x) => Number(x.replace(/,/g, ''))).sort((a, b) => b - a); if (c.length) f.amount = c[0]; }
  else f.amount = Number(m[1].replace(/,/g, ''));
  m = /\bpay\s+([A-Za-z][A-Za-z .&'-]{1,60}?)(?:\s+or\s+bearer|\s*$|\n)/im.exec(t); if (m) f.payee = m[1].trim();
  if (/hatton|\bHNB\b/i.test(t)) f.bank = 'HNB'; else if (/commercial/i.test(t)) f.bank = 'Commercial Bank'; else if (/sampath/i.test(t)) f.bank = 'Sampath Bank';
  else if (/people'?s/i.test(t)) f.bank = "People's Bank"; else if (/bank of ceylon|\bBOC\b/i.test(t)) f.bank = 'Bank of Ceylon';
  return f;
}

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' });
const ocr = (file) => new Promise((resolve) => execFile(TESS, [file, 'stdout', '-l', 'eng', '--psm', '6'], { timeout: 40000, windowsHide: true, maxBuffer: 4e6 }, (e, out) => resolve(e ? '' : String(out))));

router.post('/cheque-photo/read', express.json({ limit: '12mb' }), async (req, res) => {
  try {
    const m = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/.exec((req.body && req.body.photo_data_url) || '');
    if (!m) return res.status(400).json({ error: 'Send the cheque photo as a JPG or PNG' });
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > MAX) return res.status(400).json({ error: 'Photo is too large (max 8 MB)' });
    const dir = path.join(ROOT, today()); fs.mkdirSync(dir, { recursive: true });
    const name = Date.now() + '-' + crypto.randomBytes(3).toString('hex') + (m[1] === 'jpeg' ? '.jpg' : '.png');
    const file = path.join(dir, name); fs.writeFileSync(file, buf);
    const text = await ocr(file);
    const fields = parseCheque(text);
    const found = Object.values(fields).filter((v) => v != null).length;
    res.json({ photo: `uploads/cheques/${today()}/${name}`, fields, note: found ? 'Read on this PC. Check every box, then Save.' : 'The reader could not read this photo. The photo is saved: type the details in.' });
  } catch (e) { res.status(500).json({ error: 'Could not read the photo: ' + e.message }); }
});

module.exports = router;
module.exports.parseCheque = parseCheque;
