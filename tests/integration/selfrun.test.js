'use strict';
jest.mock('pg', () => require('../helpers/pgmock')());
const pg = require('pg');
const pool = new pg.Pool();
const { runOnce, closeLine } = require('../../utils/selfRun');
pg.__db.public.none('CREATE TABLE daily_entry_live (entry_date DATE PRIMARY KEY, payload JSONB)');
const audit = async () => ({ line: 'AUDIT GREEN: 12 checks agree', red: 0, warn: 0, ok: 12 });
const at = (h, m, d = 10) => new Date(Date.UTC(2026, 10, d, h, m) - 5.5 * 3600e3);   // Sri Lanka clock
let queued = [];
const enqueue = async (_p, t) => { queued.push(t); };
beforeEach(() => { queued = []; });

test('does nothing before 05:00', async () => {
  expect((await runOnce(pool, { now: at(4, 30, 11), runAudit: audit, enqueue })).ran).toBe(false);
  expect(queued).toHaveLength(0);
});
test('runs once a day and queues one line', async () => {
  const a = await runOnce(pool, { now: at(5, 10, 12), runAudit: audit, enqueue });
  expect(a.ran).toBe(true);
  expect(a.line).toMatch(/AUDIT GREEN/);
  const b = await runOnce(pool, { now: at(5, 20, 12), runAudit: audit, enqueue });
  expect(b).toMatchObject({ ran: false, reason: 'already done today' });
  expect(queued).toHaveLength(1);
});
test('missed run is recovered later the same day', async () => {
  const a = await runOnce(pool, { now: at(11, 0, 13), runAudit: audit, enqueue });
  expect(a.ran).toBe(true);
});
test('a failing audit is logged and retried, then gives up after 3', async () => {
  const bad = async () => { throw new Error('boom'); };
  for (let i = 0; i < 3; i++) expect((await runOnce(pool, { now: at(6, i, 14), runAudit: bad, enqueue })).ran).toBe(false);
  expect((await runOnce(pool, { now: at(6, 9, 14), runAudit: audit, enqueue })).reason).toBe('gave up for today');
  expect(queued).toHaveLength(0);
});

test('day-close line: missing sheet, not counted, match, short', async () => {
  const ins = (d, p) => pg.__db.public.none(`INSERT INTO daily_entry_live VALUES ('${d}', '${JSON.stringify(p)}')`);
  expect(await closeLine(pool, '2026-11-21')).toMatch(/no day sheet for 2026-11-20/);
  ins('2026-11-22', { cash_counted: null, totals: { cash_in_hand: 5000 } });
  expect(await closeLine(pool, '2026-11-23')).toMatch(/cash not counted on 2026-11-22/);
  ins('2026-11-24', { cash_counted: 5000, totals: { cash_in_hand: 5000 } });
  expect(await closeLine(pool, '2026-11-25')).toMatch(/cash matches/);
  ins('2026-11-26', { cash_counted: 4500, totals: { cash_in_hand: 5000 } });
  expect(await closeLine(pool, '2026-11-27')).toMatch(/short by Rs 500/);
});
