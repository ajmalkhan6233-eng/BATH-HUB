'use strict';
// Outside items, tested alone through the REAL pos_bills route: two items, one repeated, stock nets to 0, profit is right, real cost recalculates.
process.env.POS_DEDUCT_STOCK = 'true';
jest.mock('pg', () => require('../helpers/pgmock')());
const express = require('express');
const request = require('supertest');
const pg = require('pg');
const db = pg.__db.public;
db.none(`CREATE TABLE daily_summary (report_date DATE PRIMARY KEY, total_sale NUMERIC)`);
db.none(`CREATE TABLE discount_rules (id SERIAL PRIMARY KEY, role VARCHAR(30) NOT NULL DEFAULT 'all', max_discount_pct NUMERIC(5,2) NOT NULL, notes TEXT, active BOOLEAN NOT NULL DEFAULT true)`);
db.none(`CREATE TABLE products (id SERIAL PRIMARY KEY, item_code TEXT, name TEXT, category TEXT, stock_level NUMERIC DEFAULT 0, reorder_threshold NUMERIC DEFAULT 0, selling_price NUMERIC, avg_cost NUMERIC, active BOOLEAN DEFAULT true)`);
const outside = require('../../routes/outside_items');
const posBills = require('../../routes/pos_bills');
let role = 'admin';
const app = express(); app.use(express.json()); app.use((req, _r, n) => { req.session = { user: { role, username: 't' } }; n(); });
app.use('/api', outside); app.use('/api', posBills);
const pool = new pg.Pool();
const stock = async c => Number((await pool.query(`SELECT stock_level FROM products WHERE item_code=$1`, [c])).rows[0].stock_level);
const cost = async c => Number((await pool.query(`SELECT avg_cost FROM products WHERE item_code=$1`, [c])).rows[0].avg_cost);
beforeAll(() => new Promise(r => setTimeout(r, 600)));
beforeEach(() => { jest.spyOn(console, 'warn').mockImplementation(() => {}); });

test('check(): profit or cost, no loss, empty boxes refused', () => {
  expect(outside.check({ name: 'A', qty: 1, price: 100, profit: 30 }).cost).toBe(70);
  expect(outside.check({ name: 'A', qty: 1, price: 100, cost: 60 }).profit).toBe(40);
  expect(outside.check({ name: 'A', qty: 1, price: 100, cost: 120 }).error).toMatch(/No loss/);
  expect(outside.check({ name: 'A', qty: 1, price: 100, profit: -5 }).error).toMatch(/No loss/);
  expect(outside.check({ name: '', qty: 1, price: 100, profit: 1 }).error).toBeTruthy();
  expect(outside.check({ name: 'A', qty: 1, price: 100 }).error).toMatch(/profit or the cost/);
});

test('only owner/admin may use it', async () => {
  role = 'cashier';
  expect((await request(app).post('/api/outside-items').send({ name: 'X', qty: 1, price: 10, profit: 1 })).status).toBe(403);
  role = 'admin';
});

test('sell 2 outside items, repeat one: codes reused, stock 0 after the bill, profit right, real cost recalculates', async () => {
  const a1 = (await request(app).post('/api/outside-items').send({ name: 'Brass Mixer', qty: 2, price: 1000, profit: 300 })).body;
  const b1 = (await request(app).post('/api/outside-items').send({ name: 'Wall Hook', qty: 1, price: 500, cost: 400 })).body;
  const a2 = (await request(app).post('/api/outside-items').send({ name: '  brass   mixer ', qty: 1, price: 1100, profit: 350 })).body;
  expect([a1.item_code, b1.item_code, a2.item_code]).toEqual(['OUT-001', 'OUT-002', 'OUT-001']);
  expect(await stock('OUT-001')).toBe(3); expect(await stock('OUT-002')).toBe(1);
  expect(await cost('OUT-001')).toBe(750);
  const neg = await request(app).post('/api/outside-items').send({ name: 'Loss Item', qty: 1, price: 100, cost: 150 });
  expect(neg.status).toBe(400);

  const bill = await request(app).post('/api/pos-bills').send({ items: [
    { item_name: 'Brass Mixer', item_code: 'OUT-001', qty: 3, unit_price: 1100 },
    { item_name: 'Wall Hook', item_code: 'OUT-002', qty: 1, unit_price: 500 }], payment_method: 'cash' });
  if (bill.status !== 200) console.log('BILLERR', JSON.stringify(bill.body));
  expect(bill.status).toBe(200);
  expect(await stock('OUT-001')).toBe(0); expect(await stock('OUT-002')).toBe(0);
  const lines = (await pool.query(`SELECT item_code, qty, unit_price, unit_cost FROM pos_bill_items ORDER BY id`)).rows;
  const profit = lines.reduce((s, l) => s + Number(l.qty) * (Number(l.unit_price) - Number(l.unit_cost)), 0);
  expect(profit).toBe(3 * (1100 - 750) + (500 - 400));   // 1150

  const pend = (await request(app).get('/api/outside-items/pending')).body;
  expect(pend.pending.length).toBe(3); expect(pend.overdue).toBe(0);
  const bad = await request(app).post('/api/outside-items/' + a2.pending_id + '/real-cost').send({ cost: 800, reason: '' });
  expect(bad.status).toBe(400);
  const ok = (await request(app).post('/api/outside-items/' + a2.pending_id + '/real-cost').send({ cost: 800, reason: 'supplier bill 55' })).body;
  expect(ok.lines_updated).toBe(1); expect(ok.profit_change).toBe(-150);   // 3 pieces, cost 750 -> 800
  expect(Number((await pool.query(`SELECT unit_cost FROM pos_bill_items WHERE item_code='OUT-001'`)).rows[0].unit_cost)).toBe(800);
  expect(await cost('OUT-001')).toBe(800);
  expect((await request(app).post('/api/outside-items/' + a2.pending_id + '/real-cost').send({ cost: 900, reason: 'again' })).status).toBe(409);
  const info = await outside.auditInfo(pool);
  expect(info.pending).toBe(2); expect(info.stock_not_zero).toEqual([]);
});

test('auditor flags a pending cost older than 2 days', async () => {
  await pool.query(`UPDATE outside_cost_pending SET created_at = created_at - INTERVAL '3 days' WHERE id = 2`);
  const info = await outside.auditInfo(pool);
  expect(info.overdue.map(x => x.id)).toEqual([2]);
});
