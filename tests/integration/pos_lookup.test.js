'use strict';
// POS bill search (date / text filters) and best sellers computed from the bills' own line items.
jest.mock('pg', () => require('../helpers/pgmock')());

const express = require('express');
const request = require('supertest');
const pg = require('pg');
const router = require('../../routes/pos_bills');

const app = express();
app.use(express.json());
app.use('/api', router);

const db = pg.__db.public;
const bill = (id, no, at, name, phone, total) =>
  db.none(`INSERT INTO pos_bills (id, bill_number, customer_name, customer_phone, subtotal, total, created_at) VALUES (${id}, '${no}', ${name ? `'${name}'` : 'NULL'}, ${phone ? `'${phone}'` : 'NULL'}, ${total}, ${total}, '${at}')`);
const item = (billId, name, qty, unit) =>
  db.none(`INSERT INTO pos_bill_items (bill_id, item_name, qty, unit_price, line_total) VALUES (${billId}, '${name}', ${qty}, ${unit}, ${qty * unit})`);

beforeAll(async () => {
  await new Promise(r => setTimeout(r, 80));
  bill(1, 'BHT-20261001-0001', '2026-10-01 10:00:00', 'Kamal Perera', '0771234567', 27000);
  bill(2, 'BHT-20261001-0002', '2026-10-01 15:00:00', null, null, 9000);
  bill(3, 'BHT-20261002-0001', '2026-10-02 11:00:00', 'Sunil Silva', '0712223334', 25000);
  item(1, 'Floor Tile 60x60', 6, 4500);        // 27000
  item(2, 'Basin Mixer Tap', 1, 9000);         // 9000
  item(3, 'Floor Tile 60x60', 4, 4500);        // 18000
  item(3, 'Towel Rail', 2, 3500);              // 7000
});

describe('GET /api/pos-bills filters', () => {
  test('no filter: everything, newest first', async () => {
    const r = await request(app).get('/api/pos-bills');
    expect(r.body.map(b => b.bill_number)).toEqual(['BHT-20261002-0001', 'BHT-20261001-0002', 'BHT-20261001-0001']);
  });
  test('by day', async () => {
    const r = await request(app).get('/api/pos-bills?date=2026-10-01');
    expect(r.body.map(b => b.bill_number)).toEqual(['BHT-20261001-0002', 'BHT-20261001-0001']);
  });
  test('by text: customer name (any case), phone, or bill number', async () => {
    expect((await request(app).get('/api/pos-bills?q=KAMAL')).body.map(b => b.id)).toEqual([1]);
    expect((await request(app).get('/api/pos-bills?q=0712223')).body.map(b => b.id)).toEqual([3]);
    expect((await request(app).get('/api/pos-bills?q=20261001-0002')).body.map(b => b.id)).toEqual([2]);
    expect((await request(app).get('/api/pos-bills?q=nobody')).body).toEqual([]);
  });
  test('day and text together; bad date is 400', async () => {
    expect((await request(app).get('/api/pos-bills?date=2026-10-01&q=silva')).body).toEqual([]);
    expect((await request(app).get('/api/pos-bills?date=2026-10-02&q=silva')).body.map(b => b.id)).toEqual([3]);
    expect((await request(app).get('/api/pos-bills?date=tomorrow')).status).toBe(400);
  });
});

describe('GET /api/pos-bills/top-items', () => {
  test('units and revenue per item, biggest revenue first', async () => {
    const r = await request(app).get('/api/pos-bills/top-items?from=2026-10-01&to=2026-10-31');
    expect(r.status).toBe(200);
    expect(r.body.items).toEqual([
      { item_name: 'Floor Tile 60x60', units: 10, revenue: 45000, bills: 2 },
      { item_name: 'Basin Mixer Tap', units: 1, revenue: 9000, bills: 1 },
      { item_name: 'Towel Rail', units: 2, revenue: 7000, bills: 1 },
    ]);
  });
  test('date range limits it; limit trims it', async () => {
    const day2 = await request(app).get('/api/pos-bills/top-items?from=2026-10-02&to=2026-10-02');
    expect(day2.body.items.map(i => i.item_name)).toEqual(['Floor Tile 60x60', 'Towel Rail']);
    expect(day2.body.items[0]).toMatchObject({ units: 4, revenue: 18000 });
    expect((await request(app).get('/api/pos-bills/top-items?from=2026-10-01&to=2026-10-31&limit=1')).body.items).toHaveLength(1);
  });
  test('an empty period is an empty list; bad input is 400; defaults to the last 30 days', async () => {
    expect((await request(app).get('/api/pos-bills/top-items?from=2025-01-01&to=2025-01-31')).body.items).toEqual([]);
    expect((await request(app).get('/api/pos-bills/top-items?from=x&to=y')).status).toBe(400);
    expect((await request(app).get('/api/pos-bills/top-items?from=2026-10-05&to=2026-10-01')).status).toBe(400);
    const d = await request(app).get('/api/pos-bills/top-items');
    expect(d.status).toBe(200);
    expect(d.body.from <= d.body.to).toBe(true);
  });
  test('"top-items" is not mistaken for a bill id', async () => {
    expect((await request(app).get('/api/pos-bills/top-items')).body).toHaveProperty('items');
  });
});
