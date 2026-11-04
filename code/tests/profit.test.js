'use strict';
const P = require('../utils/profit');
test('gross = sales - cost; net = gross - other costs', () => {
  const r = P.aggregate({ bills: [{ day: '2026-10-24', total: 1000, discount: 0, cost: 600, no_cost: 0 }, { day: '2026-10-24', total: 500, discount: 50, cost: 300, no_cost: 1 }],
    expenses: [{ day: '2026-10-24', amount: 100 }], salaries: [{ day: '2026-10-24', amount: 50 }], commissions: [{ day: '2026-10-24', amount: 25 }] }, 'day');
  const x = r.rows[0];
  expect([x.sales, x.cogs, x.gross, x.other_costs, x.net, x.bills, x.lines_without_cost]).toEqual([1500, 900, 600, 175, 425, 2, 1]);
  expect(x.margin_pct).toBe(40);
});
test('periods group by week (Monday), month and year; total equals the sum of rows', () => {
  expect(P.periodOf('2026-10-24', 'week')).toBe('2026-10-19');
  expect(P.periodOf('2026-10-24', 'month')).toBe('2026-10');
  expect(P.periodOf('2026-10-24', 'year')).toBe('2026');
  const r = P.aggregate({ bills: [{ day: '2026-09-30', total: 100, cost: 40 }, { day: '2026-10-01', total: 200, cost: 80 }] }, 'month');
  expect(r.rows.map(x => x.period)).toEqual(['2026-10', '2026-09']);
  expect(r.total.sales).toBe(300); expect(r.total.gross).toBe(180); expect(r.total.net).toBe(180);
});
test('costs without sales make a loss; empty is zero, no NaN', () => {
  const r = P.aggregate({ expenses: [{ day: '2026-10-24', amount: 100 }] }, 'day');
  expect(r.rows[0].net).toBe(-100); expect(r.rows[0].margin_pct).toBeNull();
  const e = P.aggregate({}, 'day'); expect(e.rows).toEqual([]); expect(e.total.net).toBe(0);
});
test('rounds to 2 decimals so rows add up', () => {
  const r = P.aggregate({ bills: [{ day: '2026-10-24', total: 0.1, cost: 0 }, { day: '2026-10-24', total: 0.2, cost: 0 }] }, 'day');
  expect(r.rows[0].sales).toBe(0.3);
});
test('rollup by item and category, best profit first', () => {
  const lines = [{ item_code: 'A', item_name: 'Tap', category: 'Taps', qty: 2, revenue: 200, cost: 120 }, { item_code: 'A', item_name: 'Tap', category: 'Taps', qty: 1, revenue: 100, cost: 60 }, { item_code: 'B', item_name: 'Soap dish', category: 'Accessories', qty: 5, revenue: 100, cost: 20 }];
  const it = P.rollup(lines, 'item'); expect(it[0]).toMatchObject({ key: 'A', qty: 3, revenue: 300, cost: 180, profit: 120, margin_pct: 40 });
  expect(P.rollup(lines, 'category').map(x => x.key)).toEqual(['Taps', 'Accessories']);
});
