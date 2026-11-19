const fs = require('fs'), os = require('os'), path = require('path'); const B = require('../utils/offsiteBackup');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ob-'));
test('lock and unlock round trip; wrong key fails; plain text not visible', () => { const raw = Buffer.from('COPY customers\nsecret 0771234567\n-- PostgreSQL database dump complete'); const e = B.encrypt(raw, 'k1'); expect(e.toString('latin1')).not.toContain('secret'); expect(B.decrypt(e, 'k1').equals(raw)).toBe(true); expect(() => B.decrypt(e, 'k2')).toThrow(); });
test('run: waits before 22:30, needs key, locks, pushes, prunes to 30, skips if done', async () => {
  const bk = tmp(), br = tmp(), kd = tmp(), key = path.join(kd, 'k.txt'); fs.writeFileSync(path.join(bk, 'bathco_owner-2026-10-25_2200.sql'), 'x'.repeat(100) + '-- PostgreSQL database dump complete');
  const calls = []; const ex = (c, args, o, cb) => { calls.push(args[0]); cb(null, '', ''); };
  const late = new Date('2026-10-25T17:30:00Z'); // 23:00 SL
  expect((await B.run({ backupDir: bk, bridgeDir: br, keyFile: key, now: new Date('2026-10-25T10:00:00Z'), ex })).state).toBe('wait');
  expect((await B.run({ backupDir: bk, bridgeDir: br, keyFile: key, now: late, ex })).state).toBe('nokey');
  fs.writeFileSync(key, 'abc123\n'); const r = await B.run({ backupDir: bk, bridgeDir: br, keyFile: key, now: late, ex });
  expect(r.state).toBe('ok'); expect(calls).toEqual(['pull', 'add', 'commit', 'push']); expect(B.verify({ bridgeDir: br, keyFile: key }).ok).toBe(true);
  expect((await B.run({ backupDir: bk, bridgeDir: br, keyFile: key, now: late, ex })).state).toBe('done');
  const d = path.join(br, 'BACKUPS'); for (let i = 0; i < 35; i++) fs.writeFileSync(path.join(d, `bathco_owner-2026-09-${String(i).padStart(2, '0')}.enc`), 'x'); B.prune(d); expect(fs.readdirSync(d).length).toBe(30);
});
test('run: refuses an old or incomplete backup', async () => { const bk = tmp(), br = tmp(), key = path.join(tmp(), 'k'); fs.writeFileSync(key, 'a'); fs.writeFileSync(path.join(bk, 'bathco_owner-1.sql'), 'cut off'); expect((await B.run({ backupDir: bk, bridgeDir: br, keyFile: key, force: true })).state).toBe('fail'); });
test('runDaily tells AJ only once a day about the same failure', async () => { const d = tmp(), cwd = process.cwd(); process.chdir(d); try { const q = []; const now = new Date('2026-10-25T17:30:00Z'); await B.runDaily({ enqueue: async (t) => q.push(t), now }); await B.runDaily({ enqueue: async (t) => q.push(t), now: new Date(now.getTime() + 1800000) }); expect(q.length).toBe(1); } finally { process.chdir(cwd); } });
