'use strict';
// WhatsApp receipt sender on its own. Uses an in-memory DB and a FAKE sender: nothing here ever contacts WhatsApp.
jest.mock('pg', () => require('../helpers/pgmock')());
const fs = require('fs');
const os = require('os');
const path = require('path');
const pg = require('pg');
const S = require('../../utils/whatsappReceiptSender');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-'));
fs.writeFileSync(path.join(dir, 'r.png'), Buffer.from('89504e470d0a1a0a', 'hex'));
const pool = new pg.Pool();
const LIVE = { WHATSAPP_LIVE: 'true', WHATSAPP_API_TOKEN: 'SECRET-TOKEN-123', WHATSAPP_PHONE_NUMBER_ID: '111' };
let logs;

async function add(phone, bill, withImage = true) {
  const r = await pool.query(`INSERT INTO receipt_queue (customer_phone, sale_reference) VALUES ($1,$2) RETURNING id`, [phone, bill]);
  if (withImage) await pool.query(`INSERT INTO receipt_images (queue_id, bill_no, file_name) VALUES ($1,$2,'r.png')`, [r.rows[0].id, bill]);
  return r.rows[0].id;
}
const row = async id => (await pool.query(`SELECT * FROM receipt_queue WHERE id=$1`, [id])).rows[0];

beforeAll(async () => {
  await pool.query(`CREATE TABLE receipt_queue (id SERIAL PRIMARY KEY, customer_phone VARCHAR(30) NOT NULL, sale_reference TEXT, amount NUMERIC(12,2), status VARCHAR(20) NOT NULL DEFAULT 'queued', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, sent_at TIMESTAMP)`);
  await pool.query(`CREATE TABLE receipt_images (id SERIAL PRIMARY KEY, queue_id INT NOT NULL, bill_no VARCHAR(30), file_name VARCHAR(120) NOT NULL, width INT, height INT, bytes INT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
});
beforeEach(() => { logs = []; jest.spyOn(console, 'log').mockImplementation(m => logs.push(String(m))); jest.spyOn(console, 'error').mockImplementation(m => logs.push(String(m))); });
afterEach(() => jest.restoreAllMocks());
afterAll(() => { fs.unlinkSync(path.join(dir, 'r.png')); fs.rmdirSync(dir); });

describe('Sri Lanka number clean-up', () => {
  test.each([['0777999219', '+94777999219'], ['077 799 9219', '+94777999219'], ['+94 77 799 9219', '+94777999219'], ['94777999219', '+94777999219'], ['0094777999219', '+94777999219'], ['777999219', '+94777999219']])('%s -> %s', (a, b) => expect(S.normalizeSriLankaPhone(a)).toBe(b));
  test.each([[''], [null], ['abc'], ['12345'], ['0112345678'], ['07779992'], ['+1 415 555 2671'], ['07779992199999']])('bad number %p is refused, never guessed', a => expect(S.normalizeSriLankaPhone(a)).toBeNull());
});

describe('sending', () => {
  test('bad number: queue item becomes "no phone", nothing sent', async () => {
    const send = jest.fn(); const id = await add('12345', 'B-BAD');
    expect((await S.sendReceiptForQueueItem(pool, id, { env: LIVE, send, dir })).status).toBe('no phone');
    expect((await row(id)).status).toBe('no phone'); expect(send).not.toHaveBeenCalled();
  });
  test('no number at all: "no phone", skipped', async () => {
    const send = jest.fn(); const id = await add('', 'B-NONE');
    const rr = await S.sendReceiptForQueueItem(pool, id, { env: LIVE, send, dir }); expect(rr).toEqual({status:'no phone'});
    expect(send).not.toHaveBeenCalled();
  });
  test('dry run (default): logs what would be sent, sends nothing, row stays queued', async () => {
    const send = jest.fn(); const id = await add('0777999219', 'B-DRY');
    const r = await S.sendReceiptForQueueItem(pool, id, { env: {}, send, dir });
    expect(r.status).toBe('dry_run'); expect(send).not.toHaveBeenCalled(); expect((await row(id)).status).toBe('queued');
    const all = logs.join('\n'); expect(all).toMatch(/dry_run/); expect(all).toMatch(/\*\*\*219/); expect(all).not.toMatch(/777999219/);
  });
  test('WHATSAPP_LIVE=false is still a dry run even with keys', async () => {
    const send = jest.fn(); const id = await add('0777999219', 'B-DRY2');
    expect((await S.sendReceiptForQueueItem(pool, id, { env: { ...LIVE, WHATSAPP_LIVE: 'false' }, send, dir })).status).toBe('dry_run');
    expect(send).not.toHaveBeenCalled();
  });
  test('live but keys missing: nothing sent, row untouched', async () => {
    const send = jest.fn(); const id = await add('0777999219', 'B-NOKEY');
    expect((await S.sendReceiptForQueueItem(pool, id, { env: { WHATSAPP_LIVE: 'true' }, send, dir })).status).toBe('no_keys');
    expect(send).not.toHaveBeenCalled(); expect((await row(id)).status).toBe('queued');
  });
  test('live send works once, to +94 number of that bill only, and marks it sent', async () => {
    const send = jest.fn().mockResolvedValue({ id: 'wamid.1' }); const id = await add('0777999219', 'B-OK');
    const r = await S.sendReceiptForQueueItem(pool, id, { env: LIVE, send, dir });
    expect(r.status).toBe('sent'); expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].to).toBe('+94777999219'); expect((await row(id)).status).toBe('sent');
    // same queue row again: never twice
    expect((await S.sendReceiptForQueueItem(pool, id, { env: LIVE, send, dir })).status).toBe('already_sent');
    expect(send).toHaveBeenCalledTimes(1);
    expect(logs.join('\n')).not.toMatch(/777999219|SECRET-TOKEN/);
  });
  test('duplicate bill (second queue row for a bill already sent) is not sent again', async () => {
    const send = jest.fn().mockResolvedValue({}); const a = await add('0771111111', 'B-DUP'); const b = await add('0771111111', 'B-DUP');
    await S.sendReceiptForQueueItem(pool, a, { env: LIVE, send, dir });
    expect((await S.sendReceiptForQueueItem(pool, b, { env: LIVE, send, dir })).status).toBe('duplicate');
    expect(send).toHaveBeenCalledTimes(1); expect((await row(b)).status).toBe('duplicate');
  });
  test('failure: 1 try + 2 retries, then "failed" with the reason; token and number never stored', async () => {
    const send = jest.fn().mockRejectedValue(new Error('boom SECRET-TOKEN-123 to 94777999219')); const id = await add('0772222222', 'B-FAIL');
    const r = await S.sendReceiptForQueueItem(pool, id, { env: LIVE, send, dir, retryWaitMs: 1 });
    expect(r.status).toBe('failed'); expect(send).toHaveBeenCalledTimes(3);
    const q = await row(id); expect(q.status).toBe('failed'); expect(q.last_error).toMatch(/boom/);
    expect(q.last_error).not.toMatch(/SECRET-TOKEN|94777999219/); expect(logs.join('\n')).not.toMatch(/SECRET-TOKEN|94777999219/);
  });
  test('a failure then a success on retry still sends once', async () => {
    const send = jest.fn().mockRejectedValueOnce(new Error('temporary')).mockResolvedValue({ id: 'x' }); const id = await add('0773333333', 'B-RETRY');
    const r = await S.sendReceiptForQueueItem(pool, id, { env: LIVE, send, dir, retryWaitMs: 1 });
    expect(r).toEqual({ status: 'sent', attempts: 2 });
  });
  test('no receipt picture yet: waits, sends nothing', async () => {
    const send = jest.fn(); const id = await add('0774444444', 'B-NOIMG', false);
    expect((await S.sendReceiptForQueueItem(pool, id, { env: LIVE, send, dir })).status).toBe('waiting'); expect(send).not.toHaveBeenCalled();
  });
  test('never throws into billing (broken database)', async () => {
    const bad = { query: () => Promise.reject(new Error('db down')) };
    expect((await S.sendReceiptForQueueItem(bad, 1, { env: LIVE, dir })).status).toBe('failed');
  });
  test('every attempt is logged with bill no and last 3 digits only', async () => {
    const r = await pool.query(`SELECT bill_no, phone_last3 FROM wa_receipt_log WHERE bill_no='B-OK'`);
    expect(r.rows.length).toBeGreaterThan(0); expect(r.rows[0].phone_last3).toBe('219');
  });
  test('caption text is exactly the approved one', () => expect(S.CAPTION).toBe('Thank you for shopping at Bath Hub. Your receipt is attached.'));
});

// Live test: ONLY to the owner's own number and ONLY when WHATSAPP_LIVE=true and keys exist. Otherwise skipped.
const liveReady = process.env.WHATSAPP_LIVE === 'true' && !!process.env.WHATSAPP_API_TOKEN && !!process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WA_LIVE_TEST === 'owner';
(liveReady ? test : test.skip)('LIVE: real send to the owner number 0777999219 only', async () => {
  const id = await add('0777999219', 'B-LIVE-OWNER');
  const r = await S.sendReceiptForQueueItem(pool, id, { dir: path.join(__dirname, '..', '..', 'public', 'brand', 'receipt-template') });
  expect(['sent', 'failed']).toContain(r.status);
});