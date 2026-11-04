'use strict';
// Near-duplicate item names ("Floor Tile 60x60" vs "floor-tile 60 x 60") are caught; genuinely different items are not.
jest.mock('pg', () => require('../helpers/pgmock')());

const express = require('express');
const request = require('supertest');
const pg = require('pg');

pg.__db.public.none(`CREATE TABLE products (id SERIAL PRIMARY KEY, item_code TEXT, name TEXT, category TEXT, stock_level NUMERIC DEFAULT 0,
  reorder_threshold NUMERIC DEFAULT 0, selling_price NUMERIC DEFAULT 0, avg_cost NUMERIC DEFAULT 0, photo_url TEXT, active BOOLEAN DEFAULT true)`);
const router = require('../../routes/item_catalog');
const app = express();
app.use(express.json());
app.use('/api', router);

const add = name => request(app).post('/api/items').send({ name });

describe('duplicate item names', () => {
  test('the first one is saved', async () => {
    expect((await add('Floor Tile 60x60')).status).toBe(201);
  });

  test.each([
    'floor tile 60x60', 'FLOOR TILE 60X60', 'Floor-Tile 60x60', 'Floor Tile 60 x 60', '  Floor   Tile  60x60 ', 'Floor Tile, 60x60',
  ])('"%s" is the same item (409, names the existing code)', async (variant) => {
    const r = await add(variant);
    expect(r.status).toBe(409);
    expect(r.body.error).toMatch(/Floor Tile 60x60/);
    expect(r.body.error).toMatch(/001/);
  });

  test('different sizes or names are different items', async () => {
    expect((await add('Floor Tile 30x60')).status).toBe(201);
    expect((await add('Wall Tile 60x60')).status).toBe(201);
    expect((await add('Floor Tile 60x60 Matt')).status).toBe(201);
  });

  test('Sinhala / Tamil names compare by their letters', async () => {
    expect((await add('මාලු ටයිල් 60x60')).status).toBe(201);
    expect((await add('මාලු  ටයිල් 60 x 60')).status).toBe(409);
    expect((await add('தரை ஓடு 60x60')).status).toBe(201);
    expect((await add('தரை ஓடு')).status).toBe(201);     // no size: a different name
  });

  test('words that differ only by a vowel sign are NOT treated as the same item', async () => {
    expect((await add('මාල')).status).toBe(201);
    expect((await add('මාලු')).status).toBe(201);          // differs from the one above by a vowel sign
    expect((await add('தரை')).status).toBe(201);
    expect((await add('தரு')).status).toBe(201);
  });

  test('an inactive item does not block the name', async () => {
    pg.__db.public.none(`UPDATE products SET active = false WHERE name = 'Wall Tile 60x60'`);
    expect((await add('wall tile 60x60')).status).toBe(201);
  });
});
