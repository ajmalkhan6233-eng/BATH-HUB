'use strict';
// Item vendor code: the vendor's own code is stored next to OUR code (001, 002...), never replaces it.
jest.mock('pg', () => require('../helpers/pgmock')());
const express = require('express');
const request = require('supertest');
const pg = require('pg');
pg.__db.public.none(`CREATE TABLE products (
  id SERIAL PRIMARY KEY, item_code TEXT, name TEXT, category TEXT, stock_level NUMERIC DEFAULT 0,
  reorder_threshold NUMERIC DEFAULT 0, selling_price NUMERIC DEFAULT 0, avg_cost NUMERIC DEFAULT 0, photo_url TEXT, active BOOLEAN DEFAULT true)`);
const catalog = require('../../routes/item_catalog');
const app = express(); app.use(express.json()); app.use('/api', catalog);

test('a new item keeps our code and stores the vendor code beside it', async () => {
  await catalog.schemaReady;
  const r = await request(app).post('/api/items').send({ name: 'Basin mixer chrome', vendor_code: ' BM-2210 ' });
  expect(r.status).toBe(201);
  expect(r.body.item_code).toBe('001');
  expect(r.body.vendor_code).toBe('BM-2210');
});
test('no vendor code is fine (stored empty)', async () => {
  const r = await request(app).post('/api/items').send({ name: 'Soap dish' });
  expect(r.status).toBe(201);
  expect(r.body.vendor_code).toBeNull();
});
test('a vendor code is cut to 60 characters', async () => {
  const r = await request(app).post('/api/items').send({ name: 'Long code item', vendor_code: 'X'.repeat(90) });
  expect(r.body.vendor_code.length).toBe(60);
});
