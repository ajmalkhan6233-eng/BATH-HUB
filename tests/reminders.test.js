const { newDb } = require('pg-mem');
const { migrate } = require('../scripts/migrate_layla_owner');
const createStore = require('../layla_owner/taskStore');
const R = require('../layla_owner/reminderEngine');
let pool, store;
beforeAll(async () => { const { Pool } = newDb().adapters.createPg(); pool = new Pool(); await migrate(pool); store = createStore(pool); });
const at = (s) => new Date(s);

test('a task is not sent before it is due, is sent once, then nags with spacing and stops at max', async () => {
  const sent = []; const send = async (m) => sent.push(m);
  const t = await store.create({ kind: 'BILL_PENDING', title: 'Enter Fazal Hardware bill into GRN', dueAt: at('2026-10-04T12:00:00Z'), nagEveryMin: 60, maxNags: 2 });
  expect(await R.tick({ store, send, now: () => at('2026-10-04T11:59:00Z') })).toMatchObject({ sent: 0 });
  expect(await R.tick({ store, send, now: () => at('2026-10-04T12:00:00Z') })).toMatchObject({ sent: 1 });
  expect(await R.tick({ store, send, now: () => at('2026-10-04T12:30:00Z') })).toMatchObject({ sent: 0 });       // too soon
  expect(await R.tick({ store, send, now: () => at('2026-10-04T13:01:00Z') })).toMatchObject({ sent: 1 });       // nag 2
  expect(await R.tick({ store, send, now: () => at('2026-10-04T15:00:00Z') })).toMatchObject({ sent: 0 });       // max reached
  expect(sent).toHaveLength(2); expect(sent[0]).toContain(`done ${t.id}`);
});
test('done stops reminders; snooze delays and resets', async () => {
  const sent = []; const send = async (m) => sent.push(m);
  const a = await store.create({ kind: 'REMIND', title: 'A', dueAt: at('2026-10-05T01:00:00Z') });
  const b = await store.create({ kind: 'REMIND', title: 'B', dueAt: at('2026-10-05T01:00:00Z') });
  await store.done(a.id); await store.snooze(b.id, at('2026-10-05T03:00:00Z'));
  await R.tick({ store, send, now: () => at('2026-10-05T02:00:00Z') }); expect(sent).toHaveLength(0);
  await R.tick({ store, send, now: () => at('2026-10-05T03:00:00Z') }); expect(sent).toHaveLength(1); expect(sent[0]).toContain('B');
});
test('a task missed while the computer was off is labelled', async () => {
  const sent = []; const c = await store.create({ kind: 'REMIND', title: 'Missed one', dueAt: at('2026-10-06T01:00:00Z') });
  await R.tick({ store, send: async (m) => sent.push(m), now: () => at('2026-10-06T06:00:00Z') });
  const m = sent.find((x) => x.includes('Missed one')); expect(m).toMatch(/^Missed while the computer was off/);
});
test('duplicate WhatsApp message ids are ignored', async () => {
  expect(await store.remember('wamid.1', 'in', 'text', 'hello')).toBe(true);
  expect(await store.remember('wamid.1', 'in', 'text', 'hello')).toBe(false);
});
