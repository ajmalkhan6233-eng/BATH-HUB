'use strict';
// The LIVE POS screen is public/pos-preview2.html (the owner shell and the menu load it). The "+ Outside" module must be wired into THAT file,
// the screen must have ONE date box, and the customer and WhatsApp boxes must be unchanged.
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'pos-preview2.html'), 'utf8');
test('+ Outside script is loaded after the POS screen script', () => {
  const a = html.indexOf('pos2-screen.js'), b = html.indexOf('pos-outside.js');
  expect(a).toBeGreaterThan(-1); expect(b).toBeGreaterThan(a);
});
test('one date box only (typed dd/mm/yyyy, defaults to today in code); the drop-down is gone', () => {
  expect((html.match(/id="saleDate"/g) || []).length).toBe(1);
  expect(html).not.toMatch(/id="saleDay"/);
});
test('Walk-in customer and the WhatsApp number box are unchanged', () => {
  expect(html).toMatch(/id="customerName" placeholder="Walk-in customer"/);
  expect(html).toMatch(/id="customerPhone" placeholder="077 123 4567 or \+61 424 795 184"/);
  expect(html).toMatch(/id="waCheck"/);
});
test('date: calendar picker + Today / Yesterday chips, module loaded; cart never spills over the payment panel', () => {
  expect(html).toMatch(/id="salePick" class="datepick" type="date"/);
  expect(html).toMatch(/data-ago="0">Today</); expect(html).toMatch(/data-ago="1">Yesterday</);
  expect(html).toContain('pos-date.js');
  expect(html).toMatch(/\.item-rows\{min-height:0!important\}/);
  expect(html).toMatch(/\.left-work\{min-height:0;overflow:hidden\}/);
});
