'use strict';
// Menu map (5 Nov 2026): no separate Profit column; every report lives under Reports; no screen appears twice.
const M = require('../../public/menubar.js');
const group = n => M.MAP.find(g => g[0] === n);
const hub = require('fs').readFileSync(require('path').join(__dirname, '../../public/reports_hub.html'), 'utf8');

test('there is no Profit column any more', () => { expect(group('Profit')).toBeUndefined(); expect(M.MAP.map(g => g[0])).toContain('Reports'); });
test('Reports holds all six profit pages', () => {
  const keys = group('Reports')[1].map(i => i[0]);
  ['daily', 'weekly', 'monthly', 'yearly', 'item', 'category'].forEach(t => expect(keys).toContain('profit:' + t));
});
test('Reports has headings and the old Reports page and the report list stay reachable', () => {
  const keys = group('Reports')[1].map(i => i[0]);
  expect(keys.filter(k => k === '--').length).toBeGreaterThanOrEqual(4);
  expect(keys).toEqual(expect.arrayContaining(['reports', 'reportshub']));
});
test('every rep: entry exists as an option in the report page, and the page can run it', () => {
  group('Reports')[1].filter(i => i[0].indexOf('rep:') === 0).forEach(i => {
    const id = i[0].slice(4);
    expect(hub).toContain('<option value="' + id + '">');
    expect(hub).toMatch(new RegExp('\\b' + id + ':function|/\\^s\\(day\\|week\\|month\\)\\$/'));
  });
});
test('no screen key appears twice in the menu (headings excluded)', () => {
  const keys = M.allKeys(); expect(new Set(keys).size).toBe(keys.length);
});

test('GRN is the first item of Inventory (was Stock) and no longer under Vendors', () => {
  expect(group('Stock')).toBeUndefined();
  const inv = group('Inventory')[1].map(i => i[0]);
  expect(inv[0]).toBe('grn');
  expect(inv).toEqual(expect.arrayContaining(['stockmgr', 'pending', 'helper', 'barcode', 'stickers']));
  const ven = group('Vendors')[1].map(i => i[0]);
  expect(ven).not.toContain('grn');
  expect(ven).toEqual(expect.arrayContaining(['vendorsum', 'vendor360', 'vendors', 'vendorledger', 'vendorcredit', 'vendorreturns', 'chequereg', 'purchasing']));
});
