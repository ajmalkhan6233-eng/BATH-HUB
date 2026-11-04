'use strict';
// TEST ONLY. Draws a sample receipt picture ("TEST-001", sample items) and sends it through the shop's linked WhatsApp bridge to ONE number.
// Writes nothing to the database, no real bill, no stock change. Usage: node scripts/test_receipt_send.js 0777999219
require('dotenv').config();
const fs = require('fs');
const axios = require('axios');
const { renderReceiptPng } = require('../utils/receiptImage');
const { normalizeSriLankaPhone, CAPTION } = require('../utils/whatsappReceiptSender');

(async () => {
  const to = normalizeSriLankaPhone(process.argv[2]);
  if (!to) { console.log('RESULT: bad number'); process.exit(1); }
  const png = await renderReceiptPng({
    billNo: 'TEST-001', customer: 'Test receipt', customerPhone: to, paymentMethod: 'Cash', total: 5350, discount: 150,
    date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    items: [{ code: '001', name: 'Sample basin mixer tap', qty: 1, price: 4500 }, { code: '002', name: 'Sample shower hose', qty: 1, price: 1000 }],
  });
  console.log('RENDER: ok', png.width + 'x' + png.height, png.bytes + ' bytes');
  const url = process.env.WHATSAPP_API_URL || 'http://localhost:3001/send';
  const r = await axios.post(url, { to, message: CAPTION, media: { data: fs.readFileSync(png.file).toString('base64'), mimetype: 'image/png', filename: 'TEST-001.png' } }, { timeout: 60000, validateStatus: () => true });
  console.log('SEND: http', r.status, JSON.stringify(r.data).slice(0, 160));
  console.log('RESULT:', r.status === 200 && r.data && r.data.success ? 'SENT to ***' + String(to).slice(-3) : 'NOT SENT');
})().catch(e => { console.log('RESULT: ERROR', e.message); process.exit(1); });
