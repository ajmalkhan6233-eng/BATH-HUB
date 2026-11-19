const A = require('../../utils/vendorAdjust');
test('return: stock, credit and average cost move together', () => {
  // 10 in stock at cost 100 (value 1000). Return 4 at 100 -> credit 400, 6 left, cost still 100.
  expect(A.returnLine({ stock: 10, avgCost: 100, qty: 4, rate: 100 })).toEqual({ credit: 400, newStock: 6, newAvgCost: 100 });
});
test('return at a lower credit rate raises the average cost of what is left', () => {
  // value 1000, give back 4 units but vendor credits only 300 -> left value 700 over 6 units = 116.67
  expect(A.returnLine({ stock: 10, avgCost: 100, qty: 4, rate: 75 })).toEqual({ credit: 300, newStock: 6, newAvgCost: 116.67 });
});
test('return of everything keeps the last cost; more than stock is refused', () => {
  expect(A.returnLine({ stock: 3, avgCost: 50, qty: 3, rate: 50 }).newAvgCost).toBe(50);
  expect(() => A.returnLine({ stock: 3, avgCost: 50, qty: 4, rate: 50 })).toThrow('only 3 in stock');
  expect(() => A.returnLine({ stock: 3, avgCost: 50, qty: 0, rate: 50 })).toThrow('more than 0');
});
test('discount is split by line value and the parts add up exactly', () => {
  const parts = A.splitDiscount(100, [{ value: 1 }, { value: 1 }, { value: 1 }]);
  expect(parts.reduce((t, p) => t + p.share, 0)).toBeCloseTo(100, 2);
  expect(parts.map((p) => p.share)).toEqual([33.33, 33.33, 33.34]);
});
test('discount lowers cost of units in stock and reports the share for units already sold', () => {
  // bill had 10 units, discount share 50 -> 5 per unit; only 6 left -> 4 sold units carry 20
  expect(A.discountLine({ stock: 6, avgCost: 100, qtyOnBill: 10, share: 50 })).toEqual({ newAvgCost: 95, soldShare: 20, perUnit: 5 });
});
test('bad discount input is refused', () => {
  expect(() => A.splitDiscount(0, [{ value: 10 }])).toThrow('more than 0');
  expect(() => A.splitDiscount(10, [{ value: 0 }])).toThrow('no priced lines');
});
