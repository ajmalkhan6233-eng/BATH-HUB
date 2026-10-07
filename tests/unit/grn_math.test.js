const { lineTotal, weightedAvgCost, round2 } = require('../../utils/grn_math');
test('weighted average cost', () => {
  expect(weightedAvgCost(10, 100, 10, 120)).toBe(110);
  expect(weightedAvgCost(0, 100, 5, 90)).toBe(90);
  expect(weightedAvgCost(-3, 100, 5, 90)).toBe(90);
});
test('money is rounded to cents', () => {
  expect(lineTotal(3, 0.1)).toBe(0.3);
  expect(round2(1.005)).toBe(1.01);
});
