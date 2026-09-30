'use strict';
// Held cheques are still owed; a cleared cheque can't be re-held; credit sales aren't cash; inputs are validated.
jest.mock('pg', () => require('../helpers/pgmock')());

const express = require('express');
const request = require('supertest');
const pg = require('pg');

const db = pg.__db.public;
db.none(`CREATE TABLE bank_accounts (id SERIAL PRIMARY KEY, account_label TEXT, bank TEXT, current_balance NUMERIC DEFAULT 0, active BOOLEAN DEFAULT true, updated_at TIMESTAMP)`);
db.none(`CREATE TABLE cheque_register (id SERIAL PRIMARY KEY, cheque_no TEXT, bank TEXT, payee TEXT NOT NULL, amount NUMERIC NOT NULL,
  due_date DATE NOT NULL, status TEXT NOT NULL DEFAULT 'pending', notes TEXT, created_at TIMESTAMP DEFAULT now(), updated_at TIMESTAMP DEFAULT now(),
  account_id INT, held_from_date DATE)`);
db.none(`CREATE TABLE investor_loans (id SERIAL PRIMARY KEY, lender_name TEXT, amount NUMERIC, profit_rate NUMERIC DEFAULT 0, date_given DATE, due_date DATE, status TEXT DEFAULT 'active', notes TEXT, qr_outstanding NUMERIC DEFAULT 0, created_at TIMESTAMP DEFAULT now(), updated_at TIMESTAMP DEFAULT now())`);
db.none(`CREATE TABLE investor_loan_payments (id SERIAL PRIMARY KEY, loan_id INT, amount NUMERIC, payment_date DATE, notes TEXT, created_at TIMESTAMP DEFAULT now())`);
db.none(`CREATE TABLE notification_dismissals (id SERIAL PRIMARY KEY, category TEXT, ref_id INT, due_date DATE, dismissed_at TIMESTAMP DEFAULT now(), UNIQUE(category, ref_id, due_date))`);
db.none(`CREATE TABLE stock_items (id SERIAL PRIMARY KEY, item_name TEXT, current_qty NUMERIC DEFAULT 0, reorder_level NUMERIC DEFAULT 0)`);

const chequeRouter = require('../../routes/cheque_register');
const moneyRouter = require('../../routes/money_control');
const notificationsRouter = require('../../routes/notifications');

const app = express();
app.use(express.json());
app.use('/api', chequeRouter);
app.use('/api/money-control', moneyRouter);
app.use('/api', notificationsRouter);

// "today" as the in-memory database sees it (its CURRENT_DATE), so the test is stable at any hour
const dbToday = new Date(db.one('SELECT CURRENT_DATE AS d').d);
const day = off => { const d = new Date(dbToday); d.setUTCDate(d.getUTCDate() + off); return d.toISOString().slice(0, 10); };
const addCheque = async (payee, amount, due) => (await request(app).post('/api/cheque-register').send({ payee, amount, due_date: due })).body.id;

beforeAll(() => new Promise(r => setTimeout(r, 100)));   // let the routes' CREATE TABLEs finish

describe('held cheques', () => {
  test('a held cheque is still counted in the daily cash plan (set aside) and in due-soon', async () => {
    await request(app).post('/api/money-control/daily-cash-plan').send({ report_date: day(0), sales_total: 100000, expenses_total: 0 });
    const id = await addCheque('Supplier A', 30000, day(3));
    const beforeRes = await request(app).get(`/api/money-control/daily-cash-plan?date=${day(0)}`); if (beforeRes.status !== 200) throw new Error(JSON.stringify(beforeRes.body).slice(0, 400)); const before = beforeRes.body;
    expect(before.set_aside.cheques.total).toBe(10000);            // 30000 over 3 days

    const held = await request(app).post(`/api/money-control/cheque-register/${id}/hold`).send({ new_due_date: day(6) });
    expect(held.status).toBe(200);
    expect(held.body.status).toBe('held');
    const after = (await request(app).get(`/api/money-control/daily-cash-plan?date=${day(0)}`)).body;
    expect(after.set_aside.cheques.total).toBe(5000);              // still owed: 30000 over 6 days (was dropped to 0)
    expect(after.set_aside.cheques.breakdown.map(c => c.payee)).toContain('Supplier A');

    const soonRes = await request(app).get('/api/cheque-register/due-soon?days=10'); if (soonRes.status !== 200) throw new Error(JSON.stringify(soonRes.body).slice(0, 300)); const soon = soonRes.body;
    expect(soon.map(c => c.payee)).toContain('Supplier A');
  });

  test('holding twice keeps the ORIGINAL date as the crossed-out date', async () => {
    const id = await addCheque('Supplier B', 1000, day(2));
    await request(app).post(`/api/money-control/cheque-register/${id}/hold`).send({ new_due_date: day(9) });
    const second = await request(app).post(`/api/money-control/cheque-register/${id}/hold`).send({ new_due_date: day(16) });
    expect(second.status).toBe(200);
    expect(String(second.body.held_from_date).slice(0, 10)).toBe(day(2));
    expect(String(second.body.due_date).slice(0, 10)).toBe(day(16));
  });

  test('a cleared or bounced cheque cannot be put on hold (409)', async () => {
    const id = await addCheque('Supplier C', 1000, day(2));
    await request(app).put(`/api/cheque-register/${id}`).send({ status: 'cleared' });
    const r = await request(app).post(`/api/money-control/cheque-register/${id}/hold`).send({ new_due_date: day(9) });
    expect(r.status).toBe(409);
    expect(r.body.error).toMatch(/cleared/);
    const row = db.many(`SELECT status FROM cheque_register WHERE id = ${id}`)[0];
    expect(row.status).toBe('cleared');
  });

  test('hold: bad or missing date, unknown cheque', async () => {
    const id = await addCheque('Supplier D', 1000, day(2));
    expect((await request(app).post(`/api/money-control/cheque-register/${id}/hold`).send({})).status).toBe(400);
    expect((await request(app).post(`/api/money-control/cheque-register/${id}/hold`).send({ new_due_date: 'soon' })).status).toBe(400);
    expect((await request(app).post('/api/money-control/cheque-register/9999/hold').send({ new_due_date: day(5) })).status).toBe(404);
  });
});

describe('money control inputs', () => {
  test('payment breakdown only accepts the five known modes', async () => {
    const post = (mode, amount = 100) => request(app).post('/api/money-control/payment-breakdown').send({ report_date: day(0), mode, amount });
    expect((await post('cash')).status).toBe(200);
    expect((await post('Cash')).status).toBe(400);
    expect((await post('bitcoin')).status).toBe(400);
    expect((await post('card', -5)).status).toBe(400);
  });

  test('bank account balances must be numbers', async () => {
    expect((await request(app).post('/api/money-control/bank-accounts').send({ account_label: 'HNB', current_balance: 'lots' })).status).toBe(400);
    expect((await request(app).post('/api/money-control/bank-accounts').send({ account_label: '  ' })).status).toBe(400);
    const id = (await request(app).post('/api/money-control/bank-accounts').send({ account_label: 'HNB', current_balance: 5000 })).body.id;
    expect((await request(app).put(`/api/money-control/bank-accounts/${id}/balance`).send({ current_balance: 'x' })).status).toBe(400);
    expect((await request(app).put(`/api/money-control/bank-accounts/${id}/balance`).send({ current_balance: -250 })).status).toBe(200);   // an overdraft is a real balance
  });

  test('allocations: category and status are checked', async () => {
    expect((await request(app).post('/api/money-control/money-allocations').send({ label: 'x', category: 'gift', amount: 5 })).status).toBe(400);
    const id = (await request(app).post('/api/money-control/money-allocations').send({ label: 'Stock', category: 'planned_spend', amount: 5000 })).body.id;
    expect((await request(app).put(`/api/money-control/money-allocations/${id}`).send({ status: 'lost' })).status).toBe(400);
    expect((await request(app).put(`/api/money-control/money-allocations/${id}`).send({ status: 'done' })).status).toBe(200);
  });
});

describe('dashboard "can we cover today?"', () => {
  test('credit (on account) sales are not counted as money in hand', async () => {
    // the dashboard reads "today" as the UTC date (known quirk), so post to that date
    const utcToday = new Date().toISOString().slice(0, 10);
    const post = (mode, amount) => request(app).post('/api/money-control/payment-breakdown').send({ report_date: utcToday, mode, amount });
    await post('credit', 100000);                 // sold on account: no cash yet
    await post('cash', 1000);
    await addCheque('Due today', 50000, day(0));
    const res = await request(app).get('/api/money-control/dashboard');
    if (res.status !== 200) throw new Error(JSON.stringify(res.body).slice(0, 300));
    expect(res.body.sales_total_today).toBe(101000);      // sales include credit
    expect(res.body.cash_in_today).toBe(1000);            // money in hand does not
    expect(res.body.can_cover_today).toBe(false);         // was true: the 100,000 of credit sales was counted as cash
  });
});

describe('due-soon notifications', () => {
  test('a held cheque (postponed, not cancelled) still raises its due-soon alert', async () => {
    const id = await addCheque('Held payee', 7000, day(1));
    await request(app).post(`/api/money-control/cheque-register/${id}/hold`).send({ new_due_date: day(3) });
    const res = await request(app).get('/api/notifications');
    if (res.status !== 200) throw new Error(JSON.stringify(res.body).slice(0, 300));
    const mine = res.body.filter(n => n.title === 'Cheque — Held payee');
    expect(mine).toHaveLength(1);
    expect(mine[0].due_date).toBe(day(3));
  });
});
