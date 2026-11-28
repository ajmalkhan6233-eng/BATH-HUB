'use strict';
// Outside items, tested alone through the REAL pos_bills and void routes: stock nets to 0 (stock deduction ON and OFF),
// profit is right, real cost recalculates, a voided or dropped bill keeps stock at 0, the cashier switch is OFF by default.
process.env.POS_DEDUCT_STOCK = 'true';
jest.mock('pg', () => require('../helpers/pgmock')());
const express = require('express');
const request = require('supertest');
const pg = require('pg');
const db = pg.__db.public;
db.none(`CREATE TABLE daily_summary (report_date DATE PRIMARY KEY, total_sale NUMERIC)`);
db.none(`CREATE TABLE discount_rules (id SERIAL PRIMARY KEY, role VARCHAR(30) NOT NULL DEFAULT 'all', max_discount_pct NUMERIC(5,2) NOT NULL, notes TEXT, active BOOLEAN NOT NULL DEFAULT true)`);
db.none(`CREATE TABLE products (id SERIAL PRIMARY KEY, item_code TEXT, name TEXT, category TEXT, stock_level NUMERIC DEFAULT 0, reorder_threshold NUMERIC DEFAULT 0, selling_price NUMERIC, avg_cost NUMERIC, active BOOLEAN DEFAULT true)`);
db.none(`CREATE TABLE app_settings (key TEXT PRIMARY KEY, value JSONB, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_by TEXT)`);
db.none(`CREATE TABLE credit_customers (id SERIAL PRIMARY KEY, invoice_no TEXT, amount NUMERIC DEFAULT 0, paid NUMERIC DEFAULT 0, notes TEXT)`);
db.none(`CREATE TABLE stock_movements (id SERIAL PRIMARY KEY, item_code TEXT NOT NULL, qty_change NUMERIC(12,2) NOT NULL, reason TEXT NOT NULL, ref_type TEXT, ref_id TEXT, note TEXT, created_by TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
const outside = require('../../routes/outside_items');
const posBills = require('../../routes/pos_bills');
const corrections = require('../../routes/pos_bill_corrections');
const settings = require('../../utils/appSettings');
let role = 'admin';
const app = express(); app.use(express.json()); app.use((req, _r, n) => { req.session = { user: { role, username: 't' } }; n(); });
app.use('/api', outside); app.use('/api', posBills); app.use('/api', corrections);
const pool = new pg.Pool();
const stock = async c => Number((await pool.query(`SELECT stock_level FROM products WHERE item_code=$1`, [c])).rows[0].stock_level);
const cost = async c => Number((await pool.query(`SELECT avg_cost FROM products WHERE item_code=$1`, [c])).rows[0].avg_cost);
const add = b => request(app).post('/api/outside-items').send(b);
const bill = items => request(app).post('/api/pos-bills').send({ items, payment_method: 'cash' });
beforeAll(() => new Promise(r => setTimeout(r, 600)));
beforeEach(() => { process.env.POS_DEDUCT_STOCK = 'true'; role = 'admin'; jest.spyOn(console, 'error').mockImplementation(() => {}); jest.spyOn(console, 'warn').mockImplementation(() => {}); });

test('check(): profit or cost, no loss, empty boxes refused', () => {
  expect(outside.check({ name: 'A', qty: 1, price: 100, profit: 30 }).cost).toBe(70);
  expect(outside.check({ name: 'A', qty: 1, price: 100, cost: 60 }).profit).toBe(40);
  expect(outside.check({ name: 'A', qty: 1, price: 100, cost: 120 }).error).toMatch(/No loss/);
  expect(outside.check({ name: 'A', qty: 1, price: 100, profit: -5 }).error).toMatch(/No loss/);
  expect(outside.check({ name: '', qty: 1, price: 100, profit: 1 }).error).toBeTruthy();
  expect(outside.check({ name: 'A', qty: 1, price: 100 }).error).toMatch(/profit or the cost/);
});

test('cashier: refused by default, allowed only after the owner switches it on in Settings', async () => {
  role = 'cashier';
  expect((await request(app).get('/api/outside-items/allowed')).body.allowed).toBe(false);
  expect((await add({ name: 'Cashier Item', qty: 1, price: 10, profit: 1 })).status).toBe(403);
  await pool.query(`INSERT INTO app_settings (key, value) VALUES ('pos_outside_cashier', 'true')`); settings.clearCache();
  expect((await request(app).get('/api/outside-items/allowed')).body.allowed).toBe(true);
  expect((await add({ name: 'Cashier Item', qty: 1, price: 10, profit: 1 })).status).toBe(200);
  expect((await request(app).get('/api/outside-items/pending')).status).toBe(403);   // the cost list stays owner only
  await pool.query(`DELETE FROM app_settings WHERE key = 'pos_outside_cashier'`); settings.clearCache();
  expect((await add({ name: 'Cashier Item', qty: 1, price: 10, profit: 1 })).status).toBe(403);
});

test('stock deduction ON: sell 2 outside items, repeat one: each its own code, stock 0 after the bill, profit right, real cost recalculates', async () => {
  const a1 = (await add({ name: 'Brass Mixer', qty: 2, price: 1000, profit: 300 })).body;
  const b1 = (await add({ name: 'Wall Hook', qty: 1, price: 500, cost: 400 })).body;
  const a2 = (await add({ name: '  brass   mixer ', qty: 1, price: 1100, profit: 350 })).body;
  expect(new Set([a1.item_code, a2.item_code, b1.item_code]).size).toBe(3);
  const A = a1.item_code, A2 = a2.item_code, B = b1.item_code;
  expect(await stock(A)).toBe(2); expect(await stock(A2)).toBe(1); expect(await stock(B)).toBe(1); expect(await cost(A)).toBe(700); expect(await cost(A2)).toBe(750);
  expect((await add({ name: 'Loss Item', qty: 1, price: 100, cost: 150 })).status).toBe(400);
  const r = await bill([{ item_name: 'Brass Mixer', item_code: A, qty: 2, unit_price: 1000 }, { item_name: 'brass mixer', item_code: A2, qty: 1, unit_price: 1100 }, { item_name: 'Wall Hook', item_code: B, qty: 1, unit_price: 500 }]);
  expect(r.status).toBe(200);
  expect(await stock(A)).toBe(0); expect(await stock(A2)).toBe(0); expect(await stock(B)).toBe(0);
  const lines = (await pool.query(`SELECT qty, unit_price, unit_cost FROM pos_bill_items WHERE item_code IN ($1,$2,$3)`, [A, A2, B])).rows;
  expect(lines.reduce((s, l) => s + Number(l.qty) * (Number(l.unit_price) - Number(l.unit_cost)), 0)).toBe(2 * (1000 - 700) + (1100 - 750) + (500 - 400));   // 1050
  const bad = await request(app).post('/api/outside-items/' + a2.pending_id + '/real-cost').send({ cost: 800, reason: '' });
  expect(bad.status).toBe(400);
  const ok = (await request(app).post('/api/outside-items/' + a2.pending_id + '/real-cost').send({ cost: 800, reason: 'supplier bill 55' })).body;
  expect(ok.lines_updated).toBe(1); expect(ok.profit_change).toBe(-50);
  expect(await cost(A2)).toBe(800);
  expect((await request(app).post('/api/outside-items/' + a2.pending_id + '/real-cost').send({ cost: 900, reason: 'again' })).status).toBe(409);
  const led = (await pool.query(`SELECT SUM(qty_change)::float s FROM stock_movements WHERE item_code = $1`, [A])).rows[0].s;
  expect(led).toBe(0);   // +2 in, -2 sold: the ledger nets to 0 too
});

test('cancelled bill: a VOID gives the stock back, the outside item is taken out again so stock stays 0', async () => {
  const x = (await add({ name: 'Void Test Valve', qty: 2, price: 900, profit: 200 })).body;
  const r = await bill([{ item_name: 'Void Test Valve', item_code: x.item_code, qty: 2, unit_price: 900 }]);
  expect(r.status).toBe(200); expect(await stock(x.item_code)).toBe(0);
  const v = await request(app).post('/api/pos-bills/' + r.body.id + '/void').send({ reason: 'customer cancelled' });
  if (v.status !== 200) console.log('VOIDERR', JSON.stringify(v.body));
  expect(v.status).toBe(200);
  expect(await stock(x.item_code)).toBe(0);
  const led = (await pool.query(`SELECT SUM(qty_change)::float s FROM stock_movements WHERE item_code = $1`, [x.item_code])).rows[0].s;
  expect(led).toBe(0);
});

test('cancelled bill that was never made (cart dropped): after 12 hours the unsold qty goes back out and the entry is cancelled', async () => {
  const y = (await add({ name: 'Dropped Cart Tap', qty: 4, price: 700, profit: 100 })).body;
  expect(await stock(y.item_code)).toBe(4);
  expect(await outside.sweep(pool)).toBe(0);   // too fresh: a bill may still be on its way
  await pool.query(`UPDATE outside_cost_pending SET created_at = created_at - INTERVAL '13 hours' WHERE id = $1`, [y.pending_id]);
  expect(await outside.sweep(pool)).toBe(4);
  expect(await stock(y.item_code)).toBe(0);
  expect((await request(app).get('/api/outside-items/pending')).body.pending.map(p => p.id)).not.toContain(y.pending_id);
});

test('stock deduction OFF: the module and the sale both leave stock alone, stock is still 0, profit right', async () => {
  process.env.POS_DEDUCT_STOCK = 'false';
  const z = (await add({ name: 'No Deduct Basin', qty: 2, price: 3000, profit: 500 })).body;
  expect(z.stock_in).toBe(false); expect(await stock(z.item_code)).toBe(0);
  const r = await bill([{ item_name: 'No Deduct Basin', item_code: z.item_code, qty: 2, unit_price: 3000 }]);
  expect(r.status).toBe(200); expect(await stock(z.item_code)).toBe(0);
  const l = (await pool.query(`SELECT qty, unit_price, unit_cost FROM pos_bill_items WHERE item_code = $1`, [z.item_code])).rows[0];
  expect(Number(l.qty) * (Number(l.unit_price) - Number(l.unit_cost))).toBe(2 * 500);
  expect(await outside.sweep(pool)).toBe(0);
});

test('auditor flags a pending cost older than 2 days, and an outside item whose stock is not 0', async () => {
  const w = (await add({ name: 'Audit Item', qty: 1, price: 100, profit: 10 })).body;
  await pool.query(`UPDATE outside_cost_pending SET created_at = created_at - INTERVAL '3 days' WHERE id = $1`, [w.pending_id]);
  const info = await outside.auditInfo(pool);
  expect(info.overdue.map(x => x.id)).toContain(w.pending_id);
  expect(info.stock_not_zero.map(x => x.item_code)).toContain(w.item_code);
});
