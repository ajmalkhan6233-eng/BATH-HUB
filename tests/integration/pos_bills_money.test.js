'use strict';
// POS bill money maths: printed line totals must add up to the subtotal; bad input gets a clear 400.
jest.mock('pg', () => require('../helpers/pgmock')());

const express = require('express');
const request = require('supertest');
const router = require('../../routes/pos_bills');

const app = express();
app.use(express.json());
app.use('/api', router);

beforeAll(() => new Promise(r => setTimeout(r, 500)));   // let the route's CREATE TABLEs finish

const post = body => request(app).post('/api/pos-bills').send(body);

describe('POS bill totals', () => {
  test('subtotal is the sum of the rounded line totals (was off by a cent)', async () => {
    // 1.5 x 33.33 = 49.995 -> 50.00 per line; two lines print 100.00
    const r = await post({ items: [{ item_name: 'Tile A', qty: 1.5, unit_price: 33.33 }, { item_name: 'Tile B', qty: 1.5, unit_price: 33.33 }] });
    expect(r.status).toBe(200);
    const lineSum = r.body.items.reduce((s, i) => s + Number(i.line_total), 0);
    expect(Number(r.body.subtotal)).toBeCloseTo(lineSum, 2);
    expect(Number(r.body.subtotal)).toBe(100);
    expect(Number(r.body.total)).toBe(100);
  });

  test('discount is taken from the rounded subtotal and total = subtotal - discount', async () => {
    const r = await post({ items: [{ item_name: 'Basin', qty: 1, unit_price: 12345.67 }], discount_pct: 7.5 });
    expect(r.status).toBe(200);
    expect(Number(r.body.subtotal)).toBe(12345.67);
    expect(Number(r.body.discount_amount)).toBe(925.93);            // 12345.67 x 7.5% = 925.92525
    expect(Number(r.body.total)).toBe(11419.74);
    expect(Number(r.body.subtotal) - Number(r.body.discount_amount)).toBeCloseTo(Number(r.body.total), 2);
  });

  test('bill numbers are sequential per day', async () => {
    const a = (await post({ items: [{ item_name: 'X', qty: 1, unit_price: 10 }] })).body.bill_number;
    const b = (await post({ items: [{ item_name: 'X', qty: 1, unit_price: 10 }] })).body.bill_number;
    expect(Number(b.split('-').pop())).toBe(Number(a.split('-').pop()) + 1);
  });

  test('rejects bad input with a clear 400', async () => {
    const ok = { item_name: 'X', qty: 1, unit_price: 10 };
    expect((await post({ items: [] })).status).toBe(400);
    expect((await post({ items: [{ ...ok, item_name: '   ' }] })).status).toBe(400);
    expect((await post({ items: [{ ...ok, qty: 0 }] })).status).toBe(400);
    expect((await post({ items: [{ ...ok, unit_price: -5 }] })).status).toBe(400);
    expect((await post({ items: [{ ...ok, unit_price: 1e15 }] })).status).toBe(400);
    expect((await post({ items: [{ ...ok, item_name: 'x'.repeat(201) }] })).status).toBe(400);
    expect((await post({ items: [ok], discount_pct: 101 })).status).toBe(400);
    expect((await post({ items: [ok], customer_name: 'n'.repeat(151) })).status).toBe(400);
    expect((await post({ items: [{ ...ok, unit_price: 0 }] })).status).toBe(400);   // bill total must be > 0
    expect((await post({ items: Array(101).fill(ok) })).status).toBe(400);
  });

  test('a non-numeric bill id is "not found", not a server error', async () => {
    expect((await request(app).get('/api/pos-bills/abc')).status).toBe(404);
    expect((await request(app).get('/api/pos-bills/99999')).status).toBe(404);
  });
});
