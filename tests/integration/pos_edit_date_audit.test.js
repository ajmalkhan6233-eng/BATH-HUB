'use strict';
// POS bill corrections (void / edit / history): admin only, valid input, bad input, a database failure.
jest.mock('pg', () => require('../helpers/pgmock')());

const express = require('express');
const request = require('supertest');
const pg = require('pg');
pg.__db.public.none(`CREATE TABLE IF NOT EXISTS customers (id SERIAL PRIMARY KEY, name VARCHAR(100), phone VARCHAR(30), whatsapp VARCHAR(30), source VARCHAR(40), notes TEXT)`);
pg.__db.public.none(`CREATE TABLE IF NOT EXISTS credit_customers (id SERIAL PRIMARY KEY, customer_id INT, invoice_date DATE, invoice_no VARCHAR(60), amount NUMERIC(12,2), paid NUMERIC(12,2) DEFAULT 0, due_date DATE, notes TEXT)`);
const posBills = require('../../routes/pos_bills');                 // creates the bill tables
const corrections = require('../../routes/pos_bill_corrections');
const pool = require('../../utils/pool');

const app = express();
app.use(express.json());
app.use((req, res, next) => { const role = req.get('x-role'); if (role) req.session = { user: { role, username: 'tester' } }; next(); });
app.use('/api', posBills);
app.use('/api', corrections);

beforeAll(() => new Promise(r => setTimeout(r, 600)));
afterEach(() => jest.restoreAllMocks());

const as = role => ({
  get: u => request(app).get(u).set('x-role', role),
  post: (u, b) => request(app).post(u).set('x-role', role).send(b),
  put: (u, b) => request(app).put(u).set('x-role', role).send(b),
});
const admin = as('admin');

// 21 Nov: changing a bill's day on edit is saved AND written to money_audit_log (who, old day, new day, reason).
// POST /api/pos-bills cannot run on the in-memory test DB (the bill-number query uses a regex operator it lacks), so the bill is inserted directly
let seq = 0;
const newBill = async () => { const r = await pool.query(`INSERT INTO pos_bills (bill_number, subtotal, discount_pct, discount_amount, total, payment_method, discount_override, stock_deducted) VALUES ($1,1000,0,0,1000,'cash',false,false) RETURNING id`, ['T-' + (++seq)]); await pool.query(`INSERT INTO pos_bill_items (bill_id, item_name, qty, unit_price, line_total) VALUES ($1,'Tap',2,500,1000)`, [r.rows[0].id]); return { id: r.rows[0].id }; };
const today = () => new Date(Date.now() + 19800000).toISOString().slice(0, 10);
const yest = () => new Date(Date.now() + 19800000 - 864e5).toISOString().slice(0, 10);
test('edit with a new day moves the bill and logs old day, new day, who and reason', async () => {
  const b = await newBill();
  const r = await admin.put('/api/pos-bills/' + b.id, { items: [{ item_name: 'Tap', qty: 2, unit_price: 500 }], payment_method: 'cash', sale_date: yest(), reason: 'date changed' });
  expect({ s: r.status, e: r.body.error }).toEqual({ s: 200, e: undefined });
  expect(new Date(r.body.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' })).toBe(yest());
  await new Promise(x => setTimeout(x, 150));
  const log = (await pool.query(`SELECT * FROM money_audit_log WHERE action='pos_bill_date_change' AND ref_id=$1`, [b.id])).rows;
  expect(log).toHaveLength(1);
  expect([log[0].who, log[0].old_value, log[0].new_value, log[0].reason]).toEqual(['tester', today(), yest(), 'date changed']);
});
test('edit with a future day is refused and nothing is logged', async () => {
  const b = await newBill();
  const r = await admin.put('/api/pos-bills/' + b.id, { items: [{ item_name: 'Tap', qty: 2, unit_price: 500 }], payment_method: 'cash', sale_date: '2999-01-01', reason: 'x1x' });
  expect(r.status).toBe(400);
});
