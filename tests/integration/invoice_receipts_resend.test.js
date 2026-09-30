'use strict';
// Receipts: a receipt already sent is not sent again unless the cashier confirms (resend: true).
jest.mock('pg', () => require('../helpers/pgmock')());
jest.mock('axios', () => ({ post: jest.fn().mockResolvedValue({ data: { success: true } }) }));

const express = require('express');
const request = require('supertest');
const pg = require('pg');
const axios = require('axios');

const db = pg.__db.public;
db.none(`CREATE TABLE pos_bills (id SERIAL PRIMARY KEY, bill_number VARCHAR(30), customer_name TEXT, customer_phone TEXT, subtotal NUMERIC, discount_pct NUMERIC DEFAULT 0, discount_amount NUMERIC DEFAULT 0, total NUMERIC, payment_method TEXT DEFAULT 'cash', notes TEXT, created_at TIMESTAMP DEFAULT now())`);
db.none(`CREATE TABLE pos_bill_items (id SERIAL PRIMARY KEY, bill_id INT, item_name TEXT, qty NUMERIC, unit_price NUMERIC, line_total NUMERIC)`);
db.none(`CREATE TABLE invoice_receipts (id SERIAL PRIMARY KEY, report_id INT, report_date DATE NOT NULL, invoice_no TEXT, customer_id INT, customer_name TEXT, customer_phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_sent', last_error TEXT, sent_at TIMESTAMP, created_at TIMESTAMP DEFAULT now(), updated_at TIMESTAMP DEFAULT now(), bill_id INT)`);
db.none(`INSERT INTO pos_bills (bill_number, subtotal, total) VALUES ('BHT-20261001-0001', 1000, 1000), ('BHT-20261001-0002', 500, 500), ('BHT-20261001-0003', 700, 700)`);
db.none(`INSERT INTO pos_bill_items (bill_id, item_name, qty, unit_price, line_total) VALUES (1,'Tile',1,1000,1000), (2,'Tap',1,500,500), (3,'Basin',1,700,700)`);
db.none(`INSERT INTO invoice_receipts (report_date, invoice_no, customer_phone, status, sent_at, bill_id) VALUES ('2026-10-01','BHT-20261001-0001','94771234567','sent', now(), 1)`);
db.none(`INSERT INTO invoice_receipts (report_date, invoice_no, customer_phone, status, bill_id) VALUES ('2026-10-01','BHT-20261001-0002','94771234568','not_sent', 2)`);
db.none(`INSERT INTO invoice_receipts (report_date, invoice_no, customer_phone, status, last_error, bill_id) VALUES ('2026-10-01','BHT-20261001-0003','94771234569','failed','bridge down', 3)`);

const router = require('../../routes/invoice_receipts');
const app = express();
app.use(express.json());
app.use('/api', router);

const send = body => request(app).post('/api/invoice-receipts/send').send(body);
const status = id => db.many(`SELECT status FROM invoice_receipts WHERE bill_id = ${id}`)[0].status;

beforeEach(() => axios.post.mockClear());

describe('receipt resend guard', () => {
  test('an already-sent receipt is refused with 409 and nothing is sent', async () => {
    const r = await send({ bill_id: 1 });
    expect(r.status).toBe(409);
    expect(r.body.code).toBe('already_sent');
    expect(axios.post).not.toHaveBeenCalled();
    expect(status(1)).toBe('sent');                 // the guard must not flip it to 'failed'
  });

  test('with resend: true it is sent again', async () => {
    const r = await send({ bill_id: 1, resend: true });
    expect(r.status).toBe(200);
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post.mock.calls[0][1].to).toBe('94771234567');
  });

  test('a not-yet-sent receipt sends normally, and only once per click', async () => {
    const r = await send({ bill_id: 2 });
    expect(r.status).toBe(200);
    expect(status(2)).toBe('sent');
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect((await send({ bill_id: 2 })).status).toBe(409);   // the second tap is caught
    expect(axios.post).toHaveBeenCalledTimes(1);
  });

  test('a failed receipt can be retried without resend', async () => {
    expect((await send({ bill_id: 3 })).status).toBe(200);
    expect(status(3)).toBe('sent');
  });
});
