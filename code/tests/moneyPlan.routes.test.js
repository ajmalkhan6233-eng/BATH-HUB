const express = require('express');
const request = require('supertest');
const { newDb } = require('pg-mem');
const { migrate } = require('../scripts/migrate_vendor_ledger');
const createRouter = require('../routes/money_plan');

let app, pool, role = 'admin';
const day = (n) => new Date(Date.now() + n * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' });
beforeAll(async () => {
  const db = newDb();
  pool = new (db.adapters.createPg().Pool)();
  await migrate(pool);
  await pool.query(`CREATE TABLE app_settings (key TEXT PRIMARY KEY, value JSONB NOT NULL, updated_by TEXT, updated_at TIMESTAMPTZ DEFAULT NOW())`);
  await pool.query(`CREATE TABLE daily_summary (report_date DATE, total_sale NUMERIC, gross_profit NUMERIC, total_expenses NUMERIC)`);
  await pool.query(`INSERT INTO daily_summary VALUES ($1,60000,20000,10000)`, [day(-1)]);
  app = express();
  app.use((req, res, next) => { req.session = { user: { username: 't', role } }; next(); });
  app.use('/api', createRouter({ pool }));
});

test('settings default commission is 2% and can be changed by the owner only', async () => {
  expect((await request(app).get('/api/money/settings')).body.commissionRatePct).toBe(2);
  role = 'staff';
  expect((await request(app).put('/api/money/settings').send({ commissionRatePct: 3 })).status).toBe(403);
  role = 'admin';
  expect((await request(app).put('/api/money/settings').send({ commissionRatePct: -1 })).status).toBe(400);
  expect((await request(app).put('/api/money/settings').send({ commissionRatePct: 3 })).body.commissionRatePct).toBe(3);
  await request(app).put('/api/money/settings').send({ commissionRatePct: 2 });
});

test('waterfall reads daily_summary and applies commission', async () => {
  const r = await request(app).get(`/api/money/waterfall?from=${day(-1)}&to=${day(-1)}`);
  expect(r.status).toBe(200);
  expect(r.body.waterfall.grossProfit).toBe(20000);
  expect(r.body.waterfall.commission).toBe(400);
  expect((await request(app).get('/api/money/waterfall?from=2026-02-02&to=2026-01-01')).status).toBe(400);
});

test('morning brief reports yesterday and a cheque due today', async () => {
  const b = (await pool.query(`INSERT INTO vendor_bills (vendor_name, bill_date, total) VALUES ('RK', $1, 50000) RETURNING id`, [day(-5)])).rows[0].id;
  await pool.query(`INSERT INTO vendor_bill_cheques (bill_id, amount, cheque_date, due_date) VALUES ($1, 25000, $2, $3)`, [b, day(-3), day(0)]);
  const r = await request(app).get('/api/morning-brief');
  expect(r.status).toBe(200);
  expect(r.body.sections.yesterday.sales).toBe(60000);
  expect(r.body.sections.cheques.today).toBe(25000);
  expect(r.body.text).toMatch(/Royal Bath Hub brief/);
});
