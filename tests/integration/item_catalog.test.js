'use strict';
// Item catalog: sequential codes, and a web request cannot switch off the duplicate-name check.
jest.mock('pg', () => require('../helpers/pgmock')());

const express = require('express');
const request = require('supertest');
const pg = require('pg');

pg.__db.public.none(`CREATE TABLE products (
  id SERIAL PRIMARY KEY, item_code TEXT, name TEXT, category TEXT, stock_level NUMERIC DEFAULT 0,
  reorder_threshold NUMERIC DEFAULT 0, selling_price NUMERIC DEFAULT 0, avg_cost NUMERIC DEFAULT 0, photo_url TEXT, active BOOLEAN DEFAULT true)`);
const router = require('../../routes/item_catalog');

const app = express();
app.use(express.json());
app.use('/api', router);

describe('POST /api/items', () => {
  test('codes are sequential: 001, 002, ...', async () => {
    const a = await request(app).post('/api/items').send({ name: 'Floor tile 60x60', selling_price: 4500 });
    const b = await request(app).post('/api/items').send({ name: 'Wall tile 30x60' });
    expect(a.status).toBe(201);
    expect(a.body.item_code).toBe('001');
    expect(b.body.item_code).toBe('002');
  });

  test('a duplicate name is refused (409)', async () => {
    const r = await request(app).post('/api/items').send({ name: 'floor tile 60X60' });
    expect(r.status).toBe(409);
  });

  test('allowDuplicate in the request body does NOT bypass the duplicate check', async () => {
    const r = await request(app).post('/api/items').send({ name: 'Floor tile 60x60', allowDuplicate: true });
    expect(r.status).toBe(409);
    const n = pg.__db.public.many(`SELECT COUNT(*) AS n FROM products WHERE LOWER(name) = 'floor tile 60x60'`)[0].n;
    expect(Number(n)).toBe(1);
  });

  test('a photo_url in the request body is ignored (only an uploaded photo can set it)', async () => {
    const r = await request(app).post('/api/items').send({ name: 'Towel rail', photo_url: 'https://evil.example/x.jpg' });
    expect(r.status).toBe(201);
    expect(r.body.photo_url).toBeNull();
  });

  test('bad numbers and blank names are refused', async () => {
    expect((await request(app).post('/api/items').send({ name: '  ' })).status).toBe(400);
    expect((await request(app).post('/api/items').send({ name: 'Bad price', selling_price: -1 })).status).toBe(400);
    expect((await request(app).post('/api/items').send({ name: 'Bad cost', avg_cost: 'free' })).status).toBe(400);
  });
});
