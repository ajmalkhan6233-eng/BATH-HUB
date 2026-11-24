// VERSION LOCK: while the VERSION file equals the locked version, no app file may change. See scripts/lock_version.js.
const fs = require('fs'); const path = require('path');
const { fingerprint } = require('../../scripts/lock_version');
test('the app is locked at its version: change code only after bumping VERSION and re-locking', () => {
  const root = path.join(__dirname, '..', '..');
  const m = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'LOCK_MANIFEST.json'), 'utf8'));
  const v = fs.readFileSync(path.join(root, 'VERSION'), 'utf8').trim();
  if (v !== m.version) return; // a new version was started on purpose: lock it with  node scripts/lock_version.js
  const now = fingerprint(), changed = [];
  Object.keys(Object.assign({}, m.files, now)).forEach((f) => { if (m.files[f] !== now[f]) changed.push(f); });
  expect(changed).toEqual([]);
});
