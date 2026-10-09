'use strict';
// POS cart logic: barcode scan adds, quantity steps, totals preview, hold / resume (browser storage only).
const PosCart = require('../../public/pos-cart');

const tile = { item_code: '1001', name: 'Marble Ivory Floor Tile 60x60', selling_price: 4500 };
const tap = { item_code: '2001', name: 'Basin Mixer Tap Chrome', selling_price: 12500 };
const memStore = () => { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } }; };

describe('scan', () => {
  test('a scanned code adds the item with qty 1 and its selling price', () => {
    expect(PosCart.addScanned([], tile)).toEqual([{ item_code: '1001', name: tile.name, qty: 1, unit_price: 4500 }]);
  });
  test('scanning the same code again adds 1 to the quantity (no second row)', () => {
    let rows = PosCart.addScanned([], tile);
    rows = PosCart.addScanned(rows, tile);
    rows = PosCart.addScanned(rows, tile);
    expect(rows).toHaveLength(1);
    expect(rows[0].qty).toBe(3);
  });
  test('a different item gets its own row; the old rows are not changed in place', () => {
    const before = PosCart.addScanned([], tile);
    const after = PosCart.addScanned(before, tap);
    expect(after).toHaveLength(2);
    expect(before).toHaveLength(1);
    expect(before[0].qty).toBe(1);
  });
  test('findExact needs the whole code: 100 does not match 1001; case and spaces and a newline are ignored', () => {
    const items = [tile, tap];
    expect(PosCart.findExact(items, '100')).toBeNull();
    expect(PosCart.findExact(items, ' 1001\n')).toBe(tile);
    expect(PosCart.findExact([{ item_code: 'AB-7', name: 'x' }], 'ab-7')).toEqual({ item_code: 'AB-7', name: 'x' });
  });
  test('an unknown or empty code finds nothing, so nothing is added', () => {
    expect(PosCart.findExact([tile], '9999')).toBeNull();
    expect(PosCart.findExact([tile], '   ')).toBeNull();
    expect(PosCart.findExact(null, '1001')).toBeNull();
    expect(PosCart.cleanCode(null)).toBe('');
  });
});

describe('quantity steps', () => {
  test('+ and - move by 1', () => { expect(PosCart.stepQty(2, 1)).toBe(3); expect(PosCart.stepQty(3, -1)).toBe(2); });
  test('never below 1', () => { expect(PosCart.stepQty(1, -1)).toBe(1); expect(PosCart.stepQty(0.5, -1)).toBe(1); });
  test('fractions (tile boxes by the m2) keep 2 decimals', () => { expect(PosCart.stepQty(1.5, 1)).toBe(2.5); expect(PosCart.stepQty(0.1, 0.2)).toBe(1); });
});

describe('totals preview matches what the server works out', () => {
  test('lines to 2 decimals, subtotal = sum of lines, discount to 2 decimals', () => {
    const t = PosCart.totals([{ qty: 2, unit_price: 4500 }, { qty: 1, unit_price: 12500 }], 10);
    expect(t).toEqual({ subtotal: 21500, discount: 2150, total: 19350 });
  });
  test('no discount, odd cents', () => {
    expect(PosCart.totals([{ qty: 3, unit_price: 33.335 }], 0).subtotal).toBe(100.02);   // the price is stored as 33.34 first, like the server
  });
  test('empty cart is zero', () => { expect(PosCart.totals([], 5)).toEqual({ subtotal: 0, discount: 0, total: 0 }); });
});

describe('hold / resume', () => {
  const cart = { customer_name: 'Test', customer_phone: '0771234567', discount_pct: 5, payment_method: 'card', rows: [{ item_code: '1001', name: tile.name, qty: 2, unit_price: 4500 }] };

  test('a held cart keeps the customer, discount, payment and rows', () => {
    const h = PosCart.makeHeld(cart, 1000);
    expect(h).toMatchObject({ at: 1000, customer_name: 'Test', customer_phone: '0771234567', discount_pct: 5, payment_method: 'card' });
    expect(h.rows).toEqual([{ item_code: '1001', name: tile.name, qty: 2, unit_price: 4500 }]);
  });
  test('an empty cart is not held', () => {
    expect(PosCart.holdAdd([], PosCart.makeHeld({ rows: [{ name: '  ', qty: 1, unit_price: 0 }] }))).toEqual({ ok: false, reason: 'empty' });
  });
  test('at most 10 held carts; the 11th is refused and the list is not changed', () => {
    let list = [];
    for (let i = 0; i < 10; i++) { const r = PosCart.holdAdd(list, PosCart.makeHeld(cart, i)); expect(r.ok).toBe(true); list = r.list; }
    expect(list).toHaveLength(10);
    const r11 = PosCart.holdAdd(list, PosCart.makeHeld(cart, 99));
    expect(r11).toEqual({ ok: false, reason: 'full' });
    expect(list).toHaveLength(10);
  });
  test('resume = get by id then remove it; delete removes only that one', () => {
    const a = PosCart.makeHeld(cart, 1), b = PosCart.makeHeld(cart, 2);
    const list = [a, b];
    expect(PosCart.holdGet(list, b.id)).toBe(b);
    expect(PosCart.holdRemove(list, a.id)).toEqual([b]);
    expect(PosCart.holdGet(list, 'nope')).toBeNull();
  });
  test('saved to storage and read back; junk in storage is ignored; a failing storage never throws', () => {
    const s = memStore();
    const h = PosCart.makeHeld(cart, 5);
    expect(PosCart.saveHeld(s, [h])).toBe(true);
    expect(PosCart.loadHeld(s)).toEqual([h]);
    s.setItem(PosCart.HELD_KEY, '{not json');
    expect(PosCart.loadHeld(s)).toEqual([]);
    s.setItem(PosCart.HELD_KEY, JSON.stringify([{ nonsense: true }, h]));
    expect(PosCart.loadHeld(s)).toEqual([h]);
    const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('full'); } };
    expect(PosCart.loadHeld(broken)).toEqual([]);
    expect(PosCart.saveHeld(broken, [h])).toBe(false);
  });
  test('nothing in the module talks to the network or a database', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '../../public/pos-cart.js'), 'utf8');
    expect(src).not.toMatch(/fetch\(|XMLHttpRequest|\/api\//);
  });
});

describe('payment types (screen side)', () => {
  test('cash / card / online singles send no list', () => { expect(PosCart.buildPayments('cash', 1000)).toEqual({ payments: null }); });
  test('credit = one credit payment for the whole total', () => { expect(PosCart.buildPayments('credit', 1000)).toEqual({ payments: [{ method: 'credit', amount: 1000 }] }); });
  test('cheque needs its reference', () => {
    expect(PosCart.buildPayments('cheque', 1000, { chequeRef: '  ' }).error).toMatch(/cheque number/i);
    expect(PosCart.buildPayments('cheque', 1000, { chequeRef: '004512 Sampath' })).toEqual({ payments: [{ method: 'cheque', amount: 1000, reference: '004512 Sampath' }] });
  });
  test('split must add up to the total exactly: over and under are both refused', () => {
    const ok = PosCart.buildPayments('split', 1000, { split: [{ method: 'cash', amount: '600' }, { method: 'card', amount: '400' }] });
    expect(ok.payments).toEqual([{ method: 'cash', amount: 600 }, { method: 'card', amount: 400 }]);
    expect(PosCart.buildPayments('split', 1000, { split: [{ method: 'cash', amount: 600 }, { method: 'card', amount: 399.99 }] }).error).toMatch(/add up/);
    expect(PosCart.buildPayments('split', 1000, { split: [{ method: 'cash', amount: 600 }, { method: 'card', amount: 400.01 }] }).error).toMatch(/add up/);
  });
  test('split needs two real payments; empty rows are ignored; a split cheque needs its number', () => {
    expect(PosCart.buildPayments('split', 1000, { split: [{ method: 'cash', amount: 1000 }, { method: 'card', amount: 0 }] }).error).toMatch(/at least two/);
    expect(PosCart.buildPayments('split', 1000, { split: [{ method: 'cash', amount: 500 }, { method: 'cheque', amount: 500 }] }).error).toMatch(/cheque number/);
  });
  test('cents: the remaining amount is exact (no 0.1 + 0.2 drift)', () => {
    expect(PosCart.splitRemaining(0.3, [{ amount: 0.1 }, { amount: 0.2 }])).toBe(0);
    expect(PosCart.splitRemaining(100.02, [{ amount: 50.01 }])).toBe(50.01);
    expect(PosCart.splitRemaining(100, [{ amount: 60 }, { amount: 50 }])).toBe(-10);
  });
  test('a held cart keeps the cheque reference and split rows', () => {
    const h = PosCart.makeHeld({ rows: [{ name: 'Tap', qty: 1, unit_price: 100 }], payment_method: 'split', pay_extra: { chequeRef: 'x', split: [{ method: 'cash', amount: 50 }] } });
    expect(h.pay_extra).toEqual({ chequeRef: 'x', split: [{ method: 'cash', amount: 50 }] });
    expect(PosCart.makeHeld({ rows: [] }).pay_extra).toBeNull();
  });
});

describe('quotation to cart (read only)', () => {
  const quote = { quote_no: 'Q-0004', customer_name: 'Mr Silva', customer_phone: '0771112222', discount: 1500, total: 13500,
    items: [{ item_code: '1001', description: 'Marble Ivory Floor Tile 60x60', qty: '2', unit_price: '4500' }, { item_code: '2001', description: 'Basin Mixer Tap Chrome', qty: '1', unit_price: '6000' }] };
  test('items become cart rows with numbers, customer comes across', () => {
    const c = PosCart.quotationToCart(quote);
    expect(c.rows).toEqual([{ item_code: '1001', name: 'Marble Ivory Floor Tile 60x60', qty: 2, unit_price: 4500 }, { item_code: '2001', name: 'Basin Mixer Tap Chrome', qty: 1, unit_price: 6000 }]);
    expect(c).toMatchObject({ customer_name: 'Mr Silva', customer_phone: '0771112222', quote_no: 'Q-0004' });
  });
  test('the money discount becomes a percentage that gives the same bill total', () => {
    const c = PosCart.quotationToCart(quote);               // subtotal 15000, discount 1500 = 10%
    expect(c.discount_pct).toBe(10);
    expect(c.bill_total).toBe(13500);
    expect(c.matches).toBe(true);
  });
  test('an awkward discount (1000 of 15000 = 6.666...%) still gives the exact quote total, and says so when it does not match', () => {
    const c = PosCart.quotationToCart({ ...quote, discount: 1000, total: 14000 });
    expect(c.bill_total).toBe(14000); expect(c.matches).toBe(true);
    const off = PosCart.quotationToCart({ ...quote, total: 99999 });
    expect(off.matches).toBe(false);
  });
  test('no discount, no items, lines without a name', () => {
    expect(PosCart.quotationToCart({ ...quote, discount: 0 }).discount_pct).toBe(0);
    expect(PosCart.quotationToCart({ items: [] }).rows).toEqual([]);
    expect(PosCart.quotationToCart({ items: [{ description: ' ', qty: 1, unit_price: 5 }] }).rows).toEqual([]);
    expect(PosCart.quotationToCart(null).rows).toEqual([]);
  });
  test('the quotation object is not changed', () => {
    const copy = JSON.parse(JSON.stringify(quote)); PosCart.quotationToCart(quote); expect(quote).toEqual(copy);
  });
});
