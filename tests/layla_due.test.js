'use strict';
const express = require('express'); const http = require('http');
const createRouter = require('../routes/layla_owner');
const NOW = new Date('2026-11-08T09:00:00Z');
const task = (id, title, due, snooze) => ({ id, title, status: 'OPEN', due_at: new Date(due), snoozed_until: snooze ? new Date(snooze) : null });
function get(app, path) { return new Promise((resolve) => { const s = app.listen(0, () => { http.get({ port: s.address().port, path }, (r) => { let b = ''; r.on('data', (c) => (b += c)); r.on('end', () => { s.closeAllConnections && s.closeAllConnections(); s.close(); resolve({ status: r.statusCode, body: JSON.parse(b) }); }); }); }); }); }
test('GET /due returns only reminders whose time has come, snooze respected', async () => {
  const store = { listOpen: async () => [task(1, 'call Metro', '2026-11-08T08:00:00Z'), task(2, 'later today', '2026-11-08T12:00:00Z'), task(3, 'snoozed', '2026-11-08T07:00:00Z', '2026-11-08T10:00:00Z'), task(4, 'snooze over', '2026-11-08T07:00:00Z', '2026-11-08T08:30:00Z')] };
  const app = express(); app.use('/', createRouter({ store, adapters: {}, requireAuth: null, now: () => NOW, env: {} }));
  const r = await get(app, '/due');
  expect(r.status).toBe(200);
  expect(r.body.due.map((t) => t.id)).toEqual([1, 4]);
  expect(r.body.due[0].key).toBe('1@2026-11-08T08:00:00.000Z');
});

function post(app, path, body) { return new Promise((resolve) => { const s = app.listen(0, () => { const data = JSON.stringify(body); const rq = http.request({ port: s.address().port, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, (r) => { let b = ''; r.on('data', (c) => (b += c)); r.on('end', () => { s.closeAllConnections && s.closeAllConnections(); s.close(); resolve({ status: r.statusCode, body: JSON.parse(b) }); }); }); rq.end(data); }); }); }
test('POST /reopen puts a mistaken Done back; unknown id is a clear 404; bad id is 400', async () => {
  const store = { reopen: async (id) => (id === 5 ? { id: 5, title: 'cheque 100,000' } : null), listRecentDone: async () => [{ id: 5, title: 'cheque 100,000' }] };
  const app = express(); app.use('/', createRouter({ store, adapters: {}, requireAuth: null, now: () => NOW, env: {} }));
  expect((await post(app, '/reopen', { id: 5 })).body).toEqual({ ok: true, title: 'cheque 100,000' });
  expect((await post(app, '/reopen', { id: 99 })).status).toBe(404);
  expect((await post(app, '/reopen', { id: 'x' })).status).toBe(400);
  expect((await get(app, '/done-recent')).body.done).toEqual([{ id: 5, title: 'cheque 100,000' }]);
});
