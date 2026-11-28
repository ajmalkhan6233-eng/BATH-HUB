// With no typed day sheet the reports use the POS bills and never show a made-up expense figure.
jest.mock('../../utils/moneyCore', () => ({ days: async () => [{ day: '2026-11-05', sales: 1000, gp: 200, expenses: null, source: 'bills' }, { day: '2026-11-06', sales: 500, gp: 100, expenses: null, source: 'bills' }] }));
const { REPORTS } = require('../../utils/documents/reports');
const pool = { query: async () => ({ rows: [] }) };

test.each([['daily_summary', 2], ['pnl', 1]])('%s from bills', async (key, n) => {
  const r = await REPORTS[key].build(pool, { from: '2026-11-01', to: '2026-11-30' });
  expect(r.rows).toHaveLength(n);
  expect(r.total).toMatchObject({ total_sale: 1500, gross_profit: 300 });
  expect(r.columns.map((c) => c.key)).not.toContain('total_expenses');
});
