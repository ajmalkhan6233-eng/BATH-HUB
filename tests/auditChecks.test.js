const B = require('../scripts/audit/backup_check'); const L = require('../scripts/audit/links_check');
const file = (n, size, ageH) => ({ n, s: { size, mtimeMs: Date.now() - ageH * 36e5 } });
const counts = { products: 100, pos_bills: 50, pos_bill_items: 80, pos_bill_payments: 60, grn_records: 200, customers: 30 };
test('backup ok', () => { expect(B.judge({ files: [file('a.sql', 90000, 5), file('b.sql', 88000, 29)], counts, live: { products: 100 } }).ok).toBe(true); });
test('backup old, tiny, missing table, short dump', () => {
  expect(B.judge({ files: [file('a.sql', 90000, 50)], counts }).line).toMatch(/50h old/);
  expect(B.judge({ files: [file('a.sql', 100, 1)], counts }).ok).toBe(false);
  const c = Object.assign({}, counts); delete c.pos_bills; expect(B.judge({ files: [file('a.sql', 90000, 1)], counts: c }).line).toMatch(/pos_bills missing/);
  expect(B.judge({ files: [file('a.sql', 90000, 1)], counts, live: { products: 500 } }).line).toMatch(/products dump 100 vs live 500/);
  expect(B.judge({ files: [], counts: {} }).ok).toBe(false); });
test('dump counts parse COPY blocks', () => { const t = 'COPY public.products (a,b) FROM stdin;\n1\tx\n2\ty\n\\.\n\nCOPY public.pos_bills (a) FROM stdin;\n\\.\n'; expect(B.dumpCounts(t)).toEqual({ products: 2, pos_bills: 0 }); });
test('links judge', () => {
  const pages = ['/health', '/owner'].map(p => ({ path: p, code: 200 }));
  expect(L.judge({ pages, bridge: 'AUTHENTICATED', pm2Apex: 1, flags: { deduct: true }, tasks: [] }).ok).toBe(true);
  const r = L.judge({ pages: [{ path: '/x', code: 0 }], bridge: 'Waiting for QR', pm2Apex: 2, flags: { deduct: false }, tasks: ['RBH_Watchdog'] });
  expect(r.ok).toBe(false); expect(r.line).toMatch(/5 HEADS-UP/); });
test('cut-short dump is red', () => { expect(B.judge({ files: [file('a.sql', 90000, 1)], counts, complete: false }).line).toMatch(/cut short/); });
