const fs = require('fs'), os = require('os'), path = require('path');
const a = require('../utils/automations2');

test('slow stock: cut stays inside limit and above cost', () => {
  expect(a.slowSuggestion({ selling_price: 1000, avg_cost: 500 }, 5)).toEqual({ price: 950, pct: 5 });
  expect(a.slowSuggestion({ selling_price: 1000, avg_cost: 980 }, 10)).toBeNull();
  expect(a.slowSuggestion({ selling_price: 1000, avg_cost: 905 }, 10).price).toBeGreaterThan(905);
  expect(a.slowSuggestion({ selling_price: 1000, avg_cost: 500 }, 0)).toBeNull();
});
test('bank statement matching by cheque number and by amount', () => {
  const lines = a.parseStatement('date,desc,debit\n2026-10-05,CHQ 000123 PAID,15000\n2026-10-06,transfer,999\n');
  const m = a.matchStatement(lines, [{ cheque_no: '123', amount: 15000 }, { cheque_no: '777', amount: 5 }]);
  expect(m.matched.length).toBe(1); expect(m.unclearedCheques.length).toBe(1); expect(m.unmatchedLines.length).toBe(1);
});
test('texts', () => {
  expect(a.halalText('2026-11')).toMatch(/riba/);
  expect(a.bouncedHelp([{ cheque_no: '1', payee: 'X', amount: 100, due_date: '2026-10-01' }])).toMatch(/call the customer/);
  expect(a.socialDrafts(null, '2026-10-16')).toMatch(/on hold/);
});
test('quote PDF is written', async () => {
  const pool = { query: async (sql) => /quotation_items/.test(sql) ? { rows: [{ description: 'Tap', qty: 2, unit_price: 500, line_total: 1000 }] } : { rows: [{ id: 1, quote_date: '2026-10-01', valid_until: '2026-10-15', cname: 'T', phone: '1', subtotal: 1000, discount: 0, total: 1000 }] } };
  const f = await a.quotePdf(pool, 1, fs.mkdtempSync(path.join(os.tmpdir(), 'q')));
  expect(fs.statSync(f).size).toBeGreaterThan(500);
});
test('competitor look uses only https public pages and a stub fetch', async () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'c')), 'c.json');
  fs.writeFileSync(f, JSON.stringify({ items: [{ name: 'A', url: 'https://x.test/a' }, { name: 'B', url: 'http://x.test/b' }] }));
  const r = await a.competitorPrices(f, async () => ({ text: async () => 'Price Rs. 12,500' }));
  expect(r).toEqual([{ name: 'A', url: 'https://x.test/a', price: 12500 }]);
});
test('runDaily2 queues through enqueue, once per day, nothing before 04:00', async () => {
  const seen = new Set(); const q = [];
  const pool = { query: async (sql, p) => {
    if (/INSERT INTO automation_runs/.test(sql)) { const k = p.join('|'); if (seen.has(k)) return { rows: [] }; seen.add(k); return { rows: [{}] }; }
    if (/FROM cheque_register/.test(sql)) return { rows: [{ cheque_no: '9', payee: 'P', amount: 500, due_date: '2026-10-01' }] };
    return { rows: [] };
  } };
  const enqueue = async (t, s) => q.push(s);
  const noon = new Date('2026-10-14T06:00:00Z'); // Wednesday 11:30 Sri Lanka
  expect((await a.runDaily2({ pool, enqueue, now: new Date('2026-10-13T20:00:00Z'), root: os.tmpdir() })).done).toEqual([]);
  const r1 = await a.runDaily2({ pool, enqueue, now: noon, root: os.tmpdir() });
  expect(q).toContain('bounced'); expect(r1.done).toContain('bounced_help');
  expect((await a.runDaily2({ pool, enqueue, now: noon, root: os.tmpdir() })).done).toEqual([]);
});
