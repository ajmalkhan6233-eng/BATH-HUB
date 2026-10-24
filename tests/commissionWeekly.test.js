const C = require('../utils/commissionWeekly');
test('5% of gross profit; at/below cost earns nothing; no cost counted', () => {
  const r = C.compute([{ revenue: 1000, cost: 600 }, { revenue: 500, cost: 500 }, { revenue: 300, cost: 400 }, { revenue: 200, cost: 0 }], 5);
  expect(r).toEqual({ gross: 300, eligible: 400, commission: 20, below_cost_lines: 2, no_cost_lines: 1, pct: 5 });
});
test('default 5 percent, env can change it', () => { expect(C.pctOf({})).toBe(5); expect(C.pctOf({ COMMISSION_PCT: '8' })).toBe(8); expect(C.pctOf({ COMMISSION_PCT: 'x' })).toBe(5); });
test('only on Sunday, once', async () => {
  const runs = new Set(), sent = [];
  const pool = { query: async (sql, a) => { if (/INSERT INTO automation_runs/.test(sql)) { if (runs.has(a[0])) return { rows: [] }; runs.add(a[0]); return { rows: [{}] }; } if (/CREATE/.test(sql)) return {}; return { rows: [{ revenue: 1000, cost: 600 }] }; } };
  const enq = async t => sent.push(t);
  expect((await C.runWeekly({ pool, enqueue: enq, now: new Date('2026-10-23T01:00:00Z') })).done).toBe(false);   // Friday
  const sun = new Date('2026-10-25T01:00:00Z');                                                                      // Sunday 06:30 Sri Lanka
  expect((await C.runWeekly({ pool, enqueue: enq, now: sun })).commission).toBe(20);
  expect((await C.runWeekly({ pool, enqueue: enq, now: sun })).done).toBe(false);
  expect(sent.length).toBe(1); expect(sent[0]).toMatch(/2026-10-18 to 2026-10-24/);
});
