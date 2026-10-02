'use strict';
// Attachments module on its own (in-memory database): upload, list, byte-for-byte download, bad files, same key twice, admin only.
jest.mock('pg', () => require('../helpers/pgmock')());

const express = require('express');
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const router = require('../../routes/attachments');

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const DIR = path.join(__dirname, '..', '..', 'uploads', 'attachments');
const before = new Set(fs.existsSync(DIR) ? fs.readdirSync(DIR) : []);

function appAs(role) {
  const app = express();
  app.use((req, res, next) => { req.session = { user: { username: 'tester', role } }; next(); });
  app.use('/api', router);
  return app;
}
const admin = appAs('admin');

beforeAll(() => new Promise(r => setTimeout(r, 500)));          // the route creates its table first
afterAll(() => { for (const f of fs.readdirSync(DIR)) if (!before.has(f)) fs.unlinkSync(path.join(DIR, f)); });     // leave no test files behind

describe('attachments', () => {
  test('upload a photo, list it, download the same bytes', async () => {
    const up = await request(admin).post('/api/attachments').field('record_type', 'stock').field('record_id', 'T1').attach('file', PNG, 'tile.png');
    expect(up.status).toBe(201);
    expect(up.body).toMatchObject({ record_type: 'stock', record_id: 'T1', mime: 'image/png', size: PNG.length, uploaded_by: 'tester' });
    const list = await request(admin).get('/api/attachments?record_type=stock&record_id=T1');
    expect(list.body.length).toBe(1);
    const dl = await request(admin).get(up.body.download_url).buffer(true).parse((res, cb) => { const c = []; res.on('data', d => c.push(d)); res.on('end', () => cb(null, Buffer.concat(c))); });
    expect(dl.status).toBe(200);
    expect(Buffer.compare(dl.body, PNG)).toBe(0);
  });
  test('a file that is not really an image is refused, whatever its name', async () => {
    const r = await request(admin).post('/api/attachments').field('record_type', 'stock').field('record_id', 'T2').attach('file', Buffer.from('MZ not an image'), 'fake.png');
    expect(r.status).toBe(400);
  });
  test('a csv is accepted', async () => {
    const r = await request(admin).post('/api/attachments').field('record_type', 'expense').field('record_id', 'T3').attach('file', Buffer.from('a,b\n1,2\n'), 'x.csv');
    expect(r.status).toBe(201);
    expect(r.body.mime).toBe('text/csv');
  });
  test('over 10 MB is refused; odd record type is refused', async () => {
    const big = await request(admin).post('/api/attachments').field('record_type', 'stock').field('record_id', 'T4').attach('file', Buffer.alloc(10 * 1024 * 1024 + 10, 1), 'big.png');
    expect(big.status).toBe(413);
    const bad = await request(admin).post('/api/attachments').field('record_type', 'nonsense').field('record_id', 'T4').attach('file', PNG, 'a.png');
    expect(bad.status).toBe(400);
  });
  test('the same client_uuid twice is one record', async () => {
    const send = () => request(admin).post('/api/attachments').field('record_type', 'grn').field('record_id', 'T5').field('client_uuid', 'u-1').attach('file', PNG, 'a.png');
    const a = await send(), b = await send();
    expect(b.body.id).toBe(a.body.id);
    expect(b.body.duplicate).toBe(true);
    const list = await request(admin).get('/api/attachments?record_type=grn&record_id=T5');
    expect(list.body.length).toBe(1);
  });
  test('only the admin can attach files', async () => {
    for (const role of ['owner', 'staff']) {
      const r = await request(appAs(role)).post('/api/attachments').field('record_type', 'stock').field('record_id', 'T6').attach('file', PNG, 'a.png');
      expect(r.status).toBe(403);
    }
  });
});