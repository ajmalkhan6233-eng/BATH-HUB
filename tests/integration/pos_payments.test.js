'use strict';
// POS payment types: cash (unchanged), split, cheque, credit. Server rules + how daily_sales_live.js counts them.
jest.mock('pg', () => require('../helpers/pgmock')());

const express = require('express');
const request = require('supertest');
const pg = require('pg');

const db = pg.__db.public;
db.none(`CREATE TABLE daily_summary (report_date DATE PRIMARY KEY, total_sale NUMERIC)`);
db.none(`CREATE TABLE discount_rules (id SERIAL PRIMARY KEY, role VARCHAR(30) NOT NULL DEFAULT 'all', max_discount_pct NUMERIC(5,2) NOT NULL, notes TEXT, active BOOLEAN NOT NULL DEFAULT true)`);
const posBills = require('../../routes/pos_bills');
const corrections = require('../../routes/pos_bill_corrections');
const live = require('../../routes/daily_sales_live');

const app = express();
app.use(express.json());
app.use((req, _res, next) => { const role = req.get('x-role'); if (role) req.session = { user: { role, username: 'tester' } }; next(); });
app.use('/api', posBills);
app.use('/api', corrections);
app.use('/api', live);

beforeAll(() => new Promise(r => setTimeout(r, 600)));         // the routes run their migrations in order

const admin = { post: (u, b) => request(app).post(u).set('x-role', 'admin').send(b), put: (u, b) => request(app).put(u).set('x-role', 'admin').send(b) };
const staff = { post: (u, b) => request(app).post(u).set('x-role', 'staff').send(b) };
const ITEMS = [{ item_name: 'Tap', qty: 2, unit_price: 500 }];           // total 1000
const billCount = () => Number(db.many('SELECT COUNT(*) AS n FROM pos_bills')[0].n);
// Put a bill on a fixed day so the daily-sales read does not depend on the clock.
const onDay = (id, day) => db.none(`UPDATE pos_bills SET created_at = '${day} 10:00:00' WHERE id = ${id}`);
const day = async d => (await request(app).get('/api/daily-sales-live/' + d)).body;

describe('(a) a cash bill is unchanged', () => {
  test('no payments sent: payment_method stays as sent, no payment rows, counted as cash', async () => {
    const b = (await admin.post('/api/pos-bills', { items: ITEMS, payment_method: 'cash' })).body;
    expect(b.payment_method).toBe('cash');
    expect(b.payments).toEqual([]);
    expect(Number(db.many(`SELECT COUNT(*) AS n FROM pos_bill_payments WHERE bill_id = ${b.id}`)[0].n)).toBe(0);
    onDay(b.id, '2026-09-01');
    expect(await day('2026-09-01')).toMatchObject({ sale: 1000, bills_count: 1, pay: { cash: 1000, credit: 0, cheque: 0 } });
  });
  test('an old bill row (card, no payment rows) still reads as card', async () => {
    db.none(`INSERT INTO pos_bills (bill_number, subtotal, discount_pct, discount_amount, total, payment_method, created_at) VALUES ('OLD-1', 700, 0, 0, 700, 'card', '2026-09-02 09:00:00')`);
    expect(await day('2026-09-02')).toMatchObject({ sale: 700, pay: { card: 700, cash: 0 } });
  });
  test('one payment of the full total in cash: same as a plain cash bill (method cash, one row)', async () => {
    const r = await admin.post('/api/pos-bills', { items: ITEMS, payments: [{ method: 'cash', amount: 1000 }] });
    expect(r.status).toBe(200);
    expect(r.body.payment_method).toBe('cash');
    expect(r.body.payments).toEqual([{ method: 'cash', amount: 1000, reference: null }]);
  });
});

describe('(b) a split bill adds up to the total, never over or under', () => {
  test('cash 600 + card 400 on 1000: saved as split with two rows, counted per method', async () => {
    const b = (await admin.post('/api/pos-bills', { items: ITEMS, payments: [{ method: 'cash', amount: 600 }, { method: 'card', amount: 400 }] })).body;
    expect(b.payment_method).toBe('split');
    expect(b.payments.map(p => p.amount).reduce((a, c) => a + c, 0)).toBe(Number(b.total));
    onDay(b.id, '2026-09-03');
    expect(await day('2026-09-03')).toMatchObject({ sale: 1000, bills_count: 1, pay: { cash: 600, card: 400 } });
  });
  test.each([[900], [1100], [1000.01]])('payments adding to %s on a 1000 bill are refused and nothing is saved', async sum => {
    const before = billCount();
    const r = await admin.post('/api/pos-bills', { items: ITEMS, payments: [{ method: 'cash', amount: sum - 100 }, { method: 'card', amount: 100 }] });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('payments_mismatch');
    expect(billCount()).toBe(before);
  });
  test('cents: 3 x 33.34 = 100.02 split 50.01 + 50.01 is accepted, 50 + 50.01 is not', async () => {
    const items = [{ item_name: 'Washer', qty: 3, unit_price: 33.335 }];
    expect((await admin.post('/api/pos-bills', { items, payments: [{ method: 'cash', amount: 50.01 }, { method: 'online', amount: 50.01 }] })).status).toBe(200);
    expect((await admin.post('/api/pos-bills', { items, payments: [{ method: 'cash', amount: 50 }, { method: 'online', amount: 50.01 }] })).status).toBe(400);
  });
  test('bad input: unknown method, zero amount, empty list', async () => {
    expect((await admin.post('/api/pos-bills', { items: ITEMS, payments: [{ method: 'bitcoin', amount: 1000 }] })).status).toBe(400);
    expect((await admin.post('/api/pos-bills', { items: ITEMS, payments: [{ method: 'cash', amount: 0 }, { method: 'card', amount: 1000 }] })).status).toBe(400);
    expect((await admin.post('/api/pos-bills', { items: ITEMS, payments: [] })).status).toBe(400);
  });
});

describe('cheque and credit rules', () => {
  test('a cheque needs its number or bank/date; with it the bill is saved and counted as cheque', async () => {
    expect((await admin.post('/api/pos-bills', { items: ITEMS, payments: [{ method: 'cheque', amount: 1000 }] })).status).toBe(400);
    const b = (await admin.post('/api/pos-bills', { items: ITEMS, payments: [{ method: 'cheque', amount: 1000, reference: 'No 004512 Sampath 2026-10-30' }] })).body;
    expect(b.payment_method).toBe('cheque');
    expect(b.payments[0].reference).toMatch(/004512/);
    onDay(b.id, '2026-09-04');
    expect(await day('2026-09-04')).toMatchObject({ sale: 1000, pay: { cheque: 1000, cash: 0 } });
  });
  test('a credit bill needs a customer name or phone', async () => {
    const r = await admin.post('/api/pos-bills', { items: ITEMS, payments: [{ method: 'credit', amount: 1000 }] });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('credit_needs_customer');
  });
});

describe('(c) a credit bill is not counted as cash received', () => {
  test('credit 700 + cash 300: cash bucket 300, credit bucket 700', async () => {
    const b = (await admin.post('/api/pos-bills', { customer_name: 'Mr Perera', items: ITEMS, payments: [{ method: 'cash', amount: 300 }, { method: 'credit', amount: 700 }] })).body;
    onDay(b.id, '2026-09-05');
    const d = await day('2026-09-05');
    expect(d.pay.cash).toBe(300);
    expect(d.pay.credit).toBe(700);
    expect(d.sale).toBe(1000);
  });
  test('a fully credit bill: cash is 0', async () => {
    const b = (await admin.post('/api/pos-bills', { customer_phone: '0771234567', items: ITEMS, payments: [{ method: 'credit', amount: 1000 }] })).body;
    onDay(b.id, '2026-09-06');
    expect(await day('2026-09-06')).toMatchObject({ sale: 1000, pay: { credit: 1000, cash: 0 } });
  });
});

describe('(d) a voided split or credit bill is left out', () => {
  test('void a split and a credit bill: the day goes back to the plain bill only', async () => {
    const keep = (await admin.post('/api/pos-bills', { items: ITEMS, payment_method: 'cash' })).body;
    const split = (await admin.post('/api/pos-bills', { items: ITEMS, payments: [{ method: 'cash', amount: 500 }, { method: 'card', amount: 500 }] })).body;
    const cred = (await admin.post('/api/pos-bills', { customer_name: 'X', items: ITEMS, payments: [{ method: 'credit', amount: 1000 }] })).body;
    [keep, split, cred].forEach(b => onDay(b.id, '2026-09-07'));
    expect(await day('2026-09-07')).toMatchObject({ sale: 3000, bills_count: 3 });
    expect((await admin.post(`/api/pos-bills/${split.id}/void`, { reason: 'wrong card' })).status).toBe(200);
    expect((await admin.post(`/api/pos-bills/${cred.id}/void`, { reason: 'customer left' })).status).toBe(200);
    expect(await day('2026-09-07')).toMatchObject({ sale: 1000, bills_count: 1, pay: { cash: 1000, card: 0, credit: 0 } });
  });
});

describe('(e) the discount cap is still enforced', () => {
  test('staff over the cap with payments: 409 and nothing saved; within the cap is saved with the discounted total', async () => {
    db.none(`INSERT INTO discount_rules (role, max_discount_pct) VALUES ('all', 10)`);
    const before = billCount();
    const over = await staff.post('/api/pos-bills', { items: ITEMS, discount_pct: 20, payments: [{ method: 'cash', amount: 800 }] });
    expect(over.status).toBe(409);
    expect(over.body.code).toBe('discount_over_cap');
    expect(billCount()).toBe(before);
    const ok = await staff.post('/api/pos-bills', { items: ITEMS, discount_pct: 10, payments: [{ method: 'cash', amount: 400 }, { method: 'card', amount: 500 }] });
    expect(ok.status).toBe(200);
    expect(Number(ok.body.total)).toBe(900);                     // payments must match the DISCOUNTED total
    expect((await staff.post('/api/pos-bills', { items: ITEMS, discount_pct: 10, payments: [{ method: 'cash', amount: 1000 }] })).status).toBe(400);
  });
});

describe('editing', () => {
  test('a bill with payment rows cannot be edited (409); a plain cash bill still can', async () => {
    const split = (await admin.post('/api/pos-bills', { items: ITEMS, payments: [{ method: 'cash', amount: 500 }, { method: 'card', amount: 500 }] })).body;
    const e1 = await admin.put('/api/pos-bills/' + split.id, { items: ITEMS, payment_method: 'cash' });
    expect(e1.status).toBe(409);
    expect(e1.body.code).toBe('has_payment_rows');
    const plain = (await admin.post('/api/pos-bills', { items: ITEMS, payment_method: 'cash' })).body;
    const e2 = await admin.put('/api/pos-bills/' + plain.id, { items: [{ item_name: 'Tap', qty: 3, unit_price: 500 }], payment_method: 'card' });
    expect(e2.status).toBe(200);
  });
});
