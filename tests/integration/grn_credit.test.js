'use strict';
// New GRN -> vendor payable "payment pending"; credit days; paid now; credit view route; planner honours Sri Lankan holidays.
jest.mock('pg', () => require('../helpers/pgmock')());

const express = require('express');
const request = require('supertest');
const pg = require('pg');
const db = pg.__db.public;
db.none(`CREATE TABLE products (id SERIAL PRIMARY KEY, item_code TEXT, name TEXT, category TEXT, stock_level NUMERIC DEFAULT 0,
  reorder_threshold NUMERIC DEFAULT 0, selling_price NUMERIC DEFAULT 0, avg_cost NUMERIC DEFAULT 0, photo_url TEXT, active BOOLEAN DEFAULT true)`);
db.none(`CREATE TABLE grn_records (id SERIAL PRIMARY KEY, grn_number TEXT, supplier_id INT, supplier_name TEXT, grn_date DATE, item_description TEXT, quantity NUMERIC, unit_cost NUMERIC, total_amount NUMERIC, source_file_path TEXT, status TEXT, notes TEXT)`);
const { migrate } = require('../../scripts/migrate_vendor_ledger');
const grn = require('../../routes/grn_manual');
const credit = require('../../routes/vendor_credit');
const pool = require('../../utils/pool');

let app;
beforeAll(async () => {
  await migrate(pool);
  app = express(); app.use(express.json());
  app.use('/api', grn);
  app.use('/api/vendor-credit', credit({ pool }));
});

const send = (p) => request(app).post('/api/grn-manual').field('payload', JSON.stringify(p));
const base = (o = {}) => ({ supplier_name: 'Metro', grn_date: '2026-10-16', lines: [{ name: 'Basin ' + Math.random().toString(36).slice(2, 7), qty: 20, unit_cost: 34000 }], ...o });

test('new GRN with no cheque yet: payment pending, stock shown, vendor owed', async () => {
  const r = await send(base());
  expect(r.status).toBe(201);
  expect(r.body.total).toBe(680000);
  expect(r.body.items[0].stock_now).toBe(20);                       // available now
  expect(r.body.credit.this_bill.state).toBe('UNPAID');
  expect(r.body.credit.this_bill.status_text).toBe('Cheque not written, payment pending');
  expect(r.body.credit.vendor.owed).toBe(680000);
  expect(r.body.credit.vendor.notWritten).toBe(680000);
  expect(r.body.credit.line).toMatch(/Metro: owe Rs 680,000/);
  const bills = db.many(`SELECT * FROM vendor_bills`);
  expect(bills).toHaveLength(1); expect(bills[0].bill_no).toBe(r.body.grn_number);
});

test('credit days sets the vendor due date', async () => {
  const r = await send(base({ supplier_name: 'Eskema', credit_days: 120 }));
  expect(r.status).toBe(201);
  expect(r.body.credit.terms).toMatchObject({ credit_days: 120, due_date: '2027-02-13' });
  expect(r.body.credit.this_bill.due_date).toBe('2027-02-13');
});

test('paid now (cash on delivery): nothing owed', async () => {
  const r = await send(base({ supplier_name: 'Cash Co', paid_now: true }));
  expect(r.status).toBe(201);
  expect(r.body.credit.this_bill.state).toBe('PAID');
  expect(r.body.credit.vendor).toBeNull();
});

test('bad credit days is a 400 and nothing is saved', async () => {
  const before = db.many(`SELECT * FROM grn_records`).length;
  for (const bad of [-1, 2.5, 'abc', 5000]) {
    const r = await send(base({ credit_days: bad }));
    expect(r.status).toBe(400);
  }
  expect(db.many(`SELECT * FROM grn_records`).length).toBe(before);
});

test('written cheques show in the credit view; after-months fall away; long-dated flagged', async () => {
  const bill = db.many(`SELECT * FROM vendor_bills WHERE vendor_name='Metro'`)[0];
  await pool.query(`INSERT INTO vendor_bill_cheques (bill_id, cheque_no, amount, cheque_date, due_date, status) VALUES ($1,'A',170000,'2026-11-16','2026-11-16','ISSUED'),($1,'B',170000,'2027-02-18','2027-02-18','ISSUED')`, [bill.id]);
  const r = await request(app).get('/api/vendor-credit/vendor?name=metro');
  expect(r.status).toBe(200);
  const v = r.body.vendor;
  expect(v.owed).toBe(680000);
  expect(v.writtenNotClear).toBe(340000); expect(v.notWritten).toBe(340000);
  expect(v.after['1']).toBe(510000);                  // first cheque clears inside a month
  expect(v.after['3']).toBe(510000);                  // second is beyond 3 months
  expect(r.body.longDated).toHaveLength(1);
  const all = await request(app).get('/api/vendor-credit/summary?months=1,2');
  expect(all.status).toBe(200); expect(all.body.totals.owed).toBeGreaterThan(680000);   // Metro + Eskema
  expect((await request(app).get('/api/vendor-credit/summary?months=x')).status).toBe(400);
  expect((await request(app).get('/api/vendor-credit/vendor')).status).toBe(400);
});

test('payment planner moves a cheque off a Sri Lankan poya/bank holiday by default', () => {
  const { planSchedule } = require('../../utils/payment_planner');
  const SLH = require('../../utils/slBankHolidays');
  const p = planSchedule({ total: 1000, count: 1, firstDate: '2026-11-08', todayISO: '2026-10-16', holidays: SLH.all() });  // 8 Nov 2026 is a Sunday holiday in the list; a weekday holiday is checked next
  expect(p.ok).toBe(true);
  const q = planSchedule({ total: 1000, count: 1, firstDate: '2026-11-24', todayISO: '2026-10-16', holidays: SLH.all() });   // Tuesday holiday
  expect(q.installments[0].date).toBe('2026-11-25'); expect(q.installments[0].moved).toBe('2026-11-24');
});

test('planner preview route uses the Sri Lankan holiday list when the caller sends none', async () => {
  const planner = require('../../routes/payment_planner');
  const a2 = express(); a2.use(express.json()); a2.use('/api', planner);
  // pick a first date that is a Tuesday holiday in the list but far enough ahead: 2026-11-24 only works while "today" is before it
  const today = new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
  if (today >= '2026-11-24') return;   // the example date has passed; the util test above still covers the rule
  const r = await request(a2).post('/api/payment-planner/preview').send({ total: 1000, count: 1, first_date: '2026-11-24' });
  expect(r.status).toBe(200);
  expect(r.body.installments[0].date).toBe('2026-11-25');
});
