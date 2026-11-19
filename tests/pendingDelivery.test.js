const D = require('../utils/pendingDelivery');
test('clean needs name, qty>0, cost>=0', () => { expect(D.clean({ name: 'Valve', qty: 2, unit_cost: 100 }).amount).toBe(200); expect(D.clean({ name: '', qty: 1, unit_cost: 1 })).toBeNull(); expect(D.clean({ name: 'x', qty: 0, unit_cost: 1 })).toBeNull(); });
test('add refuses empty lists and missing bill number', async () => { const db = { query: async () => ({ rows: [] }) }; D.reset();
  expect((await D.add(db, { lines: [{ name: 'a', qty: 1, unit_cost: 1 }] })).code).toBe(400);
  expect((await D.add(db, { bill_no: 'B1', lines: [] })).code).toBe(400); });
