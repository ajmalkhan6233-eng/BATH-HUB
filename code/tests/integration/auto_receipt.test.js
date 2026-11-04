'use strict';
// Automatic receipt after a sale. Fake sender + fake picture drawer: nothing here contacts WhatsApp or starts Chromium.
// Billing must save and answer 200 in EVERY case below.
jest.mock('pg', () => require('../helpers/pgmock')());
const express = require('express');
const request = require('supertest');
const pg = require('pg');
const auto = require('../../utils/autoReceipt');
const sender = require('../../utils/whatsappReceiptSender');

const db = pg.__db.public;
const router = require('../../routes/pos_bills');
const pool = new pg.Pool();
const ON = { WHATSAPP_LIVE: 'true', WHATSAPP_AUTO_SEND: 'true', WHATSAPP_API_TOKEN: 'T', WHATSAPP_PHONE_NUMBER_ID: '1' };
const app = express(); app.use(express.json()); app.use((req, _r, n) => { req.session = { user: { role: 'admin' } }; n(); }); app.use('/api', router);
const mkBill = (over = {}) => ({ id: 1, bill_number: 'BHT-1', customer_name: 'Sam', customer_phone: '0777999219', discount_amount: 0, created_at: new Date(), items: [{ item_name: 'Tile', qty: 2, unit_price: 5000 }], ...over });
const fakeRender = async () => ({ file: 'x.png', width: 10, height: 10, bytes: 5 });
const rowOf = async ref => (await pool.query(`SELECT * FROM receipt_queue WHERE sale_reference=$1`, [ref])).rows;
let n = 0; const uniq = () => 'BHT-T' + (++n);

beforeAll(() => new Promise(r => setTimeout(r, 300)));
beforeEach(() => { jest.spyOn(console, 'log').mockImplementation(() => {}); jest.spyOn(console, 'warn').mockImplementation(() => {}); jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => jest.restoreAllMocks());

describe('flags', () => {
  test('both off by default', () => { expect(auto.autoSendOn({})).toBe(false); });
  test('only LIVE, or only AUTO_SEND, is still off', () => {
    expect(auto.autoSendOn({ WHATSAPP_LIVE: 'true' })).toBe(false);
    expect(auto.autoSendOn({ WHATSAPP_AUTO_SEND: 'true' })).toBe(false);
    expect(auto.autoSendOn(ON)).toBe(true);
  });
});

describe('queue + background send', () => {
  test('sale with a number, flags on: queued, picture drawn, sent once', async () => {
    const ref = uniq(), send = jest.fn().mockResolvedValue({ id: 'm' });
    const r = await auto.queueReceiptForBill(pool, mkBill({ bill_number: ref }), { env: ON, send, render: fakeRender, dir: __dirname, retryWaitMs: 1, skipFileCheck: true });
    expect(['sent', 'waiting']).toContain(r.status);
    expect((await rowOf(ref)).length).toBe(1);
  });
  test('sale with no number: queue item "no phone", nothing sent', async () => {
    const ref = uniq(), send = jest.fn();
    const r = await auto.queueReceiptForBill(pool, mkBill({ bill_number: ref, customer_phone: '' }), { env: ON, send, render: fakeRender });
    expect(r.status).toBe('no phone'); expect((await rowOf(ref))[0].status).toBe('no phone'); expect(send).not.toHaveBeenCalled();
  });
  test('flags off: only queued, no picture drawn, no send', async () => {
    const ref = uniq(), send = jest.fn(), render = jest.fn();
    const r = await auto.queueReceiptForBill(pool, mkBill({ bill_number: ref }), { env: {}, send, render });
    expect(r.status).toBe('queued'); expect((await rowOf(ref))[0].status).toBe('queued');
    expect(send).not.toHaveBeenCalled(); expect(render).not.toHaveBeenCalled();
  });
  test('only one flag on: still only queued', async () => {
    const ref = uniq(), send = jest.fn();
    expect((await auto.queueReceiptForBill(pool, mkBill({ bill_number: ref }), { env: { WHATSAPP_LIVE: 'true' }, send, render: fakeRender })).status).toBe('queued');
    expect(send).not.toHaveBeenCalled();
  });
  test('sender failing: never throws, queue item ends "failed"', async () => {
    const ref = uniq(), send = jest.fn().mockRejectedValue(new Error('meta down'));
    const dir = require('os').tmpdir(), fs = require('fs'); fs.writeFileSync(require('path').join(dir, 'x.png'), 'p');
    const r = await auto.queueReceiptForBill(pool, mkBill({ bill_number: ref }), { env: ON, send, render: fakeRender, dir, retryWaitMs: 1 });
    expect(r.status).toBe('failed'); expect((await rowOf(ref))[0].status).toBe('failed'); expect(send).toHaveBeenCalledTimes(3);
  });
  test('picture drawing failing: never throws, item stays queued', async () => {
    const ref = uniq();
    const r = await auto.queueReceiptForBill(pool, mkBill({ bill_number: ref }), { env: ON, send: jest.fn(), render: async () => { throw new Error('no chrome'); } });
    expect(r.status).toBe('queued');
  });
  test('same bill twice: one queue row, one send', async () => {
    const ref = uniq(), send = jest.fn().mockResolvedValue({}), dir = require('os').tmpdir();
    require('fs').writeFileSync(require('path').join(dir, 'x.png'), 'p');
    const o = { env: ON, send, render: fakeRender, dir, retryWaitMs: 1 };
    await auto.queueReceiptForBill(pool, mkBill({ bill_number: ref }), o);
    const again = await auto.queueReceiptForBill(pool, mkBill({ bill_number: ref }), o);
    expect((await rowOf(ref)).length).toBe(1); expect(again.status).toBe('already_queued'); expect(send).toHaveBeenCalledTimes(1);
  });
  test('broken database: never throws', async () => {
    const r = await auto.queueReceiptForBill({ query: () => Promise.reject(new Error('db down')) }, mkBill(), { env: ON });
    expect(r.status).toBe('error');
  });
});

describe('billing is never affected (real POS route)', () => {
  const post = (over = {}) => request(app).post('/api/pos-bills').send({ items: [{ item_name: 'Tile', qty: 1, unit_price: 100 }], ...over });
  const tick = () => new Promise(r => setTimeout(r, 200));
  test('with a number, flags off: bill saves and its receipt is queued', async () => {
    const r = await post({ customer_phone: '0777999219' }); await tick();
    expect(r.status).toBe(200); expect((await rowOf(r.body.bill_number))[0].status).toBe('queued');
  });
  test('no number: bill saves, queue says "no phone"', async () => {
    const r = await post(); await tick();
    expect(r.status).toBe(200); expect((await rowOf(r.body.bill_number))[0].status).toBe('no phone');
  });
  test('queueing itself crashing: bill still saves', async () => {
    jest.spyOn(auto, 'queueReceiptForBill').mockImplementation(() => { throw new Error('boom'); });
    const r = await post({ customer_phone: '0777999219' }); await tick();
    expect(r.status).toBe(200); expect(r.body.bill_number).toBeTruthy();
  });
  test('the answer does not wait for the sender (slow sender)', async () => {
    jest.spyOn(auto, 'queueReceiptForBill').mockImplementation(() => new Promise(() => {}));
    const t = Date.now(); const r = await post({ customer_phone: '0777999219' });
    expect(r.status).toBe(200); expect(Date.now() - t).toBeLessThan(1500);
  });
});