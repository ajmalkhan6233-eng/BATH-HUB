'use strict';
// At 00:30 on 15 Oct in Colombo (still 14 Oct in UTC), routes must use 15 Oct as "today".
jest.mock('pg', () => require('../helpers/pgmock')());

const express = require('express');
const request = require('supertest');
const pg = require('pg');

const db = pg.__db.public;
db.none(`CREATE TABLE bank_accounts (id SERIAL PRIMARY KEY, account_label TEXT, bank TEXT, current_balance NUMERIC DEFAULT 0, active BOOLEAN DEFAULT true, updated_at TIMESTAMP)`);
db.none(`CREATE TABLE cheque_register (id SERIAL PRIMARY KEY, cheque_no TEXT, bank TEXT, payee TEXT NOT NULL, amount NUMERIC NOT NULL, due_date DATE NOT NULL, status TEXT NOT NULL DEFAULT 'pending', notes TEXT, created_at TIMESTAMP DEFAULT now(), updated_at TIMESTAMP DEFAULT now(), account_id INT, held_from_date DATE)`);
db.none(`CREATE TABLE investor_loans (id SERIAL PRIMARY KEY, lender_name TEXT, amount NUMERIC, profit_rate NUMERIC DEFAULT 0, date_given DATE, due_date DATE, status TEXT DEFAULT 'active', notes TEXT, qr_outstanding NUMERIC DEFAULT 0, created_at TIMESTAMP DEFAULT now(), updated_at TIMESTAMP DEFAULT now())`);
db.none(`CREATE TABLE investor_loan_payments (id SERIAL PRIMARY KEY, loan_id INT, amount NUMERIC, payment_date DATE, notes TEXT, created_at TIMESTAMP DEFAULT now())`);
db.none(`CREATE TABLE stock_items (id SERIAL PRIMARY KEY, item_name TEXT, current_qty NUMERIC DEFAULT 0, reorder_level NUMERIC DEFAULT 0)`);
db.none(`CREATE TABLE suppliers (id SERIAL PRIMARY KEY, name TEXT)`);
db.none(`CREATE TABLE acc_petty_cash_txns (id SERIAL PRIMARY KEY, txn_date DATE, txn_type TEXT, amount NUMERIC, description TEXT, category TEXT)`);
db.none(`CREATE TABLE acc_journal_entries (id SERIAL PRIMARY KEY, entry_date DATE, description TEXT, debit_account_code TEXT, credit_account_code TEXT, amount NUMERIC, reference TEXT)`);
db.none(`CREATE TABLE acc_chart_of_accounts (account_code TEXT PRIMARY KEY, account_name TEXT, account_type TEXT, parent_code TEXT, active BOOLEAN DEFAULT true)`);
db.none(`INSERT INTO acc_chart_of_accounts (account_code, account_name, account_type) VALUES ('1000','Cash','ASSET'), ('4000','Sales','INCOME')`);

const moneyRouter = require('../../routes/money_control');
const accRouter = require('../../routes/purchasing_accounting');
const compRouter = require('../../routes/competitors');

const app = express();
app.use(express.json());
app.use((req, _res, next) => { req.session = { user: { role: 'owner' } }; next(); });
app.use('/api/money-control', moneyRouter);
app.use('/', accRouter);
app.use('/api', compRouter);

const ALL_BUT_DATE = ['hrtime', 'nextTick', 'performance', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame',
  'requestIdleCallback', 'cancelIdleCallback', 'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'];

beforeAll(async () => { await new Promise(r => setTimeout(r, 120)); });
beforeEach(() => jest.useFakeTimers({ now: new Date('2026-10-14T19:00:00Z'), doNotFake: ALL_BUT_DATE }));   // 00:30 on 15 Oct, Colombo
afterEach(() => jest.useRealTimers());

describe('routes use the Colombo date for "today"', () => {
  test('money control: a breakdown saved for 15 Oct is what "today" shows', async () => {
    await request(app).post('/api/money-control/payment-breakdown').send({ report_date: '2026-10-15', mode: 'cash', amount: 4200 }).expect(200);
    await request(app).post('/api/money-control/payment-breakdown').send({ report_date: '2026-10-14', mode: 'cash', amount: 999 }).expect(200);
    const r = await request(app).get('/api/money-control/payment-breakdown');           // no date given
    expect(r.body).toHaveLength(1);
    expect(Number(r.body[0].amount)).toBe(4200);
    const dash = await request(app).get('/api/money-control/dashboard');
    expect(dash.body.date).toBe('2026-10-15');
    expect(dash.body.sales_total_today).toBe(4200);
  });

  test('daily cash plan with no date looks up 15 Oct', async () => {
    await request(app).post('/api/money-control/daily-cash-plan').send({ report_date: '2026-10-15', sales_total: 50000, expenses_total: 1000 }).expect(200);
    const r = await request(app).get('/api/money-control/daily-cash-plan');
    expect(r.status).toBe(200);
    expect(r.body.date).toBe('2026-10-15');
  });

  test('accounting defaults (petty cash date, journal date) are the Colombo day', async () => {
    const p = await request(app).post('/api/petty-cash').send({ txn_type: 'EXPENSE', amount: 300, description: 'Tea' });
    expect(String(p.body.txn_date).slice(0, 10)).toBe('2026-10-15');
    const j = await request(app).post('/api/journal-entries').send({ description: 'x', debit_account_code: '1000', credit_account_code: '4000', amount: 100 });
    expect(String(j.body.entry_date).slice(0, 10)).toBe('2026-10-15');
  });

  test('competitor checks default to the Colombo day and the month view to the Colombo month', async () => {
    const list = (await request(app).get('/api/competitors')).body;
    const c = await request(app).post(`/api/competitors/${list[0].id}/checks`).send({ posts: true });
    expect(String(c.body.checked_on).slice(0, 10)).toBe('2026-10-15');
    expect((await request(app).get('/api/competitors/checklist')).body.month).toBe('2026-10');
  });
});
