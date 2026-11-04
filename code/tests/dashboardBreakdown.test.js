'use strict';
// Every breakdown block is a fixed read-only query; sum column must exist; the client map only points at real keys.
jest.mock('../utils/pool', () => ({ query: jest.fn() }));
const fs = require('fs');
const router = require('../routes/dashboard_breakdown');
const D = router.DEFS;
test('every block is read-only and consistent', () => {
  Object.entries(D).forEach(([k, d]) => {
    expect(d.title).toBeTruthy();
    expect(d.sql).toMatch(/^\s*(WITH|SELECT)\b/i);
    expect(d.sql).not.toMatch(/\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE)\b/i);
    expect(d.sql).not.toMatch(/\$\d|\$\{/);
    if (d.sum != null) { expect(d.sum).toBeLessThan(d.cols.length); expect(d.cols[d.sum][1]).not.toBe('text'); }
  });
});
test('client map only uses real keys', () => {
  const src = fs.readFileSync(__dirname + '/../public/dashboard_breakdown.js', 'utf8');
  const keys = [...src.matchAll(/'([a-z]+_[a-z]+)'/g)].map(m => m[1]).filter(k => !k.startsWith('bd_'));
  keys.filter(k => /^(sales|profit|expenses|grn|stock|vendors|cheques|customers|voids|top|cat|pay)_/.test(k)).forEach(k => expect(D[k]).toBeDefined());
});
