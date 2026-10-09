'use strict';
// Live daily sales from POS bills (routes/daily_sales_live.js): open day = sum of bills, closed day = day sheet wins.
jest.mock('pg', () => require('../helpers/pgmock')());

const express = require('express');
const request = require('supertest');
const pg = require('pg');
const router = require('../../routes/daily_sales_live');

const app = express();
app.use('/api', router);

const db = pg.__db.public;
const bill = (no, at, pay, subtotal, disc, total) =>
  db.none(`INSERT INTO pos_bills (bill_number, subtotal, discount_pct, discount_amount, total, payment_method, created_at) VALUES ('${no}', ${subtotal}, 0, ${disc}, ${total}, ${pay ? `'${pay}'` : 'NULL'}, '${at}')`);

beforeAll(async () => {
  db.none(`CREATE TABLE pos_bills (id SERIAL PRIMARY KEY, bill_number VARCHAR(30) UNIQUE NOT NULL, subtotal NUMERIC(12,2), discount_pct NUMERIC(5,2) DEFAULT 0, discount_amount NUMERIC(12,2) DEFAULT 0, total NUMERIC(12,2), payment_method VARCHAR(30), created_at TIMESTAMP)`);
  db.none(`CREATE TABLE pos_bill_voids (bill_id INT PRIMARY KEY, reason TEXT)`);
  db.none(`CREATE TABLE daily_summary (report_date DATE PRIMARY KEY, total_sale NUMERIC(12,2))`);

  // (a) open day 2026-10-01: three bills, no day sheet
  bill('A1', '2026-10-01 09:00:00', 'cash', 10000, 0, 10000);
  bill('A2', '2026-10-01 11:00:00', 'card', 20000, 0, 20000);
  bill('A3', '2026-10-01 15:00:00', 'cash', 5000, 0, 5000);

  // (b) closed day 2026-10-02: day sheet says 99999, bills say 30000
  db.none(`INSERT INTO daily_summary (report_date, total_sale) VALUES ('2026-10-02', 99999)`);
  bill('B1', '2026-10-02 10:00:00', 'cash', 30000, 0, 30000);

  // (c) open day 2026-10-03: two bills, one of them voided
  bill('C1', '2026-10-03 10:00:00', 'cash', 8000, 0, 8000);
  bill('C2', '2026-10-03 12:00:00', 'online', 9000, 0, 9000);
  db.none(`INSERT INTO pos_bill_voids (bill_id, reason) SELECT id, 'wrong item' FROM pos_bills WHERE bill_number = 'C2'`);

  // (d) midnight edges: 23:59 belongs to 2026-10-04, 00:01 to 2026-10-05
  bill('D1', '2026-10-04 23:59:00', 'cash', 1000, 0, 1000);
  bill('D2', '2026-10-05 00:01:00', 'cash', 2000, 0, 2000);

  // (e) discount bill: 10000 less 1500 discount = 8500 counts, not 10000; no payment method = cash
  bill('E1', '2026-10-06 13:00:00', null, 10000, 1500, 8500);
  // an unknown method still counts in the total, under "other"
  bill('E2', '2026-10-06 14:00:00', 'voucher', 500, 0, 500);
});

const get = d => request(app).get(`/api/daily-sales-live/${d}`);

describe('GET /api/daily-sales-live/:date', () => {
  test('(a) no day sheet + 3 bills = the sum of the 3, labelled open day, split by payment method', async () => {
    const r = await get('2026-10-01');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ date: '2026-10-01', mode: 'open_day', label: 'Open day: from bills', sale: 35000, bills_count: 3, bills_total: 35000 });
    expect(r.body.pay).toMatchObject({ cash: 15000, card: 20000, online: 0, credit: 0, cheque: 0, other: 0 });
  });

  test('(b) day sheet exists = the sheet wins; bills come back only as a reference and no sale figure is given', async () => {
    const r = await get('2026-10-02');
    expect(r.body).toMatchObject({ mode: 'day_sheet', label: 'Bills total (reference, not added)', bills_count: 1, bills_total: 30000 });
    expect(r.body.sale).toBeUndefined();
    expect(r.body.pay).toBeUndefined();
  });

  test('(c) a voided bill is left out of the sum and the count', async () => {
    const r = await get('2026-10-03');
    expect(r.body).toMatchObject({ mode: 'open_day', sale: 8000, bills_count: 1 });
    expect(r.body.pay.online).toBe(0);
  });

  test('(d) a bill at 23:59 and one at 00:01 land on the right dates', async () => {
    const a = await get('2026-10-04');
    const b = await get('2026-10-05');
    expect(a.body).toMatchObject({ sale: 1000, bills_count: 1 });
    expect(b.body).toMatchObject({ sale: 2000, bills_count: 1 });
  });

  test('(e) a discounted bill counts at its discounted total; unknown method goes to other but stays in the total', async () => {
    const r = await get('2026-10-06');
    expect(r.body.pay.cash).toBe(8500);
    expect(r.body.pay.other).toBe(500);
    expect(r.body.sale).toBe(9000);
  });

  test('a day with no bills and no sheet is an open day of 0', async () => {
    const r = await get('2026-09-01');
    expect(r.body).toMatchObject({ mode: 'open_day', sale: 0, bills_count: 0 });
  });

  test('a bad date is a plain 400', async () => {
    const r = await get('not-a-date');
    expect(r.status).toBe(400);
  });

  test('"today" uses the Colombo date', async () => {
    const { todayLK } = require('../../utils/lkTime');
    const r = await request(app).get('/api/daily-sales-live/today');
    expect(r.status).toBe(200);
    expect(r.body.date).toBe(todayLK());
  });

  test('it only reads: no write or schema statement is ever sent', async () => {
    const pool = require('../../utils/pool');
    const seen = [];
    const orig = pool.query.bind(pool);
    pool.query = (q, p) => { seen.push(String(q.text || q)); return orig(q, p); };
    await get('2026-10-01');
    pool.query = orig;
    expect(seen.length).toBeGreaterThan(0);
    for (const q of seen) expect(q.trim()).toMatch(/^SELECT/i);
  });
});
