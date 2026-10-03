'use strict';
// Manual GRN: valid delivery, restock of an existing item, bad input (nothing saved), and a database failure (rolled back).
jest.mock('pg', () => require('../helpers/pgmock')());

const express = require('express');
const request = require('supertest');
const pg = require('pg');
const db = pg.__db.public;
db.none(`CREATE TABLE products (id SERIAL PRIMARY KEY, item_code TEXT, name TEXT, category TEXT, stock_level NUMERIC DEFAULT 0,
  reorder_threshold NUMERIC DEFAULT 0, selling_price NUMERIC DEFAULT 0, avg_cost NUMERIC DEFAULT 0, photo_url TEXT, active BOOLEAN DEFAULT true)`);
db.none(`CREATE TABLE grn_records (id SERIAL PRIMARY KEY, grn_number TEXT, supplier_id INT, supplier_name TEXT, grn_date DATE, item_description TEXT, quantity NUMERIC, unit_cost NUMERIC, total_amount NUMERIC, source_file_path TEXT, status TEXT DEFAULT 'PENDING_REVIEW', notes TEXT)`);
const router = require('../../routes/grn_manual');
const pool = require('../../utils/pool');
const app = express(); app.use(express.json()); app.use('/api', router);

afterEach(() => jest.restoreAllMocks());
const send = payload => request(app).post('/api/grn-manual').field('payload', typeof payload === 'string' ? payload : JSON.stringify(payload));
const ok = { supplier_name: 'Lanka Tiles', grn_date: '2026-10-03', lines: [{ name: 'Floor tile A', qty: 10, unit_cost: 1500 }] };
const rows = () => db.many('SELECT * FROM grn_records');

describe('valid GRN', () => {
  test('creates a new item with the next code, a GRN number, and a PENDING_REVIEW row', async () => {
    const r = await send(ok);
    expect(r.status).toBe(201);
    expect(r.body.grn_number).toBe('MG-20261003-01'); expect(r.body.total).toBe(15000);
    expect(r.body.items[0]).toMatchObject({ name: 'Floor tile A', qty: 10, is_new: true });
    expect(r.body.items[0].item_code).toMatch(/^\d{3,}$/);
    expect(rows()[0].status).toBe('PENDING_REVIEW');
  });
  test('the same item again restocks it (no new code) and the next GRN number is 02', async () => {
    const before = db.many(`SELECT * FROM products WHERE name = 'Floor tile A'`)[0];
    const r = await send(ok);
    expect(r.status).toBe(201); expect(r.body.grn_number).toBe('MG-20261003-02'); expect(r.body.items[0].is_new).toBe(false);
    const after = db.many(`SELECT * FROM products WHERE name = 'Floor tile A'`)[0];
    expect(Number(after.stock_level)).toBe(Number(before.stock_level) + 10); expect(after.item_code).toBe(before.item_code);
  });
});

describe('bad input saves nothing', () => {
  test.each([
    ['unreadable form data', 'not json'],
    ['no supplier', { ...ok, supplier_name: '  ' }],
    ['bad date', { ...ok, grn_date: '3 Oct' }],
    ['no lines', { ...ok, lines: [] }],
    ['blank item name', { ...ok, lines: [{ name: ' ', qty: 1, unit_cost: 1 }] }],
    ['zero quantity', { ...ok, lines: [{ name: 'X1', qty: 0, unit_cost: 1 }] }],
    ['negative cost', { ...ok, lines: [{ name: 'X2', qty: 1, unit_cost: -1 }] }],
    ['51 rows', { ...ok, lines: Array.from({ length: 51 }, (_, i) => ({ name: 'R' + i, qty: 1, unit_cost: 1 })) }],
  ])('%s is a 400 and no GRN row is written', async (_n, body) => {
    const before = rows().length;
    const r = await send(body);
    expect(r.status).toBe(400); expect(r.body.error).toBeTruthy(); expect(rows().length).toBe(before);
  });
  test('the same item listed twice is a 400 (the all-or-nothing rollback itself is Postgres: pg-mem cannot roll back)', async () => {
    const r = await send({ ...ok, lines: [{ name: 'Dup', qty: 1, unit_cost: 1 }, { name: 'dup', qty: 1, unit_cost: 1 }] });
    expect(r.status).toBe(400); expect(r.body.error).toMatch(/listed twice/);
  });
  test('a valid first row followed by an invalid row saves neither (all or nothing)', async () => {
    const before = rows().length;
    const r = await send({ ...ok, lines: [{ name: 'Good row', qty: 1, unit_cost: 1 }, { name: 'Bad row', qty: 0, unit_cost: 1 }] });
    expect(r.status).toBe(400); expect(rows().length).toBe(before);
    expect(db.many(`SELECT * FROM products WHERE name = 'Good row'`).length).toBe(0);
  });
});

describe('database failure', () => {
  test('a failed connection gives a 500 saying nothing was saved, and the client is released', async () => {
    const release = jest.fn();
    jest.spyOn(pool, 'connect').mockResolvedValueOnce({ query: jest.fn().mockRejectedValue(new Error('db down')), release });
    const r = await send(ok);
    expect(r.status).toBe(500); expect(r.body.error).toMatch(/nothing was saved/); expect(release).toHaveBeenCalled();
  });
});
