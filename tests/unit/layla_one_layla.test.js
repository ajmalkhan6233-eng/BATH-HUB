const path = require('path');
const { createBridgeIn } = require('../../layla_owner/bridgeIn');
const { processInbound } = require('../../layla_owner/inbound');
const { safeInboxPath } = require('../../middleware/webhookAuth');

const NOW = 1_800_000_000;
const inboxRoot = path.resolve('/data/drop/inbox');
function make(over = {}) {
  const rows = []; const calls = { download: 0, saveMedia: 0 };
  const store = { remember: async () => true, create: async (t) => { rows.push(t); return { id: rows.length, ...t }; }, listOpen: async () => [], done: async () => null };
  const paper = { captionKind: (c) => (/^\s*grn\b/i.test(c || '') ? 'grn' : /^\s*cheque\b/i.test(c || '') ? 'cheque' : null), start: async () => ({ reply: 'Draft GRN ready. Reply ok to save.' }), handleText: async () => null };
  const bridgeIn = createBridgeIn({
    inboxRoot, safeInboxPath, readFile: async () => { calls.download++; return Buffer.from('x'); }, stat: async () => ({ size: 10 }),
    deps: () => ({ store, adapters: {}, ownerNumber: '0777999219', paper, saveMedia: async () => { calls.saveMedia++; return 'uploads/f.jpg'; }, transcribe: async () => ({ ok: false }), ...over }),
  });
  return { bridgeIn, rows, calls };
}
const owner = (b) => ({ from: '94777999219', ts: NOW, ...b });

test('text the assistant understands is still answered by the assistant', async () => {
  const { bridgeIn } = make(); const r = await bridgeIn(owner({ type: 'text', text: 'help' }));
  expect(r.status).toBe('ok'); expect(r.replies[0]).toMatch(/Talk to me/);
});
test('ONE LAYLA: text the assistant does not understand goes to the original Layla (no reply from the assistant)', async () => {
  const { bridgeIn } = make(); const r = await bridgeIn(owner({ type: 'text', text: 'what do you think about a bidet spray for a small bathroom' }));
  expect(r.status).toBe('fallback'); expect(r.replies).toHaveLength(0);
});
test('ONE LAYLA: TEACH: goes to the original Layla, any letter case', async () => {
  const { bridgeIn, rows } = make();
  for (const t of ['TEACH: showroom opens at 9', 'teach: showroom opens at 9', '  Teach : we sell tiles']) { const r = await bridgeIn(owner({ type: 'text', text: t })); expect(r.status).toBe('fallback'); expect(r.replies).toHaveLength(0); }
  expect(rows).toHaveLength(0);                                                           // nothing created by the assistant
});
test('ONE LAYLA: a photo with no GRN/cheque caption goes to the original photo pipeline, nothing downloaded or saved here', async () => {
  const { bridgeIn, calls, rows } = make();
  const r = await bridgeIn(owner({ type: 'image', filePath: path.join(inboxRoot, '2026-10-16', 'a.jpg'), mime: 'image/jpeg', caption: '' }));
  expect(r.status).toBe('fallback_photo'); expect(r.replies).toHaveLength(0); expect(calls.download).toBe(0); expect(calls.saveMedia).toBe(0); expect(rows).toHaveLength(0);
});
test('a photo captioned GRN is still handled by the assistant (draft, saved only on ok)', async () => {
  const { bridgeIn } = make(); const r = await bridgeIn(owner({ type: 'image', filePath: path.join(inboxRoot, '2026-10-16', 'b.jpg'), mime: 'image/jpeg', caption: 'GRN Eskema' }));
  expect(r.status).toBe('ok'); expect(r.replies[0]).toMatch(/Draft GRN/);
});
test('a photo captioned with a bill reminder is still the assistant\'s job', async () => {
  const { bridgeIn, rows } = make(); const r = await bridgeIn(owner({ type: 'image', filePath: path.join(inboxRoot, '2026-10-16', 'c.jpg'), mime: 'image/jpeg', caption: 'Fazal Hardware bill pending, remind me tomorrow evening' }));
  expect(r.status).toBe('ok'); expect(rows.some((x) => x.kind === 'BILL_PENDING')).toBe(true);
});
test('strangers and the wife never reach the original Layla through this door', async () => {
  const { bridgeIn } = make({ family: { isMember: (f) => String(f).endsWith('712223344'), handle: async () => 'I can only keep reminders and notes for you.' } });
  expect((await bridgeIn({ from: '94719998877', type: 'text', text: 'TEACH: price of tiles is 1', ts: NOW })).status).toBe('ignored');
  const w = await bridgeIn({ from: '94712223344', type: 'text', text: 'TEACH: price of tiles is 1', ts: NOW });
  expect(w.status).toBe('family'); expect(w.replies[0]).toMatch(/only keep reminders and notes/);
});
test('without the fallback (Cloud API / relay path) unknown text still gets the assistant\'s own reply', async () => {
  const sent = []; const store = { remember: async () => true, create: async () => ({}), listOpen: async () => [], done: async () => null };
  const r = await processInbound({ id: 'u1', from: '94777999219', type: 'text', text: 'blah blah nothing', ts: NOW }, { store, adapters: {}, ownerNumber: '0777999219', send: async (_t, x) => sent.push(x) });
  expect(r.status).toBe('ok'); expect(sent[0]).toMatch(/did not get that/);
});
