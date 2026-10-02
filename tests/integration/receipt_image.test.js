'use strict';
// Receipt picture module on its own: draws the Bath Hub receipt PNG for a 1-item and a 12-item bill, saves it for the queue, sends nothing.
jest.mock('pg', () => require('../helpers/pgmock')());
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const request = require('supertest');
const pg = require('pg');
const { renderReceiptPng, cleanBill, DEFAULT_DIR } = require('../../utils/receiptImage');

let haveChrome = true;
try { haveChrome = fs.existsSync(require('puppeteer').executablePath()); } catch (e) { haveChrome = false; }
const chrome = haveChrome ? test : test.skip;

const one = { shopName: 'BATH HUB', address: 'Thihariya, Kandy Road', phone: '0777 999 219', billNo: 'T-1', date: '02 Oct 2026', customer: 'Test', items: [{ name: 'Wall-hung toilet set', qty: 1, price: 45000 }], discount: 0 };
const twelve = { ...one, billNo: 'T-12', items: Array.from({ length: 12 }, (_, i) => ({ name: 'Item number ' + (i + 1), qty: (i % 3) + 1, price: 1500 + i * 2750 })), discount: 5000 };
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'receipts-'));
afterAll(() => { for (const f of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, f)); fs.rmdirSync(dir); });
const isPng = f => fs.readFileSync(f).slice(0, 8).toString('hex') === '89504e470d0a1a0a';

describe('receipt picture', () => {
  chrome('a 1-item bill makes a PNG the size of the brand sample', async () => {
    const r = await renderReceiptPng(one, { outDir: dir, fileName: 'one.png' });
    expect(isPng(r.file)).toBe(true);
    expect(r.width).toBe(1683);
    expect(r.height).toBeGreaterThanOrEqual(2103);
  }, 90000);
  chrome('a 12-item bill makes a taller PNG, nothing cut off', async () => {
    const a = await renderReceiptPng(one, { outDir: dir, fileName: 'a.png' });
    const b = await renderReceiptPng(twelve, { outDir: dir, fileName: 'twelve.png' });
    expect(isPng(b.file)).toBe(true);
    expect(b.height).toBeGreaterThan(a.height);
    expect(b.width).toBe(1683);
  }, 90000);
  test('bad bills are refused with a clear message', () => {
    expect(() => cleanBill({ items: [] })).toThrow(/items/);
    expect(() => cleanBill({ items: [{ name: 'x', qty: 0, price: 1 }] })).toThrow(/qty/);
    expect(() => cleanBill({ items: [{ name: 'x', qty: 1, price: -5 }] })).toThrow(/price/);
    expect(() => cleanBill({ items: [{ name: 'x', qty: 1, price: 1 }], discount: -1 })).toThrow(/discount/);
  });
  test('the address is made safe before the template writes it as HTML', () => {
    expect(cleanBill({ items: [{ name: 'x', qty: 1, price: 1 }], address: '<b>x</b>' }).address).toBe('&lt;b&gt;x&lt;/b&gt;');
  });
});

describe('queue route (saves the picture, sends nothing)', () => {
  let app;
  beforeAll(async () => {
    const router = require('../../routes/shop_operations');
    app = express(); app.use(express.json()); app.use('/api', router);
    await new Promise(r => setTimeout(r, 600));
  });
  test('queue entry, draw picture, read it back; unknown entry and bad bill are refused', async () => {
    const q = await request(app).post('/api/receipt-queue').send({ customer_phone: '0771234567', sale_reference: 'T-1', amount: 45000 });
    expect(q.status).toBe(200);
    const bad = await request(app).post(`/api/receipt-queue/${q.body.id}/image`).send({ items: [] });
    expect(bad.status).toBe(400);
    const missing = await request(app).post('/api/receipt-queue/99999/image').send(one);
    expect(missing.status).toBe(404);
    if (!haveChrome) return;
    const ok = await request(app).post(`/api/receipt-queue/${q.body.id}/image`).send(one);
    expect(ok.status).toBe(201);
    expect(ok.body.width).toBe(1683);
    const got = await request(app).get(`/api/receipt-queue/${q.body.id}/image`).buffer(true).parse((res, cb) => { const c = []; res.on('data', d => c.push(d)); res.on('end', () => cb(null, Buffer.concat(c))); });
    expect(got.status).toBe(200);
    expect(got.headers['content-type']).toMatch(/image\/png/);
    expect(got.body.slice(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    const still = await request(app).get('/api/receipt-queue?status=queued');
    expect(still.body.some(r => r.id === q.body.id && r.status === 'queued')).toBe(true);   // still queued: not sent
    fs.unlinkSync(path.join(DEFAULT_DIR, ok.body.file_name));
  }, 120000);
});