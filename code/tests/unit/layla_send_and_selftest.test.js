const { loadSettings } = require('../../layla_owner/settings');
const { createSafeSend } = require('../../layla_owner/safeSend');
const { sendOwnerTest, TEST_LINE } = require('../../layla_owner/selfTest');
const { sendText } = require('../../layla_owner/waCloud');
const base = { WA_TOKEN: 't', WA_PHONE_NUMBER_ID: '555', WA_APP_SECRET: 's', WA_VERIFY_TOKEN: 'v', LAYLA_WA_NUMBER: '0771112233', OWNER_WA_NUMBER: '0777999219' };
const mockFetch = () => { const calls = []; const f = async (url, opt) => { calls.push({ url, body: JSON.parse(opt.body), auth: opt.headers.Authorization }); return { ok: true, json: async () => ({ messages: [{ id: 'x' }] }) }; }; f.calls = calls; return f; };
test('dry run: nothing is sent, even to the owner', async () => {
  const f = mockFetch(); const logs = []; const orig = console.log; console.log = (x) => logs.push(x);
  const r = await sendOwnerTest({ settings: loadSettings(base), send: createSafeSend({ settings: loadSettings(base), sendText, fetchFn: f }) }); console.log = orig;
  expect(f.calls).toHaveLength(0); expect(r).toMatchObject({ dryRun: true, sent: false, line: TEST_LINE }); expect(logs.join(' ')).not.toContain('777999219');
});
test('live: "Layla test OK" goes to the owner only, via the Cloud API', async () => {
  const S = loadSettings({ ...base, LAYLA_OWNER_LIVE: 'true' }); const f = mockFetch();
  const r = await sendOwnerTest({ settings: S, send: createSafeSend({ settings: S, sendText, fetchFn: f }) });
  expect(r.sent).toBe(true); expect(f.calls).toHaveLength(1);
  expect(f.calls[0].body).toMatchObject({ messaging_product: 'whatsapp', to: '94777999219' }); expect(f.calls[0].url).toContain('/555/messages'); expect(JSON.stringify(f.calls[0].body)).toContain('Layla test OK');
});
test('live: a customer number is blocked, never sent', async () => {
  const S = loadSettings({ ...base, LAYLA_OWNER_LIVE: 'true' }); const f = mockFetch(); const logs = [];
  const send = createSafeSend({ settings: S, sendText, fetchFn: f, log: (x) => logs.push(x) });
  const r = await send('0712223344', 'hello customer'); expect(r).toMatchObject({ dryRun: true, blocked: true }); expect(f.calls).toHaveLength(0);
  expect(logs.join(' ')).toContain('***344'); expect(logs.join(' ')).not.toContain('712223344');
});
test('shop number as Layla number WITHOUT the accept switch: config error, falls back to dry run, nothing sent', async () => {
  const S = loadSettings({ ...base, LAYLA_OWNER_LIVE: 'true', LAYLA_WA_NUMBER: '0740355536' }); const f = mockFetch();
  await createSafeSend({ settings: S, sendText, fetchFn: f })('0777999219', 'x'); expect(S.liveAllowed).toBe(false); expect(f.calls).toHaveLength(0);
});
