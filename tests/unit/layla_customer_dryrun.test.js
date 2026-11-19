const { createCustomerHandler, inWindow, GREETING, WINDOW_MS } = require('../../layla_owner/customerDryRun');
const { processInbound } = require('../../layla_owner/inbound');
const NOW = 1_800_000_000_000;
const msg = (over = {}) => ({ id: 'w1', from: '94712223344', type: 'text', text: 'hi', ts: NOW / 1000 - 60, ...over });
test('24-hour window rule', () => { expect(inWindow(NOW - 1000, NOW)).toBe(true); expect(inWindow(NOW - WINDOW_MS, NOW)).toBe(true); expect(inWindow(NOW - WINDOW_MS - 1, NOW)).toBe(false); expect(inWindow(0, NOW)).toBe(false); expect(inWindow(NOW + 5000, NOW)).toBe(false); });
test('inside the window: logs what she WOULD say, sends nothing, masks the number', async () => {
  const logs = []; const h = createCustomerHandler({ log: (x) => logs.push(x), now: () => NOW });
  const r = await h(msg()); expect(r).toMatchObject({ status: 'customer_dry_run', sent: false, inWindow: true, wouldReply: GREETING });
  expect(logs.join(' ')).toContain('***344'); expect(logs.join(' ')).not.toContain('712223344');
});
test('outside the window: no reply at all', async () => { const h = createCustomerHandler({ log() {}, now: () => NOW }); const r = await h(msg({ ts: NOW / 1000 - 90000 })); expect(r).toMatchObject({ inWindow: false, wouldReply: null, sent: false }); });
test('greeting is English, has no phone number', () => { expect(GREETING).toMatch(/building a new bathroom or renovating/); expect(GREETING).not.toMatch(/\d{9}/); });
test('media and empty messages are skipped', async () => { const h = createCustomerHandler({ log() {}, now: () => NOW }); expect((await h(msg({ type: 'image' }))).status).toBe('customer_skipped'); expect((await h(msg({ text: '  ' }))).status).toBe('customer_skipped'); });
test('through processInbound: a stranger stays ignored, send is never called, customer dry run recorded', async () => {
  const sent = []; const remembered = []; const store = { remember: async (...a) => { remembered.push(a); return true; } };
  const customer = createCustomerHandler({ log() {}, now: () => NOW });
  const r = await processInbound(msg(), { store, adapters: {}, send: async (...a) => sent.push(a), ownerNumber: '0777999219', customer });
  expect(r.status).toBe('ignored'); expect(r.customer.wouldReply).toBe(GREETING); expect(sent).toHaveLength(0); expect(remembered[0][2]).toBe('blocked');
});
test('owner message still works through processInbound (intent parser -> sender)', async () => {
  const sent = []; const store = { remember: async () => true, create: async (t) => ({ id: 1, ...t }), listOpen: async () => [], done: async () => null };
  const r = await processInbound({ id: 'o1', from: '94777999219', type: 'text', text: 'help', ts: NOW / 1000 }, { store, adapters: {}, send: async (to, text) => sent.push([to, text]), ownerNumber: '0777999219', customer: async () => { throw new Error('must not be called for owner'); } });
  expect(r.status).toBe('ok'); expect(sent).toHaveLength(1); expect(sent[0][0]).toBe('94777999219'); expect(sent[0][1]).toMatch(/Talk to me/);
});
test('owner plan command through processInbound', async () => {
  const sent = []; const rows = []; const store = { remember: async () => true, create: async (t) => { rows.push(t); return { id: rows.length, ...t }; }, listOpen: async () => [], done: async () => null };
  await processInbound({ id: 'o2', from: '94777999219', type: 'text', text: 'plan 680000 Metro 4 months', ts: NOW / 1000 }, { store, adapters: {}, send: async (to, t) => sent.push(t), ownerNumber: '0777999219' });
  expect(rows.filter((r) => r.kind === 'PLAN_CHEQUE')).toHaveLength(4); expect(sent[0]).toMatch(/Plan: Metro/);
});

test('every customer text is passed to the owner digest hook, even outside the window', async () => {
  const seen = []; const h = createCustomerHandler({ log() {}, now: () => NOW, onInbound: async (m) => seen.push(m.text) });
  await h(msg({ text: 'price of mixer tap?' })); await h(msg({ text: 'old one', ts: NOW / 1000 - 90000 })); await h(msg({ type: 'image' }));
  expect(seen).toEqual(['price of mixer tap?', 'old one']);
});
