'use strict';
// One site: Royal Bath Hub is the front door, /owner is the business screens, the old addresses redirect.
jest.mock('file-type', () => ({ fileTypeFromBuffer: jest.fn() }));
jest.mock('connect-pg-simple', () => (session) => session.MemoryStore);
jest.mock('pg', () => require('../helpers/pgmock')());
jest.mock('../../layla', () => ({ pool: { query: jest.fn().mockResolvedValue({ rows: [{ n: 1 }] }) }, processMessage: jest.fn(), alertOwner: jest.fn(), getOrCreateCustomer: jest.fn() }));
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const pg = require('pg');
pg.__db.public.none(`CREATE TABLE users (id SERIAL PRIMARY KEY, username TEXT, role TEXT, password_hash TEXT, active BOOLEAN DEFAULT true)`);
pg.__db.public.none(`INSERT INTO users (username, role) VALUES ('a', 'admin')`);
const app = require('../../server');

test('the front door is Royal Bath Hub; /app and /nature go to /owner', async () => {
  const gate = r => r.headers.location;
  const root = await request(app).get('/');
  expect([root.status, gate(root)]).toEqual([302, '/bathhub.html']);
  for (const p of ['/app', '/nature']) { const r = await request(app).get(p); expect([r.status, gate(r)]).toEqual([302, '/owner']); }
});

test('/owner serves the business screens (login is still required for private data)', async () => {
  const r = await request(app).get('/owner');
  expect(r.status).toBe(200);
  expect(r.text).toContain('Royal Bath Hub');
  expect(r.text).toContain('id="page-docinbox"');
  expect((await request(app).get('/api/document-inbox')).status).toBeGreaterThanOrEqual(401);
});

test('the public site links to the owner area and shows no owner data', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'bathhub.html'), 'utf8');
  expect(html).toContain('href="/owner"');
  expect(html).not.toMatch(/document-inbox|cheque|avg_cost/i);
});
