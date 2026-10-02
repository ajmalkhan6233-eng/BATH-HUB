'use strict';
// Website editor routes on their own: public feed leaks nothing, edits need the owner login, photo rules, delete removes the file.
// The picture shrinker (Chromium) is replaced by a stub here; one real-Chromium test runs only if Chromium exists.
const fs = require('fs');
const os = require('os');
const path = require('path');
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'site-'));
process.env.SITE_UPLOAD_DIR = DIR;
jest.mock('pg', () => require('../helpers/pgmock')());
const express = require('express');
const request = require('supertest');
const siteImage = require('../../utils/siteImage');
const router = require('../../routes/site_editor');

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const JPG = Buffer.concat([Buffer.from('ffd8ffe000104a46494600010100000100010000', 'hex'), Buffer.alloc(64, 1), Buffer.from('ffd9', 'hex')]);
const appAs = role => { const a = express(); a.use(express.json()); a.use((req, _r, n) => { if (role) req.session = { user: { role } }; n(); }); a.use('/api', router); return a; };
const owner = appAs('admin'), staff = appAs('staff'), nobody = appAs(null);
const files = () => fs.readdirSync(DIR);
let resizeSpy;

beforeAll(async () => { await new Promise(r => setTimeout(r, 300)); });
beforeEach(() => { resizeSpy = jest.spyOn(siteImage, 'resizeToWebp').mockImplementation(async () => ({ buffer: Buffer.from('RIFFxxxxWEBPstub'), ext: 'webp', width: 10, height: 10 })); });
afterEach(() => jest.restoreAllMocks());
afterAll(() => { for (const f of files()) fs.unlinkSync(path.join(DIR, f)); fs.rmdirSync(DIR); });

const mk = async (over = {}) => (await request(owner).post('/api/site/tiles').send({ name: 'Calacatta', size: '24 x 24 in', finish: 'polished', group: 'stone', ...over })).body;
const up = (app, id, buf, name, type) => request(app).post(`/api/site/tiles/${id}/photo`).attach('photo', buf, { filename: name, contentType: type });

describe('public feed (no login)', () => {
  test('returns only visible tiles with only the allowed fields, and the site text', async () => {
    const shown = await mk({ name: 'Shown tile' });
    const hidden = await mk({ name: 'Hidden tile', visible: false });
    await request(owner).put('/api/site/text').send({ whatsapp: '0777999219', address: 'Thihariya', promise: { en: { h: 'H', p: 'P' } } });
    const r = await request(nobody).get('/api/site/public');
    expect(r.status).toBe(200);
    expect(Object.keys(r.body).sort()).toEqual(['text', 'tiles']);
    const names = r.body.tiles.map(t => t.name);
    expect(names).toContain('Shown tile'); expect(names).not.toContain('Hidden tile');
    expect(r.body.tiles.every(t => JSON.stringify(Object.keys(t).sort()) === JSON.stringify(['finish', 'group', 'id', 'name', 'photoUrl', 'size']))).toBe(true);
    expect(Object.keys(r.body.text).sort()).toEqual(['address', 'promise', 'whatsapp']);
    expect(r.body.text.whatsapp).toBe('94777999219');
    const raw = JSON.stringify(r.body);
    expect(raw).not.toMatch(/visible|photo_file|created_at|updated_at|grp|password|salary|cheque|loan/i);
    expect(hidden.visible).toBe(false); expect(shown.visible).toBe(true);
  });
});

describe('edit routes need the owner login', () => {
  const calls = [['get', '/api/site/tiles'], ['post', '/api/site/tiles'], ['put', '/api/site/tiles/1'], ['delete', '/api/site/tiles/1'], ['post', '/api/site/tiles/1/photo'], ['delete', '/api/site/tiles/1/photo'], ['get', '/api/site/text'], ['put', '/api/site/text']];
  test.each(calls)('no login: %s %s -> 401', async (m, u) => { expect((await request(nobody)[m](u).send({})).status).toBe(401); });
  test.each(calls)('staff: %s %s -> 403', async (m, u) => { expect((await request(staff)[m](u).send({})).status).toBe(403); });
});

describe('tiles', () => {
  test('new tile defaults to shown; bad finish, group and empty name are refused', async () => {
    const t = (await request(owner).post('/api/site/tiles').send({ name: 'Basic' })).body;
    expect(t.visible).toBe(true);
    expect((await request(owner).post('/api/site/tiles').send({ name: 'x', finish: 'shiny' })).status).toBe(400);
    expect((await request(owner).post('/api/site/tiles').send({ name: 'x', group: 'metal' })).status).toBe(400);
    expect((await request(owner).post('/api/site/tiles').send({ name: '  ' })).status).toBe(400);
  });
  test('edit and the show switch work', async () => {
    const t = await mk({ name: 'Edit me' });
    const r = await request(owner).put('/api/site/tiles/' + t.id).send({ name: 'Edited', visible: false });
    expect(r.body.name).toBe('Edited'); expect(r.body.visible).toBe(false);
    expect((await request(nobody).get('/api/site/public')).body.tiles.map(x => x.name)).not.toContain('Edited');
  });
});

describe('photos', () => {
  test('a real PNG is accepted, resized, stored under a random name (never the original name)', async () => {
    const t = await mk(); const before = files().length;
    const r = await up(owner, t.id, PNG, '../../evil name.png', 'image/png');
    expect(r.status).toBe(201); expect(resizeSpy).toHaveBeenCalledTimes(1);
    expect(r.body.photoUrl).toMatch(/^\/api\/site\/photo\/[a-f0-9]{24}\.webp$/);
    expect(files().length).toBe(before + 1);
    expect(files().join()).not.toMatch(/evil/);
    const pic = await request(nobody).get(r.body.photoUrl); expect(pic.status).toBe(200);
  });
  test('a real JPG is accepted too', async () => { const t = await mk(); expect((await up(owner, t.id, JPG, 'a.jpg', 'image/jpeg')).status).toBe(201); });
  test('fake extension: text, exe and gif renamed to .jpg/.png are refused and nothing is saved', async () => {
    const t = await mk(); const before = files().length;
    for (const [buf, name] of [[Buffer.from('hello world, I am not a picture'), 'a.jpg'], [Buffer.from('MZ\x90\x00\x03exe-bytes'), 'b.png'], [Buffer.from('GIF89a\x01\x00\x01\x00\x00\x00\x00;'), 'c.png']]) {
      expect((await up(owner, t.id, buf, name, 'image/png')).status).toBe(415);
    }
    expect(files().length).toBe(before); expect(resizeSpy).not.toHaveBeenCalled();
  });
  test('over 5 MB is refused', async () => {
    const t = await mk(); const big = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024 + 10, 7)]);
    expect((await up(owner, t.id, big, 'big.png', 'image/png')).status).toBe(413);
  });
  test('no file, and unknown tile', async () => {
    const t = await mk();
    expect((await request(owner).post(`/api/site/tiles/${t.id}/photo`)).status).toBe(400);
    expect((await up(owner, 99999, PNG, 'a.png', 'image/png')).status).toBe(404);
  });
  test('photo URLs only serve our own random names', async () => {
    expect((await request(nobody).get('/api/site/photo/..%2Fpackage.json')).status).toBe(404);
    expect((await request(nobody).get('/api/site/photo/secret.txt')).status).toBe(404);
  });
  test('replacing a photo deletes the old file', async () => {
    const t = await mk(); const a = (await up(owner, t.id, PNG, 'a.png', 'image/png')).body.photoUrl.split('/').pop();
    expect(files()).toContain(a);
    const b = (await up(owner, t.id, PNG, 'b.png', 'image/png')).body.photoUrl.split('/').pop();
    expect(files()).not.toContain(a); expect(files()).toContain(b);
  });
  test('deleting a tile deletes its photo file', async () => {
    const t = await mk(); const f = (await up(owner, t.id, PNG, 'a.png', 'image/png')).body.photoUrl.split('/').pop();
    expect(files()).toContain(f);
    expect((await request(owner).delete('/api/site/tiles/' + t.id)).status).toBe(200);
    expect(files()).not.toContain(f);
    expect((await request(owner).delete('/api/site/tiles/' + t.id)).status).toBe(404);
  });
  test('a photo that cannot be decoded is refused and nothing is saved', async () => {
    resizeSpy.mockRejectedValue(new Error('bad image'));
    const t = await mk(); const before = files().length;
    expect((await up(owner, t.id, PNG, 'a.png', 'image/png')).status).toBe(422); expect(files().length).toBe(before);
  });
});

describe('site text', () => {
  test('saves and reads back; bad WhatsApp number and over-long text refused', async () => {
    const r = await request(owner).put('/api/site/text').send({ whatsapp: '077 799 9219', address: 'Kandy Road', promise: { si: { h: 'සිංහල', p: 'ඡේදය' }, ta: { h: 'தமிழ்', p: 'பத்தி' } } });
    expect(r.status).toBe(200);
    const g = (await request(owner).get('/api/site/text')).body;
    expect(g.whatsapp).toBe('94777999219'); expect(g.promise.si.h).toBe('සිංහල'); expect(g.promise.ta.p).toBe('பத்தி');
    expect((await request(owner).put('/api/site/text').send({ whatsapp: '12' })).status).toBe(400);
    expect((await request(owner).put('/api/site/text').send({ address: 'x'.repeat(201) })).status).toBe(400);
  });
});

let haveChrome = false; try { haveChrome = fs.existsSync(require('puppeteer').executablePath()); } catch (e) { /* none */ }
(haveChrome ? test : test.skip)('real Chromium: a 3000 px picture is shrunk to 1200 px webp', async () => {
  jest.restoreAllMocks();
  const puppeteer = require('puppeteer'); const b = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const p = await b.newPage();
  const big = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 3000; c.height = 1500; c.getContext('2d').fillRect(0, 0, 3000, 1500); return c.toDataURL('image/png').split(',')[1]; });
  await b.close();
  const buf = Buffer.from(big, 'base64');
  expect(await siteImage.detectType(buf)).toBe('png');
  const out = await siteImage.resizeToWebp(buf);
  expect(out.width).toBe(1200); expect(out.height).toBe(600); expect(out.buffer.slice(8, 12).toString()).toBe('WEBP');
}, 90000);