const { marginPct, marginFromProfit, formatMargin } = require('../../utils/margin');
test('margin is profit / selling price, not markup', () => {
  expect(marginPct(100, 130)).toBe(23.08);
  expect(marginPct(100, 100)).toBe(0);
});
test('selling price 0 gives "-" and never divides by zero', () => {
  expect(marginPct(100, 0)).toBeNull();
  expect(formatMargin(marginPct(100, 0))).toBe('-');
  expect(formatMargin(marginPct(100, 130))).toBe('23.08%');
  expect(marginFromProfit(30, 0)).toBeNull();
});
