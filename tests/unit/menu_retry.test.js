'use strict';
// 28 Nov: one failed /api/me must not leave the owner menus hidden.
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'simple_mode.js'), 'utf8');

async function run(replies) {
  const added = []; let calls = 0;
  const el = () => ({ dataset: {}, classList: { add() {}, toggle() {} }, setAttribute() {}, insertBefore() {}, appendChild() {} });
  vm.runInNewContext(src, {
    document: { readyState: 'complete', head: el(), createElement: el, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, addEventListener() {} },
    localStorage: { getItem: () => null, setItem() {} }, MutationObserver: function () { this.observe = () => {}; },
    setTimeout: (fn) => setImmediate(fn), clearTimeout() {}, addFramePage: (d) => added.push(d.key),
    fetch: () => { const s = replies[Math.min(calls++, replies.length - 1)]; return s === 0 ? Promise.reject(new Error('net')) : Promise.resolve({ ok: s === 200, status: s, json: async () => ({ role: 'admin' }) }); },
  });
  for (let i = 0; i < 60; i++) await new Promise((r) => setImmediate(r));
  return { added, calls };
}

test('a server error then success still adds Vendor 360', async () => { const r = await run([500, 0, 200]); expect(r.added).toContain('vendor360'); expect(r.calls).toBe(3); });
test('not signed in is not retried', async () => { const r = await run([401]); expect(r.added).toEqual([]); expect(r.calls).toBe(1); });
test('gives up after a few tries', async () => { const r = await run([500]); expect(r.calls).toBe(6); });
