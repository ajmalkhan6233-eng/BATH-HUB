const express = require('express'); const request = require('supertest'); const crypto = require('crypto');
const { newDb } = require('pg-mem');
const { migrate } = require('../scripts/migrate_layla_owner'); const { migrate: ml } = require('../scripts/migrate_vendor_ledger');
const createStore = require('../layla_owner/taskStore'); const createAdapters = require('../layla_owner/adapters'); const createRouter = require('../routes/layla_owner');
let app, store, sent = []; const now = () => new Date('2026-10-04T04:30:00Z'); const env = { WA_VERIFY_TOKEN: 'vt', WA_APP_SECRET: 'sec' };
beforeAll(async () => { const { Pool } = newDb().adapters.createPg(); const pool = new Pool(); await migrate(pool); await ml(pool); store = createStore(pool);
  const requireAuth = (req, res, next) => (req.get('x-login') ? next() : res.status(401).json({ error: 'not logged in' }));
  const r = createRouter({ store, adapters: createAdapters({ pool }), requireAuth, send: async (to, t) => sent.push(t), download: async () => ({ buffer: Buffer.from('x'), mime: 'audio/ogg' }), transcribe: async () => ({ ok: true, text: 'help' }), saveMedia: async () => 'uploads/layla-inbox/x.jpg', ownerNumber: '0777999219', env, now });
  app = express(); app.use('/api/layla-owner', r); });

test('chat needs the owner login', async () => { expect((await request(app).post('/api/layla-owner/message').send({ text: 'help' })).status).toBe(401); });
test('chat answers like the WhatsApp brain', async () => {
  const r = await request(app).post('/api/layla-owner/message').set('x-login', '1').send({ text: 'remind me to call Eskema at 4pm' });
  expect(r.status).toBe(200); expect(r.body.reply).toContain('Reminder set'); expect((await request(app).get('/api/layla-owner/tasks').set('x-login', '1')).body.length).toBeGreaterThan(0);
});
test('empty or bad input is a clean 400', async () => {
  expect((await request(app).post('/api/layla-owner/message').set('x-login', '1').send({ text: '  ' })).status).toBe(400);
  expect((await request(app).post('/api/layla-owner/media').set('x-login', '1').send({ kind: 'video', data: 'x' })).status).toBe(400);
});
test('a voice note uploaded in the app is understood', async () => {
  const r = await request(app).post('/api/layla-owner/media').set('x-login', '1').send({ kind: 'audio', mime: 'audio/webm', data: Buffer.from('abc').toString('base64') });
  expect(r.status).toBe(200); expect(r.body.reply).toContain('I heard: "help"');
});
test('Meta webhook: handshake, bad signature rejected, good signature accepted without login', async () => {
  expect((await request(app).get('/api/layla-owner/wa?hub.mode=subscribe&hub.verify_token=vt&hub.challenge=123')).text).toBe('123');
  expect((await request(app).get('/api/layla-owner/wa?hub.mode=subscribe&hub.verify_token=no&hub.challenge=123')).status).toBe(403);
  const body = JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ id: 'z1', from: '94777999219', type: 'text', text: { body: 'help' } }] } }] }] });
  expect((await request(app).post('/api/layla-owner/wa').set('Content-Type', 'application/json').set('X-Hub-Signature-256', 'sha256=bad').send(body)).status).toBe(403);
  const sig = 'sha256=' + crypto.createHmac('sha256', 'sec').update(body).digest('hex');
  expect((await request(app).post('/api/layla-owner/wa').set('Content-Type', 'application/json').set('X-Hub-Signature-256', sig).send(body)).status).toBe(200);
  await new Promise((r) => setTimeout(r, 100)); expect(sent.some((t) => t.includes('Examples'))).toBe(true);
});
