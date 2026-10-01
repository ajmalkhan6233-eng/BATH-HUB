'use strict';
// Receipts: the number is checked on WhatsApp first. Not on WhatsApp -> nothing is sent and the cashier is told.
// Cannot tell (bridge down / old bridge) -> it still tries, exactly as before.
jest.mock('pg', () => require('../helpers/pgmock')());
jest.mock('puppeteer-core', () => { throw new Error('no browser in tests'); });
jest.mock('axios', () => ({ post: jest.fn() }));

const fs = require('fs');
const path = require('path');
const express = require('express');
const request = require('supertest');
const pg = require('pg');
const axios = require('axios');

const db = pg.__db.public;
db.none(`CREATE TABLE pos_bills (id SERIAL PRIMARY KEY, bill_number VARCHAR(30), customer_name TEXT, customer_phone TEXT, subtotal NUMERIC, discount_pct NUMERIC DEFAULT 0, discount_amount NUMERIC DEFAULT 0, total NUMERIC, payment_method TEXT DEFAULT 'cash', notes TEXT, created_at TIMESTAMP DEFAULT now())`);
db.none(`CREATE TABLE pos_bill_items (id SERIAL PRIMARY KEY, bill_id INT, item_name TEXT, qty NUMERIC, unit_price NUMERIC, line_total NUMERIC)`);
db.none(`CREATE TABLE invoice_receipts (id SERIAL PRIMARY KEY, report_id INT, report_date DATE NOT NULL, invoice_no TEXT, customer_id INT, customer_name TEXT, customer_phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_sent', last_error TEXT, sent_at TIMESTAMP, created_at TIMESTAMP DEFAULT now(), updated_at TIMESTAMP DEFAULT now(), bill_id INT)`);
db.none(`INSERT INTO pos_bills (bill_number, subtotal, total) VALUES ('B-1', 1000, 1000), ('B-2', 500, 500), ('B-3', 700, 700)`);
db.none(`INSERT INTO pos_bill_items (bill_id, item_name, qty, unit_price, line_total) VALUES (1,'Tile',1,1000,1000), (2,'Tap',1,500,500), (3,'Basin',1,700,700)`);
db.none(`INSERT INTO invoice_receipts (report_date, invoice_no, customer_phone, bill_id) VALUES ('2026-10-01','B-1','94771234567',1), ('2026-10-01','B-2','94771234568',2), ('2026-10-01','B-3','94771234569',3)`);

const router = require('../../routes/invoice_receipts');
const app = express();
app.use(express.json());
app.use('/api', router);

const bridge = ({ registered, down } = {}) => axios.post.mockImplementation(async url => {
  if (/\/check$/.test(url)) { if (down) throw new Error('connect ECONNREFUSED'); return { data: { registered } }; }
  return { data: { success: true } };
});
const sends = () => axios.post.mock.calls.filter(c => /\/send$/.test(c[0]));
const status = id => db.many(`SELECT status, last_error FROM invoice_receipts WHERE bill_id = ${id}`)[0];
beforeEach(() => axios.post.mockReset());

describe('number check', () => {
  test('on WhatsApp: the live check says so, and the receipt is sent', async () => {
    bridge({ registered: true });
    const c = await request(app).get('/api/invoice-receipts/check-number?phone=077%201234567');
    expect(c.body).toEqual({ phone: '94771234567', registered: true });
    const r = await request(app).post('/api/invoice-receipts/send').send({ bill_id: 1 });
    expect(r.status).toBe(200);
    expect(sends()).toHaveLength(1);
    expect(status(1).status).toBe('sent');
  });

  test('NOT on WhatsApp: nothing is sent, the cashier is told plainly, the failure is recorded', async () => {
    bridge({ registered: false });
    expect((await request(app).get('/api/invoice-receipts/check-number?phone=0771234568')).body.registered).toBe(false);
    const r = await request(app).post('/api/invoice-receipts/send').send({ bill_id: 2 });
    expect(r.status).toBe(422);
    expect(r.body.error).toMatch(/not on WhatsApp/);
    expect(sends()).toHaveLength(0);
    expect(status(2)).toMatchObject({ status: 'failed' });
  });

  test('cannot tell (bridge down): the check says unknown and sending is still attempted', async () => {
    bridge({ down: true });
    expect((await request(app).get('/api/invoice-receipts/check-number?phone=0771234569')).body.registered).toBe(null);
    const r = await request(app).post('/api/invoice-receipts/send').send({ bill_id: 3 });
    expect(r.status).toBe(200);
    expect(sends()).toHaveLength(1);
  });

  test('a bad number is refused with a clear message', async () => {
    const r = await request(app).get('/api/invoice-receipts/check-number?phone=12');
    expect(r.status).toBe(400);
    expect(axios.post).not.toHaveBeenCalled();
  });
});

describe('POS page and bridge wiring', () => {
  const pos = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'pos_billing.html'), 'utf8');
  const bridgeSrc = fs.readFileSync(path.join(__dirname, '..', '..', 'whatsapp-bridge.js'), 'utf8');

  test('Print sends the receipt to WhatsApp (when ticked), never twice, never asking questions', () => {
    expect(pos).toContain('onclick="printBill()"');
    expect(pos).toMatch(/async function printBill\(\)[\s\S]*window\.print\(\)[\s\S]*sendWhatsAppReceipt\(true\)/);
    expect(pos).toMatch(/if \(!phone && auto\) return;/);
    expect(pos).toMatch(/if \(auto\) \{ setMsg\('Receipt was already sent/);
    expect(pos).toContain('id="autoWa"');
    expect(pos).toContain('/api/invoice-receipts/check-number');
  });

  test('the bridge has a read-only /check that sends nothing', () => {
    const block = bridgeSrc.slice(bridgeSrc.indexOf("app.post('/check'"), bridgeSrc.indexOf("app.get('/qr'"));
    expect(block).toContain('getNumberId');
    expect(block).not.toMatch(/sendMessage/);
  });
});
