'use strict';
// POS cheque / credit bills on the Cheques and Credit & Aging screens (read side), and the quotation "already billed" marker.
jest.mock('pg', () => require('../helpers/pgmock')());

const express = require('express');
const request = require('supertest');
const pg = require('pg');

const db = pg.__db.public;
db.none(`CREATE TABLE daily_summary (report_date DATE PRIMARY KEY, total_sale NUMERIC)`);
db.none(`CREATE TABLE discount_rules (id SERIAL PRIMARY KEY, role VARCHAR(30) NOT NULL DEFAULT 'all', max_discount_pct NUMERIC(5,2) NOT NULL, notes TEXT, active BOOLEAN NOT NULL DEFAULT TRUE)`);
db.none(`CREATE TABLE customers (id SERIAL PRIMARY KEY, name VARCHAR(100), phone VARCHAR(30))`);
db.none(`CREATE TABLE credit_customers (id SERIAL PRIMARY KEY, customer_id INT, amount NUMERIC(12,2), paid NUMERIC(12,2) DEFAULT 0)`);
db.none(`INSERT INTO credit_customers (customer_id, amount, paid) VALUES (1, 5000, 1000)`);
db.none(`INSERT INTO customers (name, phone) VALUES ('Nimal', '0771234567')`);
const posBills = require('../../routes/pos_bills');
const corrections = require('../../routes/pos_bill_corrections');
const bridge = require('../../routes/pos_ledger_bridge');

const app = express();
app.use(express.json());
app.use((req, _res, next) => { const role = req.get('x-role'); if (role) req.session = { user: { role, username: 'tester' } }; next(); });
app.use('/api', posBills);
app.use('/api', corrections);
app.use('/api', bridge);

beforeAll(() => new Promise(r => setTimeout(r, 600)));

const admin = { post: (u, b) => request(app).post(u).set('x-role', 'admin').send(b) };
const ITEMS = [{ item_name: 'Tap', qty: 2, unit_price: 500 }];   // total 1000
const chq = async () => { const r = await request(app).get('/api/pos-ledger/cheques'); if (!Array.isArray(r.body)) throw new Error(JSON.stringify(r.body)); return r.body; };
const crd = async () => (await request(app).get('/api/pos-ledger/credit')).body;
const agingSum = () => Number(db.many('SELECT SUM(amount - paid) AS s FROM credit_customers')[0].s);

describe('(a) a cheque bill appears once', () => {
  test('one cheque bill = one row, with its customer matched by phone', async () => {
    const b = (await admin.post('/api/pos-bills', { items: ITEMS, customer_name: 'Nimal', customer_phone: '0771234567', payments: [{ method: 'cheque', amount: 1000, reference: '123456 / BOC' }] })).body;
    const rows = (await chq()).filter(r => r.bill_id === b.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ amount: 1000, bill_number: b.bill_number, customer_id: 1 });
  });
});

describe('(b) registering twice is blocked', () => {
  test('first claim works, second is 409, and the row leaves the list', async () => {
    const b = (await admin.post('/api/pos-bills', { items: ITEMS, payments: [{ method: 'cheque', amount: 1000, reference: '777' }] })).body;
    const id = (await chq()).find(r => r.bill_id === b.id).payment_id;
    expect((await admin.post(`/api/pos-ledger/cheques/${id}/claim`, {})).status).toBe(200);
    expect((await admin.post(`/api/pos-ledger/cheques/${id}/claim`, {})).status).toBe(409);
    expect((await admin.post(`/api/pos-ledger/cheques/${id}/done`, { cheque_id: 9 })).status).toBe(200);
    expect((await admin.post(`/api/pos-ledger/cheques/${id}/release`, {})).status).toBe(200);   // a finished one is never released
    expect((await admin.post(`/api/pos-ledger/cheques/${id}/claim`, {})).status).toBe(409);
    expect((await chq()).some(r => r.payment_id === id)).toBe(false);
  });
  test('a failed create gives the claim back so it can be tried again', async () => {
    const b = (await admin.post('/api/pos-bills', { items: ITEMS, payments: [{ method: 'cheque', amount: 1000, reference: '888' }] })).body;
    const id = (await chq()).find(r => r.bill_id === b.id).payment_id;
    await admin.post(`/api/pos-ledger/cheques/${id}/claim`, {});
    await admin.post(`/api/pos-ledger/cheques/${id}/release`, {});
    expect((await admin.post(`/api/pos-ledger/cheques/${id}/claim`, {})).status).toBe(200);
  });
});

describe('(c) a credit bill shows in its own section; old aging totals do not move', () => {
  test('credit part listed with a per-customer total, credit_customers untouched', async () => {
    const before = agingSum(), rowsBefore = Number(db.many('SELECT COUNT(*) AS n FROM credit_customers')[0].n);
    await admin.post('/api/pos-bills', { items: ITEMS, customer_name: 'Kamal', customer_phone: '0712223344', payments: [{ method: 'credit', amount: 1000 }] });
    await admin.post('/api/pos-bills', { items: ITEMS, customer_name: 'Kamal', customer_phone: '0712223344', payments: [{ method: 'credit', amount: 1000 }] });
    const c = await crd();
    expect(c.customers.find(x => x.phone === '0712223344')).toMatchObject({ total: 2000, bills: 2 });
    expect(agingSum()).toBe(before);
    expect(Number(db.many('SELECT COUNT(*) AS n FROM credit_customers')[0].n)).toBe(rowsBefore);
  });
});

describe('(d) voided bills never show', () => {
  test('void a cheque bill and a credit bill: both lists drop them', async () => {
    const ch = (await admin.post('/api/pos-bills', { items: ITEMS, payments: [{ method: 'cheque', amount: 1000, reference: '999' }] })).body;
    const cr = (await admin.post('/api/pos-bills', { items: ITEMS, customer_name: 'Void Vi', payments: [{ method: 'credit', amount: 1000 }] })).body;
    expect((await chq()).some(r => r.bill_id === ch.id)).toBe(true);
    await admin.post(`/api/pos-bills/${ch.id}/void`, { reason: 'wrong' });
    await admin.post(`/api/pos-bills/${cr.id}/void`, { reason: 'wrong' });
    expect((await chq()).some(r => r.bill_id === ch.id)).toBe(false);
    expect((await crd()).bills.some(r => r.bill_number === cr.bill_number)).toBe(false);
  });
});

describe('(e) a split bill shows only its cheque or credit part', () => {
  test('cash 400 + cheque 600: the cheque list says 600; cash 300 + credit 700: the credit list says 700', async () => {
    const s1 = (await admin.post('/api/pos-bills', { items: ITEMS, payments: [{ method: 'cash', amount: 400 }, { method: 'cheque', amount: 600, reference: '555' }] })).body;
    const s2 = (await admin.post('/api/pos-bills', { items: ITEMS, customer_name: 'Split Sam', payments: [{ method: 'cash', amount: 300 }, { method: 'credit', amount: 700 }] })).body;
    expect((await chq()).filter(r => r.bill_id === s1.id).map(r => r.amount)).toEqual([600]);
    expect((await crd()).bills.filter(r => r.bill_number === s2.bill_number).map(r => r.amount)).toEqual([700]);
  });
});

describe('quotation already billed', () => {
  test('a bill saved from a quotation is marked; a voided one frees it again', async () => {
    const b = (await admin.post('/api/pos-bills', { items: ITEMS, quotation_id: 42, payments: [{ method: 'cash', amount: 1000 }] })).body;
    expect((await request(app).get('/api/pos-ledger/quotation-billed')).body['42']).toBe(b.bill_number);
    await admin.post(`/api/pos-bills/${b.id}/void`, { reason: 'wrong' });
    expect((await request(app).get('/api/pos-ledger/quotation-billed')).body['42']).toBeUndefined();
  });
});
