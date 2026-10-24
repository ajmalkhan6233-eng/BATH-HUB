const W = require('../utils/billWatch');
test('add needs vendor and a number', async () => { const db = { query: async () => ({ rows: [] }) }; W.reset();
  expect((await W.add(db, { diff_amount: 400 })).code).toBe(400);
  expect((await W.add(db, { vendor_name: 'F', diff_amount: 'abc' })).code).toBe(400); });
