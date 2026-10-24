const O = require('../utils/oversold');
test('shortOf: only the part past stock', () => { expect(O.shortOf(5, 6)).toBe(1); expect(O.shortOf(0, 2)).toBe(2); expect(O.shortOf(-3, 2)).toBe(2); expect(O.shortOf(9, 6)).toBe(0); });
test('resolve local_cash needs a cost and computes the extra cost', async () => {
  const rows = [{ id: 1, status: 'OPEN', qty_short: 2, avg_cost: 100 }]; const calls = [];
  const db = { query: async (sql, a) => { calls.push(sql); if (/CREATE TABLE/.test(sql)) return {}; if (/SELECT o\.\*/.test(sql)) return { rows }; return { rows: [] }; } };
  O.reset();
  expect((await O.resolve(db, 1, { how: 'local_cash' })).code).toBe(400);
  const r = await O.resolve(db, 1, { how: 'local_cash', cost: 130 });
  expect(r.cost_adjust).toBe(60); expect(r.status).toBe('DONE');
});
