const express = require('express'), request = require('supertest');
jest.mock('../../utils/pool', () => ({ query: jest.fn(async () => ({ rows: [{ item_code: '001', avg_cost: '60' }, { item_code: '002', avg_cost: '0' }] })) }));
const route = require('../../routes/sale_profit');
const app = role => { const a = express(); a.use((q, r, n) => { q.session = { user: { role } }; n(); }); a.use('/api/sale-profit', route); return a; };
test('owner gets cost, profit and percent', async () => {
  const r = await request(app('owner')).post('/api/sale-profit').send({ items: [{ item_code: '001', qty: 2, unit_price: 100 }], discount: 20 });
  expect(r.status).toBe(200); expect(r.body).toMatchObject({ subtotal: 200, discount: 20, total: 180, cost: 120, profit: 60, pct: 33.33, unknown: 0 });
});
test('a typed package price wins and unknown cost is counted', async () => {
  const r = await request(app('admin')).post('/api/sale-profit').send({ items: [{ item_code: '001', qty: 1, unit_price: 100 }, { item_code: '002', qty: 1, unit_price: 50 }], price: 120 });
  expect(r.body).toMatchObject({ total: 120, cost: 60, profit: 60, unknown: 1 });
});
test('staff are refused', async () => {
  const r = await request(app('staff')).post('/api/sale-profit').send({ items: [] });
  expect(r.status).toBe(403); expect(JSON.stringify(r.body)).not.toMatch(/cost/);
});
test('empty cart is fine', async () => {
  const r = await request(app('owner')).post('/api/sale-profit').send({ items: [] });
  expect(r.status).toBe(200); expect(r.body.total).toBe(0);
});
