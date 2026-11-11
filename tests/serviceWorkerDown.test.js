// PC off / tunnel down: the proxy answers 530; the phone must show the saved copy, not the error page.
const fs = require('fs'), vm = require('vm');
function load(fetchImpl, store) {
  const handlers = {};
  const cache = { put: async (k, v) => { store[k.url || k] = v; }, match: async (k) => store[k.url || k] };
  const self = { location: { origin: 'https://shop.test' }, addEventListener: (t, f) => { handlers[t] = f; }, clients: { matchAll: async () => [] }, skipWaiting() {}, registration: {} };
  const ctx = { self, caches: { open: async () => cache, match: async (k) => store[k.url || k], keys: async () => [], delete: async () => true }, fetch: fetchImpl, Response, Headers, URL, Promise, setTimeout, clearTimeout, console };
  vm.runInNewContext(fs.readFileSync(__dirname + '/../public/service-worker.js', 'utf8'), ctx);
  return handlers;
}
const run = (h, url) => new Promise((resolve) => { h.fetch({ request: { method: 'GET', url, mode: 'cors' }, respondWith: (p) => resolve(p) }); });
test('tunnel answers 530: API serves the saved copy', async () => {
  const store = { 'https://shop.test/api/stock': new Response('{"ok":1}', { status: 200 }) };
  const h = load(async () => new Response('tunnel error', { status: 530 }), store);
  const r = await (await run(h, 'https://shop.test/api/stock'));
  expect(r.status).toBe(200); expect(r.headers.get('X-Saved-Copy')).toBe('1');
});
test('tunnel answers 530 and no saved copy: clear offline message, not the tunnel page', async () => {
  const h = load(async () => new Response('tunnel error', { status: 530 }), {});
  const r = await (await run(h, 'https://shop.test/api/stock'));
  expect(r.status).toBe(503); expect(JSON.parse(await r.text()).offline).toBe(true);
});
test('normal 200 still passes straight through', async () => {
  const h = load(async () => new Response('{"live":1}', { status: 200 }), {});
  const r = await (await run(h, 'https://shop.test/api/stock'));
  expect(JSON.parse(await r.text()).live).toBe(1);
});
test('a real app error (500) is NOT hidden behind an old copy', async () => {
  const store = { 'https://shop.test/api/stock': new Response('{"old":1}', { status: 200 }) };
  const h = load(async () => new Response('boom', { status: 500 }), store);
  const r = await (await run(h, 'https://shop.test/api/stock'));
  expect(r.status).toBe(500);
});
