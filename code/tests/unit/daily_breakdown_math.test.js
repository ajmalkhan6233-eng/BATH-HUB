const { computeBreakdown, dueList, daysInMonth } = require('../../utils/daily_breakdown_math');

describe('computeBreakdown', () => {
  const settings = { rent_monthly: 70000, salary_monthly: 0, other_monthly: 0, commission_rate: 0 };

  test('days in month', () => {
    expect(daysInMonth('2026-10-19')).toBe(31);
    expect(daysInMonth('2026-02-10')).toBe(28);
  });

  test('plain POS day: sales, cost, gross, rent share, net', () => {
    const r = computeBreakdown({ date: '2026-10-19', posSales: 100000, stockCost: 50000, settings });
    expect(r.sales).toBe(100000);
    expect(r.gross_profit).toBe(50000);
    expect(r.rent).toBe(2258.06);            // 70000 / 31
    expect(r.net_profit).toBe(47741.94);
    expect(r.keep_aside).toBe(52258.06);     // cost + rent
    expect(r.keep_aside + r.net_profit).toBeCloseTo(r.sales, 2);
  });

  test('salary and commission once Aj fills them in', () => {
    const r = computeBreakdown({ date: '2026-10-19', posSales: 100000, stockCost: 50000, settings: { ...settings, salary_monthly: 31000, commission_rate: 2 } });
    expect(r.salary).toBe(1000);
    expect(r.commission).toBe(1000);         // 2% of 50000 gross
    expect(r.keep_aside + r.net_profit).toBeCloseTo(r.sales, 2);
  });

  test('market purchase outside POS: adds its price to sales and its cost, only profit lands in net', () => {
    const r = computeBreakdown({ date: '2026-10-19', posSales: 0, stockCost: 0, market: [{ buy_cost: 1000, sell_price: 1400, on_bill: false }], settings: { ...settings, rent_monthly: 0 } });
    expect(r.sales).toBe(1400);
    expect(r.cost).toBe(1000);
    expect(r.market_profit).toBe(400);
    expect(r.net_profit).toBe(400);
  });

  test('market purchase already on a POS bill is not counted twice in sales', () => {
    const r = computeBreakdown({ date: '2026-10-19', posSales: 1400, stockCost: 0, market: [{ buy_cost: 1000, sell_price: 1400, on_bill: true }], settings: { ...settings, rent_monthly: 0 } });
    expect(r.sales).toBe(1400);
    expect(r.gross_profit).toBe(400);
  });

  test('loss day: no negative commission', () => {
    const r = computeBreakdown({ date: '2026-10-19', posSales: 1000, stockCost: 3000, settings: { ...settings, commission_rate: 5, rent_monthly: 0 } });
    expect(r.gross_profit).toBe(-2000);
    expect(r.commission).toBe(0);
  });
});

describe('dueList', () => {
  test('cheques inside the window, overdue included, sorted; far ones left out; cleared ones left out', () => {
    const out = dueList({ today: '2026-10-19', windowDays: 7, cheques: [
      { payee: 'A', amount: 5000, due_date: '2026-10-25', status: 'pending' },
      { payee: 'B', amount: 3000, due_date: '2026-10-17', status: 'pending' },
      { payee: 'C', amount: 9000, due_date: '2026-11-30', status: 'pending' },
      { payee: 'D', amount: 100, due_date: '2026-10-20', status: 'cleared' },
    ] });
    expect(out.map((x) => x.label)).toEqual(['Cheque to B', 'Cheque to A']);
    expect(out[0].days_left).toBe(-2);
    expect(out[1].days_left).toBe(6);
  });

  test('rent and salary by day of month; off when day is 0 or amount is 0', () => {
    const out = dueList({ today: '2026-10-19', windowDays: 7, rentDay: 22, salaryDay: 0, rentAmount: 70000, salaryAmount: 0 });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: 'rent', amount: 70000, days_left: 3, due_date: '2026-10-22' });
    expect(dueList({ today: '2026-10-19', rentDay: 0, rentAmount: 70000 })).toHaveLength(0);
  });

  test('rent day already passed rolls to next month and falls outside the window', () => {
    expect(dueList({ today: '2026-10-19', windowDays: 7, rentDay: 5, rentAmount: 70000 })).toHaveLength(0);
  });
});

test('a held cheque still counts as to-pay', () => {
  const out = dueList({ today: '2026-10-19', windowDays: 7, cheques: [{ payee: 'H', amount: 700, due_date: '2026-10-21', status: 'held' }] });
  expect(out).toHaveLength(1);
});
