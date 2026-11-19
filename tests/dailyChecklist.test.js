const C = require('../utils/dailyChecklist');
test('one category per day, cycles through all', () => {
  const cats = ['Tiles', 'Taps', 'Basins'], seen = new Set();
  for (let i = 0; i < 3; i++) seen.add(C.categoryOfDay(cats, C.addDays('2026-10-24', i)));
  expect(seen.size).toBe(3); expect(C.categoryOfDay([], '2026-10-24')).toBeNull();
});
test('runDaily queues once per day', async () => {
  const runs = new Set(), sent = [];
  const pool = { query: async (sql, a) => { if (/INSERT INTO automation_runs/.test(sql)) { const k = a[0]; if (runs.has(k)) return { rows: [] }; runs.add(k); return { rows: [{ job: 'x' }] }; } if (/DISTINCT category/.test(sql)) return { rows: [{ category: 'Taps' }] }; if (/CREATE/.test(sql)) return {}; throw new Error('relation does not exist'); } };
  const enq = async t => sent.push(t), now = new Date('2026-10-24T01:00:00Z');
  expect((await C.runDaily({ pool, enqueue: enq, now, backupDir: '/nonexistent-backups' })).lines).toBe(1);
  expect((await C.runDaily({ pool, enqueue: enq, now, backupDir: '/nonexistent-backups' })).done).toBe(false);
  expect(sent.length).toBe(1); expect(sent[0]).toMatch(/Taps/);
});
