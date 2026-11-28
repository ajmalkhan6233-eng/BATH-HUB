'use strict';
// AJ 28 Nov: money screens read the typed day sheet, else the POS bills; unknown stays null.
const MC = require('../../utils/moneyCore');
const { weeklyProfit } = require('../../utils/automations');
const bill = (day, total, cost) => ({ id: 1, bill_number: 'T', day, total, discount: 0, cost, no_cost: 0 });
const pool = (bills, sheets) => ({ query: async (sql) => ({ rows: /FROM pos_bills/.test(sql) ? bills : sheets }) });

test('bills fill a day with no sheet; expenses stay unknown', async () => {
  const t = MC.dayTotal(await MC.days(pool([bill('2026-11-27', 1000, 600)], []), '2026-11-27', '2026-11-27'));
  expect(t).toEqual({ sales: 1000, gp: 400, expenses: null, days: 1 });
  expect(weeklyProfit('a', 'b', t)).toContain('expenses not entered');
});
test('a typed sheet wins over the bills for that day', async () => {
  const t = MC.dayTotal(await MC.days(pool([bill('2026-11-27', 1000, 600)], [{ report_date: '2026-11-27', total_sale: '1500', gross_profit: '500', total_expenses: '100' }]), '2026-11-27', '2026-11-27'));
  expect(t).toEqual({ sales: 1500, gp: 500, expenses: 100, days: 1 });
});
