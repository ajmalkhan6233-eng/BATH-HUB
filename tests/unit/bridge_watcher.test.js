const W = require('../../utils/bridgeWatcher');
const md = ['## TASK 75 — X. STATUS: NEW (becomes PLAYED when AJ says "play 75")', '## TASK 76 — Y. STATUS: PARKED', '## TASK 77 — Z. STATUS: PLAYED. Chat wrote it', '## TASK 70 — old. STATUS: DONE'].join('\n');
test('only a heading that says STATUS: PLAYED counts', () => { expect(W.playedTasks(md)).toEqual([77]); });
test('new played task starts Claude once, then never again', () => {
  const a = W.decide(md, null, '2026-10-21'); expect(a.run).toBe(true);
  const b = W.decide(md, a.state, '2026-10-21'); expect(b.run).toBe(false);
});
test('daily limit stops a runaway', () => {
  let st = { handled: [1, 2, 3], day: '2026-10-21', startsToday: 3 };
  expect(W.decide(md, st, '2026-10-21')).toMatchObject({ run: false });
  expect(W.decide(md, st, '2026-10-22').run).toBe(true);
});
