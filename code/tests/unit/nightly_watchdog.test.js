const fs = require('fs'), os = require('os'), path = require('path');
const { runNightly, reportText } = require('../../utils/nightlyReport');
const { check } = require('../../utils/serverWatchdog');

const mkPool = () => { const seen = new Set(); return { query: async (sql, p) => {
  if (/INSERT INTO automation_runs/.test(sql)) { const k = p.join('|'); if (seen.has(k)) return { rows: [] }; seen.add(k); return { rows: [{}] }; }
  if (/FROM daily_summary/.test(sql)) return { rows: [{ s: 90000, gp: 30000, e: 12000, n: 1 }] };
  return { rows: [] };
} }; };

test('nightly report: dummy data gives text with net profit + a PDF, once per day, not before 21:00', async () => {
  const pool = mkPool(), q = [], outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'n'));
  const enqueue = async (t) => q.push(t);
  expect((await runNightly({ pool, enqueue, now: new Date('2026-10-12T10:00:00Z'), outDir })).done).toBe(false); // 15:30 SL
  const at = new Date('2026-10-12T16:00:00Z');                                                                    // 21:30 SL
  const r = await runNightly({ pool, enqueue, now: at, outDir });
  expect(r.done).toBe(true); expect(fs.statSync(r.pdf).size).toBeGreaterThan(500);
  expect(q[0]).toMatch(/net profit Rs 18,000/);
  expect((await runNightly({ pool, enqueue, now: at, outDir })).done).toBe(false);
});
test('watchdog: up = nothing; down = restart apex-server once + queued note; other names refused', async () => {
  const restarted = [], q = [];
  const base = { restart: async (n) => restarted.push(n), enqueue: async (t) => q.push(t) };
  expect((await check({ ...base, fetchFn: async () => ({ ok: true }) })).up).toBe(true);
  expect(restarted).toEqual([]);
  const r = await check({ ...base, fetchFn: async () => { throw new Error('refused'); } });
  expect(r).toEqual({ up: false, restarted: true }); expect(restarted).toEqual(['apex-server']); expect(q[0]).toMatch(/I restarted it/);
  await expect(check({ ...base, name: 'bathco-server', fetchFn: async () => { throw new Error('x'); } })).rejects.toThrow(/apex-/);
});
