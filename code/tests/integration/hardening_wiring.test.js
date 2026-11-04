'use strict';
// The hardening pieces as mounted in server.js: CSP + headers on /site and /api/site, rate limits on the public API, JSON depth guard,
// golden-core routes untouched. Real server over the in-memory test database.
jest.mock('file-type', () => ({ fileTypeFromBuffer: jest.fn(), fromBuffer: jest.fn() }));
jest.mock('connect-pg-simple', () => (session) => session.MemoryStore);
jest.mock('pg', () => require('../helpers/pgmock')());
jest.mock('../../layla', () => ({ pool: { query: jest.fn().mockResolvedValue({ rows: [{ n: 1 }] }) }, processMessage: jest.fn(), alertOwner: jest.fn(), getOrCreateCustomer: jest.fn() }));
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const pg = require('pg');
pg.__db.public.none(`CREATE TABLE users (id SERIAL PRIMARY KEY, username TEXT, role TEXT, password_hash TEXT, active BOOLEAN DEFAULT true)`);
pg.__db.public.none(`INSERT INTO users (username, role) VALUES ('a', 'admin')`);
const app = require('../../server');
const page = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'website', 'index.html'), 'utf8');
const h = txt => "'sha256-" + crypto.createHash('sha256').update(txt.replace(/\r\n?/g, '\n'), 'utf8').digest('base64') + "'";
const get = (url, ip) => request(app).get(url).set('X-Forwarded-For', ip);

describe('security headers on the public site', () => {
  test('/site: CSP carries the hash of the real inline script and style, no unsafe-inline for them', async () => {
    const r = await request(app).get('/site');
    expect(r.status).toBe(200);
    const csp = r.headers['content-security-policy'];
    const script = /<script>([\s\S]*?)<\/script>/.exec(page)[1], style = /<style>([\s\S]*?)<\/style>/.exec(page)[1];
    expect(csp).toContain(h(script)); expect(csp).toContain(h(style));
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/); expect(csp).not.toMatch(/(^|; )style-src [^;]*unsafe-inline/);
    expect(csp).toContain("frame-ancestors 'none'"); expect(csp).toContain('https://fonts.gstatic.com');
    expect(r.headers['x-content-type-options']).toBe('nosniff');
    expect(r.headers['referrer-policy']).toBeTruthy();
    expect(r.headers['permissions-policy']).toContain('camera=()');
  });
  test('/api/site/public carries the policy too; the owner app API does not get the site policy', async () => {
    const r = await request(app).get('/api/site/public');
    expect(r.status).toBe(200); expect(r.headers['content-security-policy']).toContain("default-src 'self'");
    const o = await request(app).get('/api/me');
    expect(o.headers['content-security-policy']).toBeUndefined();
  });
});

describe('rate limits on the public API', () => {
  test('/api/site/public: 60 per minute per outside IP, the 61st is 429; the next IP is fine', async () => {
    const ip = '203.0.113.50';
    for (let i = 0; i < 60; i++) expect((await get('/api/site/public', ip)).status).toBe(200);
    const r = await get('/api/site/public', ip);
    expect(r.status).toBe(429); expect(r.body.error).toMatch(/too many requests/i);
    expect((await get('/api/site/public', '203.0.113.51')).status).toBe(200);
  });
  test('/api/public/catalogue is limited separately (own counter)', async () => {
    const ip = '203.0.113.52';
    for (let i = 0; i < 60; i++) await get('/api/public/catalogue', ip);
    expect((await get('/api/public/catalogue', ip)).status).toBe(429);
    expect((await get('/api/site/public', ip)).status).toBe(200);
  });
  test('devices on the shop network (private addresses) are never counted', async () => {
    for (let i = 0; i < 70; i++) expect((await get('/api/site/public', '192.168.1.40')).status).toBe(200);
  });
});

describe('JSON depth guard on public endpoints', () => {
  test('absurdly nested body is refused with 400 before any handler', async () => {
    let o = {}; const root = o; for (let i = 0; i < 40; i++) { o.n = {}; o = o.n; }
    const r = await request(app).post('/api/public/enquiry').set('X-Forwarded-For', '203.0.113.60').send(root);
    expect(r.status).toBe(400); expect(r.body.error).toMatch(/too complicated/i);
  });
  test('a normal enquiry body still reaches the real handler', async () => {
    const r = await request(app).post('/api/public/enquiry').set('X-Forwarded-For', '203.0.113.61').send({ name: 'A', message: 'hi' });
    expect(r.body.error || '').not.toMatch(/too complicated/i);
  });
});

describe('golden-core routes unchanged by the hardening mounts', () => {
  test('summary is still behind the login gate', async () => {
    expect((await request(app).get('/api/summary')).status).toBe(401);
  });
});
