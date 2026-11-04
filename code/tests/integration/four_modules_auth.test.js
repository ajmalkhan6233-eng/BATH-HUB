'use strict';
// Through the real server: business intelligence, GRN manual, investor loans and POS bill corrections all need a login.
jest.mock('file-type', () => ({ fromBuffer: jest.fn(), fileTypeFromBuffer: jest.fn() }));
jest.mock('connect-pg-simple', () => (session) => session.MemoryStore);
jest.mock('pg', () => require('../helpers/pgmock')());
jest.mock('../../layla', () => ({ pool: { query: jest.fn().mockResolvedValue({ rows: [] }) }, processMessage: jest.fn(), alertOwner: jest.fn(), getOrCreateCustomer: jest.fn() }));
jest.mock('bcryptjs', () => ({ ...jest.requireActual('bcryptjs'), compare: jest.fn().mockResolvedValue(true) }));

const request = require('supertest');
const app = require('../../server');
const { pool } = require('../../layla');

const ROUTES = [
  ['get', '/api/cash-position-forecast'], ['get', '/api/non-moving-stock'],
  ['post', '/api/grn-manual'],
  ['get', '/api/investor-loans'], ['get', '/api/investor-loans/summary'], ['get', '/api/investor-loans/1'], ['post', '/api/investor-loans'],
  ['put', '/api/investor-loans/1'], ['post', '/api/investor-loans/1/payments'], ['put', '/api/investor-loans/1/qr-balance'],
  ['post', '/api/pos-bills/1/void'], ['put', '/api/pos-bills/1'], ['get', '/api/pos-bills/1/history'],
];

async function as(role) {
  const a = request.agent(app);
  pool.query.mockResolvedValueOnce({ rows: [{ id: 1, username: 'u', name: 'U', role, staff_id: 7, password_hash: 'x' }] });
  await a.post('/api/login').send({ username: 'u', password: 'pass' }).expect(200);
  return a;
}

test.each(ROUTES)('%s %s without a login is 401', async (m, url) => {
  expect((await request(app)[m](url).send({})).status).toBe(401);
});
test.each(ROUTES)('%s %s as staff is 403', async (m, url) => {
  const a = await as('staff');
  expect((await a[m](url).send({})).status).toBe(403);
});
