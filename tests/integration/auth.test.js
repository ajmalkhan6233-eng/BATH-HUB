'use strict';
// Mock file-type (ESM module) and layla (DB pool) before app loads
jest.mock('file-type', () => ({ fileTypeFromBuffer: jest.fn() }));
jest.mock('../../layla', () => ({
  pool: { query: jest.fn().mockResolvedValue({ rows: [] }) },
  processMessage: jest.fn(),
  alertOwner:     jest.fn(),
  getOrCreateCustomer: jest.fn(),
}));
// Sessions: server.js builds its store on the mocked pool, so the session lookup would
// swallow mocked query results and every cookie-bearing request would look logged out.
// An in-memory store keeps the real session + auth middleware under test.
jest.mock('connect-pg-simple', () => (session) => session.MemoryStore);
jest.mock('bcryptjs', () => ({
  ...jest.requireActual('bcryptjs'),
  compare: jest.fn().mockResolvedValue(true),
}));

const request = require('supertest');
const app     = require('../../server');
const { pool } = require('../../layla');

// ── helper: log in as a given role via real /api/login ──────────────────────
async function agentAs(role) {
  const agent = request.agent(app);
  pool.query.mockResolvedValueOnce({
    rows: [{ id: 1, username: 'admin', name: 'Admin', role, staff_id: role === 'staff' ? 5 : null, password_hash: 'x' }],
  });
  await agent.post('/api/login').send({ username: 'admin', password: 'pass' }).expect(200);
  return agent;
}

// ── tests ─────────────────────────────────────────────────────────────────────
describe('Auth middleware', () => {
  beforeEach(() => {
    pool.query.mockResolvedValue({ rows: [] });
  });

  test('unauthenticated request to /api/ returns 401', async () => {
    const res = await request(app).get('/api/me');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/not logged in/i);
  });

  test('wrong password returns 401', async () => {
    const bcrypt = require('bcryptjs');
    bcrypt.compare.mockResolvedValueOnce(false);
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, username: 'admin', name: 'Admin', role: 'admin', password_hash: 'x' }],
    });
    const res = await request(app).post('/api/login').send({ username: 'admin', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  test('unknown user returns 401', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }); // no user found
    const res = await request(app).post('/api/login').send({ username: 'nobody', password: 'x' });
    expect(res.status).toBe(401);
  });

  test('admin can access GET /api/me', async () => {
    const agent = await agentAs('admin');
    const res = await agent.get('/api/me');
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('admin');
  });

  test('owner (read-only) can GET /api/daily-summary', async () => {
    const agent = await agentAs('owner');
    const res = await agent.get('/api/daily-summary?date=2026-05-12');
    expect(res.status).toBe(200);
  });

  // The white-label template gives 'owner' the same access as 'admin' (the read-only
  // 'uncle' investor role belonged to the original live system). If a read-only role is
  // wanted later, add it as a new role rather than restricting 'owner'.
  test('owner can write, same as admin (template design)', async () => {
    const agent = await agentAs('owner');
    const res = await agent
      .patch('/api/daily-summary/2026-05-12/field')
      .send({ field: 'total_expenses', value: 5000 });
    expect(res.status).not.toBe(403);
    expect(res.status).not.toBe(401);
  });

  test('staff cannot access general API routes — returns 403', async () => {
    const agent = await agentAs('staff');
    const res = await agent.get('/api/daily-summary?date=2026-05-12');
    expect(res.status).toBe(403);
  });

  test('staff can access their own salary endpoint', async () => {
    const agent = await agentAs('staff'); // staff_id=5
    // Mock the salary query response
    pool.query.mockResolvedValueOnce({ rows: [{ staff_id: 5, amount: 30000 }] });
    const res = await agent.get('/api/staff/5/salary');
    expect(res.status).toBe(200);
  });

  test('staff cannot access another staff member\'s salary', async () => {
    const agent = await agentAs('staff'); // staff_id=5
    const res = await agent.get('/api/staff/9/salary');
    expect(res.status).toBe(403);
  });
});
