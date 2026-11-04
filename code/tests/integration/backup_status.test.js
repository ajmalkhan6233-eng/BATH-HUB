'use strict';
// Backup / Restore / Status on their own. Gates, name checks, confirm + PIN, rate limit use a fake child-process runner.
// The REAL restore test (real pg_dump + psql) only runs when E2E_RESTORE=1 and points at a throwaway db:
//   E2E_RESTORE=1 DB_HOST=127.0.0.1 DB_PORT=5433 DB_NAME=bathco_test_c DB_USER=postgres DB_PASSWORD=... PG_BIN=... npx jest backup_status
jest.mock('pg', () => { const m = require('../helpers/pgmock')(); return m; });

const express = require('express');
const request = require('supertest');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PIN = '482910';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'bk-test-'));
process.env.BACKUP_DIR = TMP;
process.env.ADMIN_PIN = PIN;
const E2E = process.env.E2E_RESTORE === '1';
if (!E2E) { process.env.DB_NAME = 'bathco_owner'; process.env.DB_PASSWORD = 'supersecretdbpw'; }

const router = require('../../routes/backup_status');

function appAs(role) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.session = { user: { username: E2E ? 'e2e_jest' : 'tester', role } }; next(); });
  app.use('/api/system', router);
  return app;
}
const admin = appAs('admin');
const DB = () => process.env.DB_NAME;
const BIG = 'x'.repeat(1500);

beforeAll(() => new Promise(r => setTimeout(r, 500)));
afterAll(() => { fs.rmSync(TMP, { recursive: true, force: true }); });
beforeEach(() => router._resetPinFails());

describe('gates', () => {
  for (const role of ['staff', 'owner']) {
    test(`${role} role gets 403 everywhere`, async () => {
      const a = appAs(role);
      expect((await request(a).get('/api/system/backups')).status).toBe(403);
      expect((await request(a).post('/api/system/backups')).status).toBe(403);
      expect((await request(a).get('/api/system/status')).status).toBe(403);
      expect((await request(a).get('/api/system/backups/x.sql/download')).status).toBe(403);
      expect((await request(a).post('/api/system/restore').send({ name: 'x.sql', confirm: 'RESTORE', pin: PIN })).status).toBe(403);
    });
  }
});

describe('listing, download, names', () => {
  beforeAll(() => {
    fs.writeFileSync(path.join(TMP, 'a-2026-01-01_0100.sql'), BIG);
    fs.writeFileSync(path.join(TMP, 'a-2026-01-02_0100.sql'), BIG);
    fs.writeFileSync(path.join(TMP, 'notes.txt'), 'ignore me');
    fs.utimesSync(path.join(TMP, 'a-2026-01-01_0100.sql'), new Date(2026, 0, 1), new Date(2026, 0, 1));
    fs.utimesSync(path.join(TMP, 'a-2026-01-02_0100.sql'), new Date(2026, 0, 2), new Date(2026, 0, 2));
  });
  test('lists only .sql files, newest first', async () => {
    const r = await request(admin).get('/api/system/backups');
    expect(r.status).toBe(200);
    expect(r.body.backups.map(b => b.name)).toEqual(['a-2026-01-02_0100.sql', 'a-2026-01-01_0100.sql']);
    expect(r.body.backups[0]).toHaveProperty('size');
  });
  test('download works for a real name', async () => {
    const r = await request(admin).get('/api/system/backups/a-2026-01-02_0100.sql/download');
    expect(r.status).toBe(200);
    expect(r.headers['content-disposition']).toMatch(/attachment/);
  });
  test('path traversal and odd names are refused (download and restore)', async () => {
    for (const bad of ['..%2F..%2Fserver.js', '..%5C..%5Cpackage.json', 'notes.txt', '%2E%2E%2Fx.sql', 'a..b..sql', 'x.sql%00.png']) {
      const r = await request(admin).get('/api/system/backups/' + bad + '/download');
      expect([400, 404]).toContain(r.status);
    }
    for (const bad of ['../x.sql', '..\\x.sql', '/etc/passwd.sql', 'a/b.sql', 'x.txt', '', null, 5, '..sql']) {
      const r = await request(admin).post('/api/system/restore').send({ name: bad, confirm: 'RESTORE', pin: PIN });
      expect(r.status).toBe(400);
    }
    expect((await request(admin).get('/api/system/backups/missing.sql/download')).status).toBe(404);
  });
});

describe('backup now (fake pg_dump)', () => {
  const real = router._runner.run;
  afterEach(() => { router._runner.run = real; });
  test('success writes the file, tiny/failed output is rejected, keeps newest 14', async () => {
    const calls = [];
    router._runner.run = async (exe, args) => { calls.push({ exe, args }); fs.writeFileSync(args[args.indexOf('-f') + 1], BIG); return { code: 0, stderr: '' }; };
    // 16 old daily files for this db
    for (let i = 1; i <= 16; i++) { const f = path.join(TMP, `${DB()}-2020-01-${String(i).padStart(2, '0')}_0000.sql`); fs.writeFileSync(f, BIG); fs.utimesSync(f, new Date(2020, 0, i), new Date(2020, 0, i)); }
    const r = await request(admin).post('/api/system/backups');
    expect(r.status).toBe(201);
    expect(r.body.name).toMatch(new RegExp('^' + DB() + '-\\d{4}-\\d{2}-\\d{2}_\\d{4}\\.sql$'));
    expect(calls[0].exe).toBe('pg_dump');
    expect(JSON.stringify(calls)).not.toContain(process.env.DB_PASSWORD);          // password is never in args
    const kept = fs.readdirSync(TMP).filter(n => n.startsWith(DB() + '-'));
    expect(kept.length).toBe(14);
    expect(JSON.stringify(r.body)).not.toContain(process.env.DB_PASSWORD);
  });
  test('tiny output counts as failure and the file is removed', async () => {
    router._runner.run = async (exe, args) => { fs.writeFileSync(args[args.indexOf('-f') + 1], 'tiny'); return { code: 0, stderr: '' }; };
    for (const n of fs.readdirSync(TMP)) if (n.startsWith(DB() + '-' + String(new Date().getFullYear()))) fs.unlinkSync(path.join(TMP, n));   // same-minute name from the previous test
    const before = fs.readdirSync(TMP).length;
    const r = await request(admin).post('/api/system/backups');
    expect(r.status).toBe(500);
    expect(fs.readdirSync(TMP).length).toBe(before);
  });
  test('error text never shows the password', async () => {
    router._runner.run = async () => ({ code: 1, stderr: `connection failed password=${process.env.DB_PASSWORD} ${process.env.DB_PASSWORD}` });
    const r = await request(admin).post('/api/system/backups');
    expect(r.status).toBe(500);
    expect(JSON.stringify(r.body)).not.toContain(process.env.DB_PASSWORD);
  });
});

describe('restore checks (fake psql)', () => {
  const real = router._runner.run;
  const NAME = 'good-2026-02-02_0200.sql';
  beforeAll(() => fs.writeFileSync(path.join(TMP, NAME), BIG));
  afterEach(() => { router._runner.run = real; });
  const ok = () => { const calls = []; router._runner.run = async (exe, args) => { calls.push(exe); if (exe === 'pg_dump') fs.writeFileSync(args[args.indexOf('-f') + 1], BIG); return { code: 0, stderr: '' }; }; return calls; };

  test('wrong confirm text refused, nothing run', async () => {
    const calls = ok();
    for (const c of ['restore', 'Restore', ' RESTORE', 'RESTORE ', undefined, '']) {
      const r = await request(admin).post('/api/system/restore').send({ name: NAME, confirm: c, pin: PIN });
      expect(r.status).toBe(400);
    }
    expect(calls.length).toBe(0);
  });
  test('wrong / missing pin refused and never echoed', async () => {
    const calls = ok();
    const r = await request(admin).post('/api/system/restore').send({ name: NAME, confirm: 'RESTORE', pin: '000000' });
    expect(r.status).toBe(403);
    expect(JSON.stringify(r.body)).not.toContain('000000');
    expect((await request(admin).post('/api/system/restore').send({ name: NAME, confirm: 'RESTORE' })).status).toBe(403);
    expect((await request(admin).post('/api/system/restore').send({ name: NAME, confirm: 'RESTORE', pin: 482910 })).status).toBe(403);
    expect(calls.length).toBe(0);
  });
  test('after 5 wrong pins in a row even the right pin gets 429', async () => {
    const calls = ok();
    for (let i = 0; i < 5; i++) expect((await request(admin).post('/api/system/restore').send({ name: NAME, confirm: 'RESTORE', pin: 'bad' + i })).status).toBe(403);
    const r = await request(admin).post('/api/system/restore').send({ name: NAME, confirm: 'RESTORE', pin: PIN });
    expect(r.status).toBe(429);
    expect(calls.length).toBe(0);
  });
  test('unknown backup is 404; right pin runs pre-restore dump first, then psql in a single transaction', async () => {
    const calls = ok();
    expect((await request(admin).post('/api/system/restore').send({ name: 'nope.sql', confirm: 'RESTORE', pin: PIN })).status).toBe(404);
    let psqlArgs;
    const inner = router._runner.run;
    router._runner.run = async (exe, args) => { if (exe === 'psql') psqlArgs = args; return inner(exe, args); };
    const r = await request(admin).post('/api/system/restore').send({ name: NAME, confirm: 'RESTORE', pin: PIN });
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(r.body.pre_restore_backup).toMatch(/-pre-restore-/);
    expect(fs.existsSync(path.join(TMP, r.body.pre_restore_backup))).toBe(true);
    expect(calls).toEqual(['pg_dump', 'psql']);
    expect(psqlArgs).toEqual(expect.arrayContaining(['--single-transaction', 'ON_ERROR_STOP=1']));
    expect(JSON.stringify(psqlArgs)).not.toContain(process.env.DB_PASSWORD);
  });
  test('if the safety backup fails, psql is never run', async () => {
    const calls = []; router._runner.run = async (exe) => { calls.push(exe); return { code: 1, stderr: 'boom' }; };
    const r = await request(admin).post('/api/system/restore').send({ name: NAME, confirm: 'RESTORE', pin: PIN });
    expect(r.status).toBe(500);
    expect(calls).toEqual(['pg_dump']);
  });
  test('status answers with the expected sections', async () => {
    const r = await request(admin).get('/api/system/status');
    expect(r.status).toBe(200);
    expect(r.body.server.node).toBe(process.version);
    expect(r.body).toHaveProperty('disk');
    expect(r.body).toHaveProperty('last_backup');
    expect(r.body.errors).toHaveProperty('lines');
  });
});

// ---------- REAL end-to-end restore on a throwaway database ----------
(E2E ? describe : describe.skip)('REAL restore on the test database', () => {
  const { Client } = jest.requireActual('pg');
  const cli = () => new Client({ host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
  const q = async (sql, p) => { const c = cli(); await c.connect(); try { return (await c.query(sql, p)).rows; } finally { await c.end(); } };
  jest.setTimeout(180000);

  test('data written after the backup is gone; pre-restore backup exists and holds it', async () => {
    expect(process.env.DB_NAME).toMatch(/^bathco_test_/);                    // safety: never anything but a test db
    await q('DROP TABLE IF EXISTS e2e_marker');
    await q('CREATE TABLE e2e_marker (v text)');
    await q("INSERT INTO e2e_marker VALUES ('before-backup')");
    const b = await request(admin).post('/api/system/backups');
    expect(b.status).toBe(201);
    await q("INSERT INTO e2e_marker VALUES ('after-backup')");
    expect((await q('SELECT count(*)::int AS n FROM e2e_marker'))[0].n).toBe(2);

    const bad = await request(admin).post('/api/system/restore').send({ name: b.body.name, confirm: 'RESTORE', pin: 'wrong' });
    expect(bad.status).toBe(403);
    expect((await q('SELECT count(*)::int AS n FROM e2e_marker'))[0].n).toBe(2);          // refused: untouched

    const r = await request(admin).post('/api/system/restore').send({ name: b.body.name, confirm: 'RESTORE', pin: PIN });
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    const rows = await q('SELECT v FROM e2e_marker');
    expect(rows.map(x => x.v)).toEqual(['before-backup']);                                // the later row is gone
    const pre = path.join(TMP, r.body.pre_restore_backup);
    expect(fs.existsSync(pre)).toBe(true);
    expect(fs.readFileSync(pre, 'utf8')).toContain('after-backup');                       // pre-restore copy still has it
  });
  afterAll(async () => {
    try { await q('DROP TABLE IF EXISTS e2e_marker'); await q("DELETE FROM admin_audit WHERE actor = 'e2e_jest'"); } catch (e) { /* */ }
  });
});
