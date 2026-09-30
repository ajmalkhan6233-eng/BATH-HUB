'use strict';
// Disabling a user: they cannot log in, their sessions are cleared, and nobody can disable/demote themselves.
jest.mock('file-type', () => ({ fileTypeFromBuffer: jest.fn() }));
jest.mock('connect-pg-simple', () => (session) => session.MemoryStore);
jest.mock('../../layla', () => ({
  pool: { query: jest.fn().mockResolvedValue({ rows: [] }) },
  processMessage: jest.fn(), alertOwner: jest.fn(), getOrCreateCustomer: jest.fn(),
}));
jest.mock('bcryptjs', () => ({ ...jest.requireActual('bcryptjs'), compare: jest.fn().mockResolvedValue(true) }));

const request = require('supertest');
const app = require('../../server');
const { pool } = require('../../layla');

const userRow = (over = {}) => ({ id: 7, username: 'sam', name: 'Sam', role: 'staff', staff_id: 3, password_hash: 'x', ...over });

describe('login of a disabled account', () => {
  test('correct password but active = false -> 403, no session', async () => {
    pool.query.mockResolvedValueOnce({ rows: [userRow({ active: false })] });
    const agent = request.agent(app);
    const r = await agent.post('/api/login').send({ username: 'sam', password: 'right-password' });
    expect(r.status).toBe(403);
    expect(r.body.error).toMatch(/disabled/i);
    expect((await agent.get('/api/me')).status).toBe(401);
  });

  test('active = true (or no active column) still logs in', async () => {
    pool.query.mockResolvedValueOnce({ rows: [userRow({ active: true })] });
    expect((await request(app).post('/api/login').send({ username: 'sam', password: 'p' })).status).toBe(200);
    pool.query.mockResolvedValueOnce({ rows: [userRow()] });   // column absent -> undefined
    expect((await request(app).post('/api/login').send({ username: 'sam', password: 'p' })).status).toBe(200);
  });
});

describe('PATCH /api/users/:id', () => {
  async function adminAgent() {
    const agent = request.agent(app);
    pool.query.mockResolvedValueOnce({ rows: [userRow({ id: 1, username: 'boss', name: 'Boss', role: 'admin', staff_id: null })] });
    await agent.post('/api/login').send({ username: 'boss', password: 'p' }).expect(200);
    return agent;
  }

  test('disabling someone else clears their sessions', async () => {
    const agent = await adminAgent();
    pool.query.mockReset().mockResolvedValue({ rows: [], rowCount: 1 });
    pool.query.mockResolvedValueOnce({ rows: [{ id: 7, username: 'sam', name: 'Sam', role: 'staff', staff_id: 3 }], rowCount: 1 });
    const r = await agent.patch('/api/users/7').send({ active: false });
    expect(r.status).toBe(200);
    const sqls = pool.query.mock.calls.map(c => String(c[0]));
    const del = pool.query.mock.calls.find(c => /DELETE FROM session/i.test(String(c[0])));
    expect(del).toBeTruthy();
    expect(del[1]).toEqual(['7']);
    expect(sqls.some(q => /UPDATE users SET active=/.test(q))).toBe(true);
  });

  test('enabling someone does not touch sessions', async () => {
    const agent = await adminAgent();
    pool.query.mockReset().mockResolvedValue({ rows: [], rowCount: 1 });
    pool.query.mockResolvedValueOnce({ rows: [{ id: 7, username: 'sam', name: 'Sam', role: 'staff', staff_id: 3 }], rowCount: 1 });
    await agent.patch('/api/users/7').send({ active: true }).expect(200);
    expect(pool.query.mock.calls.some(c => /DELETE FROM session/i.test(String(c[0])))).toBe(false);
  });

  test('changing someone else's role also clears their sessions (a session keeps its old role)', async () => {
    const agent = await adminAgent();
    pool.query.mockReset().mockResolvedValue({ rows: [], rowCount: 1 });
    pool.query.mockResolvedValueOnce({ rows: [{ id: 7, username: 'sam', name: 'Sam', role: 'staff', staff_id: 3 }], rowCount: 1 });
    await agent.patch('/api/users/7').send({ role: 'staff' }).expect(200);
    expect(pool.query.mock.calls.some(c => /DELETE FROM session/i.test(String(c[0])))).toBe(true);
  });

  test("you can't disable or demote your own account", async () => {
    const agent = await adminAgent();
    pool.query.mockReset().mockResolvedValue({ rows: [], rowCount: 1 });
    expect((await agent.patch('/api/users/1').send({ active: false })).status).toBe(400);
    expect((await agent.patch('/api/users/1').send({ role: 'staff' })).status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
    // but renaming yourself or re-saving your own role is fine
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1, username: 'boss', name: 'New', role: 'admin', staff_id: null }], rowCount: 1 });
    expect((await agent.patch('/api/users/1').send({ name: 'New', role: 'admin' })).status).toBe(200);
  });
});
