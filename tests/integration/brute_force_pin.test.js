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

// The 4-digit admin PIN: right PIN works, wrong guesses are cut off after 5.
describe('admin PIN brute-force limit', () => {
  async function loggedIn() {
    const agent = request.agent(app);
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1, username: 'a', name: 'A', role: 'admin', staff_id: null, password_hash: 'x' }] });
    await agent.post('/api/login').send({ username: 'a', password: 'p' }).expect(200);
    return agent;
  }

  test('right PIN unlocks, does not count against the limit, wrong PIN is 401', async () => {
    const agent = await loggedIn();
    expect((await agent.post('/api/admin/verify').send({ pin: '4821' })).status).toBe(200);
    expect((await agent.post('/api/admin/verify').send({ pin: '4821' })).status).toBe(200);
    expect((await agent.post('/api/admin/verify').send({ pin: 4821 })).status).toBe(200);   // number form also fine
    expect((await agent.post('/api/admin/verify').send({ pin: '4822' })).status).toBe(401);
    expect((await agent.post('/api/admin/verify').send({})).status).toBe(401);               // missing pin: no crash
  });

  test('after 5 wrong guesses in total, further attempts (even the right PIN) get 429', async () => {
    const agent = await loggedIn();
    // 2 wrong guesses were already used by the previous test, so 3 more reach the limit of 5
    for (let i = 0; i < 3; i++) expect((await agent.post('/api/admin/verify').send({ pin: '0000' })).status).toBe(401);
    expect((await agent.post('/api/admin/verify').send({ pin: '4821' })).status).toBe(429);
  });
});
