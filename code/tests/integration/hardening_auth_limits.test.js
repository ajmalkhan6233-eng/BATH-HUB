'use strict';
// Proves the EXISTING brute-force limits (does not add new ones): login = 10 failed attempts per 15 min per IP, admin PIN = 5 failed.
// Only failures count; a correct login/PIN never uses up the allowance.
jest.mock('file-type', () => ({ fileTypeFromBuffer: jest.fn(), fromBuffer: jest.fn() }));
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
const row = { id: 1, username: 'a', name: 'A', role: 'admin', staff_id: null, password_hash: 'x' };
const login = (ip, body) => request(app).post('/api/login').set('X-Forwarded-For', ip).send(body);

describe('login limit: 10 failed attempts per IP', () => {
  const ip = '198.51.100.20';
  test('10 failures answer 401, the 11th is 429 with a plain message, and the right password is then blocked too', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    for (let i = 0; i < 10; i++) expect((await login(ip, { username: 'x', password: 'y' })).status).toBe(401);
    const blocked = await login(ip, { username: 'x', password: 'y' });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatch(/too many failed attempts/i);
    expect(JSON.stringify(blocked.body)).not.toMatch(/at .*\.js|stack/i);
    pool.query.mockResolvedValueOnce({ rows: [row] });
    expect((await login(ip, { username: 'a', password: 'right' })).status).toBe(429);
  });
  test('another IP is not affected by the first one being blocked', async () => {
    pool.query.mockResolvedValueOnce({ rows: [row] });
    expect((await login('198.51.100.21', { username: 'a', password: 'right' })).status).toBe(200);
  });
  test('successful logins do not use up the allowance', async () => {
    for (let i = 0; i < 13; i++) {
      pool.query.mockResolvedValueOnce({ rows: [row] });
      expect((await login('198.51.100.22', { username: 'a', password: 'right' })).status).toBe(200);
    }
  });
});

describe('admin PIN limit: 5 failed attempts', () => {
  test('right PIN costs nothing; 5 wrong are 401; then even the right PIN is 429', async () => {
    const ip = '198.51.100.30';
    const agent = request.agent(app);
    pool.query.mockResolvedValueOnce({ rows: [row] });
    await agent.post('/api/login').set('X-Forwarded-For', ip).send({ username: 'a', password: 'p' }).expect(200);
    const verify = pin => agent.post('/api/admin/verify').set('X-Forwarded-For', ip).send({ pin });
    for (let i = 0; i < 3; i++) expect((await verify('4821')).status).toBe(200);
    for (let i = 0; i < 5; i++) expect((await verify('0000')).status).toBe(401);
    const blocked = await verify('4821');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatch(/too many failed attempts/i);
  });
});
