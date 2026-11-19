'use strict';
jest.mock('pg', () => require('../helpers/pgmock')());
const express = require('express');
const request = require('supertest');
const mk = (role) => { const a = express(); a.use(express.json()); a.use((q, _r, n) => { q.session = { user: { role, username: 't' } }; n(); }); a.use('/api', require('../../routes/cheque_register')); return a; };
const body = { payee: 'Metro', amount: 5000, due_date: '2026-12-01', cheque_no: '000123', bank: 'Commercial' };
beforeAll(() => new Promise(r => setTimeout(r, 500)));
test('staff cannot add or change a cheque', async () => {
  expect((await request(mk('staff')).post('/api/cheque-register').send(body)).status).toBe(403);
  expect((await request(mk('staff')).put('/api/cheque-register/1').send({ status: 'cleared' })).status).toBe(403);
});
test('owner adds a cheque; the same number at the same bank is refused unless confirmed', async () => {
  const app = mk('owner');
  expect((await request(app).post('/api/cheque-register').send(body)).status).toBe(200);
  const d = await request(app).post('/api/cheque-register').send({ ...body, cheque_no: ' 000123 ', bank: 'commercial' });
  expect(d.status).toBe(409); expect(d.body.code).toBe('duplicate_cheque');
  expect((await request(app).post('/api/cheque-register').send({ ...body, confirm_duplicate: true })).status).toBe(200);
});
test('a cancelled cheque does not block re-entry', async () => {
  const app = mk('owner');
  const a = await request(app).post('/api/cheque-register').send({ ...body, cheque_no: '777', bank: 'HNB' });
  await request(app).put(`/api/cheque-register/${a.body.id}`).send({ status: 'cancelled' });
  expect((await request(app).post('/api/cheque-register').send({ ...body, cheque_no: '777', bank: 'HNB' })).status).toBe(200);
});
