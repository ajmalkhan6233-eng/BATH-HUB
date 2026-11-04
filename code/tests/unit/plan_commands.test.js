const { parsePlanCommand } = require('../../layla_owner/planCommands');
const { parseOwnerMessage } = require('../../layla_owner/intentParser');
const { handleOwnerMessage } = require('../../layla_owner/brain');
const now = new Date('2026-10-15T03:00:00Z'); // 15 Oct 2026 08:30 Sri Lanka
function memStore() {
  const rows = []; let id = 0;
  return { rows,
    async create(t) { const r = { id: ++id, status: 'OPEN', kind: t.kind, title: t.title, due_at: t.dueAt, meta: t.meta, max_nags: t.maxNags }; rows.push(r); return r; },
    async listOpen() { return rows.filter(r => r.status === 'OPEN'); },
    async done(i) { const r = rows.find(x => x.id === i); if (r) r.status = 'DONE'; return r; } };
}
test('parses the two commands', () => {
  expect(parsePlanCommand('plan 680000 Metro 4 months', now)).toEqual({ type: 'PLAN', total: 680000, vendor: 'Metro', n: 4, unit: 'months', count: 4 });
  expect(parsePlanCommand('Plan 100000 Eskema 6 weeks 3 cheques', now)).toMatchObject({ unit: 'weeks', n: 6, count: 3 });
  expect(parsePlanCommand('move cheque 2 to 20th', now)).toEqual({ type: 'MOVE_CHEQUE', no: 2, day: 20, date: null });
  expect(parsePlanCommand('move cheque 2 to 20 dec', now)).toEqual({ type: 'MOVE_CHEQUE', no: 2, date: '2026-12-20' });
  expect(parsePlanCommand('stock of angle valve', now)).toBeNull();
});
test('intent parser routes them first', () => { expect(parseOwnerMessage('plan 680000 Metro 4 months', now).type).toBe('PLAN'); });
test('plan: 4 cheques, reminders at 06:00 SL, 3 days before, one nag, writes no money', async () => {
  const store = memStore();
  const r = await handleOwnerMessage('plan 680000 Metro 4 months', { store, adapters: {}, now: () => now });
  expect(r.plan.installments).toHaveLength(4); expect(store.rows).toHaveLength(4);
  expect(store.rows.every(x => x.kind === 'PLAN_CHEQUE' && x.max_nags === 1)).toBe(true);
  expect(r.plan.installments[3].date <= '2027-02-15').toBe(true);                        // inside the 4 months
  expect(store.rows[0].due_at.toISOString().slice(11, 16)).toBe('00:30');                // 06:00 Sri Lanka = 00:30 UTC
  expect(r.reply).toMatch(/credit price = cash price/i); expect(r.reply).toMatch(/a week/);
});
test('move cheque 2 changes only cheque 2', async () => {
  const store = memStore(); await handleOwnerMessage('plan 680000 Metro 4 months', { store, adapters: {}, now: () => now });
  const r = await handleOwnerMessage('move cheque 2 to 20th', { store, adapters: {}, now: () => now });
  const open = store.rows.filter(x => x.status === 'OPEN');
  expect(open).toHaveLength(4); expect(open.find(x => x.meta.no === 2).meta.date).toBe('2026-12-21'); expect(r.reply).toMatch(/now dated 2026-12-21 \(2026-12-20 is a weekend/);   // "20th" = 20 Dec (cheque 2's own month); Sunday moves to Monday
});
test('a move past the vendor-agreed date is refused', async () => {
  const store = memStore(); await handleOwnerMessage('plan 680000 Metro 4 months', { store, adapters: {}, now: () => now });
  const r = await handleOwnerMessage('move cheque 2 to 20 mar', { store, adapters: {}, now: () => now });
  expect(r.reply).toMatch(/after the date the vendor agreed/); expect(store.rows.find(x => x.meta.no === 2 && x.status === 'OPEN').meta.date).toBe('2026-12-15');
});
test('move with no plan is polite', async () => {
  const r = await handleOwnerMessage('move cheque 1 to 20th', { store: memStore(), adapters: {}, now: () => now });
  expect(r.reply).toMatch(/no open plan/);
});
