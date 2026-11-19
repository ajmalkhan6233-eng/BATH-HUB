const { guardReceipt, isTest, allowList } = require('../../utils/testMode');
const tm = require('../../scripts/test_mode');
const st = require('../../scripts/selftest_photo');
const ocr = require('../../scripts/ocr_photo');
const fs = require('fs'), os = require('os'), path = require('path');

describe('receipt guard', () => {
  test('off: text unchanged', () => expect(guardReceipt({}, '94771234567', 'hi')).toBe('hi'));
  test('on, no allow list: refuses', () => expect(() => guardReceipt({ TEST_MODE: 'true' }, '94771234567', 'hi')).toThrow(/TEST_WA_ALLOW/));
  test('on, number allowed (any format): sends with [TEST]', () => expect(guardReceipt({ TEST_MODE: 'true', TEST_WA_ALLOW: '0771234567' }, '94771234567', 'hi')).toBe('[TEST] hi'));
  test('on, other number: refuses', () => expect(() => guardReceipt({ TEST_MODE: 'true', TEST_WA_ALLOW: '0771234567' }, '94779999999', 'hi')).toThrow(/not in TEST_WA_ALLOW/));
  test('flag parsing', () => { expect(isTest({ TEST_MODE: 'TRUE' })).toBe(true); expect(allowList({ TEST_WA_ALLOW: '077 123 4567, x' })).toEqual(['0771234567']); });
});

describe('test_mode.js wipe', () => {
  const mk = () => { const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-')); const calls = []; const spawn = (bin, a) => { calls.push([path.basename(bin), a.join(' ')]);
      const f = a[a.indexOf('-f') + 1]; if (/pg_dump/.test(bin) && f) fs.writeFileSync(f, 'x'.repeat(2000)); return { status: 0 }; };
    return { root, calls, spawn, env: { DB_NAME: 'd', DB_USER: 'u', TEST_MODE: 'true', BACKUP_DIR: path.join(root, 'b') }, log: () => {} }; };
  test('wipe without baseline fails', () => { const c = mk(); expect(tm.run({ cmd: 'wipe', ...c }).ok).toBe(false); });
  test('start saves baseline; wipe is a dry run by default (no database call)', () => {
    const c = mk(); expect(tm.run({ cmd: 'start', ...c }).ok).toBe(true); const n = c.calls.length;
    const r = tm.run({ cmd: 'wipe', ...c }); expect(r.dry).toBe(true); expect(c.calls.length).toBe(n);
  });
  test('wipe --yes: safety copy first, then clear, then load; refuses when TEST_MODE is off', () => {
    const c = mk(); tm.run({ cmd: 'start', ...c }); c.calls.length = 0;
    expect(tm.run({ cmd: 'wipe', args: ['--yes'], ...c, env: { ...c.env, TEST_MODE: 'false' } }).ok).toBe(false); expect(c.calls.length).toBe(0);
    expect(tm.run({ cmd: 'wipe', args: ['--yes'], ...c }).ok).toBe(true);
    expect(c.calls.map((x) => x[0].replace('.exe', ''))).toEqual(['pg_dump', 'psql', 'psql']);
    expect(c.calls[1][1]).toMatch(/DROP SCHEMA public/);
  });
  test('wipe stops if the safety copy fails (nothing dropped)', () => {
    const c = mk(); tm.run({ cmd: 'start', ...c }); c.calls.length = 0;
    const bad = (bin, a) => { c.calls.push([bin, a.join(' ')]); return { status: 1 }; };
    expect(tm.run({ cmd: 'wipe', args: ['--yes'], ...c, spawn: bad }).ok).toBe(false); expect(c.calls.length).toBe(1);
  });
});

describe('photo self-test judge + Gemini reader', () => {
  const good = { date: '2026-10-09', items: [{ name: 'Wall tile 30x60 white', qty: 10, unit_price: 1500, amount: 15000 }, { name: 'Basin mixer tap chrome', qty: 4, unit_price: 8500, amount: 34000 }, { name: 'Commode set slim', qty: 2, unit_price: 32000, amount: 64000 }, { name: 'Shower rose 8 inch', qty: 5, unit_price: 3200, amount: 16000 }] };
  test('correct reading passes everything', () => expect(st.judge(good).filter((r) => !r.pass)).toEqual([]));
  test('a misread digit fails', () => { const bad = JSON.parse(JSON.stringify(good)); bad.items[1].qty = 9; expect(st.judge(bad).some((r) => !r.pass)).toBe(true); });
  test('fixture image exists', () => expect(fs.statSync(path.join(__dirname, '../fixtures/selftest_grn.png')).size).toBeGreaterThan(2000));
  test('geminiOcr parses a reply and picks a flash model', async () => {
    const urls = [];
    const f = async (u, o) => { urls.push(u); if (/\/models\?/.test(u)) return { ok: true, json: async () => ({ models: [{ name: 'models/gemini-9-flash', supportedGenerationMethods: ['generateContent'] }, { name: 'models/gemini-9-pro', supportedGenerationMethods: ['generateContent'] }] }) };
      return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"document_type":"grn","items":[{"name":"A","qty":1}]}' }] } }] }) }; };
    const r = await ocr.geminiOcr({ key: 'k', base64: 'AA', mime: 'image/png', fetchFn: f });
    expect(r.model).toBe('gemini:gemini-9-flash'); expect(r.parsed.items[0].name).toBe('A'); expect(urls.some((u) => /gemini-9-flash:generateContent/.test(u))).toBe(true);
  });
  test('geminiOcr moves to the next model on 429', async () => {
    ocr._resetGeminiCache();
    let n = 0;
    const f = async (u) => { if (/\/models\?/.test(u)) return { ok: true, json: async () => ({ models: [{ name: 'models/g-flash-2', supportedGenerationMethods: ['generateContent'] }, { name: 'models/g-flash-1', supportedGenerationMethods: ['generateContent'] }] }) };
      if (n++ === 0) return { ok: false, status: 429, json: async () => ({ error: { message: 'busy' } }) };
      return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"items":[]}' }] } }] }) }; };
    const r = await ocr.geminiOcr({ key: 'k', base64: 'AA', mime: 'image/png', fetchFn: f }); expect(r.model).toBe('gemini:g-flash-1');
  });
});
