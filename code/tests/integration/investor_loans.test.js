'use strict';
// Investor loans: create, read, repay, QR balance. Valid input, bad input, a database failure.
jest.mock('pg', () => require('../helpers/pgmock')());
jest.mock('file-type', () => ({ fromBuffer: jest.fn(), fileTypeFromBuffer: jest.fn() }));

const express = require('express');
const request = require('supertest');
const router = require('../../routes/investor_loans');
const pool = require('../../utils/pool');
const app = express(); app.use(express.json()); app.use('/api', router);

beforeAll(() => new Promise(r => setTimeout(r, 600)));   // let the route's CREATE TABLEs finish
afterEach(() => jest.restoreAllMocks());

const good = { lender_name: 'Uncle', amount: 100000, profit_rate: 10, date_given: '2026-09-01', due_date: '2026-12-01' };

describe('create and read', () => {
  let id;
  test('a valid loan is created and comes back with totals', async () => {
    const c = await request(app).post('/api/investor-loans').send(good);
    expect(c.status).toBe(200); id = c.body.id; expect(id).toBeGreaterThan(0);
    const g = await request(app).get(`/api/investor-loans/${id}`);
    expect(g.status).toBe(200); expect(g.body.lender_name).toBe('Uncle');
    expect(Number(g.body.total_due)).toBe(110000); expect(Array.isArray(g.body.payments)).toBe(true);
  });
  test('the list and the summary answer 200', async () => {
    expect((await request(app).get('/api/investor-loans')).status).toBe(200);
    const s = await request(app).get('/api/investor-loans/summary');
    expect(s.status).toBe(200); expect(s.body).toHaveProperty('total_outstanding');
  });
  test('an unknown loan is a 404', async () => {
    expect((await request(app).get('/api/investor-loans/99999')).status).toBe(404);
  });
  test('a repayment is recorded; a bad one is refused', async () => {
    expect((await request(app).post(`/api/investor-loans/${id}/payments`).send({ amount: 5000, payment_date: '2026-10-01' })).status).toBe(200);
    expect((await request(app).post(`/api/investor-loans/${id}/payments`).send({ amount: -5, payment_date: '2026-10-01' })).status).toBe(400);
    expect((await request(app).post(`/api/investor-loans/${id}/payments`).send({ amount: 5, payment_date: 'tomorrow' })).status).toBe(400);
    expect((await request(app).post(`/api/investor-loans/${id}/payments`).send({})).status).toBe(400);
    expect((await request(app).post('/api/investor-loans/99999/payments').send({ amount: 5, payment_date: '2026-10-01' })).status).toBe(404);
  });
  test('the QR balance is updated by hand; negative or text is refused', async () => {
    expect((await request(app).put(`/api/investor-loans/${id}/qr-balance`).send({ qr_outstanding: 1200 })).status).toBe(200);
    expect((await request(app).put(`/api/investor-loans/${id}/qr-balance`).send({ qr_outstanding: -1 })).status).toBe(400);
    expect((await request(app).put(`/api/investor-loans/${id}/qr-balance`).send({ qr_outstanding: 'lots' })).status).toBe(400);
    expect((await request(app).put(`/api/investor-loans/${id}/qr-balance`).send({})).status).toBe(400);
  });
});

describe('bad input on create and edit', () => {
  test.each([
    ['missing lender', { ...good, lender_name: '' }],
    ['zero amount', { ...good, amount: 0 }],
    ['text amount', { ...good, amount: 'abc' }],
    ['profit over 100', { ...good, profit_rate: 150 }],
    ['bad date_given', { ...good, date_given: '01/09/2026' }],
    ['bad due_date', { ...good, due_date: 'soon' }],
  ])('create: %s is a 400', async (_n, body) => {
    expect((await request(app).post('/api/investor-loans').send(body)).status).toBe(400);
  });
  test('edit: bad status and bad amount are 400; unknown id is 404', async () => {
    expect((await request(app).put('/api/investor-loans/1').send({ status: 'gone' })).status).toBe(400);
    expect((await request(app).put('/api/investor-loans/1').send({ amount: -1 })).status).toBe(400);
    expect((await request(app).put('/api/investor-loans/99999').send({ notes: 'x' })).status).toBe(404);
  });
});

describe('database failure', () => {
  test.each([
    ['get', '/api/investor-loans', undefined],
    ['get', '/api/investor-loans/summary', undefined],
    ['post', '/api/investor-loans', good],
  ])('%s %s gives a 500 with a message', async (m, url, body) => {
    jest.spyOn(pool, 'query').mockRejectedValueOnce(new Error('db down'));
    const r = await request(app)[m](url).send(body);
    expect(r.status).toBe(500); expect(r.body.error).toMatch(/db down/);
  });
});
