'use strict';
// Staff advances can't go negative or over-repay; attendance/leave dates are validated; payroll CSV is formula-safe.
jest.mock('pg', () => require('../helpers/pgmock')());

const express = require('express');
const request = require('supertest');
const pg = require('pg');

const db = pg.__db.public;
db.none(`CREATE TABLE staff (id SERIAL PRIMARY KEY, name TEXT, role TEXT, commission_pct NUMERIC DEFAULT 0)`);
db.none(`CREATE TABLE staff_loans (id SERIAL PRIMARY KEY, staff_id INT, loan_date DATE, amount NUMERIC, repaid NUMERIC DEFAULT 0, type TEXT DEFAULT 'loan', notes TEXT)`);
db.none(`CREATE TABLE staff_salary (id SERIAL PRIMARY KEY, staff_id INT, pay_date DATE, amount NUMERIC, commission NUMERIC DEFAULT 0, period_start DATE, period_end DATE, notes TEXT)`);
db.none(`INSERT INTO staff (name, role) VALUES ('Nimal', 'cashier')`);
db.none(`INSERT INTO staff (name, role) VALUES ('=HYPERLINK("http://evil.example","click")', '+cmd')`);
db.none(`INSERT INTO staff_salary (staff_id, pay_date, amount, commission, notes) VALUES (1, '2026-09-30', 50000, 1500, '-2+3')`);
db.none(`INSERT INTO staff_salary (staff_id, pay_date, amount, commission, notes) VALUES (2, '2026-09-30', 40000, 0, 'normal note')`);
db.none(`CREATE TABLE staff_attendance (id SERIAL PRIMARY KEY, staff_id INT, work_date DATE, status TEXT DEFAULT 'present', notes TEXT, created_at TIMESTAMP DEFAULT now(), updated_at TIMESTAMP DEFAULT now(), UNIQUE(staff_id, work_date))`);
db.none(`CREATE TABLE staff_leave (id SERIAL PRIMARY KEY, staff_id INT, leave_start DATE, leave_end DATE, leave_type TEXT, reason TEXT, status TEXT DEFAULT 'approved', created_at TIMESTAMP DEFAULT now())`);

const router = require('../../routes/staff_reports');
const app = express();
app.use(express.json());
app.use('/api', router);

const adv = body => request(app).post('/api/advances').send({ staff_id: 1, loan_date: '2026-10-01', ...body });

describe('salary advances', () => {
  test('amount must be a positive number; bad date and unknown type refused', async () => {
    expect((await adv({ amount: -500 })).status).toBe(400);
    expect((await adv({ amount: 'lots' })).status).toBe(400);
    expect((await adv({ amount: 1000, loan_date: 'yesterday' })).status).toBe(400);
    expect((await adv({ amount: 1000, type: 'gift' })).status).toBe(400);
  });

  test('a repayment cannot exceed what is still owed', async () => {
    expect((await adv({ amount: 10000 })).status).toBe(200);                          // advance 10,000
    const over = await adv({ amount: 12000, type: 'repayment' });
    expect(over.status).toBe(409);
    expect(over.body.error).toMatch(/outstanding/i);
    expect((await adv({ amount: 4000, type: 'repayment' })).status).toBe(200);       // 6,000 left
    expect((await adv({ amount: 6000, type: 'repayment' })).status).toBe(200);       // exactly clears it
    expect((await adv({ amount: 1, type: 'repayment' })).status).toBe(409);          // nothing owed now
    const rows = db.many(`SELECT type, amount FROM staff_loans WHERE staff_id = 1`);
    const owed = rows.reduce((s, r) => s + (r.type === 'advance' ? Number(r.amount) : -Number(r.amount)), 0);
    expect(owed).toBe(0);
  });
});

describe('attendance and leave', () => {
  test('attendance needs a real date and a known status', async () => {
    const post = b => request(app).post('/api/attendance').send({ staff_id: 1, work_date: '2026-10-01', ...b });
    expect((await post({ work_date: '1/10/2026' })).status).toBe(400);
    expect((await post({ status: 'vacation' })).status).toBe(400);
    expect((await post({ status: 'half_day' })).status).toBe(200);
  });

  test('leave needs real dates and end >= start', async () => {
    const post = b => request(app).post('/api/leave').send({ staff_id: 1, leave_start: '2026-10-05', leave_end: '2026-10-07', ...b });
    expect((await post({ leave_start: 'monday' })).status).toBe(400);
    expect((await post({ leave_end: '2026-10-01' })).status).toBe(400);
    expect((await post({})).status).toBe(200);
    expect((await post({ leave_end: '2026-10-05' })).status).toBe(200);            // one-day leave
  });
});

describe('payroll CSV export', () => {
  test('free-text cells that start with = + - @ are neutralised; numbers are untouched', async () => {
    const res = await request(app).get('/api/payroll-export?format=csv&start=2026-09-01&end=2026-09-30');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    const body = res.text;
    expect(body).toContain(`"'=HYPERLINK(""http://evil.example"",""click"")"`);   // name
    expect(body).toContain(`"'+cmd"`);                                              // role
    expect(body).toContain(`"'-2+3"`);                                              // notes
    expect(body).toContain('"normal note"');
    expect(body).toContain('"50000"');                                              // amounts not prefixed
    expect(body).not.toMatch(/(^|,)"=/m);                                           // no cell starts with =
  });
});
