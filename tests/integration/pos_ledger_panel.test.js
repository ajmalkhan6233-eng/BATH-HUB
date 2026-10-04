'use strict';
const request = require('supertest');
// POS page shows the daily ledger beside the bill form: framing allowed for same origin only, ledger data still behind login.
jest.mock('file-type', () => ({ fileTypeFromBuffer: jest.fn(), fromBuffer: jest.fn() }));
jest.mock('connect-pg-simple', () => (session) => session.MemoryStore);
jest.mock('pg', () => require('../helpers/pgmock')());
jest.mock('../../layla', () => ({ pool: { query: jest.fn().mockResolvedValue({ rows: [{ n: 1 }] }) }, processMessage: jest.fn(), alertOwner: jest.fn(), getOrCreateCustomer: jest.fn() }));
const fs = require('fs');
const path = require('path');
const app = require('../../server');
const root = path.join(__dirname, '..', '..');

test('daily ledger page can be framed by this same site only, and its data still needs login', async () => {
  const page = await request(app).get('/daily-entry-v2.html');
  expect(page.status).toBe(200);
  expect(page.headers['x-frame-options']).toBe('SAMEORIGIN');
  expect(String(page.headers['content-security-policy'] || '')).not.toMatch(/frame-ancestors\s+\*/);
  expect((await request(app).get('/api/daily-entry/meta')).status).toBe(401);   // the ledger's data is behind login
});

test('POS page carries the panel container and one script tag; module is wired', () => {
  const pos = fs.readFileSync(path.join(root, 'public', 'pos_billing.html'), 'utf8');
  expect(pos).toContain('<div id="ledger-panel"></div>');
  expect(pos.match(/posSidePanel\.js/g).length).toBe(1);
  const mod = fs.readFileSync(path.join(root, 'public', 'lib', 'posSidePanel.js'), 'utf8');
  expect(mod).toContain("'?embed=1'");
  expect(mod).toMatch(/min-width:1100px/);
  const sw = fs.readFileSync(path.join(root, 'public', 'service-worker.js'), 'utf8');
  expect(sw).toContain('/lib/posSidePanel.js');
});
