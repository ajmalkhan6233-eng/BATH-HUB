// The Home numbers route must answer 200 (25 Nov: a quoting slip made it fail with "SP is not defined" while every syntax check passed). Read-only.
const express = require('express');
const request = require('supertest');
jest.mock('../../utils/pool', () => ({ query: async (sql) => ({ rows: /CURRENT_DATE/.test(sql) || /SUM|COUNT/.test(sql) ? [{ d: '2026-11-25', s: 0, amt: 0, qty: 0, units: 0, items: 0, cost: 0, sell: 0, neg: 0, nosell: 0 }] : [] }) }));

test('GET /api/home-solid and stock-gap answer', async () => {
  const app = express();
  app.use((req, res, next) => { req.session = { user: { role: 'owner' } }; next(); });
  app.use('/api', require('../../routes/home_solid'));
  const a = await request(app).get('/api/home-solid');
  expect(a.status).toBe(200);
  expect(a.body.checks.length).toBeGreaterThan(0);
  const b = await request(app).get('/api/home-solid/stock-gap');
  expect(b.status).toBe(200);
  console.log(a.body.checks.map((c) => `${c.ok ? 'OK' : 'NO'} ${c.key} ${c.note}`).join(' | '));
});
