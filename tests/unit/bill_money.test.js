jest.mock('../../utils/pool', () => ({ query: async () => ({ rows: [] }) }));
const { billMoney } = require('../../routes/outside_items');
test('shop to pay, profit and margin of one bill', () => {
  expect(billMoney(1000, [{ code: 'SP-001', qty: 1, cost: 300 }, { code: '014', qty: 2, cost: 100 }])).toEqual({ shops_to_pay: 300, profit: 500, margin: 50, no_cost: 0 });
});
