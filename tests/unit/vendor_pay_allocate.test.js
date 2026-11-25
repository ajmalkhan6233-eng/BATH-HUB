jest.mock('../../utils/pool', () => ({ query: async () => ({ rows: [] }) }));
const { allocate } = require('../../routes/vendor_pay');
const bills = [{ id: 1, bill_no: 'A', free: 100 }, { id: 2, bill_no: 'B', free: 0 }, { id: 3, bill_no: 'C', free: 50.5 }];
test('oldest bill first, never more than what is free', () => {
  expect(allocate(bills, 40)).toEqual([{ id: 1, bill_no: 'A', amount: 40 }]);
  expect(allocate(bills, 150.5)).toEqual([{ id: 1, bill_no: 'A', amount: 100 }, { id: 3, bill_no: 'C', amount: 50.5 }]);
  expect(allocate(bills, 151)).toBeNull();
});
