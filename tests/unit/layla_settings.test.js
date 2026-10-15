const { loadSettings, describe, last3 } = require('../../layla_owner/settings');
const keys = { WA_TOKEN: 'tok', WA_PHONE_NUMBER_ID: '123', WA_APP_SECRET: 'sec', WA_VERIFY_TOKEN: 'ver', LAYLA_WA_NUMBER: '0771112233' };
test('defaults: dry run, owner default, customers never live', () => {
  const s = loadSettings({});
  expect(s.live).toBe(false); expect(s.liveAllowed).toBe(false); expect(s.ownerNumber).toBe('94777999219'); expect(s.ownerIsDefault).toBe(true); expect(s.customerLive).toBe(false);
});
test('owner number is one setting', () => { expect(loadSettings({ OWNER_WA_NUMBER: '0712345678' }).ownerNumber).toBe('94712345678'); });
test('live needs every key and the Layla number', () => {
  expect(loadSettings({ LAYLA_OWNER_LIVE: 'true' }).liveAllowed).toBe(false);
  expect(loadSettings({ LAYLA_OWNER_LIVE: 'true', ...keys }).liveAllowed).toBe(true);
});
test('SHOP number is refused as Layla number or owner', () => {
  expect(loadSettings({ LAYLA_OWNER_LIVE: 'true', ...keys, LAYLA_WA_NUMBER: '074 035 5536' }).liveAllowed).toBe(false);
  expect(loadSettings({ LAYLA_OWNER_LIVE: 'true', ...keys, OWNER_WA_NUMBER: '0740355536' }).liveAllowed).toBe(false);
});
test('Layla number must differ from owner', () => { expect(loadSettings({ LAYLA_OWNER_LIVE: 'true', ...keys, OWNER_WA_NUMBER: '0771112233' }).liveAllowed).toBe(false); });
test('describe never shows full numbers or secrets', () => {
  const out = JSON.stringify(describe(loadSettings({ LAYLA_OWNER_LIVE: 'true', ...keys })));
  expect(out).toContain('***233'); expect(out).not.toContain('771112233'); expect(out).not.toContain('tok"'); expect(out).not.toContain('sec"'); expect(last3('')).toBe('(not set)');
});
