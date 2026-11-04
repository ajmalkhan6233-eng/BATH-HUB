'use strict';
// Website enquiry form: no login, add-only, limited, plain text. It lands in the Enquiries tab as channel 'website'.
jest.mock('pg', () => require('../helpers/pgmock')());
const fs = require('fs');
const path = require('path');
const express = require('express');
const request = require('supertest');
const pg = require('pg');
const { createRouter, CHANNELS } = require('../../routes/enquiries');

const db = pg.__db.public;
const app = express();
app.use(express.json());
app.use((req, _res, next) => { req.session = undefined; next(); });      // nobody is logged in
const pool = new pg.Pool();
app.use('/api', createRouter(pool, { publicPerHour: 100 }));
const limited = express();
limited.use(express.json());
limited.use((req, _res, next) => { req.session = undefined; next(); });
limited.use('/api', createRouter(pool, { publicPerHour: 4 }));
const post = body => request(app).post('/api/public/enquiry').send(body);
const rows = () => db.many('SELECT * FROM enquiries ORDER BY id');
beforeAll(() => new Promise(r => setTimeout(r, 200)));

test('a visitor can leave a message without logging in; it is saved as a new website enquiry', async () => {
  const r = await post({ name: 'Nimal Perera', phone: '077 123 4567', product: 'Marble 60x60', message: 'Price for 40 boxes?' });
  expect(r.status).toBe(201);
  expect(rows()[0]).toMatchObject({ channel: 'website', status: 'new', product_interest: 'Marble 60x60' });
  expect(rows()[0].notes).toMatch(/Nimal Perera.*077 123 4567.*Price for 40 boxes/);
  expect(CHANNELS).toContain('website');
});

test('name and a real phone number are required; nothing is saved otherwise', async () => {
  const before = rows().length;
  expect((await post({ phone: '0771234567' })).status).toBe(400);
  expect((await post({ name: 'A', phone: '12' })).status).toBe(400);
  expect(rows()).toHaveLength(before);
});

test('markup and control characters are removed; long text is cut', async () => {
  await post({ name: '<script>alert(1)</script>Kamal', phone: '0771234567', message: 'x'.repeat(2000) });
  const n = rows().pop().notes;
  expect(n).not.toMatch(/[<>]/);
  expect(n.length).toBeLessThan(700);
});

test('the hidden trap field: bots get a fake success and nothing is saved', async () => {
  const before = rows().length;
  const r = await post({ name: 'Bot', phone: '0771234567', company_site: 'http://spam.example' });
  expect(r.status).toBe(201);
  expect(rows()).toHaveLength(before);
});

test('too many messages from one device are refused', async () => {
  let last;
  for (let i = 0; i < 6; i++) last = await request(limited).post('/api/public/enquiry').send({ name: 'Spam', phone: '0771234567' });
  expect(last.status).toBe(429);
});

test('the public form cannot read or change anything: the owner routes stay closed', async () => {
  expect((await request(app).get('/api/enquiries')).status).toBe(403);
  expect((await request(app).put('/api/enquiries/1/status').send({ status: 'won' })).status).toBe(403);
});

test('the page has the form, the trap field, and robots.txt hides the owner area', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'bathhub.html'), 'utf8');
  for (const id of ['cform', 'cName', 'cPhone', 'cMsg', 'cTrap', 'cSend']) expect(html).toContain(`id="${id}"`);
  expect(html).toContain('/api/public/enquiry');
  for (const lang of ['en', 'si', 'ta']) expect(html.match(/cOk:/g).length).toBeGreaterThanOrEqual(3);
  const robots = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'robots.txt'), 'utf8');
  expect(robots).toMatch(/Disallow: \/owner/);
  expect(robots).toMatch(/Disallow: \/api\//);
});
