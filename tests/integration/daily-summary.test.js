'use strict';
jest.mock('file-type', () => ({ fileTypeFromBuffer: jest.fn() }));
jest.mock('../../layla', () => ({
  pool: { query: jest.fn().mockResolvedValue({ rows: [] }) },
  processMessage: jest.fn(),
  alertOwner:     jest.fn(),
  getOrCreateCustomer: jest.fn(),
}));
jest.mock('bcryptjs', () => ({
  ...jest.requireActual('bcryptjs'),
  compare: jest.fn().mockResolvedValue(true),
}));

const request = require('supertest');
const app     = require('../../server');
const { pool } = require('../../layla');

// ── DB row fixture ────────────────────────────────────────────────────────────
const DB_ROW = {
  report_date: '2026-05-12',
  date_str: '2026-05-12',
  total_sale: 415865,
  total_expenses: 76940,
  gross_profit: 89480,
  net_profit: 12540,
  gp_status: 'ACTUAL',
  day_status: null,
  checker_flags: '[]',
  data_tier: 'FULL',
  cash_in_total: 200000,
  cash_out_total: 76940,
  net_cash_movement: 123060,
};

async function adminAgent() {
  const agent = request.agent(app);
  pool.query.mockResolvedValueOnce({
    rows: [{ id: 1, username: 'admin', name: 'Admin', role: 'admin', staff_id: null, password_hash: 'x' }],
  });
  await agent.post('/api/login').send({ username: 'admin', password: 'pass' }).expect(200);
  return agent;
}

// ── GET /api/daily-summary ────────────────────────────────────────────────────
describe('GET /api/daily-summary', () => {
  let agent;
  beforeAll(async () => { agent = await adminAgent(); });
  beforeEach(() => pool.query.mockResolvedValue({ rows: [DB_ROW] }));

  test('?date= returns the row for that date', async () => {
    const res = await agent.get('/api/daily-summary?date=2026-05-12');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // Verify the query used the date parameter
    const call = pool.query.mock.calls.find(([q]) => q.includes('report_date = $1'));
    expect(call).toBeDefined();
    expect(call[1]).toEqual(['2026-05-12']);
  });

  test('?latest=1 queries most recent row on or before today', async () => {
    await agent.get('/api/daily-summary?latest=1');
    const call = pool.query.mock.calls.find(([q]) => q.includes('ORDER BY report_date DESC LIMIT 1'));
    expect(call).toBeDefined();
    expect(call[1]).toEqual([]); // no $1 param when no before=
  });

  test('?latest=1&before=DATE queries most recent row strictly before that date', async () => {
    await agent.get('/api/daily-summary?latest=1&before=2026-05-19');
    const call = pool.query.mock.calls.find(([q]) => q.includes('report_date < $1'));
    expect(call).toBeDefined();
    expect(call[1]).toEqual(['2026-05-19']);
  });

  test('?from=&to= queries a date range', async () => {
    await agent.get('/api/daily-summary?from=2026-05-01&to=2026-05-31');
    const call = pool.query.mock.calls.find(([q]) => q.includes('BETWEEN $1 AND $2'));
    expect(call).toBeDefined();
    expect(call[1]).toEqual(['2026-05-01', '2026-05-31']);
  });

  test('unauthenticated request returns 401', async () => {
    const res = await request(app).get('/api/daily-summary?date=2026-05-12');
    expect(res.status).toBe(401);
  });
});

// ── PATCH /api/daily-summary/:date/field ─────────────────────────────────────
describe('PATCH /api/daily-summary/:date/field', () => {
  let agent;
  beforeAll(async () => { agent = await adminAgent(); });
  beforeEach(() => pool.query.mockResolvedValue({ rows: [] }));

  test('invalid field name returns 400', async () => {
    const res = await agent
      .patch('/api/daily-summary/2026-05-12/field')
      .send({ field: 'password_hash', value: 1 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not overridable/i);
  });

  test('negative value returns 400', async () => {
    const res = await agent
      .patch('/api/daily-summary/2026-05-12/field')
      .send({ field: 'total_expenses', value: -500 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/non-negative/i);
  });

  test('non-numeric value returns 400', async () => {
    const res = await agent
      .patch('/api/daily-summary/2026-05-12/field')
      .send({ field: 'total_expenses', value: 'abc' });
    expect(res.status).toBe(400);
  });

  test('valid total_expenses update returns 200', async () => {
    const res = await agent
      .patch('/api/daily-summary/2026-05-12/field')
      .send({ field: 'total_expenses', value: 76940 });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test('total_expenses update triggers net_profit recalculation query', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    await agent
      .patch('/api/daily-summary/2026-05-12/field')
      .send({ field: 'total_expenses', value: 76940 });

    // First call: UPDATE the field
    const updateCall = pool.query.mock.calls.find(([q]) =>
      q.includes('SET total_expenses=$1')
    );
    expect(updateCall).toBeDefined();
    expect(updateCall[1]).toEqual([76940, '2026-05-12']);

    // Second call: recalculate NP (only where gp_status='ACTUAL')
    const npCall = pool.query.mock.calls.find(([q]) =>
      q.includes('net_profit') && q.includes("gp_status='ACTUAL'")
    );
    expect(npCall).toBeDefined();
  });

  test('gross_profit update sets gp_status=ACTUAL and recalcs NP', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    await agent
      .patch('/api/daily-summary/2026-05-12/field')
      .send({ field: 'gross_profit', value: 89480 });

    const gpCall = pool.query.mock.calls.find(([q]) =>
      q.includes("gp_status='ACTUAL'") && q.includes('day_status=NULL')
    );
    expect(gpCall).toBeDefined();
  });

  test('clearFlag removes the specified flag from checker_flags JSON', async () => {
    // SELECT returns row with the flag present
    pool.query
      .mockResolvedValueOnce({ rows: [] }) // UPDATE field
      .mockResolvedValueOnce({ rows: [] }) // NP recalc
      .mockResolvedValueOnce({ rows: [{ checker_flags: '["high_expenses"]' }] }) // SELECT flags
      .mockResolvedValueOnce({ rows: [] }); // UPDATE flags

    const res = await agent
      .patch('/api/daily-summary/2026-05-12/field')
      .send({ field: 'total_expenses', value: 20000, clearFlag: 'high_expenses' });

    expect(res.status).toBe(200);

    // Final UPDATE should write an empty flags array
    const flagUpdateCall = pool.query.mock.calls.find(([q, p]) =>
      q.includes('checker_flags=$1') && p && p[0] === '[]'
    );
    expect(flagUpdateCall).toBeDefined();
  });

  test('unauthenticated PATCH returns 401', async () => {
    const res = await request(app)
      .patch('/api/daily-summary/2026-05-12/field')
      .send({ field: 'total_expenses', value: 5000 });
    expect(res.status).toBe(401);
  });
});
