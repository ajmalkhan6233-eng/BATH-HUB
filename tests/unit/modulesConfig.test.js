const fs = require('fs'), os = require('os'), path = require('path');
const M = require('../../utils/modulesConfig');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mods-'));
const base = path.join(dir, 'modules.json'), ov = path.join(dir, 'data', 'modules.override.json');
const cfg = { always: ['dashboard'], modules: [{ key: 'a', label: 'A', active: true, pages: ['p1', 'dashboard'] }, { key: 'b', label: 'B', active: false, pages: ['p2'] }] };
beforeEach(() => { fs.writeFileSync(base, JSON.stringify(cfg)); try { fs.unlinkSync(ov); } catch (e) {} });
test('off modules are hidden, always-on pages never', () => {
  expect(M.hiddenKeys(M.load(base, ov))).toEqual(['p2']);
});
test('switching a module off hides its pages but keeps the always-on page', () => {
  const c = M.setActive('a', false, base, ov);
  expect(M.hiddenKeys(c)).toEqual(['p1', 'p2']);
  expect(fs.existsSync(ov)).toBe(true);
  expect(JSON.parse(fs.readFileSync(base)).modules[0].active).toBe(true); // default file untouched
});
test('switching on again restores the menu', () => {
  M.setActive('b', true, base, ov);
  expect(M.hiddenKeys(M.load(base, ov))).toEqual([]);
});
test('unknown module and non-boolean are refused', () => {
  expect(() => M.setActive('zzz', true, base, ov)).toThrow('Unknown module');
  expect(() => M.setActive('a', 'yes', base, ov)).toThrow('true or false');
});
test('real config is valid and keeps the 6 core modules', () => {
  const c = M.load();
  expect(c.modules.slice(0, 6).map((m) => m.key)).toEqual(['grn', 'sales', 'vendors', 'money', 'loans', 'stock']);
  const all = c.modules.flatMap((m) => m.pages);
  expect(new Set(all).size).toBe(all.length); // no page in two modules
});
