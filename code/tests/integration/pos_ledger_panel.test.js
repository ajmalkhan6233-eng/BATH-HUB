'use strict';
// POS and the daily ledger side by side on one page (two full pages in two columns). Ledger framing is same-origin only; its data stays behind login.
jest.mock('file-type', () => ({ fileTypeFromBuffer: jest.fn(), fromBuffer: jest.fn() }));
jest.mock('connect-pg-simple', () => (session) => session.MemoryStore);
jest.mock('pg', () => require('../helpers/pgmock')());
jest.mock('../../layla', () => ({ pool: { query: jest.fn().mockResolvedValue({ rows: [{ n: 1 }] }) }, processMessage: jest.fn(), alertOwner: jest.fn(), getOrCreateCustomer: jest.fn() }));
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('../../server');
const root = path.join(__dirname, '..', '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');

test('pages can be framed by this same site only; ledger data still needs login', async () => {
  for (const u of ['/daily-entry-v2.html', '/pos_billing.html', '/pos-ledger.html']) {
    const r = await request(app).get(u);
    expect(r.status).toBe(200);
    expect(r.headers['x-frame-options']).toBe('SAMEORIGIN');
  }
  expect((await request(app).get('/api/daily-entry/meta')).status).toBe(401);
});

test('split page holds both full pages and refreshes the ledger after a bill; POS page is back to normal', () => {
  const page = read('public', 'pos-ledger.html');
  expect(page).toContain('src="/pos_billing.html"');
  expect(page).toContain('src="/daily-entry-v2.html"');
  expect(page).toContain('pos-bills');
  expect(read('public', 'pos_billing.html')).not.toContain('ledger-panel');
  expect(read('public', 'service-worker.js')).toContain('/pos-ledger.html');
});
