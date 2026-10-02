'use strict';
// End-of-day POS summary: totals and payment-method split for a day or a range.
jest.mock('pg', () => require('../helpers/pgmock')());

const express = require('express');
const request = require('supertest');
const pg = require('pg');
const router = require('../../routes/pos_bills');

const app = express();
app.use(express.json());
app.use('/api', router);

const db = pg.__db.public;
const ins = (no, at, pay, subtotal, disc, total) =>
  db.none(`INSERT INTO pos_bills (bill_number, subtotal, discount_pct, discount_amount, total, payment_method, created_at) VALUES ('${no}', ${subtotal}, 0, ${disc}, ${total}, ${pay ? `'${pay}'` : 'NULL'}, '${at}')`);

beforeAll(async () => {
  await new Promise(r => setTimeout(r, 500));            // route creates its tables
  ins('B1', '2026-10-01 09:15:00', 'cash', 10000, 0, 10000);
  ins('B2', '2026-10-01 14:30:00', 'card', 20000, 1000, 19000);
  ins('B3', '2026-10-01 23:59:00', 'cash', 5000, 500, 4500);
  ins('B4', '2026-10-02 08:00:00', 'cash', 7000, 0, 7000);
  ins('B5', '2026-10-02 10:00:00', null, 1000, 0, 1000);      // no method recorded -> cash
});

describe('GET /api/pos-bills/summary', () => {
  test('one day: totals and the split by payment method', async () => {
    const r = await request(app).get('/api/pos-bills/summary?date=2026-10-01');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ from: '2026-10-01', to: '2026-10-01', bills: 3, subtotal: 35000, discount: 1500, total: 33500 });
    expect(r.body.by_payment).toEqual([
      { payment_method: 'card', bills: 1, subtotal: 20000, discount: 1000, total: 19000 },
      { payment_method: 'cash', bills: 2, subtotal: 15000, discount: 500, total: 14500 },
    ]);
  });

  test('a late-night bill stays on its own day', async () => {
    const r = await request(app).get('/api/pos-bills/summary?from=2026-10-02&to=2026-10-02');
    expect(r.body.bills).toBe(2);
    expect(r.body.total).toBe(8000);
    expect(r.body.by_payment).toEqual([{ payment_method: 'cash', bills: 2, subtotal: 8000, discount: 0, total: 8000 }]);   // the null method counts as cash
  });

  test('a range adds the days up', async () => {
    const r = await request(app).get('/api/pos-bills/summary?from=2026-10-01&to=2026-10-02');
    expect(r.body).toMatchObject({ bills: 5, total: 41500 });
  });

  test('a day with no sales is zeros, not an error', async () => {
    const r = await request(app).get('/api/pos-bills/summary?date=2026-09-15');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ bills: 0, subtotal: 0, discount: 0, total: 0, by_payment: [] });
  });

  test('defaults to today; bad dates and reversed ranges are 400', async () => {
    const r = await request(app).get('/api/pos-bills/summary');
    expect(r.status).toBe(200);
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    expect(r.body.from).toBe(today);
    expect((await request(app).get('/api/pos-bills/summary?date=yesterday')).status).toBe(400);
    expect((await request(app).get('/api/pos-bills/summary?from=2026-10-05&to=2026-10-01')).status).toBe(400);
  });

  test('"summary" is not mistaken for a bill id', async () => {
    expect((await request(app).get('/api/pos-bills/summary?date=2026-10-01')).body).toHaveProperty('by_payment');
    expect((await request(app).get('/api/pos-bills/abc')).status).toBe(404);
  });
});
