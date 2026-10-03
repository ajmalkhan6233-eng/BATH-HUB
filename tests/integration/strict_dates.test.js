'use strict';
// Impossible calendar dates (2026-02-30, 2026-04-31) must be refused with a 400, not pass the check and fail inside Postgres with a 500.
jest.mock('pg', () => require('../helpers/pgmock')());
jest.mock('file-type', () => ({ fromBuffer: jest.fn(), fileTypeFromBuffer: jest.fn() }));

const express = require('express');
const request = require('supertest');
const { isRealDate } = require('../../utils/validate');

describe('isRealDate', () => {
  test.each(['2026-02-28', '2028-02-29', '2026-12-31', '2026-04-30', '1999-01-01'])('%s is real', d => expect(isRealDate(d)).toBe(true));
  test.each(['2026-02-30', '2026-04-31', '2026-13-01', '2026-00-10', '2026-01-00', '2027-02-29', '26-01-01', '2026/01/01', '2026-1-1', '', null, undefined, 'tomorrow', '2026-01-01T00:00', 20260101, '0000-00-00'])('%s is refused', d => expect(isRealDate(d)).toBe(false));
});

const app = express(); app.use(express.json());
app.use('/api', require('../../routes/cheque_register'));
app.use('/api', require('../../routes/investor_loans'));
app.use('/api', require('../../routes/sale_commissions'));
beforeAll(() => new Promise(r => setTimeout(r, 600)));

describe('routes refuse impossible dates', () => {
  const chq = d => request(app).post('/api/cheque-register').send({ payee: 'X', amount: 1000, due_date: d });
  test('cheque due date', async () => {
    expect((await chq('2026-02-30')).status).toBe(400);
    expect((await chq('2026-04-31')).status).toBe(400);
    expect((await chq('2028-02-29')).status).toBe(200);
  });
  test('investor loan dates and repayment date', async () => {
    const good = { lender_name: 'L', amount: 1000, date_given: '2026-09-01' };
    expect((await request(app).post('/api/investor-loans').send({ ...good, date_given: '2026-04-31' })).status).toBe(400);
    expect((await request(app).post('/api/investor-loans').send({ ...good, due_date: '2026-02-30' })).status).toBe(400);
    const c = await request(app).post('/api/investor-loans').send(good); expect(c.status).toBe(200);
    expect((await request(app).post(`/api/investor-loans/${c.body.id}/payments`).send({ amount: 5, payment_date: '2026-02-30' })).status).toBe(400);
  });
  test('commission sale date', async () => {
    const r = await request(app).post('/api/sale-commissions').send({ staff_id: 1, sale_date: '2026-02-30', amount: 100, commission_pct: 5 });
    expect(r.status).toBe(400);
  });
});
