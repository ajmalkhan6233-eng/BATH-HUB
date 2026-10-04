const { createOutbox } = require('../public/lib/offlineSave');
const { newDb } = require('pg-mem'); const express = require('express'); const request = require('supertest');
const { migrate } = require('../scripts/migrate_layla_owner'); const idem = require('../middleware/idempotency');
const memory = () => { const m = new Map(); return { put: async (i) => m.set(i.key, { ...i }), del: async (k) => m.delete(k), all: async () => [...m.values()].map((x) => ({ ...x })) }; };

test('online save goes straight through', async () => {
  const ob = createOutbox({ storage: memory(), fetchFn: async () => ({ ok: true, status: 201, json: async () => ({ id: 5 }) }) });
  expect(await ob.post('/api/x', { a: 1 })).toMatchObject({ ok: true, queued: false, response: { id: 5 } });
});
test('offline save is kept on the device and syncs in order when the internet returns', async () => {
  let online = false; const seen = []; let k = 0;
  const f = async (u, o) => { if (!online) throw new Error('offline'); seen.push(JSON.parse(o.body).n); return { ok: true, status: 201, json: async () => ({}) }; };
  const ob = createOutbox({ storage: memory(), fetchFn: f, makeKey: () => 'key' + k++, now: () => 1000 });
  expect((await ob.post('/api/x', { n: 1 })).queued).toBe(true); expect((await ob.post('/api/x', { n: 2 })).queued).toBe(true);
  expect(await ob.status()).toEqual({ waiting: 2, failed: 0, needsLogin: false });
  online = true; const r = await ob.flush(); expect(r.sent).toBe(2); expect(seen).toEqual([1, 2]); expect(await ob.status()).toEqual({ waiting: 0, failed: 0, needsLogin: false });
});
test('a rejected save (400) is final and reported, not retried forever', async () => {
  const ob = createOutbox({ storage: memory(), fetchFn: async () => ({ ok: false, status: 400, json: async () => ({ error: 'total must be positive' }) }) });
  expect(await ob.post('/api/x', {})).toMatchObject({ ok: false, queued: false, error: 'total must be positive' });
});
test('logged out (401): the save is kept, not lost, and syncs after login', async () => {
  let loggedIn = false; const f = async () => (loggedIn ? { ok: true, status: 201, json: async () => ({}) } : { ok: false, status: 401, json: async () => ({ error: 'not logged in' }) });
  const ob = createOutbox({ storage: memory(), fetchFn: f, makeKey: () => 'auth1' });
  expect(await ob.post('/api/x', { n: 1 })).toMatchObject({ ok: true, queued: true }); expect((await ob.status()).needsLogin).toBe(true);
  await ob.flush(); expect((await ob.status()).waiting).toBe(1);
  loggedIn = true; expect((await ob.flush()).sent).toBe(1); expect(await ob.status()).toEqual({ waiting: 0, failed: 0, needsLogin: false });
});
test('a server error is retried later with backoff and keeps order', async () => {
  let t = 0; let calls = 0; const f = async () => { calls++; return { ok: false, status: 503, json: async () => ({}) }; };
  const ob = createOutbox({ storage: memory(), fetchFn: f, now: () => t, makeKey: () => 'kk' + calls });
  await ob.post('/api/x', { n: 1 }); calls = 0; await ob.flush(); expect(calls).toBe(1);
  await ob.flush(); expect(calls).toBe(1);        // too soon, backed off
  t = 10 ** 6; await ob.flush(); expect(calls).toBe(2);
});
test('server ignores a repeated Idempotency-Key and returns the first answer', async () => {
  const { Pool } = newDb().adapters.createPg(); const pool = new Pool(); await migrate(pool);
  let writes = 0; const app = express(); app.use(express.json()); app.post('/api/save', idem({ pool }), (req, res) => { writes++; res.status(201).json({ id: writes }); });
  const a = await request(app).post('/api/save').set('Idempotency-Key', 'abc-12345678').send({});
  const b = await request(app).post('/api/save').set('Idempotency-Key', 'abc-12345678').send({});
  expect(a.status).toBe(201); expect(b.status).toBe(201); expect(b.body).toEqual(a.body); expect(b.headers['idempotent-replay']).toBe('true'); expect(writes).toBe(1);
  const c = await request(app).post('/api/save').set('Idempotency-Key', 'bad key!!').send({}); expect(c.status).toBe(400);
});
