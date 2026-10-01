'use strict';
// SALARY module on its own (in-memory Postgres): settings, Today, Month, closing, late returns, cheque set-aside.
jest.mock('pg', () => require('../helpers/pgmock')());

const express = require('express');
const request = require('supertest');
const pg = require('pg');

const db = pg.__db.public;
db.none(`CREATE TABLE daily_summary (id SERIAL PRIMARY KEY, report_date DATE UNIQUE NOT NULL, total_sale NUMERIC DEFAULT 0, cash_sale NUMERIC DEFAULT 0, gross_profit NUMERIC DEFAULT 0, total_expenses NUMERIC DEFAULT 0, gp_status TEXT DEFAULT 'NOT_AVAILABLE')`);
db.none(`CREATE TABLE daily_reports (id SERIAL PRIMARY KEY, report_date DATE, total_sale NUMERIC DEFAULT 0, is_refund BOOLEAN DEFAULT FALSE, created_at TIMESTAMPTZ DEFAULT NOW())`);
db.none(`CREATE TABLE cheque_register (id SERIAL PRIMARY KEY, cheque_no TEXT, payee TEXT, amount NUMERIC, due_date DATE, status TEXT DEFAULT 'pending')`);

const { createRouter } = require('../../routes/salary');
let TODAY = '2026-10-01';
const router = createRouter(new pg.Pool(), { today: () => TODAY });
function appAs(role) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.session = role ? { user: { role } } : undefined; next(); });
  app.use('/api', router);
  return app;
}
const owner = appAs('owner');
const get = (u, a = owner) => request(a).get('/api' + u);
const put = (u, b) => request(owner).put('/api' + u).send(b);
const post = (u, b = {}) => request(owner).post('/api' + u).send(b);
beforeAll(() => new Promise(r => setTimeout(r, 300)));

describe('access', () => {
  test('owner only', async () => {
    for (const a of [appAs('staff'), appAs(null)]) {
      expect((await get('/salary/today', a)).status).toBe(403);
      expect((await get('/salary/month', a)).status).toBe(403);
      expect((await get('/salary/settings', a)).status).toBe(403);
    }
  });
});

describe('settings', () => {
  test('defaults are the owner numbers; they are editable and checked', async () => {
    const s = (await get('/salary/settings')).body.settings;
    expect(s).toMatchObject({ save_pct: 10, colleague_pct: 15, owner_pct: 10, rent_month: 70000, utilities_month: 30000, working_days: 26, owner_daily: 5000, colleague_daily: 3000, cost_normal: 15000, cost_ceiling: 18000, push_1: 100000, push_2: 150000 });
    expect((await put('/salary/settings', { save_pct: 12 })).body.settings.save_pct).toBe(12);
    expect((await get('/salary/settings')).body.settings.save_pct).toBe(12);
    await put('/salary/settings', { save_pct: 10 });
    for (const bad of [{ save_pct: 150 }, { nonsense: 1 }, { rent_month: -5 }, { working_days: 0 }, { cost_ceiling: 100 }, { colleague_pct: 60, owner_pct: 60 }, { markup: 1 }, { rent_month: 'abc' }]) {
      expect((await put('/salary/settings', bad)).status).toBe(400);
    }
    expect((await get('/salary/settings')).body.settings.rent_month).toBe(70000);   // refused changes were not saved
  });
});

describe('Today', () => {
  test('no data yet: net is PENDING (null), never a guess; costs and break-even still show', async () => {
    const t = (await get('/salary/today')).body;
    expect(t).toMatchObject({ date: '2026-10-01', sales: 0, net: null, gross_profit: null });
    expect(t.costs.total).toBeCloseTo(14846.15, 1);
    expect(t.margin_pct).toBe(25);                       // no history: the setting
    expect(t.break_even_sales).toBe(Math.ceil(t.costs.total / 0.25));
  });

  test("today's figures, margin from the last 30 days, push progress and break-even", async () => {
    db.none(`INSERT INTO daily_summary (report_date, total_sale, cash_sale, gross_profit, total_expenses, gp_status) VALUES ('2026-09-20', 100000, 60000, 20000, 9000, 'LASERSOFT')`);
    db.none(`INSERT INTO daily_summary (report_date, total_sale, cash_sale, gross_profit, total_expenses, gp_status) VALUES ('2026-10-01', 120000, 70000, 26000, 15000, 'LASERSOFT')`);
    const t = (await get('/salary/today')).body;
    expect(t).toMatchObject({ sales: 120000, gross_profit: 26000, expenses: 15000, net: 11000, margin_pct: 20 });
    expect(t.break_even_sales).toBe(Math.ceil(t.costs.total / 0.2));
    expect(t.break_even_reached).toBe(true);
    expect(t.push[0]).toMatchObject({ target: 100000, pct: 100, remaining: 0 });
    expect(t.push[1]).toMatchObject({ target: 150000, pct: 80, remaining: 30000 });
  });

  test('cheque set-aside: amount / days left, today and overdue in full, warns when it is more than the sales cash', async () => {
    db.none(`INSERT INTO cheque_register (payee, amount, due_date, status) VALUES ('Tile Zone', 50000, '2026-10-02', 'pending'), ('Lanka Tiles', 70000, '2026-10-08', 'pending'), ('Far', 90000, '2026-10-30', 'pending'), ('Paid one', 40000, '2026-10-02', 'cleared')`);
    const t = (await get('/salary/today')).body;
    expect(t.cheque_set_aside.amount).toBe(60000);
    expect(t.cheque_set_aside.message).toBe('Set aside Rs 60,000 today for cheques.');
    expect(t.cheque_set_aside.warning).toBeNull();                     // 60,000 < today's cash 70,000
    db.none(`UPDATE daily_summary SET cash_sale = 30000 WHERE report_date = '2026-10-01'`);
    expect((await get('/salary/today')).body.cheque_set_aside.warning).toMatch(/more than today's sales cash/);
  });

  test('a HELD (postponed) cheque is still owed, so it counts; a cleared one does not', async () => {
    db.none(`INSERT INTO cheque_register (payee, amount, due_date, status) VALUES ('Held one', 10000, '2026-10-03', 'held')`);
    expect((await get('/salary/today')).body.cheque_set_aside.amount).toBeCloseTo(60000 + 5000, 1);   // + 10,000 / 2 days
    db.none(`DELETE FROM cheque_register WHERE payee = 'Held one'`);
  });

  test('a cheque marked covered drops out of the set-aside, and can be un-marked', async () => {
    const id = db.many(`SELECT id FROM cheque_register WHERE payee = 'Tile Zone'`)[0].id;
    expect((await post(`/salary/cheque-cover/${id}`)).body.covered).toBe(true);
    expect((await get('/salary/today')).body.cheque_set_aside.amount).toBe(10000);
    await post(`/salary/cheque-cover/${id}`, { covered: false });
    expect((await get('/salary/today')).body.cheque_set_aside.amount).toBe(60000);
    expect((await post('/salary/cheque-cover/abc')).status).toBe(400);
  });
});

describe('Month, closing and late returns', () => {
  beforeAll(() => {
    // September: gross 50,000, returns 2,000 (an earlier refund), expenses 30,000 -> net 18,000
    db.none(`DELETE FROM daily_summary`);
    db.none(`INSERT INTO daily_summary (report_date, total_sale, gross_profit, total_expenses, gp_status) VALUES ('2026-09-10', 200000, 30000, 18000, 'LASERSOFT'), ('2026-09-20', 150000, 20000, 12000, 'LASERSOFT')`);
    db.none(`INSERT INTO daily_reports (report_date, total_sale, is_refund, created_at) VALUES ('2026-09-12', -2000, true, '2026-09-13T10:00:00Z')`);
  });

  test('net = gross profit - returns - expenses, then the money order', async () => {
    const m = (await get('/salary/month?ym=2026-09')).body;
    expect(m).toMatchObject({ gross_profit: 50000, returns: 2000, expenses: 30000, net: 18000 });
    expect(m.split).toMatchObject({ save: 1800, pool: 16200, colleague: 2430, owner: 1620, keep: 12150 });
    expect(m.adjustments).toEqual([]);
    expect(m.colleague_commission.payable).toBe(2430);
  });

  test('zero or negative net: no savings, no commission', async () => {
    db.none(`INSERT INTO daily_summary (report_date, total_sale, gross_profit, total_expenses, gp_status) VALUES ('2026-08-10', 50000, 5000, 9000, 'LASERSOFT')`);
    const m = (await get('/salary/month?ym=2026-08')).body;
    expect(m.net).toBe(-4000);
    expect(m.split).toEqual({ save: 0, pool: 0, colleague: 0, owner: 0, keep: 0 });
    expect(m.note).toMatch(/no commission/);
  });

  test('a month cannot be closed before it ends; bad month text is refused', async () => {
    expect((await post('/salary/month/2026-10/close')).status).toBe(400);
    expect((await post('/salary/month/oct/close')).status).toBe(400);
    expect((await get('/salary/month?ym=bad')).status).toBe(400);
  });

  test('closing freezes September; closing twice is refused', async () => {
    const c = await post('/salary/month/2026-09/close');
    expect(c.status).toBe(201);
    expect(c.body.closed).toMatchObject({ net: 18000 });
    expect((await post('/salary/month/2026-09/close')).status).toBe(409);
  });

  test('a return recorded AFTER September was closed never reopens it: it becomes an adjustment against October', async () => {
    db.none(`INSERT INTO daily_reports (report_date, total_sale, is_refund, created_at) VALUES ('2026-09-25', -3000, true, NOW() + interval '1 hour')`);
    const sep = (await get('/salary/month?ym=2026-09')).body;
    expect(sep.net).toBe(15000);                                      // the live figure moves, but September stays closed
    expect(sep.closed).not.toBeNull();
    // September closed at net 18,000 (colleague 2,430, owner 1,620); with the late 3,000 off it would have been 15,000 (2,025 / 1,350)
    const oct = (await get('/salary/month?ym=2026-10')).body;
    expect(oct.adjustments).toEqual([{ from_month: '2026-09', late_returns: 3000, colleague: 405, owner: 270 }]);
    expect(oct.colleague_commission.adjustment).toBe(405);
    expect(oct.owner_commission.adjustment).toBe(270);
  });

  test('October with a profit: the adjustment comes off its commission as its own line; closing records it so it is not taken twice', async () => {
    db.none(`INSERT INTO daily_summary (report_date, total_sale, gross_profit, total_expenses, gp_status) VALUES ('2026-10-05', 100000, 25000, 10000, 'LASERSOFT')`);
    TODAY = '2026-11-02';                                              // October has ended
    const oct = (await get('/salary/month?ym=2026-10')).body;
    expect(oct.net).toBe(15000);
    expect(oct.split.colleague).toBe(2025);
    expect(oct.colleague_commission).toMatchObject({ calculated: 2025, adjustment: 405, payable: 1620 });
    expect(oct.owner_commission).toMatchObject({ calculated: 1350, adjustment: 270, payable: 1080 });
    expect((await post('/salary/month/2026-10/close')).status).toBe(201);
    const nov = (await get('/salary/month?ym=2026-11')).body;
    expect(nov.adjustments).toEqual([]);                               // already deducted
  });

  test('an adjustment bigger than the month commission carries forward, never makes commission negative', async () => {
    TODAY = '2026-12-02';
    db.none(`INSERT INTO daily_summary (report_date, total_sale, gross_profit, total_expenses, gp_status) VALUES ('2026-11-10', 10000, 1000, 800, 'LASERSOFT')`);
    db.none(`INSERT INTO daily_reports (report_date, total_sale, is_refund, created_at) VALUES ('2026-10-20', -6000, true, NOW() + interval '2 hours')`);
    const nov = (await get('/salary/month?ym=2026-11')).body;
    expect(nov.net).toBe(200);
    expect(nov.colleague_commission.payable).toBe(0);
    expect(nov.colleague_commission.carried_forward).toBeGreaterThan(0);
  });
});

describe('pricing rules helper', () => {
  test('cost 1,000: list 1,950; 1,050 refused', async () => {
    expect((await get('/salary/price-check?cost=1000')).body.list_price).toBe(1950);
    expect((await get('/salary/price-check?cost=1000&price=1050')).body.too_close_to_cost).toBe(true);
    expect((await get('/salary/price-check?cost=0')).status).toBe(400);
  });
});
