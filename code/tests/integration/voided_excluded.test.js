'use strict';
// Voided vendors / commissions are kept (row stays) but left out of lists and totals.
jest.mock('pg', () => require('../helpers/pgmock')());
const express = require('express');
const request = require('supertest');
const pg = require('pg');

pg.__db.public.none(`CREATE TABLE staff (id SERIAL PRIMARY KEY, name TEXT)`);
pg.__db.public.none(`INSERT INTO staff (name) VALUES ('Nimal')`);
pg.__db.public.none(`CREATE TABLE suppliers (id SERIAL PRIMARY KEY, name TEXT)`);
pg.__db.public.none(`INSERT INTO suppliers (name) VALUES ('Keep Ltd'), ('Void Ltd')`);
pg.__db.public.none(`CREATE TABLE grn_records (id SERIAL PRIMARY KEY, supplier_id INT, total_amount NUMERIC, grn_date DATE)`);
pg.__db.public.none(`CREATE TABLE supplier_payments (id SERIAL PRIMARY KEY, supplier_id INT, amount NUMERIC)`);
const commissions = require('../../routes/sale_commissions');
const purchasing = require('../../routes/purchasing_accounting');

const app = express();
app.use(express.json());
app.use('/api', commissions);
app.use('/', purchasing);

const wait = ms => new Promise(r => setTimeout(r, ms));
const today = new Date().toISOString().slice(0, 10);
beforeAll(() => wait(600));

test('a voided commission is not listed (the weekly total is checked on the real database: pg-mem has no date_trunc)', async () => {
  const a = (await request(app).post('/api/sale-commissions').send({ staff_id: 1, sale_date: today, amount: 10000, commission_pct: 2 })).body;
  const b = (await request(app).post('/api/sale-commissions').send({ staff_id: 1, sale_date: today, amount: 50000, commission_pct: 2 })).body;
  pg.__db.public.none(`INSERT INTO record_voids (module, record_id, reason) VALUES ('commissions', '${b.id}', 'test void')`);
  const list = (await request(app).get('/api/sale-commissions')).body;
  expect(list.map(r => r.id)).toEqual([a.id]);
});

test('a voided vendor is left out of supplier aging', async () => {
  pg.__db.public.none(`INSERT INTO grn_records (supplier_id, total_amount, grn_date) VALUES (1, 1000, '${today}'), (2, 5000, '${today}')`);
  pg.__db.public.none(`INSERT INTO record_voids (module, record_id, reason) VALUES ('suppliers', '2', 'test void')`);
  const r = await request(app).get('/api/supplier-aging');
  expect(r.status).toBe(200);
  const names = JSON.stringify(r.body);
  expect(names).toContain('Keep Ltd');
  expect(names).not.toContain('Void Ltd');
});