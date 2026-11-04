const W = require('../utils/profitWaterfall');
test('deposit set-aside is 200,000 over 24 months', () => { expect(W.depositSetAside()).toBe(8333.33); });
test('commission is percent of profit and never negative', () => {
  expect(W.commission(540000, 5)).toBe(27000);
  expect(W.commission(-100, 5)).toBe(0);
});
test('phase switches when shop cash reaches one month of costs', () => {
  expect(W.phaseFor({ shopCash: 100000, monthlyCosts: 316000 })).toBe(1);
  expect(W.phaseFor({ shopCash: 316000, monthlyCosts: 316000 })).toBe(2);
});
test('split always adds up to the amount', () => {
  const s = W.splitNetProfit(188666.67, 1);
  expect(Math.round((s.shop + s.commitments + s.savings + s.owner) * 100) / 100).toBe(188666.67);
  expect(s.shop).toBe(94333.34);
});
test('60,000 a day month: gross 540,000, costs 316,000, commission 5%', () => {
  const w = W.waterfall({ grossProfit: 540000, fixedCosts: 316000, commissionRatePct: 5, depositPerPeriod: 8333.33, shopCash: 0, monthlyCosts: 316000 });
  expect(w.commission).toBe(27000);
  expect(w.net).toBe(197000);
  expect(w.splitBase).toBe(188666.67);
  expect(w.phase).toBe(1);
});
test('a losing period pays no commission and reports the shortfall', () => {
  const w = W.waterfall({ grossProfit: 180000, fixedCosts: 316000, depositPerPeriod: 8333.33 });
  expect(w.commission).toBe(0);
  expect(w.split.shortfall).toBeGreaterThan(0);
  expect(w.split.owner).toBe(0);
});
