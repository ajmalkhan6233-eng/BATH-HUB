'use strict';
// Draws 4 FAKE sample receipts (1 item, credit, cheque, 40 items) into public/print/ so Aj can look at them. Sends nothing, touches no database.
// Run: node scripts/render_receipt_samples.js
const path = require('path');
const { renderReceiptPng } = require('../utils/receiptImage');
const out = path.join(__dirname, '..', 'public', 'print');
const base = { billNo: 'SAMPLE-0001', date: '22 Oct 2026', customer: 'Sample Customer (fake)', customerPhone: '+94700000000' };
const mk = n => Array.from({ length: n }, (_, i) => ({ code: 'T-' + (800 + i), name: i === 1 ? 'Rain Shower Set Stainless Steel 304 Extra Long Arm With Hand Spray' : 'SAMPLE item ' + (i + 1), qty: (i % 3) + 1, price: 1500 + i * 2750 }));
(async () => {
  const jobs = [
    ['receipt_v2_one.png', { ...base, items: mk(1), paymentMethod: 'cash' }],
    ['receipt_v2_credit.png', { ...base, items: mk(3), discount: 2500, paymentMethod: 'credit' }],
    ['receipt_v2_cheque.png', { ...base, items: mk(2), paymentMethod: 'cheque', chequeNo: '000000' }],
    ['receipt_v2_forty.png', { ...base, items: mk(40) }],
  ];
  for (const [name, bill] of jobs) {
    const r = await renderReceiptPng(bill, { outDir: out, fileName: name });
    console.log(name, r.width + 'x' + r.height, r.bytes + ' bytes');
  }
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
