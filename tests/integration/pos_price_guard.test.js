'use strict';
// Price guard: the server refuses a price below the allowed floor unless the owner approves. Fake data only.
jest.mock('pg', () => require('../helpers/pgmock')());
const express = require('express');
const request = require('supertest');
const pg = require('pg');
const db = pg.__db.public;
db.none(`CREATE TABLE discount_rules (id SERIAL PRIMARY KEY, role VARCHAR(30) NOT NULL DEFAULT 'all', max_discount_pct NUMERIC(5,2) NOT NULL, notes TEXT, active BOOLEAN NOT NULL DEFAULT true)`);
db.none(`CREATE TABLE products (id SERIAL PRIMARY KEY, item_code TEXT, name TEXT, stock_level NUMERIC DEFAULT 0, selling_price NUMERIC DEFAULT 0, avg_cost NUMERIC DEFAULT 0, active BOOLEAN DEFAULT true)`);
db.none(`INSERT INTO products (item_code, name, stock_level, selling_price, avg_cost) VALUES ('A1','Basin',10,1000,600),('B2','Tap',10,500,0)`);
const router = require('../../routes/pos_bills');
const appAs = role => { const a = express(); a.use(express.json()); a.use((q, _r, n) => { q.session = { user: { role } }; n(); }); a.use('/api', router); return a; };
const bill = (app, items, over = {}) => request(app).post('/api/pos-bills').send({ items, ...over });
beforeAll(() => new Promise(r => setTimeout(r, 250)));

describe('price guard, with an owner discount rule of 10%', () => {
  beforeAll(() => db.none(`INSERT INTO discount_rules (role, max_discount_pct) VALUES ('all', 10)`));
  test('normal price passes', async () => { expect((await bill(appAs('cashier'), [{ item_name: 'Basin', item_code: 'A1', qty: 1, unit_price: 1000 }])).status).toBe(200); });
  test('exactly the floor (900) passes', async () => { expect((await bill(appAs('cashier'), [{ item_name: 'Basin', item_code: 'A1', qty: 1, unit_price: 900 }])).status).toBe(200); });
  test('cashier price 1 is refused (409) and nothing is saved', async () => {
    const n = Number(db.many('SELECT COUNT(*) AS n FROM pos_bills')[0].n);
    const r = await bill(appAs('cashier'), [{ item_name: 'Basin', item_code: 'A1', qty: 1, unit_price: 1 }, { item_name: 'x', qty: 1, unit_price: 5000 }]);
    expect(r.status).toBe(409); expect(r.body.code).toBe('discount_over_cap'); expect(r.body.can_override).toBe(false);
    expect(Number(db.many('SELECT COUNT(*) AS n FROM pos_bills')[0].n)).toBe(n);
  });
  test('cashier cannot override even with override:true', async () => {
    expect((await bill(appAs('cashier'), [{ item_name: 'Basin', item_code: 'A1', qty: 1, unit_price: 500 }], { override: true })).status).toBe(409);
  });
  test('owner is asked, then can approve with override:true', async () => {
    const it = [{ item_name: 'Basin', item_code: 'A1', qty: 1, unit_price: 500 }];
    const a = await bill(appAs('owner'), it); expect(a.status).toBe(409); expect(a.body.can_override).toBe(true);
    expect((await bill(appAs('owner'), it, { override: true })).status).toBe(200);
  });
  test('price plus bill discount counts together (900 less 10% = 810 is refused)', async () => {
    expect((await bill(appAs('cashier'), [{ item_name: 'Basin', item_code: 'A1', qty: 1, unit_price: 900 }], { discount_pct: 10 })).status).toBe(409);
  });
  test('price 0 line is refused for a cashier even without an item code', async () => {
    expect((await bill(appAs('cashier'), [{ item_name: 'Gift', qty: 1, unit_price: 0 }, { item_name: 'x', qty: 1, unit_price: 100 }])).status).toBe(409);
  });
  test('item with no code is not price-checked (only 0 is)', async () => { expect((await bill(appAs('cashier'), [{ item_name: 'Odd job', qty: 1, unit_price: 50 }])).status).toBe(200); });
});

describe('payment method must match the payment details', () => {
  test('credit without payment details is refused (400)', async () => {
    const r = await bill(appAs('cashier'), [{ item_name: 'x', qty: 1, unit_price: 100 }], { payment_method: 'credit' });
    expect(r.status).toBe(400); expect(r.body.code).toBe('payments_required');
  });
  test('free text method is refused (400)', async () => {
    expect((await bill(appAs('cashier'), [{ item_name: 'x', qty: 1, unit_price: 100 }], { payment_method: 'hello' })).status).toBe(400);
  });
  test('card passes', async () => { expect((await bill(appAs('cashier'), [{ item_name: 'x', qty: 1, unit_price: 100 }], { payment_method: 'card' })).status).toBe(200); });
});
