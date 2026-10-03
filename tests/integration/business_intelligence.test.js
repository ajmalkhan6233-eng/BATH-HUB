'use strict';
// Business intelligence: cash-position forecast and non-moving stock.
// The in-memory test database (pg-mem) cannot run these queries (date_trunc, correlated sub-queries), so the pool is
// stubbed per SQL text: the tests cover the route's own logic (parameters, buckets, rounding, errors), not Postgres.
jest.mock('pg', () => require('../helpers/pgmock')());

const express = require('express');
const request = require('supertest');
const router = require('../../routes/business_intelligence');
const pool = require('../../utils/pool');
const app = express(); app.use(express.json()); app.use('/api', router);

afterEach(() => jest.restoreAllMocks());

// avg daily sales, then per month: start date + a detail row
function stubForecast({ avg = 10000, days = 30, cheques = 50000, loans = 20000 } = {}) {
  const calls = [];
  jest.spyOn(pool, 'query').mockImplementation(async (sql, params) => {
    calls.push({ sql, params });
    if (/AVG\(total_sale\)/.test(sql)) return { rows: [{ avg_daily: avg }] };
    if (/date_trunc/.test(sql)) return { rows: [{ month_start: `2026-${String(10 + params[0]).padStart(2, '0')}-01` }] };
    if (/WITH bounds/.test(sql)) return { rows: [{ month_start: params[0], month_end: '2026-10-31', days_in_month: days, actual_sales: 1000, cheques_due: cheques, cheques_count: 2, loans_due: loans }] };
    throw new Error('unexpected query');
  });
  return calls;
}

describe('GET /api/cash-position-forecast', () => {
  test('one entry per month asked, with projected sales = average x days and net = sales - cheques - loans', async () => {
    stubForecast();
    const r = await request(app).get('/api/cash-position-forecast?months=2');
    expect(r.status).toBe(200);
    expect(r.body.forecast).toHaveLength(2);
    expect(r.body.avg_daily_sales_used).toBe(10000); expect(r.body.healthy_threshold).toBe(200000);
    expect(r.body.forecast[0]).toMatchObject({ projected_sales: 300000, cheques_due: 50000, cheques_count: 2, investor_loans_due: 20000, net_position: 230000, status: 'HEALTHY' });
  });
  test('status is WATCH when positive but under the threshold, TIGHT when zero or negative', async () => {
    stubForecast({ cheques: 150000, loans: 100000 });                       // 300000 - 250000 = 50000
    expect((await request(app).get('/api/cash-position-forecast?months=1')).body.forecast[0].status).toBe('WATCH');
    jest.restoreAllMocks(); stubForecast({ cheques: 300000, loans: 0 });     // exactly 0
    expect((await request(app).get('/api/cash-position-forecast?months=1')).body.forecast[0].status).toBe('TIGHT');
    jest.restoreAllMocks(); stubForecast({ cheques: 400000, loans: 50000 });
    expect((await request(app).get('/api/cash-position-forecast?months=1')).body.forecast[0]).toMatchObject({ net_position: -150000, status: 'TIGHT' });
  });
  test('healthy_threshold can be set in the request', async () => {
    stubForecast();
    const r = await request(app).get('/api/cash-position-forecast?months=1&healthy_threshold=500000');
    expect(r.body.healthy_threshold).toBe(500000); expect(r.body.forecast[0].status).toBe('WATCH');   // 230000 < 500000
  });
  test('months defaults to 3 when missing or not a number', async () => {
    stubForecast();
    expect((await request(app).get('/api/cash-position-forecast')).body.forecast).toHaveLength(3);
    expect((await request(app).get('/api/cash-position-forecast?months=abc')).body.forecast).toHaveLength(3);
  });
  test('no sales history at all (average null) gives zero projected sales, not a crash', async () => {
    stubForecast({ avg: null, cheques: 0, loans: 0 });
    const r = await request(app).get('/api/cash-position-forecast?months=1');
    expect(r.status).toBe(200); expect(r.body.forecast[0]).toMatchObject({ projected_sales: 0, net_position: 0, status: 'TIGHT' });
  });
  test('a database failure gives a 500 with a message, not a crash', async () => {
    jest.spyOn(pool, 'query').mockRejectedValueOnce(new Error('db down'));
    const r = await request(app).get('/api/cash-position-forecast');
    expect(r.status).toBe(500); expect(r.body.error).toMatch(/db down/);
  });
});

describe('GET /api/non-moving-stock', () => {
  test('returns the rows from the database, using a 30 day window by default', async () => {
    const spy = jest.spyOn(pool, 'query').mockResolvedValue({ rows: [{ id: 1, item_name: 'Never sold', unit: 'pcs', current_qty: 5, reorder_level: 0, last_sale_at: null }] });
    const r = await request(app).get('/api/non-moving-stock');
    expect(r.status).toBe(200); expect(r.body.map(x => x.item_name)).toEqual(['Never sold']);
    expect(spy.mock.calls[0][1]).toEqual([30]);
  });
  test('uses the days asked; a bad days value falls back to 30', async () => {
    const spy = jest.spyOn(pool, 'query').mockResolvedValue({ rows: [] });
    await request(app).get('/api/non-moving-stock?days=7');
    await request(app).get('/api/non-moving-stock?days=zzz');
    expect(spy.mock.calls.map(c => c[1][0])).toEqual([7, 30]);
  });
  test('the query only counts in-stock items with no recent sale adjustment', async () => {
    const spy = jest.spyOn(pool, 'query').mockResolvedValue({ rows: [] });
    await request(app).get('/api/non-moving-stock');
    const sql = spy.mock.calls[0][0];
    expect(sql).toMatch(/current_qty > 0/); expect(sql).toMatch(/NOT EXISTS/); expect(sql).toMatch(/reason = 'sale'/);
  });
  test('a database failure gives a 500', async () => {
    jest.spyOn(pool, 'query').mockRejectedValueOnce(new Error('db down'));
    const r = await request(app).get('/api/non-moving-stock');
    expect(r.status).toBe(500); expect(r.body.error).toMatch(/db down/);
  });
});
