'use strict';
// POS item picker: catalogue search, what a suggestion shows, what filling a row does, and the stock warnings.
const fs = require('fs');
const path = require('path');
const PosPicker = require('../../public/pos-picker');

const ok = body => async () => ({ ok: true, json: async () => body });
const item = (over = {}) => ({ item_code: '1001', name: 'Marble Floor Tile 60x60', category: 'Tiles', stock_level: 120, reorder_threshold: 20, selling_price: 4500, ...over });

describe('search', () => {
  test('asks the catalogue with the typed text, encoded', async () => {
    const calls = [];
    const rows = await PosPicker.search('floor tile & 60x60', async (url) => { calls.push(url); return { ok: true, json: async () => [item()] }; });
    expect(calls).toEqual(['/api/items?limit=8&q=floor%20tile%20%26%2060x60']);
    expect(rows).toHaveLength(1);
  });
  test('nothing typed means no request and no suggestions', async () => {
    const f = jest.fn();
    expect(await PosPicker.search('   ', f)).toEqual([]);
    expect(await PosPicker.search('', f)).toEqual([]);
    expect(await PosPicker.search(null, f)).toEqual([]);
    expect(f).not.toHaveBeenCalled();
  });
  test('any failure is just "no suggestions": typing by hand must keep working', async () => {
    expect(await PosPicker.search('tile', async () => { throw new Error('offline'); })).toEqual([]);
    expect(await PosPicker.search('tile', async () => ({ ok: false, status: 401, json: async () => ({ error: 'x' }) }))).toEqual([]);
    expect(await PosPicker.search('tile', async () => ({ ok: true, json: async () => { throw new Error('bad json'); } }))).toEqual([]);
    expect(await PosPicker.search('tile', ok({ error: 'not a list' }))).toEqual([]);
  });
});

describe('suggestion and fill', () => {
  test('a suggestion shows name, code, stock and price', () => {
    expect(PosPicker.optionLabel(item())).toEqual({ title: 'Marble Floor Tile 60x60', detail: '1001 · stock 120 · LKR 4,500' });
  });
  test('picking fills the name and the selling price', () => {
    expect(PosPicker.fill(item({ selling_price: '12500.50' }))).toEqual({ name: 'Marble Floor Tile 60x60', price: 12500.5 });
  });
  test('the cost price is never part of a suggestion or a fill, even if the server sent it', () => {
    const leaky = item({ avg_cost: 2999 });
    expect(JSON.stringify(PosPicker.optionLabel(leaky)) + JSON.stringify(PosPicker.fill(leaky))).not.toMatch(/2,?999|cost/i);
  });
});

describe('stock warnings', () => {
  test.each([
    [item({ stock_level: 120 }), 5, 'ok', 'In stock: 120'],
    [item({ stock_level: 15, reorder_threshold: 20 }), 5, 'low', 'Low stock: 15 left'],
    [item({ stock_level: 10 }), 11, 'over', 'Only 10 in stock'],
    [item({ stock_level: 10, reorder_threshold: 5 }), 10, 'ok', 'In stock: 10'],
    [item({ stock_level: 0 }), 1, 'out', 'Out of stock'],
    [item({ stock_level: -3 }), 1, 'out', 'Out of stock'],
  ])('%#', (it, qty, level, text) => {
    expect(PosPicker.stockStatus(it, qty)).toEqual({ level, text });
  });
});

describe('the bill page is wired to it', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'pos_billing.html'), 'utf8');
  test('loads the helper before the page script and builds each row with a suggestion list and a stock hint', () => {
    expect(html.indexOf('<script src="/pos-picker.js"></script>')).toBeGreaterThan(-1);
    expect(html.indexOf('/pos-picker.js')).toBeLessThan(html.indexOf('function addItemRow'));
    expect(html).toMatch(/class="pick-list"/);
    expect(html).toMatch(/class="stock-hint"/);
    expect(html).toMatch(/attachPicker\(row\)/);
  });
  test('the bill still reads the same fields, so a free-typed item works exactly as before', () => {
    expect(html).toMatch(/r\.querySelector\('\.i-name'\)\.value\.trim\(\)/);
    expect(html).toMatch(/r\.querySelector\('\.i-qty'\)\.value/);
    expect(html).toMatch(/r\.querySelector\('\.i-price'\)\.value/);
    expect(html).toMatch(/item_name: r\.querySelector/);
  });
  test('names from the catalogue are placed as text, never as HTML', () => {
    expect(html).toMatch(/row\.querySelector\('\.i-name'\)\.value = name/);
    expect(html).toMatch(/b\.textContent = o\.title/);
    expect(html).toMatch(/s\.textContent = o\.detail/);
    expect(html).not.toMatch(/class="i-name" value="\$\{/);                  // the old unescaped template is gone
  });
  test('the page script parses', () => {
    const vm = require('vm');
    const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
    for (const code of scripts) expect(() => new vm.Script(code)).not.toThrow();
  });
});
