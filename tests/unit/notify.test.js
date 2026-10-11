// Rule 11: nothing reaches the owner except in ONE combined message at 05:45-06:00 Sri Lanka time. Fake clock, fake database.
const notify = require('../../utils/notify');
function fakePool() {
  const rows = []; let id = 0;
  return { rows, query: async (sql, p = []) => {
    if (/CREATE TABLE/.test(sql)) return { rows: [] };
    if (/INSERT INTO notify_queue/.test(sql)) { rows.push({ id: ++id, source: p[0], body: p[1], sent_day: null }); return { rows: [] }; }
    if (/SELECT 1 FROM notify_queue WHERE sent_day/.test(sql)) return { rows: rows.filter((r) => r.sent_day === p[0]).slice(0, 1) };
    if (/SELECT id, body FROM notify_queue/.test(sql)) return { rows: rows.filter((r) => !r.sent_day).map((r) => ({ id: r.id, body: r.body })) };
    if (/UPDATE notify_queue SET sent_day/.test(sql)) { rows.find((r) => r.id === p[0]).sent_day = p[1]; return { rows: [] }; }
    throw new Error('unexpected sql ' + sql);
  } };
}
// Sri Lanka = UTC + 5:30. 14:00 SL = 08:30Z, 05:45 SL = 00:15Z
const at = (iso) => new Date(iso);
beforeEach(() => notify.resetForTests());

test('3 messages queued at 14:00 go out together at 05:45 next day, not before', async () => {
  const pool = fakePool(), sent = [], send = async (t) => { sent.push(t); };
  await notify.enqueue(pool, 'Cheque alert A', 'cheque'); await notify.enqueue(pool, 'Price change B', 'price'); await notify.enqueue(pool, 'Website problem C', 'website');
  expect((await notify.flush({ pool, send, now: at('2026-10-11T08:30:00Z') })).sent).toBe(0);      // 14:00 SL
  expect((await notify.flush({ pool, send, now: at('2026-10-11T22:30:00Z') })).sent).toBe(0);      // 04:00 SL next day
  expect((await notify.flush({ pool, send, now: at('2026-10-11T23:59:00Z') })).sent).toBe(0);      // 05:29 SL
  expect((await notify.flush({ pool, send, now: at('2026-10-12T00:05:00Z') })).sent).toBe(0);      // 05:35 SL: window open but release is 05:45
  expect(sent).toHaveLength(0);
  expect((await notify.flush({ pool, send, now: at('2026-10-12T00:15:00Z') })).sent).toBe(3);      // 05:45 SL
  expect(sent).toHaveLength(1);                                                                      // ONE message
  for (const t of ['Cheque alert A', 'Price change B', 'Website problem C']) expect(sent[0]).toContain(t);
});
test('once a day: a second run the same morning sends nothing; a late message waits for tomorrow', async () => {
  const pool = fakePool(), sent = [], send = async (t) => { sent.push(t); };
  await notify.enqueue(pool, 'first');
  await notify.flush({ pool, send, now: at('2026-10-12T00:15:00Z') });
  await notify.enqueue(pool, 'late one');
  expect((await notify.flush({ pool, send, now: at('2026-10-12T00:20:00Z') })).reason).toBe('already sent today');
  expect((await notify.flush({ pool, send, now: at('2026-10-12T00:31:00Z') })).sent).toBe(0);     // 06:01 SL: outside
  expect((await notify.flush({ pool, send, now: at('2026-10-12T08:30:00Z') })).sent).toBe(0);     // 14:00 SL
  expect((await notify.flush({ pool, send, now: at('2026-10-13T00:16:00Z') })).sent).toBe(1);     // next morning
  expect(sent).toHaveLength(2); expect(sent[1]).toContain('late one'); expect(sent[1]).not.toContain('first');
});
test('nothing waiting means nothing sent; a very long queue is cut and the rest comes tomorrow', async () => {
  const pool = fakePool(), sent = [], send = async (t) => { sent.push(t); };
  expect((await notify.flush({ pool, send, now: at('2026-10-12T00:15:00Z') })).reason).toBe('nothing waiting');
  for (let i = 0; i < 20; i++) await notify.enqueue(pool, `msg ${i} ` + 'x'.repeat(400));
  const r = await notify.flush({ pool, send, now: at('2026-10-13T00:15:00Z') });
  expect(r.sent).toBeGreaterThan(0); expect(r.sent).toBeLessThan(20); expect(sent[0].length).toBeLessThanOrEqual(4000); expect(sent[0]).toContain('more, they come tomorrow');
});
