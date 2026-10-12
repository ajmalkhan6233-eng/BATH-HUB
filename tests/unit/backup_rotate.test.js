// Backup every 30 minutes: keep 48 recent + 14 daily + 8 weekly, skip when nothing changed. Fake pg_dump, temp folder.
const fs = require('fs'); const os = require('os'); const path = require('path');
const B = require('../../scripts/backup_rotate');

const name = (d) => { const p = (n) => String(n).padStart(2, '0'); return `bathco_owner-${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}_${p(d.getUTCHours())}${p(d.getUTCMinutes())}.sql`; };

test('retention: newest 48, newest of 14 days, newest of 8 weeks; other files untouched', () => {
  const end = Date.UTC(2026, 9, 12, 12, 0), names = [];
  for (let i = 0; i < 60 * 48; i++) names.push(name(new Date(end - i * 30 * 60000)));   // 60 days of half-hours
  names.push('pre-cleanup.sql', 'notes.txt', 'bathco_owner-tmp-1.sql');
  const { keep, remove } = B.plan(names);
  expect(keep.length).toBeGreaterThanOrEqual(48); expect(keep.length).toBeLessThanOrEqual(48 + 14 + 8);
  expect(keep.slice(0, 48)).toEqual(names.slice(0, 48));                                       // the last 24 hours, all kept
  const days = new Set(keep.map((n) => B.parseName(n).day));
  expect(days.size).toBeGreaterThanOrEqual(14);                                                 // a file from each of the last 14 days
  expect(keep.some((n) => n.includes('2026-08-1'))).toBe(false);                                // older than 8 weeks is gone (the 60 day old ones)
  expect(remove.length + keep.length).toBe(60 * 48);
  for (const n of ['pre-cleanup.sql', 'notes.txt', 'bathco_owner-tmp-1.sql']) { expect(keep).not.toContain(n); expect(remove).not.toContain(n); }
});
test('the hash ignores the random \\restrict lines and nothing else', () => {
  const a = 'CREATE TABLE a;\n\\restrict AAA\nINSERT 1;\n\\unrestrict AAA\n', b = 'CREATE TABLE a;\n\\restrict ZZZ\nINSERT 1;\n\\unrestrict ZZZ\n', c = 'CREATE TABLE a;\nINSERT 2;\n';
  expect(B.dumpHash(a)).toBe(B.dumpHash(b)); expect(B.dumpHash(a)).not.toBe(B.dumpHash(c));
});
test('run: first call saves, an unchanged second call is skipped, a change saves again; failed dump saves nothing', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bk-')); const dir = path.join(root, 'backups');
  let content = 'x'.repeat(1500) + '\n';
  const spawn = (cmd, args) => { const f = args[args.indexOf('-f') + 1]; if (f) fs.writeFileSync(f, content + '\\restrict ' + Math.random() + '\n'); return { status: 0 }; };
  const env = { DB_USER: 'u', DB_NAME: 'd', DB_PASSWORD: 'secret-not-logged', BACKUP_DIR: dir };
  const t = (h, m) => new Date(2026, 9, 12, h, m);
  const r1 = B.run({ root, env, now: t(6, 0), spawn }); expect(r1).toMatchObject({ ok: true, saved: 'bathco_owner-2026-10-12_0600.sql' });
  const r2 = B.run({ root, env, now: t(6, 30), spawn }); expect(r2).toEqual({ ok: true, skipped: true });
  content += 'new data\n';
  const r3 = B.run({ root, env, now: t(7, 0), spawn }); expect(r3.saved).toBe('bathco_owner-2026-10-12_0700.sql');
  expect(fs.readdirSync(dir).filter((n) => n.endsWith('.sql')).sort()).toEqual(['bathco_owner-2026-10-12_0600.sql', 'bathco_owner-2026-10-12_0700.sql']);
  expect(B.run({ root, env: { ...env, BACKUP_DIR: path.join(root, 'b2') }, now: t(8, 0), spawn: () => ({ status: 1 }) })).toMatchObject({ ok: false });
  expect(fs.readdirSync(path.join(root, 'b2'))).toEqual([]);
});
