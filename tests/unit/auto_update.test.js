'use strict';
// Real git, temp folders only: a fake "origin" and a fake PC clone. Never touches this repo.
const fs = require('fs'), os = require('os'), path = require('path'), { execFileSync } = require('child_process');
const { autoUpdate } = require('../../utils/autoUpdate');
const g = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8' }).trim();
let base, origin, pc, cloud;
const commit = (dir, file, text, msg) => { fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true }); fs.writeFileSync(path.join(dir, file), text); g(dir, 'add', '-A'); g(dir, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', msg); };
beforeEach(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'au-')); origin = path.join(base, 'origin.git'); cloud = path.join(base, 'cloud'); pc = path.join(base, 'pc');
  g(base, 'init', '-q', '--bare', '-b', 'work', origin); g(base, 'clone', '-q', origin, cloud); g(cloud, 'checkout', '-q', '-B', 'work');
  commit(cloud, 'a.txt', '1', 'first'); g(cloud, 'push', '-q', 'origin', 'work'); g(base, 'clone', '-q', '-b', 'work', origin, pc);
});
const F = { force: true };
test('nothing new: current', () => { expect(autoUpdate(pc, F).state).toBe('current'); });
test('new cloud commit: pulled; server file -> restart, html only -> no restart', () => {
  commit(cloud, 'public/x.html', 'h', 'html'); g(cloud, 'push', '-q', 'origin', 'work');
  let r = autoUpdate(pc, F); expect(r.state).toBe('updated'); expect(r.restart).toBe(false); expect(fs.existsSync(path.join(pc, 'public/x.html'))).toBe(true);
  commit(cloud, 'routes/r.js', 'r', 'route'); g(cloud, 'push', '-q', 'origin', 'work');
  r = autoUpdate(pc, F); expect(r.state).toBe('updated'); expect(r.restart).toBe(true);
});
test('local edits to a tracked file are never overwritten', () => {
  fs.writeFileSync(path.join(pc, 'a.txt'), 'mine'); commit(cloud, 'b.txt', 'b', 'x'); g(cloud, 'push', '-q', 'origin', 'work');
  expect(autoUpdate(pc, F).state).toBe('blocked'); expect(fs.readFileSync(path.join(pc, 'a.txt'), 'utf8')).toBe('mine'); expect(fs.existsSync(path.join(pc, 'b.txt'))).toBe(false);
});
test('other branch, diverged history, opt-out and 10-minute throttle all do nothing', () => {
  g(pc, 'checkout', '-q', '-b', 'main2'); expect(autoUpdate(pc, F).state).toBe('blocked'); g(pc, 'checkout', '-q', 'work');
  commit(pc, 'pc_only.txt', 'p', 'pc commit'); commit(cloud, 'c.txt', 'c', 'cloud commit'); g(cloud, 'push', '-q', 'origin', 'work');
  expect(autoUpdate(pc, F).state).toBe('blocked'); expect(fs.existsSync(path.join(pc, 'c.txt'))).toBe(false);
  fs.mkdirSync(path.join(pc, 'local_ops')); fs.writeFileSync(path.join(pc, 'local_ops', 'NO_AUTOUPDATE'), ''); expect(autoUpdate(pc, F).state).toBe('skipped');
  fs.unlinkSync(path.join(pc, 'local_ops', 'NO_AUTOUPDATE')); autoUpdate(pc, { force: true, now: Date.now() }); expect(autoUpdate(pc, { now: Date.now() + 1000 }).state).toBe('skipped');
});
