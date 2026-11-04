'use strict';
// A sale can be refunded/exchanged only once; bad input is rejected with a clear error.
jest.mock('pg', () => require('../helpers/pgmock')());

const express = require('express');
const request = require('supertest');
const pg = require('pg');

pg.__db.public.none(`CREATE TABLE staff (id SERIAL PRIMARY KEY, name TEXT)`);
pg.__db.public.none(`INSERT INTO staff (name) VALUES ('Nimal')`);
const router = require('../../routes/sale_commissions');

const app = express();
app.use(express.json());
app.use('/api', router);

const tick = () => new Promise(r => setTimeout(r, 50));   // let the route's CREATE TABLE finish
const today = new Date().toISOString().slice(0, 10);
const logSale = async (over = {}) =>
  (await request(app).post('/api/sale-commissions').send({ staff_id: 1, sale_date: today, amount: 10000, commission_pct: 2, ...over }));

beforeAll(tick);

describe('sale commission returns', () => {
  test('refund claws back the full commission, exactly once', async () => {
    const sale = (await logSale()).body;
    expect(Number(sale.commission_amount)).toBe(200);
    const r1 = await request(app).post(`/api/sale-commissions/${sale.id}/return`).send({ type: 'refund' });
    expect(r1.status).toBe(200);
    expect(Number(r1.body.commission_amount)).toBe(-200);
    const r2 = await request(app).post(`/api/sale-commissions/${sale.id}/return`).send({ type: 'refund' });
    expect(r2.status).toBe(409);
    expect(r2.body.error).toMatch(/already has a refund/i);
    // and an exchange after a refund is refused too
    const r3 = await request(app).post(`/api/sale-commissions/${sale.id}/return`).send({ type: 'exchange', new_amount: 5000, new_commission_pct: 2 });
    expect(r3.status).toBe(409);
    // the ledger shows one sale row and one refund row
    const rows = pg.__db.public.many(`SELECT entry_type FROM sale_commissions WHERE id = ${sale.id} OR linked_sale_id = ${sale.id}`);
    expect(rows.map(r => r.entry_type).sort()).toEqual(['return_refund', 'sale']);
  });

  test('exchange reverses the old commission and adds the new one (net), once', async () => {
    const sale = (await logSale({ amount: 20000, commission_pct: 3 })).body; // 600
    const ex = await request(app).post(`/api/sale-commissions/${sale.id}/return`).send({ type: 'exchange', new_amount: 10000, new_commission_pct: 2 }); // +200 - 600
    expect(ex.status).toBe(200);
    expect(Number(ex.body.commission_amount)).toBe(-400);
    expect((await request(app).post(`/api/sale-commissions/${sale.id}/return`).send({ type: 'exchange', new_amount: 10000, new_commission_pct: 2 })).status).toBe(409);
  });

  test('validation: unknown staff, unknown sale, bad type, missing exchange fields', async () => {
    expect((await logSale({ staff_id: 999 })).status).toBe(404);
    expect((await request(app).post('/api/sale-commissions/9999/return').send({ type: 'refund' })).status).toBe(404);
    const sale = (await logSale()).body;
    expect((await request(app).post(`/api/sale-commissions/${sale.id}/return`).send({ type: 'steal' })).status).toBe(400);
    expect((await request(app).post(`/api/sale-commissions/${sale.id}/return`).send({ type: 'exchange' })).status).toBe(400);
    expect((await request(app).get('/api/sale-commissions/weekly-summary?week_start=not-a-date')).status).toBe(400);
    // a failed attempt must not have used up the one allowed return
    expect((await request(app).post(`/api/sale-commissions/${sale.id}/return`).send({ type: 'refund' })).status).toBe(200);
  });
});
