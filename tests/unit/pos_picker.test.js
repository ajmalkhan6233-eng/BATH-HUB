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

// 28 Nov: public/pos_billing.html now runs the new POS screen (pos2-screen.js + pos2-api.js, same as pos-preview2.html).
// These checks cover the same promises on the screen that is really used.
const read = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', f), 'utf8');

describe('the live bill page is wired to it', () => {
  const screen = read('pos2-screen.js');
  test('both POS pages load the same screen code', () => {
    ['pos_billing.html', 'pos-preview2.html'].forEach((f) => { expect(read(f)).toContain('pos2-api.js'); expect(read(f)).toContain('pos2-screen.js'); });
  });
  test('names from the catalogue are escaped in the item list', () => {
    expect(screen).toMatch(/'<strong>' \+ esc\(x\.name\)|<strong>' \+ esc\(x\.name\)/);
    expect(screen).not.toMatch(/' \+ x\.name \+ '<\/strong>/);
  });
});

describe('the live bill page: discount cap, item codes, today list', () => {
  const screen = read('pos2-screen.js'), api = read('pos2-api.js'), html = read('pos_billing.html');
  test('shows the cap and asks for approval of an over-cap discount, then resends with override', () => {
    expect(api).toContain("'/api/pos-bills/discount-cap'");
    expect(html).toMatch(/id="capHint"/);
    expect(api).toMatch(/r\.d\.code === 'discount_over_cap' && r\.d\.can_override/);
    expect(api).toMatch(/go\(\{ override: true/);
    expect(screen).toContain("askReason('Discount approval'");
  });
  test('a catalogue item sends its code with the bill', () => {
    expect(api).toMatch(/item_code: r\.code \|\| undefined/);
  });
  test("today's bills are loaded on start and after each new bill; names are escaped", () => {
    expect(api).toContain("'/api/pos-bills/today'");
    expect(screen).toMatch(/paymentUI\(\); render\(\); loadToday\(\);/);
    expect(screen).toMatch(/clearForNext\(\); loadToday\(\);/);
    expect(screen).toMatch(/esc\(b\.customer_name \|\| 'Walk-in'\)/);
  });
});
