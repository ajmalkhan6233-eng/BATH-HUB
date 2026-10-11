// Money questions are answered ONLY to the owner's number. Anyone else is ignored silently: nothing sent, nothing read.
const { processInbound } = require('../../layla_owner/inbound');
const mk = () => {
  const out = []; let adapterCalls = 0;
  const calm = { today: 0, tomorrow: 0, monday: { date: '2026-10-12', amount: 0 }, windows: { 7: 0, 30: 0 }, overdue: { count: 0, amount: 0 }, bulkDays: [] };
  const adapters = new Proxy({}, { get: () => async () => { adapterCalls++; return calm; } });
  const store = { remember: async () => true, create: async () => ({ id: 1 }), listOpen: async () => [] };
  return { out, calls: () => adapterCalls, deps: { store, adapters, ownerNumber: '0771234567', send: async (_to, t) => out.push(t), now: () => new Date('2026-10-11T04:00:00Z') } };
};
const ASKS = ['how much do we owe Eskema', 'sales yesterday', 'cheques tomorrow', 'stock of taps', 'cash in hand', 'send me the profit report'];
test.each(ASKS)('stranger asking "%s" gets nothing and no data is read', async (text) => {
  const { out, calls, deps } = mk();
  const r = await processInbound({ id: 'x' + text.length, from: '94770000000', type: 'text', text }, deps);
  expect(r.status).toBe('ignored'); expect(out).toHaveLength(0); expect(calls()).toBe(0);
});
test('the same question from the owner number is answered', async () => {
  const { out, deps } = mk();
  const r = await processInbound({ id: 'o1', from: '94771234567', type: 'text', text: 'cheques tomorrow' }, deps);
  expect(r.status).toBe('ok'); expect(out.length).toBeGreaterThan(0);
});
test('an owner-looking number with extra digits or a different prefix is still a stranger', async () => {
  const { out, deps } = mk();
  for (const from of ['947712345670', '94771234568', '0771234567x9']) expect((await processInbound({ id: 'z' + from, from, type: 'text', text: 'sales yesterday' }, deps)).status).toBe('ignored');
  expect(out).toHaveLength(0);
});
