'use strict';
// Offline write queue (client module) with the in-memory adapter, a fake server and a fake clock. No network, no browser.
const OfflineQueue = require('../../public/offline-queue.js');

function makeServer() {
  const s = { up: true, received: [], seen: {}, review: [], calls: 0, dieAfterApplyAt: null, reject: n => false, tooBusy: false, sentKeys: [] };
  s.fetch = async (url, init = {}) => {
    s.calls++;
    if (!s.up) throw new TypeError('network down');
    const h = init.headers || {};
    if (url === '/api/sync/needs-review') {
      s.review.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ ok: true }), { status: 201 });
    }
    const key = h['X-Idempotency-Key'];
    s.sentKeys.push(key);
    if (s.tooBusy) return new Response(JSON.stringify({ error: 'boom' }), { status: 503 });
    if (key && s.seen[key]) return new Response(JSON.stringify(s.seen[key]), { status: 201, headers: { 'X-Idempotent-Replay': '1' } });
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
    if (body && s.reject(body))return new Response(JSON.stringify({ error: 'bad ' + body.n }), { status: 400 });
    const rec = { id: s.received.length + 1 };
    s.received.push({ key, url, body, headers: h });
    if (key) s.seen[key] = rec;
    if (s.dieAfterApplyAt === s.received.length) { s.dieAfterApplyAt = null; s.up = false; throw new TypeError('connection lost after apply'); }
    return new Response(JSON.stringify(rec), { status: 201 });
  };
  return s;
}

function setup(over = {}) {
  const server = makeServer();
  const state = { online: true, t: 1_800_000_000_000, timers: [] };
  const q = OfflineQueue.create({
    adapter: over.adapter || OfflineQueue.memoryAdapter(), fetchImpl: server.fetch, deviceId: 'D7K2',
    now: () => (state.t += 1000), isOnline: () => state.online,
    schedule: (fn, ms) => { const t = { fn, ms }; state.timers.push(t); return t; }, cancel: () => {},
    ...over.opts,
  });
  return { q, server, state };
}
const post = (q, url, body) => q.fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

describe('offline queue', () => {
  test('1. 20 writes made offline all arrive exactly once and in order', async () => {
    const { q, server, state } = setup();
    await q.ready;
    state.online = false;
    for (let i = 1; i <= 20; i++) {
      const r = await post(q, '/api/expenses', { n: i });
      expect(r.status).toBe(202);
      expect(r.headers.get('X-Offline-Queued')).toBe('1');
      expect((await r.json()).queued).toBe(true);
    }
    expect(server.calls).toBe(0);
    expect(q.status()).toMatchObject({ state: 'offline', waiting: 20, rejected: 0 });
    state.online = true;
    await q.replay();
    expect(server.received.map(r => r.body.n)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(new Set(server.received.map(r => r.key)).size).toBe(20);
    expect(server.received[0].headers['X-Device']).toBe('D7K2');
    expect(server.received[0].headers['X-Client-Queued-At']).toMatch(/^\d{4}-\d\d-\d\dT/);
    expect(q.status()).toMatchObject({ state: 'online', waiting: 0 });
    expect((await q.results()).length).toBe(20);
  });

  test('2. the server goes down at item 7 (after saving it) and comes back: no duplicates, no losses, order kept', async () => {
    const { q, server, state } = setup();
    await q.ready;
    state.online = false;
    for (let i = 1; i <= 20; i++) await post(q, '/api/grn', { n: i });
    state.online = true;
    server.dieAfterApplyAt = 7;             // item 7 is stored but its answer is lost
    const first = await q.replay();
    expect(first.stopped).toBe(true);
    expect(server.received.length).toBe(7);
    expect(q.status().waiting).toBe(14);
    expect(state.timers.length).toBeGreaterThan(0);   // a retry was scheduled
    server.up = true;
    await q.replay();
    expect(server.received.map(r => r.body.n)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(q.status().waiting).toBe(0);
  });

  test('3. the same UUID sent twice is one record', async () => {
    const { q, server, state } = setup();
    await q.ready;
    state.online = false;
    const req = { method: 'POST', url: '/api/expenses', headers: {}, body: JSON.stringify({ n: 1 }), uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' };
    await q.enqueue(req); await q.enqueue(req);
    state.online = true;
    await q.replay();
    expect(server.received.length).toBe(1);
    expect(q.status().waiting).toBe(0);
  });

  test('4. crash recovery: an item left in "sending" is retried with the same key', async () => {
    const adapter = OfflineQueue.memoryAdapter();
    const a = setup({ adapter });
    await a.q.ready;
    a.state.online = false;
    await post(a.q, '/api/expenses', { n: 1 });
    const [item] = await adapter.all();
    item.state = 'sending'; await adapter.update(item);       // the page died mid-send
    const b = setup({ adapter });                              // fresh start over the same storage
    await b.q.ready;
    expect((await adapter.all())[0].state).toBe('waiting');
    await b.q.replay();
    expect(b.server.sentKeys).toEqual([item.uuid]);
    expect(b.server.received.length).toBe(1);
    expect(await adapter.all()).toEqual([]);
  });

  test('5. back-off doubles 2s, 4s, 8s ... and caps at 60s', async () => {
    const { q, server, state } = setup();
    await q.ready;
    server.up = false;
    await post(q, '/api/expenses', { n: 1 });                  // network error: queued, first retry scheduled
    for (let i = 0; i < 6; i++) await q.replay();
    expect(state.timers.map(t => t.ms)).toEqual([2000, 4000, 8000, 16000, 32000, 60000, 60000]);
    server.up = true;
    await q.replay();
    expect(server.received.length).toBe(1);
  });

  test('5b. a 5xx also stops and backs off; the item stays', async () => {
    const { q, server } = setup();
    await q.ready;
    server.tooBusy = true;
    await q.enqueue({ method: 'POST', url: '/api/expenses', body: '{"n":1}', headers: {} });
    const r = await q.replay();
    expect(r.stopped).toBe(true);
    expect(q.status().waiting).toBe(1);
    expect(q.status().lastError).toBe('boom');
  });

  test('6. a 4xx is kept as rejected and does not block later items', async () => {
    const { q, server } = setup();
    await q.ready;
    server.reject = b => b.n === 2;
    for (const n of [1, 2, 3]) await q.enqueue({ method: 'POST', url: '/api/expenses', body: JSON.stringify({ n }), headers: {} });
    await q.replay();
    expect(server.received.map(r => r.body.n)).toEqual([1, 3]);
    const left = await q.list();
    expect(left.length).toBe(1);
    expect(left[0]).toMatchObject({ state: 'rejected', error: 'bad 2' });
    expect(q.status()).toMatchObject({ state: 'error', waiting: 0, rejected: 1 });
    server.reject = () => false;                               // the admin fixes the cause and presses Retry
    await q.retryRejected();
    expect(server.received.map(r => r.body.n)).toEqual([1, 3, 2]);
    expect(q.status().state).toBe('online');
  });

  test('7. POS bill made offline gets OFF-<device>-<n> and correct totals', async () => {
    const { q, server, state } = setup();
    await q.ready;
    state.online = false;
    const bill = { customer_name: 'Ali', customer_phone: '0300', discount_pct: 10, payment_method: 'card',
      items: [{ item_name: 'a', qty: 3, unit_price: 19.99 }, { item_name: 'b', qty: 1, unit_price: 5.5 }] };
    const r = await post(q, '/api/pos-bills', bill);
    expect(r.status).toBe(202);
    const b = await r.json();
    expect(b).toMatchObject({ id: 'off-1', bill_number: 'OFF-D7K2-1', temp: true, queued: true, customer_name: 'Ali', customer_phone: '0300', payment_method: 'card', discount_pct: 10 });
    expect(b.items.map(i => i.line_total)).toEqual([59.97, 5.5]);
    expect(b.subtotal).toBe(65.47);
    expect(b.discount_amount).toBe(6.55);
    expect(b.total).toBe(58.92);
    expect(typeof b.created_at).toBe('string');
    const b2 = await (await post(q, '/api/pos-bills', bill)).json();
    expect(b2.bill_number).toBe('OFF-D7K2-2');
    state.online = true;
    await q.replay();
    expect(server.received.length).toBe(2);
    const res = await q.results();
    expect(res.map(x => x.temp.bill_number).sort()).toEqual(['OFF-D7K2-1', 'OFF-D7K2-2']);     // maps temp number to the real record
  });

  test('8. edits and voids go to /api/sync/needs-review, never to their own URL', async () => {
    const { q, server, state } = setup();
    await q.ready;
    state.online = false;
    const put = await q.fetch('/api/items/5', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{"price":10}' });
    const vd = await post(q, '/api/pos-bills/9/void', { reason: 'wrong' });
    expect(put.status).toBe(202); expect(vd.status).toBe(202);
    state.online = true;
    await q.replay();
    expect(server.received.length).toBe(0);
    expect(server.review.map(r => [r.method, r.url, r.body])).toEqual([['PUT', '/api/items/5', '{"price":10}'], ['POST', '/api/pos-bills/9/void', '{"reason":"wrong"}']]);
    expect(server.review[0]).toMatchObject({ device: 'D7K2' });
    expect(server.review[0].uuid).toMatch(/^[0-9a-f-]{36}$/);
    expect(server.review[0].queued_at).toMatch(/^\d{4}-/);
    expect(await q.list()).toEqual([]);
  });

  test('9. the queueable test never matches login / system and friends', () => {
    const { q } = setup();
    for (const u of ['/api/login', '/api/logout', '/api/setup/status', '/api/auth/x', '/api/system/backup', '/api/admin-core/x', '/api/app-settings', '/api/users', '/api/feature-flags'])
      expect([u, q.isQueueable(u)]).toEqual([u, false]);
    for (const u of ['/api/pos-bills', '/api/expenses', '/api/pos-bills/3/void', '/api/attachments'])
      expect([u, q.isQueueable(u)]).toEqual([u, true]);
    expect(OfflineQueue.DEFAULT_QUEUEABLE.test('/api/login')).toBe(false);
    expect(OfflineQueue.DEFAULT_QUEUEABLE.test('/api/system/x')).toBe(false);
    const custom = setup({ opts: { queueable: [/^\/api\/login/, /^\/api\/things/] } }).q;     // even a careless custom rule cannot queue login
    expect(custom.isQueueable('/api/login')).toBe(false);
    expect(custom.isQueueable('/api/things')).toBe(true);
  });

  test('10. a real HTTP answer is returned as is and not queued; GET and other URLs pass through; order is kept behind waiting items', async () => {
    const { q, server, state } = setup();
    await q.ready;
    server.reject = b => b.n === 1;
    const r = await post(q, '/api/expenses', { n: 1 });
    expect(r.status).toBe(400);
    expect(q.status().waiting).toBe(0);
    state.online = false;
    expect((await post(q, '/api/expenses', { n: 2 })).status).toBe(202);
    state.online = true;                                       // network is back, but item 2 is still waiting
    const calls = server.calls;
    expect((await post(q, '/api/expenses', { n: 3 })).status).toBe(202);
    expect(server.calls).toBe(calls);
    await q.replay();
    expect(server.received.map(x => x.body.n)).toEqual([2, 3]);
    expect((await q.fetch('/api/expenses', { method: 'GET' })).status).toBe(201);        // passthrough (stub answers anything)
    expect((await q.fetch('/api/login', { method: 'POST', body: '{"n":9}' })).status).toBe(201);
    expect(q.status().waiting).toBe(0);
  });

  test('11. file uploads (FormData with a file) survive the queue byte for byte', async () => {
    const { q, server, state } = setup();
    await q.ready;
    state.online = false;
    const fd = new FormData();
    fd.append('record_type', 'grn');
    fd.append('file', new Blob([Buffer.from([1, 2, 3, 250])], { type: 'image/png' }), 'a.png');
    const r = await q.fetch('/api/attachments', { method: 'POST', body: fd });
    expect(r.status).toBe(202);
    state.online = true;
    await q.replay();
    const sent = server.received[0].body;
    expect(sent.get('record_type')).toBe('grn');
    const f = sent.get('file');
    expect(f.name).toBe('a.png');
    expect(Array.from(new Uint8Array(await f.arrayBuffer()))).toEqual([1, 2, 3, 250]);
  });

  test('12. status events fire and two replays never run at once', async () => {
    const { q, server, state } = setup();
    await q.ready;
    const seen = [];
    q.on('status', s => seen.push(s.state));
    state.online = false;
    await post(q, '/api/expenses', { n: 1 });
    state.online = true;
    const [a, b] = await Promise.all([q.replay(), q.replay()]);
    expect([a.skipped, b.skipped].filter(Boolean).length).toBe(1);
    expect(server.received.length).toBe(1);
    expect(seen).toContain('syncing');
    expect(seen[seen.length - 1]).toBe('online');
  });
});
