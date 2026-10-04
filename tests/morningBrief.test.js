const M = require('../utils/morningBrief');
const base = {
  yesterday: { sales: 32500, grossProfit: 9750, expenses: 0 }, targets: { dailySales: 35000, dailyCost: 15000 },
  cheques: { today: 120000, tomorrow: 0, monday: { date: '2026-10-12', amount: 250000 }, overdue: { amount: 0, count: 0 }, bulkDays: [{ date: '2026-10-12', amount: 250000 }] },
  cashGap: { due: 120000, gap: 20000, days: 2 }, cashOnHand: 100000, receivables: [{ name: 'Nimal', amount: 65000, due: '2026-10-05' }],
};
test('behind target and short of cash produce clear actions', () => {
  const b = M.buildBrief(base, '2026-10-05');
  expect(b.sections.yesterday).toMatchObject({ salesPct: 93, profitVsCost: -5250, ahead: false });
  expect(b.actions[0]).toContain('Rs. 20,000');
  expect(b.actions.length).toBeLessThanOrEqual(3);
  expect(b.allActions.join(' ')).toContain('Nimal');
});
test('text is plain and mentions the cash position', () => {
  const t = M.toText(M.buildBrief(base, '2026-10-05'));
  expect(t).toContain('SHORT by Rs. 20,000');
  expect(t).toContain('Rs. 120,000');
});
test('a good day with no gap says on track', () => {
  const ok = { ...base, yesterday: { sales: 60000, grossProfit: 18000, expenses: 0 }, cashGap: { due: 0, gap: 0, days: 2 }, cheques: { ...base.cheques, bulkDays: [] }, receivables: [] };
  expect(M.buildBrief(ok, '2026-10-05').actions[0]).toContain('On track');
});
