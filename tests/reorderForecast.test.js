const F = require('../utils/reorder_forecast');
test('fast seller with few days left gets an order to cover 30 days', () => {
  const r = F.suggest([{ item_code: 'A1', name: 'Basin', stock_level: 6, reorder_threshold: 0, vendor: 'Eskema', sold: 60 }]); // 1/day, 6 days left
  expect(r).toHaveLength(1); expect(r[0].days_left).toBe(6); expect(r[0].order_qty).toBe(24);
});
test('slow seller with plenty of stock is left alone', () => {
  expect(F.suggest([{ item_code: 'B1', name: 'Tap', stock_level: 50, reorder_threshold: 5, vendor: 'X', sold: 6 }])).toEqual([]);
});
test('under the minimum but never sold: nothing to order (no sales history, owner decides)', () => {
  expect(F.suggest([{ item_code: 'C1', name: 'Soap dish', stock_level: 1, reorder_threshold: 5, vendor: 'X', sold: 0 }])).toEqual([]);
});
test('most urgent first, grouped by vendor with a ready text', () => {
  const l = F.suggest([
    { item_code: 'A', name: 'Slow', stock_level: 10, reorder_threshold: 0, vendor: 'V1', sold: 45 },
    { item_code: 'B', name: 'Fast', stock_level: 2, reorder_threshold: 0, vendor: 'V1', sold: 60 }]);
  expect(l[0].item_code).toBe('B');
  const v = F.byVendor(l); expect(v).toHaveLength(1); expect(v[0].text).toContain('Order for V1');
});
