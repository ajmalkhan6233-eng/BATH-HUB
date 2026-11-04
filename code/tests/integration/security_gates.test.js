'use strict';
// Security gates: the read-only 'owner' account, and the second login step re-checking the account.
jest.mock('file-type', () => ({ fileTypeFromBuffer: jest.fn() }));
jest.mock('../../layla', () => ({
  pool: { query: jest.fn().mockResolvedValue({ rows: [] }) },
  processMessage: jest.fn(), alertOwner: jest.fn(), getOrCreateCustomer: jest.fn(),
}));
jest.mock('connect-pg-simple', () => (session) => session.MemoryStore);
jest.mock('bcryptjs', () => ({ ...jest.requireActual('bcryptjs'), compare: jest.fn().mockResolvedValue(true) }));

const request = require('supertest');
const app = require('../../server');
const { pool } = require('../../layla');

async function agentAs(role) {
  const agent = request.agent(app);
  pool.query.mockResolvedValueOnce({ rows: [{ id: 1, username: 'u', name: 'U', role, staff_id: null, password_hash: 'x' }] });
  await agent.post('/api/login').send({ username: 'u', password: 'pass' }).expect(200);
  return agent;
}
beforeEach(() => { pool.query.mockReset(); pool.query.mockResolvedValue({ rows: [] }); });
afterEach(() => { delete process.env.OWNER_READ_ONLY; });

describe('read-only owner account (OWNER_READ_ONLY=true)', () => {
  beforeEach(() => { process.env.OWNER_READ_ONLY = 'true'; });
  test('can read', async () => {
    const a = await agentAs('owner');
    expect((await a.get('/api/me')).status).toBe(200);
    expect((await a.get('/api/daily-summary?date=2026-05-12')).status).toBe(200);
  });
  test.each([
    ['put', '/api/salary/settings', { cost_normal: 1 }],
    ['post', '/api/users', { username: 'x' }],
    ['patch', '/api/feature-flags/pos_billing', { enabled: true }],
    ['post', '/api/pos-bills', { items: [] }],
    ['put', '/api/pos-bills/1', {}],
    ['post', '/api/suppliers', { name: 'x' }],
    ['post', '/api/attachments', {}],
    ['post', '/api/system/backups', {}],
  ])('%s %s is refused with 403', async (method, url, body) => {
    const a = await agentAs('owner');
    const r = await a[method](url).send(body);
    expect(r.status).toBe(403);
  });
  test('admin is not blocked by the gate', async () => {
    const a = await agentAs('admin');
    const r = await a.put('/api/salary/settings').send({ cost_normal: 1 });
    expect(r.status).not.toBe(403);
  });
});

describe('without the flag the template behaviour stays (owner = admin rights)', () => {
  test('owner write is not refused by the gate', async () => {
    const a = await agentAs('owner');
    const r = await a.post('/api/suppliers').send({ name: 'x' });
    expect(r.status).not.toBe(403);
  });
});

describe('two-step login re-checks the account', () => {
  test('a user disabled between step 1 and step 2 is refused and the pending login is dropped', async () => {
    const agent = request.agent(app);
    pool.query.mockResolvedValueOnce({ rows: [{ id: 7, username: 'u', name: 'U', role: 'staff', staff_id: 1, password_hash: 'x', totp_enabled: true }] });
    const s1 = await agent.post('/api/login').send({ username: 'u', password: 'pass' });
    expect(s1.body.needs_totp).toBe(true);
    pool.query.mockResolvedValueOnce({ rows: [{ totp_secret: 'JBSWY3DPEHPK3PXP', active: false, role: 'staff' }] });
    const s2 = await agent.post('/api/auth/verify-totp').send({ code: '123456' });
    expect(s2.status).toBe(403);
    const s3 = await agent.post('/api/auth/verify-totp').send({ code: '123456' });
    expect(s3.status).toBe(401);                       // nothing pending any more
  });
});