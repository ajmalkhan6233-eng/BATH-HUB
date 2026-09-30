'use strict';
// Shop operations: stock upsert must not wipe fields; adjustments must match their reason; limits are range-checked.
jest.mock('pg', () => require('../helpers/pgmock')());

const express = require('express');
const request = require('supertest');
const router = require('../../routes/shop_operations');

const app = express();
app.use(express.json());
app.use('/api', router);

beforeAll(() => new Promise(r => setTimeout(r, 80)));   // let the route's CREATE TABLEs finish

describe('stock items', () => {
  test('editing only the notes keeps the existing unit and reorder level', async () => {
    const a = await request(app).post('/api/stock-items').send({ item_name: 'Basin mixer', unit: 'box', current_qty: 12, reorder_level: 5 });
    expect(a.status).toBe(200);
    const b = await request(app).post('/api/stock-items').send({ item_name: 'Basin mixer', notes: 'supplier changed' });
    expect(b.status).toBe(200);
    const items = (await request(app).get('/api/stock-items')).body;
    const item = items.find(i => i.item_name === 'Basin mixer');
    expect(item).toMatchObject({ unit: 'box', notes: 'supplier changed' });
    expect(Number(item.reorder_level)).toBe(5);
    expect(Number(item.current_qty)).toBe(12);
  });

  test('a new item gets the defaults', async () => {
    await request(app).post('/api/stock-items').send({ item_name: 'Soap dish' });
    const item = (await request(app).get('/api/stock-items')).body.find(i => i.item_name === 'Soap dish');
    expect(item).toMatchObject({ unit: 'pcs' });
    expect(Number(item.current_qty)).toBe(0);
    expect(Number(item.reorder_level)).toBe(0);
  });

  test('rejects blank names and bad quantities', async () => {
    expect((await request(app).post('/api/stock-items').send({ item_name: '   ' })).status).toBe(400);
    expect((await request(app).post('/api/stock-items').send({ item_name: 'X', current_qty: -1 })).status).toBe(400);
    expect((await request(app).post('/api/stock-items').send({ item_name: 'X', reorder_level: 'lots' })).status).toBe(400);
  });

  test('adjustments: sign must match the reason, zero/garbage refused, stock moves correctly', async () => {
    const id = (await request(app).post('/api/stock-items').send({ item_name: 'Tap', current_qty: 10 })).body.id;
    const adj = (delta, reason) => request(app).post(`/api/stock-items/${id}/adjust`).send({ delta, reason });
    expect((await adj(-3, 'restock')).status).toBe(400);      // a "restock" that removes stock
    expect((await adj(4, 'sale')).status).toBe(400);          // a "sale" that adds stock
    expect((await adj(0, 'correction')).status).toBe(400);
    expect((await adj('abc', 'correction')).status).toBe(400);
    expect((await adj(null, 'correction')).status).toBe(400);
    expect((await adj(2, 'gift')).status).toBe(400);
    expect(Number((await adj(5, 'restock')).body.current_qty)).toBe(15);
    expect(Number((await adj(-2, 'sale')).body.current_qty)).toBe(13);
    expect(Number((await adj(-1, 'correction')).body.current_qty)).toBe(12);
    expect((await request(app).post('/api/stock-items/9999/adjust').send({ delta: 1, reason: 'restock' })).status).toBe(404);
  });
});

describe('discount rules and credit limits', () => {
  test('discount cap must be 0-100', async () => {
    expect((await request(app).post('/api/discount-rules').send({ max_discount_pct: 150 })).status).toBe(400);
    expect((await request(app).post('/api/discount-rules').send({ max_discount_pct: -5 })).status).toBe(400);
    expect((await request(app).post('/api/discount-rules').send({ max_discount_pct: 'abc' })).status).toBe(400);
    expect((await request(app).post('/api/discount-rules').send({ max_discount_pct: 10 })).status).toBe(200);
  });

  test('discount check validates its input and applies the cap', async () => {
    expect((await request(app).post('/api/discount-check').send({ discount_pct: 'abc' })).status).toBe(400);
    expect((await request(app).post('/api/discount-check').send({ discount_pct: -3 })).status).toBe(400);
    expect((await request(app).post('/api/discount-check').send({ discount_pct: 101 })).status).toBe(400);
    expect((await request(app).post('/api/discount-check').send({ discount_pct: 10 })).body).toMatchObject({ allowed: true, max_allowed: 10 });
    expect((await request(app).post('/api/discount-check').send({ discount_pct: 12 })).body).toMatchObject({ allowed: false, max_allowed: 10 });
  });

  test('credit limit: 0 is a valid limit, negatives and text are not; re-saving keeps the notes', async () => {
    expect((await request(app).post('/api/credit-limits').send({ customer_name: 'Kamal', credit_limit: 0 })).status).toBe(200);
    expect((await request(app).post('/api/credit-limits').send({ customer_name: 'Kamal', credit_limit: -10 })).status).toBe(400);
    expect((await request(app).post('/api/credit-limits').send({ customer_name: 'Kamal', credit_limit: 'lots' })).status).toBe(400);
    expect((await request(app).post('/api/credit-limits').send({ customer_name: '  ', credit_limit: 5 })).status).toBe(400);
    await request(app).post('/api/credit-limits').send({ customer_name: 'Sunil', credit_limit: 50000, notes: 'pays monthly' });
    await request(app).post('/api/credit-limits').send({ customer_name: 'Sunil', credit_limit: 80000 });
    const got = (await request(app).get('/api/credit-limits/Sunil')).body;
    expect(Number(got.credit_limit)).toBe(80000);
    expect(got.notes).toBe('pays monthly');
  });

  test('receipt queue rejects a bad amount', async () => {
    expect((await request(app).post('/api/receipt-queue').send({ customer_phone: '0771234567', amount: -5 })).status).toBe(400);
    expect((await request(app).post('/api/receipt-queue').send({ customer_phone: '0771234567', amount: 'x' })).status).toBe(400);
    expect((await request(app).post('/api/receipt-queue').send({ customer_phone: '0771234567', amount: 1500.5 })).status).toBe(200);
  });
});
