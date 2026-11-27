const { compute, validate, daysBetween, DEFAULTS } = require('../../routes/running_cost');

test('buffer tops the real costs up to the daily line', () => {
  const r = compute(DEFAULTS, 10, 100000);
  expect(r.total).toBe(200000);
  expect(r.real + r.buffer).toBe(200000);
  expect(r.net).toBe(-100000);
});
test('no negative buffer when real costs pass the line', () => {
  const r = compute({ ...DEFAULTS, daily_line: 1000 }, 1, 0);
  expect(r.buffer).toBe(0);
  expect(r.total).toBe(r.real);
});
test('days are counted inclusively and bad settings are refused', () => {
  expect(daysBetween('2026-10-29', '2026-10-31')).toBe(3);
  expect(() => validate({ rent_month: -1 }, DEFAULTS)).toThrow();
  expect(() => validate({ from: 'yesterday' }, DEFAULTS)).toThrow();
});
