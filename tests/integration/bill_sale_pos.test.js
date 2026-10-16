'use strict';
// The bill-photo sale goes through the REAL pos_bills route (callRouter), cash by default, credit when asked, phone kept on the bill.
jest.mock('pg', () => require('../helpers/pgmock')());
const pg = require('pg');
const db = pg.__db.public;
db.none(`CREATE TABLE daily_summary (report_date DATE PRIMARY KEY, total_sale NUMERIC)`);
db.none(`CREATE TABLE discount_rules (id SERIAL PRIMARY KEY, role VARCHAR(30) NOT NULL DEFAULT 'all', max_discount_pct NUMERIC(5,2) NOT NULL, notes TEXT, active BOOLEAN NOT NULL DEFAULT true)`);
const posBills = require('../../routes/pos_bills');
const { callRouter } = require('../../layla_owner/paperDeps');
const createBillSale = require('../../layla_owner/billSale');
const { normalizeSriLankaPhone } = require('../../utils/whatsappReceiptSender');
beforeAll(() => new Promise(r => setTimeout(r, 600)));

const sent = []; let shared = null;
const make = () => {
  sent.length = 0; if (shared) return shared;      // pg-mem cannot run CREATE TABLE IF NOT EXISTS twice; real Postgres can
  const pool = new pg.Pool();
  const api = createBillSale({ pool, normalizePhone: normalizeSriLankaPhone, receiptsLive: () => true,
    readPaper: async () => ({ ok: true, doc: { items: [{ name: 'Basin', qty: 2, unit_price: 5000, amount: 10000 }], total: 10000 } }),
    sendCustomer: async (to, text) => { sent.push({ to, text }); },
    createBill: async (payload) => { const r = await callRouter(posBills, 'POST', '/pos-bills', payload); return r.status >= 300 ? { ok: false, message: r.body && r.body.error } : { ok: true, bill: r.body }; } });
  return (shared = { api, sent });
};
test('cash sale through the real POS route; receipt text carries the real bill number', async () => {
  const { api, sent } = make();
  const r = await api.start('bill', 'x.jpg', 'bill 0771234567');
  expect(r.reply).toMatch(/Sale .* saved: Rs\. 10,000\.00 \(CASH\)/);
  const row = db.many('SELECT * FROM pos_bills ORDER BY id DESC LIMIT 1')[0];
  expect(row.payment_method).toBe('cash'); expect(Number(row.total)).toBe(10000); expect(row.customer_phone).toBe('0771234567');
  expect(sent).toHaveLength(1); expect(sent[0].text).toContain(row.bill_number);
});
test('credit sale without any customer is refused by the POS and nothing is sent', async () => {
  const { api, sent } = make();
  const before = Number(db.many('SELECT COUNT(*) AS n FROM pos_bills')[0].n);
  const r = await api.start('bill', 'x.jpg', 'bill credit');
  expect(r.reply).toMatch(/credit sale needs/i);
  expect(Number(db.many('SELECT COUNT(*) AS n FROM pos_bills')[0].n)).toBe(before); expect(sent).toHaveLength(0);
});
