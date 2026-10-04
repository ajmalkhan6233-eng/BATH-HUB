const express = require('express');
const request = require('supertest');
const { newDb } = require('pg-mem');
const { migrate } = require('../scripts/migrate_vendor_ledger');
const createRouter = require('../routes/vendor_ledger');

let app, pool;
beforeAll(async () => {
  const db = newDb();
  const { Pool } = db.adapters.createPg();
  pool = new Pool();
  await migrate(pool);
  app = express();
  let authed = true;
  app.use((req, res, next) => (req.headers['x-anon'] ? res.status(401).json({ error: 'not logged in' }) : next()));
  app.use('/api/vendor-ledger', createRouter({ pool }));
});

const post = (url, body) => request(app).post(url).send(body);
const day = (n) => { const d = new Date(Date.now() + n * 86400000); return d.toISOString().slice(0, 10); };

test('auth middleware (when supplied by the app) is respected', async () => {
  const r = await request(app).get('/api/vendor-ledger/summary').set('x-anon', '1');
  expect(r.status).toBe(401);
});

test('bad input returns 400 not 500', async () => {
  expect((await post('/api/vendor-ledger/bills', { vendor_name: '', total: 10, bill_date: '2026-01-01' })).status).toBe(400);
  expect((await post('/api/vendor-ledger/bills', { vendor_name: 'A', total: -5, bill_date: '2026-01-01' })).status).toBe(400);
  expect((await post('/api/vendor-ledger/bills', { vendor_name: 'A', total: 5, bill_date: '01/01/2026' })).status).toBe(400);
  expect((await post('/api/vendor-ledger/bills/abc/cheques', { amount: 1, cheque_date: '2026-01-01' })).status).toBe(400);
});

test('full cheque life: payable stays until cleared, once only', async () => {
  const bill = (await post('/api/vendor-ledger/bills', { vendor_name: 'Eskema Ceramic', bill_no: 'M1-5820', bill_date: '2026-01-13', due_date: '2026-02-12', total: 213200 })).body;
  expect(bill.id).toBeGreaterThan(0);
  const ch = (await post(`/api/vendor-ledger/bills/${bill.id}/cheques`, { cheque_no: '760342', bank: 'NDB', amount: 213200, cheque_date: day(3), payee: 'CASH', amount_words: 'Two Hundred Thirteen Thousand Two Hundred Only' })).body;
  expect(ch.warnings).toContain('PAYEE_IS_CASH');
  expect(ch.words).toBe('Two Hundred Thirteen Thousand Two Hundred Only');

  let list = (await request(app).get('/api/vendor-ledger/bills')).body;
  expect(list[0]).toMatchObject({ state: 'CHEQUE_ISSUED', outstanding: 213200, covered: 213200 });
  let sum = (await request(app).get('/api/vendor-ledger/summary')).body;
  expect(sum.totals.outstanding).toBe(213200);

  expect((await post(`/api/vendor-ledger/cheques/${ch.cheque.id}/clear`)).status).toBe(200);
  expect((await post(`/api/vendor-ledger/cheques/${ch.cheque.id}/clear`)).status).toBe(200); // idempotent
  expect((await post(`/api/vendor-ledger/cheques/${ch.cheque.id}/bounce`)).status).toBe(400); // cannot undo a cleared cheque
  list = (await request(app).get('/api/vendor-ledger/bills')).body;
  expect(list[0]).toMatchObject({ state: 'PAID', outstanding: 0 });
});

test('credit note reduces payable, bounced cheque restores it', async () => {
  const bill = (await post('/api/vendor-ledger/bills', { vendor_name: 'RK Trading', bill_date: '2025-12-17', total: 100000 })).body;
  await post(`/api/vendor-ledger/bills/${bill.id}/credit-notes`, { amount: 25000, note_no: 'M1-6032' });
  const ch = (await post(`/api/vendor-ledger/bills/${bill.id}/cheques`, { amount: 75000, cheque_date: day(1) })).body;
  await post(`/api/vendor-ledger/cheques/${ch.cheque.id}/bounce`);
  const b = (await request(app).get('/api/vendor-ledger/bills?vendor=RK%20Trading')).body[0];
  expect(b).toMatchObject({ outstanding: 75000, covered: 0, hasBounced: true, state: 'UNPAID' });
});

test('calendar, cash gap, checks, csv', async () => {
  const bill = (await post('/api/vendor-ledger/bills', { vendor_name: 'F.R Marketing', bill_date: '2026-01-01', total: 1000000 })).body;
  await post(`/api/vendor-ledger/bills/${bill.id}/cheques`, { cheque_no: '499904', amount: 400000, cheque_date: day(0), due_date: day(0) });
  await post(`/api/vendor-ledger/bills/${bill.id}/cheques`, { cheque_no: '499904', amount: 400000, cheque_date: day(0), due_date: day(0) });
  const cal = (await request(app).get('/api/vendor-ledger/calendar?bulk=300000')).body;
  expect(cal.today).toBeGreaterThanOrEqual(800000);
  const gap = (await request(app).get('/api/vendor-ledger/cash-gap?cash=100000&days=2')).body;
  expect(gap.gap).toBeGreaterThan(0);
  const chk = (await request(app).get('/api/vendor-ledger/checks')).body;
  expect(chk.duplicates.sameNumber.length).toBeGreaterThanOrEqual(1);
  const csv = await request(app).get('/api/vendor-ledger/export.csv');
  expect(csv.text.split('\n')[0]).toContain('outstanding');
});
