'use strict';
// POS bill corrections (void / edit / history): admin only, valid input, bad input, a database failure.
jest.mock('pg', () => require('../helpers/pgmock')());

const express = require('express');
const request = require('supertest');
const posBills = require('../../routes/pos_bills');                 // creates the bill tables
const corrections = require('../../routes/pos_bill_corrections');
const pool = require('../../utils/pool');

const app = express();
app.use(express.json());
app.use((req, res, next) => { const role = req.get('x-role'); if (role) req.session = { user: { role, username: 'tester' } }; next(); });
app.use('/api', posBills);
app.use('/api', corrections);

beforeAll(() => new Promise(r => setTimeout(r, 600)));
afterEach(() => jest.restoreAllMocks());

const as = role => ({
  get: u => request(app).get(u).set('x-role', role),
  post: (u, b) => request(app).post(u).set('x-role', role).send(b),
  put: (u, b) => request(app).put(u).set('x-role', role).send(b),
});
const admin = as('admin');
const newBill = async (qty = 2, price = 500) => (await admin.post('/api/pos-bills', { items: [{ item_name: 'Tap', qty, unit_price: price }] })).body;

describe('who may correct a bill', () => {
  test.each([['staff'], ['owner']])('the %s role is refused (403) on void, edit and history', async role => {
    const b = await newBill(), u = as(role);
    expect((await u.post(`/api/pos-bills/${b.id}/void`, { reason: 'mistake' })).status).toBe(403);
    expect((await u.put(`/api/pos-bills/${b.id}`, { items: [{ item_name: 'Tap', qty: 1, unit_price: 1 }] })).status).toBe(403);
    expect((await u.get(`/api/pos-bills/${b.id}/history`)).status).toBe(403);
  });
  test('with no session at all it is also refused', async () => {
    expect((await request(app).post('/api/pos-bills/1/void').send({ reason: 'mistake' })).status).toBe(403);
  });
});

describe('edit', () => {
  test('a valid edit recalculates the totals and writes a history row', async () => {
    const b = await newBill();
    const r = await admin.put(`/api/pos-bills/${b.id}`, { items: [{ item_name: 'Tap', qty: 3, unit_price: 400 }], discount_pct: 10, reason: 'qty fix' });
    expect(r.status).toBe(200); expect(Number(r.body.subtotal)).toBe(1200); expect(Number(r.body.total)).toBe(1080); expect(r.body.edited_by).toBe('tester');
    const h = await admin.get(`/api/pos-bills/${b.id}/history`);
    expect(h.status).toBe(200); expect(h.body.map(x => x.action)).toEqual(['edit']);
  });
  test.each([
    ['no items', { items: [] }],
    ['blank item name', { items: [{ item_name: ' ', qty: 1, unit_price: 1 }] }],
    ['zero qty', { items: [{ item_name: 'X', qty: 0, unit_price: 1 }] }],
    ['negative price', { items: [{ item_name: 'X', qty: 1, unit_price: -1 }] }],
    ['discount over 100', { items: [{ item_name: 'X', qty: 1, unit_price: 1 }], discount_pct: 120 }],
    ['zero total', { items: [{ item_name: 'X', qty: 1, unit_price: 0 }] }],
  ])('%s is a 400', async (_n, body) => {
    const b = await newBill();
    expect((await admin.put(`/api/pos-bills/${b.id}`, body)).status).toBe(400);
  });
  test('an unknown bill is 404; a void bill cannot be edited (409)', async () => {
    const ok = { items: [{ item_name: 'X', qty: 1, unit_price: 5 }] };
    expect((await admin.put('/api/pos-bills/99999', ok)).status).toBe(404);
    expect((await admin.put('/api/pos-bills/abc', ok)).status).toBe(404);
    const b = await newBill(); await admin.post(`/api/pos-bills/${b.id}/void`, { reason: 'wrong customer' });
    expect((await admin.put(`/api/pos-bills/${b.id}`, ok)).status).toBe(409);
  });
});

describe('void', () => {
  test('a valid void marks the bill void and keeps a history row; a second void is 409', async () => {
    const b = await newBill();
    const r = await admin.post(`/api/pos-bills/${b.id}/void`, { reason: 'customer cancelled' });
    expect(r.status).toBe(200); expect(r.body).toMatchObject({ ok: true, status: 'VOID', voided_by: 'tester' });
    expect((await admin.post(`/api/pos-bills/${b.id}/void`, { reason: 'again please' })).status).toBe(409);
    expect((await admin.get(`/api/pos-bills/${b.id}/history`)).body.map(x => x.action)).toEqual(['void']);
  });
  test('a missing, tiny or huge reason is a 400; an unknown bill is 404', async () => {
    const b = await newBill();
    expect((await admin.post(`/api/pos-bills/${b.id}/void`, {})).status).toBe(400);
    expect((await admin.post(`/api/pos-bills/${b.id}/void`, { reason: 'x' })).status).toBe(400);
    expect((await admin.post(`/api/pos-bills/${b.id}/void`, { reason: 'x'.repeat(501) })).status).toBe(400);
    expect((await admin.post('/api/pos-bills/99999/void', { reason: 'no such bill' })).status).toBe(404);
  });
});

describe('history', () => {
  test('a bill with no corrections has an empty history; a non-numeric id is 404', async () => {
    const b = await newBill();
    expect((await admin.get(`/api/pos-bills/${b.id}/history`)).body).toEqual([]);
    expect((await admin.get('/api/pos-bills/abc/history')).status).toBe(404);
  });
});

describe('database failure', () => {
  const dead = () => ({ query: jest.fn().mockRejectedValue(new Error('db down')), release: jest.fn() });
  test('void: 500 with a message, client released', async () => {
    const c = dead(); jest.spyOn(pool, 'connect').mockResolvedValueOnce(c);
    const r = await admin.post('/api/pos-bills/1/void', { reason: 'testing failure' });
    expect(r.status).toBe(500); expect(r.body.error).toMatch(/Could not void the bill: db down/); expect(c.release).toHaveBeenCalled();
  });
  test('edit: 500 with a message, client released', async () => {
    const c = dead(); jest.spyOn(pool, 'connect').mockResolvedValueOnce(c);
    const r = await admin.put('/api/pos-bills/1', { items: [{ item_name: 'X', qty: 1, unit_price: 5 }] });
    expect(r.status).toBe(500); expect(r.body.error).toMatch(/Could not edit the bill: db down/); expect(c.release).toHaveBeenCalled();
  });
  test('history: 500', async () => {
    jest.spyOn(pool, 'query').mockRejectedValueOnce(new Error('db down'));
    const r = await admin.get('/api/pos-bills/1/history');
    expect(r.status).toBe(500); expect(r.body.error).toMatch(/db down/);
  });
});
