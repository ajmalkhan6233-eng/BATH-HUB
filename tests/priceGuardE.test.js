'use strict';
const { findBadPrice } = require('../utils/priceGuard');
const q = (row) => async () => ({ rows: row ? [row] : [] });
const line = (o) => ({ item_name: 'X', item_code: 'A', qty: 1, unit_price: 100, line_total: 100, ...o });
test('with a discount rule the floor is never below cost', async () => {
  // selling 100, cap 50% -> 50, but cost is 80: price 60 must be refused
  const bad = await findBadPrice(q({ selling_price: 100, avg_cost: 80 }), [line({ unit_price: 60, line_total: 60 })], 0, 50);
  expect(bad).toMatchObject({ reason: 'low', floor: 80 });
  expect(await findBadPrice(q({ selling_price: 100, avg_cost: 80 }), [line({ unit_price: 85, line_total: 85 })], 0, 50)).toBeNull();
});
test('a big line with no item code needs approval, a small one does not', async () => {
  expect((await findBadPrice(q(null), [line({ item_code: '', unit_price: 8000, line_total: 8000 })], 0, null)).reason).toBe('no_code');
  expect(await findBadPrice(q(null), [line({ item_code: '', unit_price: 800, line_total: 800 })], 0, null)).toBeNull();
});
test('an unknown code counts like no code; the bill discount lowers the line', async () => {
  expect((await findBadPrice(q(null), [line({ item_code: 'ZZ', unit_price: 6000, line_total: 6000 })], 0, null)).reason).toBe('no_code');
  expect(await findBadPrice(q(null), [line({ item_code: 'ZZ', unit_price: 6000, line_total: 6000 })], 20, null)).toBeNull();   // 4800 after 20%
});
test('the owner selling is not held for a no-code line', async () => {
  expect(await findBadPrice(q(null), [line({ item_code: '', unit_price: 8000, line_total: 8000 })], 0, null, { ownerSale: true })).toBeNull();
});
