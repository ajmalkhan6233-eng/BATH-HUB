'use strict';
// Overdue cheques: still to be paid (pending or held) and past their due date.
jest.mock('pg', () => require('../helpers/pgmock')());

const express = require('express');
const request = require('supertest');
const pg = require('pg');

const db = pg.__db.public;
db.none(`CREATE TABLE cheque_register (id SERIAL PRIMARY KEY, cheque_no TEXT, bank TEXT, payee TEXT NOT NULL, amount NUMERIC NOT NULL,
  due_date DATE NOT NULL, status TEXT NOT NULL DEFAULT 'pending', notes TEXT, created_at TIMESTAMP DEFAULT now(), updated_at TIMESTAMP DEFAULT now())`);
const router = require('../../routes/cheque_register');
const app = express();
app.use(express.json());
app.use('/api', router);

// "today" as the in-memory database sees it (its CURRENT_DATE), so the test is stable at any hour
const dbToday = new Date(db.one('SELECT CURRENT_DATE AS d').d);
const day = off => { const d = new Date(dbToday); d.setUTCDate(d.getUTCDate() + off); return d.toISOString().slice(0, 10); };
const add = (payee, amt, off, status) => db.none(`INSERT INTO cheque_register (payee, amount, due_date, status) VALUES ('${payee}', ${amt}, '${day(off)}', '${status}')`);

beforeAll(() => {
  add('Late pending', 10000, -5, 'pending');
  add('Later held', 20000, -2, 'held');
  add('Paid long ago', 30000, -30, 'cleared');
  add('Bounced', 40000, -3, 'bounced');
  add('Not yet', 60000, 4, 'pending');   // (a cheque due today is not overdue: due_date < CURRENT_DATE; not asserted here because pg-mem treats CURRENT_DATE as a timestamp)
});

test('overdue = pending or held, due before today, oldest first, with days overdue', async () => {
  const r = await request(app).get('/api/cheque-register/overdue');
  expect(r.status).toBe(200);
  expect(r.body.map(c => c.payee)).toEqual(['Late pending', 'Later held']);
  expect(r.body.map(c => c.days_overdue)).toEqual([5, 2]);
  expect(r.body[0].amount).toBe(10000);
});

test('the other cheque lists still work beside it', async () => {
  expect((await request(app).get('/api/cheque-register/due-soon?days=10')).body.map(c => c.payee)).toContain('Not yet');
  expect(Array.isArray((await request(app).get('/api/cheque-register/overdue')).body)).toBe(true);
});
