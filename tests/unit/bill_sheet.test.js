// Report screens with no typed day sheet: bill figures, and unknown things stay null (never 0).
jest.mock('../../utils/moneyCore', () => ({
  round2: (n) => Math.round(n * 100) / 100,
  days: async () => [{ day: '2026-11-05', sales: 1000, gp: 200, source: 'bills' }, { day: '2026-11-29', sales: 500, gp: null, source: 'bills' }, { day: '2026-11-30', sales: 9, gp: 1, source: 'sheet' }],
}));
const B = require('../../utils/billSheet');

test('rows from bills only; expenses and net unknown', async () => {
  const r = await B.rows({}, '2026-11-01', '2026-11-30');
  expect(r).toHaveLength(2);
  expect(r[0]).toMatchObject({ total_sale: 1000, gross_profit: 200, total_expenses: null, net_profit: null, cash_sale: null });
  expect(B.total(r)).toEqual({ sales: 1500, gross_profit: 200, days: 2 });
  expect(B.group(r, 'monthly')).toEqual([{ period: '2026-11-01', days: 2, sales: 1500, gross_profit: 200 }]);
  expect(B.group(r, 'weekly').map((g) => g.period)).toEqual(['2026-11-02', '2026-11-23']);
  expect(B.group(r, 'quarterly')[0].period).toBe('2026-10-01');
});
