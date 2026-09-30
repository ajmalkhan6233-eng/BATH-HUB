'use strict';
// Item lookup: search by name/code, filter by category / low stock; never returns the cost price.
jest.mock('pg', () => require('../helpers/pgmock')());

const express = require('express');
const request = require('supertest');
const pg = require('pg');

const db = pg.__db.public;
db.none(`CREATE TABLE products (id SERIAL PRIMARY KEY, item_code TEXT, name TEXT, category TEXT, stock_level NUMERIC DEFAULT 0,
  reorder_threshold NUMERIC DEFAULT 0, selling_price NUMERIC DEFAULT 0, avg_cost NUMERIC DEFAULT 0, photo_url TEXT, active BOOLEAN DEFAULT true)`);
db.none(`INSERT INTO products (item_code, name, category, stock_level, reorder_threshold, selling_price, avg_cost, active) VALUES
  ('001','Floor Tile 60x60','Tiles',120,20,4500,2999,true),
  ('002','Wall Tile 30x60','Tiles',5,10,3200,1888,true),
  ('003','Basin Mixer Tap','Taps',8,3,12500,7777,true),
  ('004','Old Discontinued Tile','Tiles',0,0,1000,500,false)`);
const router = require('../../routes/item_catalog');
const app = express();
app.use(express.json());
app.use('/api', router);

describe('GET /api/items', () => {
  test('lists active items, newest code order, without cost price', async () => {
    const r = await request(app).get('/api/items');
    expect(r.status).toBe(200);
    expect(r.body.map(i => i.item_code)).toEqual(['001', '002', '003']);     // 004 is inactive
    expect(JSON.stringify(r.body)).not.toMatch(/avg_cost|2999|1888|7777/);
    expect(r.body[0]).toMatchObject({ name: 'Floor Tile 60x60', category: 'Tiles', low_stock: false });
    expect(Number(r.body[0].selling_price)).toBe(4500);
  });

  test('search by part of the name (any case) or of the code', async () => {
    expect((await request(app).get('/api/items?q=TILE')).body.map(i => i.item_code)).toEqual(['001', '002']);
    expect((await request(app).get('/api/items?q=mixer')).body.map(i => i.item_code)).toEqual(['003']);
    expect((await request(app).get('/api/items?q=002')).body.map(i => i.item_code)).toEqual(['002']);
    expect((await request(app).get('/api/items?q=nothing-like-this')).body).toEqual([]);
  });

  test('category filter and low-stock filter', async () => {
    expect((await request(app).get('/api/items?category=Taps')).body.map(i => i.item_code)).toEqual(['003']);
    const low = (await request(app).get('/api/items?low=1')).body;
    expect(low.map(i => i.item_code)).toEqual(['002']);                      // 5 <= 10
    expect(low[0].low_stock).toBe(true);
  });

  test('limit is respected and capped', async () => {
    expect((await request(app).get('/api/items?limit=2')).body).toHaveLength(2);
    expect((await request(app).get('/api/items?limit=abc')).status).toBe(200);
  });

  test('one item by code; unknown or inactive codes are 404', async () => {
    const ok = await request(app).get('/api/items/003');
    expect(ok.status).toBe(200);
    expect(ok.body.name).toBe('Basin Mixer Tap');
    expect(JSON.stringify(ok.body)).not.toMatch(/avg_cost|7777/);
    expect((await request(app).get('/api/items/999')).status).toBe(404);
    expect((await request(app).get('/api/items/004')).status).toBe(404);
  });

  test('next-code still works (not swallowed by /items/:code)', async () => {
    const r = await request(app).get('/api/items/next-code');
    expect(r.status).toBe(200);
    expect(r.body).toHaveProperty('next_code');
  });
});
