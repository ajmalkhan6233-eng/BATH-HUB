'use strict';
// Sync module on its own (in-memory database): idempotency middleware + needs-review routes.
jest.mock('pg', () => require('../helpers/pgmock')());

const express = require('express');
const request = require('supertest');
const crypto = require('crypto');
const sync = require('../../routes/sync');
const { Pool } = require('pg');

const handlerRuns = { things: 0, bad: 0 };
function appAs(role) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.session = { user: { username: 'tester', role } }; next(); });
  app.use('/api', sync.idempotency());                         // mounted before the route modules, like server.js will do
  app.post('/api/things', (req, res) => { handlerRuns.things++; res.status(201).json({ id: handlerRuns.things, name: req.body.name }); });
  app.post('/api/bad', (req, res) => { handlerRuns.bad++; if (handlerRuns.bad === 1) return res.status(400).json({ error: 'name missing' }); res.status(201).json({ ok: true }); });
  app.use('/api', sync);
  return app;
}
const admin = appAs('admin');
const db = new Pool();
const created = [];
const key = () => { const k = crypto.randomUUID(); created.push(k); return k; };

beforeAll(async () => { await new Promise(r => setTimeout(r, 500)); await sync.ensure(); });
afterAll(async () => { for (const k of created) await db.query('DELETE FROM sync_log WHERE id = $1', [k]); });     // leave no test rows behind

describe('idempotency middleware', () => {
  test('same key twice: handler ran once, second answer identical + X-Idempotent-Replay', async () => {
    const k = key();
    const a = await request(admin).post('/api/things').set('X-Idempotency-Key', k).send({ name: 'x' });
    const b = await request(admin).post('/api/things').set('X-Idempotency-Key', k).send({ name: 'x' });
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(b.body).toEqual(a.body);
    expect(a.headers['x-idempotent-replay']).toBeUndefined();
    expect(b.headers['x-idempotent-replay']).toBe('1');
    expect(handlerRuns.things).toBe(1);
    const row = (await db.query('SELECT status, record_type, response_status FROM sync_log WHERE id=$1', [k])).rows[0];
    expect(row).toMatchObject({ status: 'done', record_type: 'things', response_status: 201 });
  });
  test('no key or a bad key: always runs', async () => {
    const before = handlerRuns.things;
    await request(admin).post('/api/things').send({ name: 'a' });
    await request(admin).post('/api/things').set('X-Idempotency-Key', 'not-a-uuid').send({ name: 'a' });
    await request(admin).post('/api/things').set('X-Idempotency-Key', 'not-a-uuid').send({ name: 'a' });
    expect(handlerRuns.things).toBe(before + 3);
  });
  test('a 4xx is not cached: a corrected retry runs', async () => {
    const k = key();
    const a = await request(admin).post('/api/bad').set('X-Idempotency-Key', k).send({});
    expect(a.status).toBe(400);
    const row = await db.query('SELECT 1 FROM sync_log WHERE id=$1', [k]);
    expect(row.rows.length).toBe(0);
    const b = await request(admin).post('/api/bad').set('X-Idempotency-Key', k).send({ name: 'fixed' });
    expect(b.status).toBe(201);
    expect(b.headers['x-idempotent-replay']).toBeUndefined();
  });
  test('a key still pending gives 409 after waiting', async () => {
    const k = key();
    await db.query(`INSERT INTO sync_log (id, status, method, path) VALUES ($1,'pending','POST','/api/things')`, [k]);
    const r = await request(admin).post('/api/things').set('X-Idempotency-Key', k).send({ name: 'x' });
    expect(r.status).toBe(409);
    expect(r.body.error).toMatch(/still processing/);
  }, 15000);
});

describe('roles', () => {
  test('staff and the read-only owner get 403 on every sync route', async () => {
    for (const role of ['staff', 'owner']) {
      const app = appAs(role);
      expect((await request(app).get('/api/sync/status')).status).toBe(403);
      expect((await request(app).get('/api/sync/review')).status).toBe(403);
      expect((await request(app).post('/api/sync/needs-review').send({ uuid: crypto.randomUUID(), method: 'PUT', url: '/api/items/1' })).status).toBe(403);
      expect((await request(app).post('/api/sync/review/' + crypto.randomUUID() + '/resolve').send({ action: 'dismissed' })).status).toBe(403);
    }
  });
});

describe('needs-review flow', () => {
  test('receive, list, idempotent resend, resolve, status counts', async () => {
    const id = key();
    const body = { uuid: id, method: 'PUT', url: '/api/items/5', body: '{"price":10}', queued_at: '2026-07-01T10:00:00Z', device: 'D7K2' };
    const a = await request(admin).post('/api/sync/needs-review').send(body);
    expect(a.status).toBe(201);
    const b = await request(admin).post('/api/sync/needs-review').send(body);
    expect(b.status).toBe(201);
    expect(b.body.duplicate).toBe(true);
    const list = await request(admin).get('/api/sync/review');
    const mine = list.body.filter(r => r.id === id);
    expect(mine.length).toBe(1);
    expect(mine[0]).toMatchObject({ method: 'PUT', path: '/api/items/5', device: 'D7K2', record_type: 'items' });
    expect(mine[0].detail.body).toBe('{"price":10}');
    const st1 = await request(admin).get('/api/sync/status');
    expect(st1.body.counts.needs_review).toBeGreaterThanOrEqual(1);
    expect(st1.body.last.every(r => !('response_body' in r))).toBe(true);
    expect((await request(admin).post(`/api/sync/review/${id}/resolve`).send({ action: 'bogus' })).status).toBe(400);
    const res1 = await request(admin).post(`/api/sync/review/${id}/resolve`).send({ action: 'dismissed', note: 'server price is right' });
    expect(res1.status).toBe(200);
    expect((await request(admin).post(`/api/sync/review/${id}/resolve`).send({ action: 'applied' })).status).toBe(409);
    const after = await request(admin).get('/api/sync/review');
    expect(after.body.filter(r => r.id === id).length).toBe(0);
    const row = (await db.query('SELECT status, resolved_by FROM sync_log WHERE id=$1', [id])).rows[0];
    expect(row).toMatchObject({ status: 'dismissed', resolved_by: 'tester' });
  });
  test('bad input is refused; unknown id is 404', async () => {
    expect((await request(admin).post('/api/sync/needs-review').send({ method: 'PUT', url: '/api/items/1' })).status).toBe(400);
    expect((await request(admin).post('/api/sync/review/' + crypto.randomUUID() + '/resolve').send({ action: 'applied' })).status).toBe(404);
  });
});
