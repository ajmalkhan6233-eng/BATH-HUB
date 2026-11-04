'use strict';
// POS: discount cap (the owner's discount rule), opt-in stock deduction, today's bills (Sri Lanka date).
jest.mock('pg', () => require('../helpers/pgmock')());
// Fixed clock (08:00 UTC = 13:30 in Colombo): pg-mem stamps rows in UTC, so between 00:00 and 05:30 Colombo time the bills fell on the
// previous UTC day and "today's bills" came back empty. Only Date is faked; timers stay real.
jest.useFakeTimers({ now: new Date('2026-10-04T08:00:00Z'), doNotFake: ['nextTick', 'setImmediate', 'clearImmediate', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask', 'performance', 'hrtime', 'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback'] });

const express = require('express');
const request = require('supertest');
const pg = require('pg');

const db = pg.__db.public;
db.none(`CREATE TABLE discount_rules (id SERIAL PRIMARY KEY, role VARCHAR(30) NOT NULL DEFAULT 'all', max_discount_pct NUMERIC(5,2) NOT NULL, notes TEXT, active BOOLEAN NOT NULL DEFAULT true)`);
db.none(`CREATE TABLE products (id SERIAL PRIMARY KEY, item_code TEXT, name TEXT, stock_level NUMERIC DEFAULT 0, active BOOLEAN DEFAULT true)`);
db.none(`INSERT INTO products (item_code, name, stock_level) VALUES ('1001', 'Marble Tile', 100), ('1002', 'Basin', 10)`);
const router = require('../../routes/pos_bills');

function appAs(role) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.session = role ? { user: { role } } : undefined; next(); });
  app.use('/api', router);
  return app;
}
const bill = (app, over = {}) => request(app).post('/api/pos-bills').send({ items: [{ item_name: 'Marble Tile', qty: 2, unit_price: 5000 }], ...over });
const stock = code => Number(db.many(`SELECT stock_level FROM products WHERE item_code = '${code}'`)[0].stock_level);
const billCount = () => Number(db.many('SELECT COUNT(*) AS n FROM pos_bills')[0].n);

beforeAll(() => new Promise(r => setTimeout(r, 250)));          // the route runs its migrations in order

describe('discount cap', () => {
  test('no rule: no cap (as before)', async () => {
    expect((await bill(appAs('staff'), { discount_pct: 40 })).status).toBe(200);
    const cap = (await request(appAs('staff')).get('/api/pos-bills/discount-cap')).body;
    expect(cap).toEqual({ max_allowed: null, can_override: false });
  });

  test("with a rule for 'all' (10%): within the cap is fine, over it is refused and nothing is saved", async () => {
    db.none(`INSERT INTO discount_rules (role, max_discount_pct) VALUES ('all', 10)`);
    const staff = appAs('staff');
    expect((await bill(staff, { discount_pct: 10 })).status).toBe(200);          // exactly at the cap
    const before = billCount();
    const r = await bill(staff, { discount_pct: 12 });
    expect(r.status).toBe(409);
    expect(r.body).toMatchObject({ code: 'discount_over_cap', max_allowed: 10, can_override: false });
    expect(r.body.error).toMatch(/12%.*10%/);
    expect(billCount()).toBe(before);                                            // no bill was created
    expect((await bill(staff, { discount_pct: 0 })).status).toBe(200);           // no discount, no cap check
  });

  test('a rule for the cashier role wins over the rule for all; inactive rules are ignored', async () => {
    db.none(`INSERT INTO discount_rules (role, max_discount_pct) VALUES ('staff', 5)`);
    db.none(`INSERT INTO discount_rules (role, max_discount_pct, active) VALUES ('staff', 1, false)`);
    const staff = appAs('staff');
    expect((await request(staff).get('/api/pos-bills/discount-cap')).body.max_allowed).toBe(5);
    expect((await bill(staff, { discount_pct: 7 })).status).toBe(409);
    expect((await bill(staff, { discount_pct: 5 })).status).toBe(200);
    // the owner is on the 'all' rule (10%): a different role, a different cap
    expect((await request(appAs('admin')).get('/api/pos-bills/discount-cap')).body).toEqual({ max_allowed: 10, can_override: true });
  });

  test('the owner can approve a discount above the cap, and it is recorded; nobody else can', async () => {
    const admin = appAs('admin');
    const refused = await bill(admin, { discount_pct: 15 });
    expect(refused.status).toBe(409);
    expect(refused.body.can_override).toBe(true);
    expect(refused.body.error).toMatch(/approve it as the owner/);

    const ok = await bill(admin, { discount_pct: 15, override: true });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ discount_override: true });
    expect(Number(ok.body.discount_pct)).toBe(15);

    const within = await bill(admin, { discount_pct: 8, override: true });          // an override flag on a normal discount is not recorded
    expect(within.body.discount_override).toBe(false);

    expect((await bill(appAs('staff'), { discount_pct: 15, override: true })).status).toBe(409);
    expect((await bill(appAs(null), { discount_pct: 15, override: true })).status).toBe(409);
    expect((await bill(admin, { discount_pct: 15, override: 'yes' })).status).toBe(409);    // only a real true counts
  });

  test('bad percentages are still 400 before any cap talk', async () => {
    expect((await bill(appAs('admin'), { discount_pct: 101 })).status).toBe(400);
    expect((await bill(appAs('admin'), { discount_pct: -1 })).status).toBe(400);
  });

  test('a missing discount_rules table means no cap, not an error', async () => {
    db.none('DROP TABLE discount_rules');
    expect((await bill(appAs('staff'), { discount_pct: 30 })).status).toBe(200);
    expect((await request(appAs('staff')).get('/api/pos-bills/discount-cap')).body.max_allowed).toBeNull();
  });
});

describe('stock deduction (POS_DEDUCT_STOCK, off by default)', () => {
  afterEach(() => { delete process.env.POS_DEDUCT_STOCK; });
  const withCodes = (qty1 = 3, qty2 = 1) => ({ items: [
    { item_name: 'Marble Tile', item_code: '1001', qty: qty1, unit_price: 5000 },
    { item_name: 'Basin', item_code: '1002', qty: qty2, unit_price: 9000 },
    { item_name: 'Delivery (typed by hand)', qty: 1, unit_price: 500 },
  ] });

  test('off: stock is untouched, the item code is still saved on the line', async () => {
    const r = await bill(appAs('admin'), withCodes());
    expect(r.status).toBe(200);
    expect(r.body.stock_deducted).toBe(false);
    expect(stock('1001')).toBe(100);
    expect(r.body.items.map(i => i.item_code)).toEqual(['1001', '1002', null]);
  });

  test('on: catalogue items go down by the quantity sold; typed items are not stock', async () => {
    process.env.POS_DEDUCT_STOCK = 'true';
    const r = await bill(appAs('admin'), withCodes(3, 2));
    expect(r.status).toBe(200);
    expect(r.body.stock_deducted).toBe(true);
    expect(stock('1001')).toBe(97);
    expect(stock('1002')).toBe(8);
  });

  test('on: a bill that fails does not touch stock', async () => {
    process.env.POS_DEDUCT_STOCK = 'true';
    const r = await bill(appAs('admin'), { items: [{ item_name: 'Marble Tile', item_code: '1001', qty: 5, unit_price: 5000 }, { item_name: '', qty: 1, unit_price: 1 }] });
    expect(r.status).toBe(400);
    expect(stock('1001')).toBe(97);
  });

  test('on: selling more than is in stock is allowed (a warning on the page, never a block) and shows as oversold', async () => {
    process.env.POS_DEDUCT_STOCK = 'true';
    expect((await bill(appAs('admin'), { items: [{ item_name: 'Basin', item_code: '1002', qty: 20, unit_price: 9000 }] })).status).toBe(200);
    expect(stock('1002')).toBe(-12);
  });
});

describe("today's bills", () => {
  test("lists today's bills (Colombo date) with totals, newest first", async () => {
    const { todayLK } = require('../../utils/lkTime');
    const r = await request(appAs('admin')).get('/api/pos-bills/today');
    expect(r.status).toBe(200);
    expect(r.body.date).toBe(todayLK());
    expect(r.body.count).toBeGreaterThan(3);
    expect(r.body.bills[0].id).toBeGreaterThan(r.body.bills[r.body.bills.length - 1].id);
    expect(r.body.total).toBeCloseTo(r.body.bills.reduce((a, b) => a + b.total, 0), 2);
    expect(r.body.bills.some(b => b.discount_override === true)).toBe(true);
  });
  test('"today" is not mistaken for a bill id', async () => {
    expect((await request(appAs('admin')).get('/api/pos-bills/today')).body).toHaveProperty('bills');
  });
});
