'use strict';
// WhatsApp photos land in the Document Inbox. In draft-only mode a customer's photo is kept but never read, and nothing is sent back.
jest.mock('file-type', () => ({ fileTypeFromBuffer: jest.fn() }));
jest.mock('connect-pg-simple', () => (session) => session.MemoryStore);
jest.mock('pg', () => require('../helpers/pgmock')());
jest.mock('../../layla', () => ({
  pool: { query: jest.fn().mockResolvedValue({ rows: [] }) },
  processMessage: jest.fn(async () => ({ message: 'LAYLA auto reply', escalate: false })),
  alertOwner: jest.fn(), getOrCreateCustomer: jest.fn(),
}));
jest.mock('../../scripts/ocr_photo', () => ({ ocrPhoto: jest.fn(), PROMPT: 'x' }));

const fs = require('fs');
const os = require('os');
const path = require('path');
const DROP = fs.mkdtempSync(path.join(os.tmpdir(), 'drop-'));
process.env.DROP_ROOT = DROP;
process.env.WHATSAPP_TEST_WHITELIST = '94770000000';          // the owner
process.env.WHATSAPP_PAPER_NUMBERS = '94771111111';           // a staff member who may send papers
process.env.AGENT_DRAFT_ONLY = 'false';

const request = require('supertest');
const pg = require('pg');
const db = pg.__db.public;
db.none(`CREATE TABLE whatsapp_draft_entries (id SERIAL PRIMARY KEY, from_number TEXT, photo_path TEXT, report_date DATE, total_sale NUMERIC, cash_sale NUMERIC, card_sale NUMERIC, online_sale NUMERIC, credit_sale NUMERIC, total_expenses NUMERIC, expense_items TEXT, confidence TEXT, ocr_notes TEXT, ocr_raw JSONB, status TEXT DEFAULT 'PENDING_CONFIRM', confirmed_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW())`);
const app = require('../../server');
const { ocrPhoto } = require('../../scripts/ocr_photo');
// server.js uses LAYLA's pool for the draft table: point that (mocked) pool at the in-memory database
const realPool = new pg.Pool();
require('../../layla').pool.query.mockImplementation((...a) => realPool.query(...a));

const dir = path.join(DROP, 'inbox', '2026-09-30');
fs.mkdirSync(dir, { recursive: true });
let n = 0;
const photo = () => { const f = path.join(dir, `p${++n}.jpg`); fs.writeFileSync(f, Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 1, 2, 3])); return f; };
const send = (from, filePath) => request(app).post('/webhook/whatsapp-photo').send({ from, filePath });
const inbox = () => db.many('SELECT * FROM document_inbox ORDER BY id');
const settle = () => new Promise(r => setTimeout(r, 400));

beforeAll(settle);
afterAll(() => fs.rmSync(DROP, { recursive: true, force: true }));
beforeEach(() => ocrPhoto.mockReset());
afterEach(() => { process.env.AGENT_DRAFT_ONLY = 'false'; });

test('a bill photo from the owner is recorded for checking, and the reply points to the Document Inbox', async () => {
  ocrPhoto.mockResolvedValue({ document_type: 'manual_bill', confidence: 'medium', bill_number: '5', date: '2026-09-29', items: [{ name: 'Tile', qty: 1, unit_price: 100, amount: 100 }], total: 100 });
  const r = await send('94770000000', photo());
  expect(r.status).toBe(200);
  expect(r.body.reply).toMatch(/Document Inbox/);
  const row = inbox().pop();
  expect(row).toMatchObject({ source: 'whatsapp', doc_type: 'manual_bill', status: 'to_check', from_ref: '94770000000' });
  expect(JSON.parse(row.extracted).bill_number).toBe('5');
  // YES keeps it for the inbox; it is not filed by WhatsApp
  const yes = await request(app).post('/webhook/whatsapp').send({ from: '94770000000', message: 'YES' });
  expect(yes.body.reply).toMatch(/Document Inbox/);
  expect(db.many('SELECT status FROM document_inbox WHERE id = ' + row.id)[0].status).toBe('to_check');
});

test('a photo the reader cannot read is still kept', async () => {
  ocrPhoto.mockRejectedValue(new Error('reader down'));
  const before = inbox().length;
  const r = await send('94770000000', photo());
  expect(r.status).toBe(200);
  expect(inbox()).toHaveLength(before + 1);
  expect(inbox().pop().reader_note).toMatch(/Could not read/);
});

describe('draft-only mode', () => {
  beforeEach(() => { process.env.AGENT_DRAFT_ONLY = 'true'; });

  test("a customer's photo is kept as a customer photo, never read, and nothing is sent back", async () => {
    const before = inbox().length;
    const r = await send('94779999999', photo());
    expect(r.status).toBe(200);
    expect(r.body.reply).toBe('');
    expect(ocrPhoto).not.toHaveBeenCalled();
    const row = inbox().pop();
    expect(inbox()).toHaveLength(before + 1);
    expect(row).toMatchObject({ doc_type: 'customer_photo', from_ref: '94779999999' });
  });

  test('the owner and listed staff numbers can still send papers', async () => {
    ocrPhoto.mockResolvedValue({ document_type: 'cheque_note', payee: 'X', amount: 10, due_date: '2026-10-01' });
    for (const who of ['94770000000', '94771111111']) {
      const r = await send(who, photo());
      expect(r.status).toBe(200);
    }
    expect(ocrPhoto).toHaveBeenCalledTimes(2);
  });
});
