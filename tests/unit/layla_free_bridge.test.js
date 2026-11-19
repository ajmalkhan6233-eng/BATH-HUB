const path = require('path');
const { loadSettings, describe } = require('../../layla_owner/settings');
const { createSafeSend } = require('../../layla_owner/safeSend');
const { bridgeSendText } = require('../../layla_owner/bridgeSend');
const { createBridgeIn } = require('../../layla_owner/bridgeIn');
const { safeInboxPath } = require('../../middleware/webhookAuth');

const env = { LAYLA_TRANSPORT: 'bridge', LAYLA_OWNER_LIVE: 'true', OWNER_WA_NUMBER: '0777999219' };
const mockFetch = () => { const calls = []; const f = async (url, opt) => { calls.push({ url, body: JSON.parse(opt.body) }); return { ok: true, json: async () => ({ success: true }) }; }; f.calls = calls; return f; };

test('bridge transport needs NO Meta keys and no Layla number to go live', () => {
  const S = loadSettings(env); expect(S.transport).toBe('bridge'); expect(S.liveAllowed).toBe(true); expect(describe(S).transport).toBe('bridge');
});
test('bridge transport is off by default and still dry run until LAYLA_OWNER_LIVE=true', () => {
  expect(loadSettings({}).transport).toBe('cloud'); expect(loadSettings({ LAYLA_TRANSPORT: 'bridge' }).liveAllowed).toBe(false);
});
test('owner can never be the shop number, even on the bridge', () => { expect(loadSettings({ ...env, OWNER_WA_NUMBER: '0740355536' }).liveAllowed).toBe(false); });
test('live "Layla test OK" goes to the bridge /send for the owner only', async () => {
  const S = loadSettings(env); const f = mockFetch(); const send = createSafeSend({ settings: S, sendText: bridgeSendText, fetchFn: f });
  await send(S.ownerNumber, 'Layla test OK');
  expect(f.calls).toHaveLength(1); expect(f.calls[0].url).toBe('http://localhost:3001/send'); expect(f.calls[0].body).toEqual({ to: '94777999219', message: 'Layla test OK' });
});
test('a customer number is blocked on the bridge too', async () => {
  const S = loadSettings(env); const f = mockFetch(); const logs = [];
  const r = await createSafeSend({ settings: S, sendText: bridgeSendText, fetchFn: f, log: (x) => logs.push(x) })('0712223344', 'hi');
  expect(r).toMatchObject({ blocked: true }); expect(f.calls).toHaveLength(0); expect(logs.join(' ')).not.toContain('712223344');
});
test('dry run sends nothing', async () => {
  const S = loadSettings({ ...env, LAYLA_OWNER_LIVE: 'false' }); const f = mockFetch(); const orig = console.log; console.log = () => {};
  const r = await createSafeSend({ settings: S, sendText: bridgeSendText, fetchFn: f })(S.ownerNumber, 'x'); console.log = orig;
  expect(r).toEqual({ dryRun: true }); expect(f.calls).toHaveLength(0);
});

// ---- bridge-in: owner messages from whatsapp-bridge.js ----
const NOW = 1_800_000_000;
function makeBridgeIn(over = {}) {
  const rows = []; const store = { remember: async () => true, create: async (t) => { rows.push(t); return { id: rows.length, ...t }; }, listOpen: async () => [], done: async () => null };
  const inboxRoot = path.resolve('/data/drop/inbox');
  const bridgeIn = createBridgeIn({ inboxRoot, safeInboxPath, deps: () => ({ store, adapters: {}, ownerNumber: '0777999219', ...over.deps }), readFile: async () => Buffer.from('x'), stat: async () => ({ size: 10 }) });
  return { bridgeIn, rows, inboxRoot };
}
test('bridge-in: owner "help" gets a reply that goes BACK to the bridge (nothing sent by Layla herself)', async () => {
  const { bridgeIn } = makeBridgeIn(); const r = await bridgeIn({ from: '94777999219', type: 'text', text: 'help', ts: NOW });
  expect(r.status).toBe('ok'); expect(r.replies).toHaveLength(1); expect(r.replies[0]).toMatch(/Talk to me/);
});
test('bridge-in: owner plan command creates the 4 reminders', async () => {
  const { bridgeIn, rows } = makeBridgeIn(); const r = await bridgeIn({ from: '94777999219', type: 'text', text: 'plan 680000 Metro 4 months', ts: NOW });
  expect(rows.filter((x) => x.kind === 'PLAN_CHEQUE')).toHaveLength(4); expect(r.replies[0]).toMatch(/Plan: Metro/);
});
test('bridge-in: a stranger is ignored, no reply', async () => {
  const { bridgeIn } = makeBridgeIn(); const r = await bridgeIn({ from: '94712223344', type: 'text', text: 'help', ts: NOW });
  expect(r.status).toBe('ignored'); expect(r.replies).toHaveLength(0);
});
test('bridge-in: bad requests rejected', async () => {
  const { bridgeIn } = makeBridgeIn(); expect((await bridgeIn({})).status).toBe('bad_request'); expect((await bridgeIn({ from: '1', type: 'video' })).status).toBe('bad_request'); expect((await bridgeIn(null)).status).toBe('bad_request');
});
test('bridge-in: a photo path OUTSIDE the inbox folder is refused (no file read)', async () => {
  const paper = { captionKind: () => 'grn', start: async () => ({ reply: 'draft' }), handleText: async () => null };
  const { bridgeIn } = makeBridgeIn({ deps: { transcribe: async () => ({ ok: false }), saveMedia: async () => 'f', paper } });
  const r = await bridgeIn({ from: '94777999219', type: 'image', filePath: '/etc/passwd', mime: 'image/jpeg', caption: 'GRN', ts: NOW });
  expect(r.status).toBe('error'); expect(r.replies.join(' ')).toMatch(/Something went wrong/);
});
test('bridge-in: a captioned photo inside the inbox folder is accepted and handled here', async () => {
  const saved = []; const { bridgeIn, inboxRoot, rows } = makeBridgeIn({ deps: { saveMedia: async (buf, mime, kind) => { saved.push(kind); return 'uploads/f.jpg'; }, paper: null } });
  const r = await bridgeIn({ from: '94777999219', type: 'image', filePath: path.join(inboxRoot, '2026-10-16', 'a.jpg'), mime: 'image/jpeg', caption: 'Eskema bill 213200 pending, remind me tomorrow evening', ts: NOW });
  expect(r.status).toBe('ok'); expect(saved).toEqual(['image']); expect(rows[0].kind).toBe('BILL_PENDING');
});
test('bridge-in: an uncaptioned photo is passed on to the original Layla photo pipeline', async () => {
  const { bridgeIn, inboxRoot, rows } = makeBridgeIn({ deps: { paper: null } });
  const r = await bridgeIn({ from: '94777999219', type: 'image', filePath: path.join(inboxRoot, '2026-10-16', 'a.jpg'), mime: 'image/jpeg', ts: NOW });
  expect(r.status).toBe('fallback_photo'); expect(rows).toHaveLength(0);
});
