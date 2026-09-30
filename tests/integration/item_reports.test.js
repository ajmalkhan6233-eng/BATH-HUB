'use strict';
// Reorder suggestions and the stock-take sheet (CSV) for the item catalogue.
jest.mock('pg', () => require('../helpers/pgmock')());

const express = require('express');
const request = require('supertest');
const pg = require('pg');

const db = pg.__db.public;
db.none(`CREATE TABLE products (id SERIAL PRIMARY KEY, item_code TEXT, name TEXT, category TEXT, stock_level NUMERIC DEFAULT 0,
  reorder_threshold NUMERIC DEFAULT 0, selling_price NUMERIC DEFAULT 0, avg_cost NUMERIC DEFAULT 0, photo_url TEXT, active BOOLEAN DEFAULT true)`);
db.none(`INSERT INTO products (item_code, name, category, stock_level, reorder_threshold, avg_cost, active) VALUES
  ('001','Floor Tile 60x60','Tiles',120,20,2999,true),
  ('002','Wall Tile 30x60','Tiles',5,10,1888,true),
  ('003','Basin Mixer Tap','Taps',8,3,7777,true),
  ('004','Retired Tile','Tiles',0,5,100,false),
  ('005','Towel Rail','Accessories',0,4,500,true),
  ('006','=HYPERLINK("http://evil.example","x")','Tiles',50,5,100,true),
  ('007','Drain, "Chrome"','Accessories',12,4,100,true)`);
const router = require('../../routes/item_catalog');
const app = express();
app.use(express.json());
app.use('/api', router);

describe('GET /api/items/reorder', () => {
  test('only low active items, most urgent first, with a suggested order quantity', async () => {
    const r = await request(app).get('/api/items/reorder');
    expect(r.status).toBe(200);
    expect(r.body.map(i => i.item_code)).toEqual(['002', '005']);       // 004 is inactive; 001/003/006/007 are fine
    expect(r.body[0]).toEqual({ item_code: '002', name: 'Wall Tile 30x60', category: 'Tiles', stock_level: 5, reorder_threshold: 10, suggested_order_qty: 15 });
    expect(r.body[1].suggested_order_qty).toBe(8);                        // 0 in stock, level 4 -> top up to 8
    expect(JSON.stringify(r.body)).not.toMatch(/avg_cost|2999|1888/);
  });

  test('"reorder" is not mistaken for an item code', async () => {
    expect(Array.isArray((await request(app).get('/api/items/reorder')).body)).toBe(true);
  });
});

describe('GET /api/items/export.csv', () => {
  test('a stock-take sheet with an empty Counted column, no cost', async () => {
    const r = await request(app).get('/api/items/export.csv');
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toMatch(/text\/csv/);
    expect(r.headers['content-disposition']).toMatch(/stock-take\.csv/);
    const lines = r.text.trim().split('\r\n');
    expect(lines[0]).toBe('"Code","Name","Category","System stock","Counted"');
    expect(lines).toContain('"001","Floor Tile 60x60","Tiles","120",""');
    expect(r.text).not.toContain('Retired Tile');
    expect(r.text).not.toMatch(/2999|7777|avg_cost/);
  });

  test('names that start with = are neutralised and quotes are escaped', async () => {
    const r = await request(app).get('/api/items/export.csv');
    expect(r.text).toContain(`"'=HYPERLINK(""http://evil.example"",""x"")"`);
    expect(r.text).toContain('"Drain, ""Chrome"""');
    expect(r.text).not.toMatch(/(^|,)"=/m);
  });
});
