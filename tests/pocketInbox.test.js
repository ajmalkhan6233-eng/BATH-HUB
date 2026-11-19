const crypto = require('crypto');
const snap = require('../utils/pocketSnapshot');
const I = require('../utils/pocketInbox');
const env = { POCKET_URL: 'http://x', POCKET_PUSH_SECRET: 's'.repeat(24), POCKET_PASSCODE: 'testpass12345' };
const salt = crypto.createHmac('sha256', env.POCKET_PUSH_SECRET).update('rbh-pocket-salt-v2').digest().subarray(0, 16);
const seal = (o, pass = env.POCKET_PASSCODE, s = salt) => snap.lock(o, pass, { salt: s });
const ok = { id: 'abcdefgh1234', ts: Date.now(), type: 'bill', pay: 'cash', items: [{ code: 'T-1', qty: 2, price: 100 }] };

test('a request locked with the right passcode opens; wrong passcode or wrong salt does not', () => {
  expect(I.open(seal(ok), env).id).toBe('abcdefgh1234');
  expect(() => I.open(seal(ok, 'otherpass000000'), env)).toThrow();
  expect(() => I.open(seal(ok, env.POCKET_PASSCODE, crypto.randomBytes(16)), env)).toThrow('wrong lock');
});
test('clean accepts a good bill and order', () => {
  expect(I.clean(ok).lines[0]).toEqual({ code: 'T-1', pid: null, qty: 2, price: 100 });
  expect(I.clean({ id: 'abcdefgh1234', ts: Date.now(), type: 'order', supplier: 'Cool Lanka', items: [{ name: 'Commode', qty: 3 }] }).type).toBe('order');
});
test('clean refuses old, odd and unknown requests', () => {
  expect(() => I.clean({ ...ok, ts: Date.now() - 25 * 3600e3 })).toThrow('too old');
  expect(() => I.clean({ ...ok, pay: 'credit' })).toThrow('cash, card or online');
  expect(() => I.clean({ ...ok, items: [{ code: 'A', qty: -1 }] })).toThrow('quantity');
  expect(() => I.clean({ ...ok, disc: 150 })).toThrow('discount');
  expect(() => I.clean({ ...ok, id: 'x' })).toThrow('request id');
  expect(() => I.clean({ ...ok, type: 'delete' })).toThrow('unknown');
});
test('pollOnce runs each id once and answers locked', async () => {
  const done = new Set(), puts = {}; let box = [seal(ok), seal(ok)];
  const pool = { query: async (sql, p) => { if (/INSERT INTO pocket_inbox_done/.test(sql)) { if (done.has(p[0])) return { rows: [] }; done.add(p[0]); return { rows: [{ id: p[0] }] }; } if (/FROM products/.test(sql)) return { rows: [{ id: 1, item_code: 'T-1', name: 'Test', selling_price: 100 }] }; return { rows: [] }; } };
  const fetchFn = async (u, o = {}) => { const path = u.replace('http://x', ''); if (path === '/inbox') return { ok: true, json: async () => box };
    if (path.startsWith('/out/')) { puts[path] = JSON.parse(o.body); return { ok: true }; } return { ok: true }; };
  const calls = []; const call = async (m, p) => { calls.push(p); return p.endsWith('pos-bills') ? { id: 9, bill_number: 'B9', total: 200 } : Buffer.from('png'); };
  const r = await I.pollOnce(pool, env, { fetchFn, call });
  expect(r.n).toBe(2); expect(calls.filter((c) => c === '/api/pos-bills').length).toBe(1);   // the same id twice makes ONE bill
});
