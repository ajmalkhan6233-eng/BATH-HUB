'use strict';
jest.mock('file-type', () => ({ fileTypeFromBuffer: jest.fn() }));
jest.mock('connect-pg-simple', () => (session) => session.MemoryStore);
jest.mock('../../layla', () => ({
  pool: { query: jest.fn().mockResolvedValue({ rows: [] }) },
  processMessage: jest.fn(), alertOwner: jest.fn(), getOrCreateCustomer: jest.fn(),
}));
jest.mock('bcryptjs', () => ({ ...jest.requireActual('bcryptjs'), compare: jest.fn().mockResolvedValue(true) }));
process.env.ADMIN_PIN = '4821';
const request = require('supertest');
const app = require('../../server');
const { pool } = require('../../layla');

// Login guessing is throttled; only failures count.
describe('login brute-force limit', () => {
  test('successful logins never use up the allowance', async () => {
    for (let i = 0; i < 12; i++) {
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1, username: 'a', name: 'A', role: 'admin', staff_id: null, password_hash: 'x' }] });
      expect((await request(app).post('/api/login').send({ username: 'a', password: 'right' })).status).toBe(200);
    }
  });

  test('10 failed logins are answered 401, the 11th is blocked with 429', async () => {
    pool.query.mockResolvedValue({ rows: [] }); // unknown user
    for (let i = 0; i < 10; i++) {
      expect((await request(app).post('/api/login').send({ username: 'x', password: 'y' })).status).toBe(401);
    }
    const blocked = await request(app).post('/api/login').send({ username: 'x', password: 'y' });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatch(/too many/i);
  });
});
