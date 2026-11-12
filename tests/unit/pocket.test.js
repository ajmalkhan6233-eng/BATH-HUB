const fs = require('fs'), path = require('path');
const snap = require('../../utils/pocketSnapshot');
const app = require('../../pocket/app.js');

// Cloudflare worker is an ES module: load it as CommonJS for the test.
const workerSrc = fs.readFileSync(path.join(__dirname, '../../cloudflare/pocket_worker.js'), 'utf8').replace('export default', 'module.exports =');
const worker = (() => { const m = { exports: {} }; new Function('module', 'exports', 'Response', workerSrc)(m, m.exports, Response); return m.exports; })();
const kv = () => { const m = new Map(); return { put: async (k, v) => m.set(k, v), get: async (k) => m.get(k) ?? null }; };
const env = () => ({ PUSH_SECRET: 'push-secret-123', READ_TOKEN: 'read-token-456', SNAP: kv() });
const req = (method, headers, body) => new Request('https://w.example/snap', { method, headers, body });

describe('lock (PC) -> unlock (phone) round trip', () => {
  const data = { v: 1, at: '2026-11-10T10:00:00.000Z', sales: { today: 125000 } };
  test('phone code opens what the PC locked (same passcode)', async () => {
    const sealed = snap.lock(data, 'my pass 123');
    expect(JSON.stringify(sealed)).not.toContain('125000');
    expect(await app.unlock(sealed, 'my pass 123')).toEqual(data);
  });
  test('wrong passcode fails', async () => { await expect(app.unlock(snap.lock(data, 'right'), 'wrong')).rejects.toBeTruthy(); });
  test('fixed salt: same key for phone, new copy still opens with the kept key (Face ID)', async () => {
    const salt = Buffer.from('0123456789abcdef');
    const a = snap.lock(data, 'pp', { salt }), b = snap.lock({ ...data, x: 2 }, 'pp', { salt });
    expect(a.salt).toBe(b.salt); expect(a.ct).not.toBe(b.ct);
    const key = await app.deriveKey(a, 'pp');
    expect(await app.decryptWith(key, b)).toEqual({ ...data, x: 2 });
  });
  test('two locks of the same data differ (fresh salt and iv)', () => expect(snap.lock(data, 'p').ct).not.toBe(snap.lock(data, 'p').ct));
});

describe('snapshot build (fake database)', () => {
  const pool = { query: async (sql) => {
    if (/FILTER \(WHERE d = CURRENT_DATE\)/.test(sql)) return { rows: [{ today: '1000', bills_today: '2', yesterday: '500', week: '3000', month: '9000' }] };
    if (/GROUP BY method/.test(sql)) return { rows: [{ method: 'cash', amount: '700' }, { method: 'card', amount: '300' }] };
    if (/FROM products WHERE active = true AND stock_level > 0/.test(sql)) return { rows: [{ item_code: 'A1', name: 'Tap', stock_level: '1', reorder_threshold: '5' }] };
    if (/COUNT\(\*\) AS items/.test(sql)) return { rows: [{ items: '10', out_of_stock: '2', low_stock: '1' }] };
    if (/FROM vendor_bills/.test(sql)) return { rows: [{ vendor_name: 'V1', bill_no: 'B1', due_date: '2026-11-01', owed: '2500' }] };
    if (/FROM cheque_register/.test(sql)) return { rows: [{ payee: 'V2', cheque_no: 'C9', amount: '4000', due_date: '2026-11-20', status: 'pending' }] };
    if (/FROM pos_bill_items i/.test(sql) && /i\.bill_id, i\.item_name/.test(sql)) return { rows: [{ bill_id: 7, item_name: 'Tap', qty: '1', line_total: '1000' }] };
    if (/b\.bill_number, to_char/.test(sql)) return { rows: [{ id: 7, bill_number: 'B-7', t: '10:05', customer_name: null, total: '1000', payment_method: 'cash' }] };
    if (/GROUP BY 1 ORDER BY 1/.test(sql)) return { rows: [{ d: '2026-11-09', total: '800', n: '2' }, { d: '2026-11-10', total: '1000', n: '2' }] };
    if (/SELECT item_code, name, stock_level, selling_price/.test(sql)) return { rows: [{ item_code: 'A1', name: 'Tap', stock_level: '1', selling_price: '1500' }] };
    if (/stock_level <= 0 ORDER BY name/.test(sql)) return { rows: [{ item_code: 'Z9', name: 'Sink' }] };
    if (/FROM credit_customers/.test(sql)) return { rows: [{ name: 'Builder', owed: '7000', oldest: '2026-10-01' }] };
    return { rows: [{ name: 'Sink', qty: '3', revenue: '9000' }] };
  } };
  test('shape and overdue maths', async () => {
    const s = await snap.build(pool, new Date('2026-11-10T06:00:00Z'));
    expect(s.sales).toEqual({ today: 1000, bills_today: 2, yesterday: 500, week: 3000, month: 9000 });
    expect(s.stock).toMatchObject({ out: 2, low: 1 });
    expect(s.due.overdue_count).toBe(1); expect(s.due.overdue_amount).toBe(2500);
    expect(s.due.next[0].kind).toBe('bill'); expect(s.due.next[1].kind).toBe('cheque');
  });
  test('v2 tab data', async () => {
    const s = await snap.build(pool, new Date('2026-11-10T06:00:00Z'));
    expect(s.v).toBe(2);
    expect(s.bills[0]).toMatchObject({ no: 'B-7', t: '10:05', total: 1000, lines: [{ n: 'Tap', q: 1, a: 1000 }] });
    expect(s.daily).toEqual([{ d: '2026-11-09', total: 800, n: 2 }, { d: '2026-11-10', total: 1000, n: 2 }]);
    expect(s.items).toEqual([['A1', 'Tap', 1, 1500]]); expect(s.out_list).toEqual([{ code: 'Z9', name: 'Sink' }]);
    expect(s.credit).toEqual({ total: 7000, list: [{ who: 'Builder', owed: 7000, oldest: '2026-10-01' }] });
    expect(s.vendors[0]).toMatchObject({ who: 'V1', owed: 2500, oldest: '2026-11-01' });
    expect(s.cheques[0]).toMatchObject({ who: 'V2', ref: 'C9', amount: 4000, status: 'pending' });
  });
  test('a failing query gives null for that part, not a crash', async () => {
    const s = await snap.build({ query: async () => { throw new Error('boom'); } }, new Date());
    expect(s.sales).toBeNull(); expect(s.stock).toBeNull(); expect(s.due).toBeNull(); expect(s.bills).toBeNull(); expect(s.items).toBeNull(); expect(s.credit).toBeNull(); expect(s.vendors).toBeNull();
  });
  test('does nothing unless all three settings exist', async () => { expect((await snap.runOnce(pool, {})).ran).toBe(false); });
  test('runOnce posts a LOCKED copy with the push secret', async () => {
    let seen; const fetchFn = async (url, o) => { seen = { url, o }; return { ok: true }; };
    const r = await snap.runOnce(pool, { POCKET_URL: 'https://w.example/', POCKET_PUSH_SECRET: 's', POCKET_PASSCODE: 'pp' }, { fetchFn });
    expect(r.ran).toBe(true); expect(seen.url).toBe('https://w.example/snap');
    expect(seen.o.headers.Authorization).toBe('Bearer s'); expect(seen.o.body).not.toContain('Tap');
  });
});

describe('cloud mailbox (worker)', () => {
  const sealed = JSON.stringify(snap.lock({ a: 1 }, 'p'));
  test('push needs the push secret', async () => {
    const e = env();
    expect((await worker.fetch(req('PUT', { Authorization: 'Bearer nope' }, sealed), e)).status).toBe(403);
    expect((await worker.fetch(req('PUT', { Authorization: 'Bearer push-secret-123' }, sealed), e)).status).toBe(200);
  });
  test('read needs the read token, and the push secret does not open it', async () => {
    const e = env(); await worker.fetch(req('PUT', { Authorization: 'Bearer push-secret-123' }, sealed), e);
    expect((await worker.fetch(req('GET', {}), e)).status).toBe(403);
    expect((await worker.fetch(req('GET', { 'X-Read-Token': 'push-secret-123' }), e)).status).toBe(403);
    const ok = await worker.fetch(req('GET', { 'X-Read-Token': 'read-token-456' }), e);
    expect(ok.status).toBe(200); expect(await ok.text()).toBe(sealed);
  });
  test('rejects plain (unlocked) or oversize data', async () => {
    const e = env();
    expect((await worker.fetch(req('PUT', { Authorization: 'Bearer push-secret-123' }, '{"sales":1}'), e)).status).toBe(400);
    expect((await worker.fetch(req('PUT', { Authorization: 'Bearer push-secret-123' }, 'x'.repeat(270000)), e)).status).toBe(413);
  });
  test('empty mailbox is 404', async () => { expect((await worker.fetch(req('GET', { 'X-Read-Token': 'read-token-456' }), env())).status).toBe(404); });
});

describe('phone app helpers', () => {
  test('find: every word must match name or code', () => {
    const it = [['A1', 'Basin mixer tap', 2, 1], ['B2', 'Wall tile 30x60', 9, 1]];
    expect(app.find(it, 'mixer tap').length).toBe(1); expect(app.find(it, 'b2').length).toBe(1); expect(app.find(it, 'mixer tile').length).toBe(0); expect(app.find(it, '  ').length).toBe(0);
  });
  test('throttle: free for 4 wrong tries, then waits that double up to 15 min', () => {
    expect([0, 4].map(app.throttleWait)).toEqual([0, 0]); expect(app.throttleWait(5)).toBe(30); expect(app.throttleWait(6)).toBe(60); expect(app.throttleWait(30)).toBe(900);
  });
  test('rs', () => expect(app.rs(1234567.4)).toBe('Rs 1,234,567'));
  test('ago', () => { const n = Date.parse('2026-11-10T10:00:00Z'); expect(app.ago('2026-11-10T09:55:00Z', n)).toBe('5 min ago'); expect(app.ago('2026-11-10T07:00:00Z', n)).toBe('3 h ago'); });
  test('vs yesterday', () => { expect(app.vs(150, 100)).toEqual({ text: 'Up 50% on yesterday', cls: 'up' }); expect(app.vs(50, 100).cls).toBe('down'); expect(app.vs(5, 0).cls).toBe('dim'); });
  test('dueWord', () => { expect(app.dueWord('2026-11-08', '2026-11-10')).toBe('2 d overdue'); expect(app.dueWord('2026-11-10', '2026-11-10')).toBe('today'); expect(app.dueWord('2026-11-11', '2026-11-10')).toBe('tomorrow'); });
});
