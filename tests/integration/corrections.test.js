'use strict';
// Edit + void module on its own (in-memory database): gates, validation, void-then-edit refused, history, price_history, golden-core refusal.
jest.mock('pg', () => require('../helpers/pgmock')());

const express = require('express');
const request = require('supertest');
const { __db } = require('pg');
const router = require('../../routes/corrections');

function appAs(role) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.session = { user: { username: 'tester', role } }; next(); });
  app.use('/api/corrections', router);
  return app;
}
const admin = appAs('admin');
const q = sql => __db.public.many(sql);

beforeAll(async () => {
  __db.public.none(`CREATE TABLE suppliers (id SERIAL PRIMARY KEY, name TEXT, phone TEXT, active BOOLEAN DEFAULT TRUE, category TEXT, notes TEXT)`);
  __db.public.none(`CREATE TABLE products (id SERIAL PRIMARY KEY, item_code TEXT, name TEXT NOT NULL, category TEXT, stock_level NUMERIC DEFAULT 0, reorder_threshold NUMERIC DEFAULT 0, selling_price NUMERIC DEFAULT 0, avg_cost NUMERIC DEFAULT 0, photo_url TEXT, active BOOLEAN DEFAULT TRUE)`);
  __db.public.none(`CREATE TABLE sale_commissions (id SERIAL PRIMARY KEY, staff_id INT, entry_type VARCHAR(20), sale_date DATE, amount NUMERIC, commission_pct NUMERIC, commission_amount NUMERIC, linked_sale_id INT, reference_note TEXT, notes TEXT)`);
  __db.public.none(`CREATE TABLE discount_rules (id SERIAL PRIMARY KEY, role VARCHAR(20), max_discount_pct NUMERIC, notes TEXT, active BOOLEAN DEFAULT TRUE)`);
  __db.public.none(`CREATE TABLE daily_summary (id SERIAL PRIMARY KEY, report_date DATE, total_sale NUMERIC, cash_sale NUMERIC, card_sale NUMERIC, online_sale NUMERIC, credit_sale NUMERIC, day_status TEXT)`);
  __db.public.none(`INSERT INTO suppliers (name, phone) VALUES ('Old Vendor','0771')`);
  __db.public.none(`INSERT INTO products (item_code, name, selling_price, avg_cost) VALUES ('1001','Tile',100,60)`);
  __db.public.none(`INSERT INTO sale_commissions (staff_id, entry_type, amount, commission_pct, commission_amount) VALUES (1,'sale',1000,2,20), (1,'return_refund',1000,2,-20)`);
  __db.public.none(`INSERT INTO discount_rules (role, max_discount_pct) VALUES ('staff', 5)`);
  __db.public.none(`INSERT INTO daily_summary (report_date, total_sale, cash_sale) VALUES ('2026-01-01', 5000, 5000)`);
  await new Promise(r => setTimeout(r, 500));          // the route creates its own tables first
});

describe('corrections gates', () => {
  test.each(['staff', 'owner'])('%s gets 403 on every verb', async role => {
    const a = appAs(role);
    expect((await request(a).get('/api/corrections/suppliers')).status).toBe(403);
    expect((await request(a).put('/api/corrections/suppliers/1').send({ name: 'x' })).status).toBe(403);
    expect((await request(a).post('/api/corrections/suppliers/1/void').send({ reason: 'abc' })).status).toBe(403);
    expect((await request(a).get('/api/corrections/suppliers/1/history')).status).toBe(403);
  });
  test('unknown module is 404', async () => {
    expect((await request(admin).get('/api/corrections/nope')).status).toBe(404);
  });
});

describe('edit', () => {
  test('edit saves old row to history first, then updates', async () => {
    const r = await request(admin).put('/api/corrections/suppliers/1').send({ name: 'New Vendor', reason: 'typo' });
    expect(r.status).toBe(200);
    expect(r.body.row.name).toBe('New Vendor');
    const h = await request(admin).get('/api/corrections/suppliers/1/history');
    expect(h.body.length).toBe(1);
    expect(h.body[0]).toMatchObject({ action: 'edit', changed_by: 'tester', reason: 'typo' });
    expect(h.body[0].old_version.name).toBe('Old Vendor');
    expect(Number((await q(`SELECT COUNT(*) AS n FROM admin_audit WHERE action='correction.edit'`))[0].n)).toBeGreaterThan(0);
  });
  test('validation: blank name, bad number, nothing to change, unknown id', async () => {
    expect((await request(admin).put('/api/corrections/suppliers/1').send({ name: '  ' })).status).toBe(400);
    expect((await request(admin).put('/api/corrections/products/1').send({ selling_price: 'abc' })).status).toBe(400);
    expect((await request(admin).put('/api/corrections/products/1').send({ selling_price: -5 })).status).toBe(400);
    expect((await request(admin).put('/api/corrections/discount_rules/1').send({ max_discount_pct: 150 })).status).toBe(400);
    expect((await request(admin).put('/api/corrections/suppliers/1').send({ reason: 'x' })).status).toBe(400);
    expect((await request(admin).put('/api/corrections/suppliers/999').send({ name: 'x' })).status).toBe(404);
    expect((await request(admin).put('/api/corrections/suppliers/abc').send({ name: 'x' })).status).toBe(400);
  });
  test('a price change writes price_history; a non-price change does not', async () => {
    await request(admin).put('/api/corrections/products/1').send({ category: 'Tiles' });
    expect((await q(`SELECT * FROM price_history`)).length).toBe(0);
    const r = await request(admin).put('/api/corrections/products/1').send({ selling_price: 120, reason: 'new list' });
    expect(r.status).toBe(200);
    const ph = await q(`SELECT * FROM price_history`);
    expect(ph.length).toBe(1);
    expect(ph[0]).toMatchObject({ item_code: '1001', old_price: 100, new_price: 120, changed_by: 'tester' });
  });
  test('commission edit recomputes with the same maths; a return entry cannot be edited', async () => {
    const r = await request(admin).put('/api/corrections/commissions/1').send({ amount: 2000, commission_pct: 3 });
    expect(r.status).toBe(200);
    expect(Number(r.body.row.commission_amount)).toBe(60);
    expect((await request(admin).put('/api/corrections/commissions/2').send({ amount: 5 })).status).toBe(400);
  });
});

describe('void', () => {
  test('reason is required (3+ chars)', async () => {
    expect((await request(admin).post('/api/corrections/suppliers/1/void').send({})).status).toBe(400);
    expect((await request(admin).post('/api/corrections/suppliers/1/void').send({ reason: 'ab' })).status).toBe(400);
  });
  test('void keeps the record, then edit and second void are refused, history has both', async () => {
    const v = await request(admin).post('/api/corrections/suppliers/1/void').send({ reason: 'duplicate vendor' });
    expect(v.status).toBe(200);
    expect((await q(`SELECT * FROM suppliers`)).length).toBe(1);                       // not deleted
    expect((await request(admin).put('/api/corrections/suppliers/1').send({ name: 'again' })).status).toBe(409);
    expect((await request(admin).post('/api/corrections/suppliers/1/void').send({ reason: 'twice' })).status).toBe(409);
    const list = await request(admin).get('/api/corrections/suppliers');
    expect(list.body.rows[0]).toMatchObject({ voided: true, void_reason: 'duplicate vendor', voided_by: 'tester' });
    const h = await request(admin).get('/api/corrections/suppliers/1/history');
    expect(h.body.map(x => x.action).sort()).toEqual(['edit', 'void']);
  });
  test('voiding a discount rule also switches it off', async () => {
    expect((await request(admin).post('/api/corrections/discount_rules/1/void').send({ reason: 'not used' })).status).toBe(200);
    expect((await q(`SELECT active FROM discount_rules WHERE id=1`))[0].active).toBe(false);
  });
});

describe('golden core', () => {
  test('daily sales: read-only list, edit refused, figures untouched, void is a flag only', async () => {
    const l = await request(admin).get('/api/corrections/daily_sales');
    expect(l.status).toBe(200);
    expect(l.body.editable).toBe(false);
    expect(l.body.rows[0].total_sale).toBe(5000);
    expect((await request(admin).put('/api/corrections/daily_sales/1').send({ total_sale: 1 })).status).toBe(403);
    expect((await request(admin).post('/api/corrections/daily_sales/1/void').send({ reason: 'test day' })).status).toBe(200);
    const row = (await q(`SELECT total_sale, day_status FROM daily_summary WHERE id=1`))[0];
    expect(row).toMatchObject({ total_sale: 5000, day_status: null });
  });
  test('expenses edit is refused too (no table needed)', async () => {
    expect((await request(admin).put('/api/corrections/expenses/1').send({ amount: 1 })).status).toBe(403);
  });
  test('investor loans: edit refused here (existing PUT is used), void path exists', async () => {
    expect((await request(admin).put('/api/corrections/investor_loans/1').send({ amount: 1 })).status).toBe(403);
  });
});
