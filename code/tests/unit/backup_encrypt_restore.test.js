'use strict';
// Encrypted off-machine backup copy + restore into a throwaway database (the database part uses a fake runner: tests never touch a real DB).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { encryptFile, decryptFile } = require('../../utils/backupCrypto');
const { copyEncrypted } = require('../../scripts/backup_encrypt');
const { restoreEncrypted } = require('../../scripts/restore_encrypted_backup');

const PASS = 'correct horse battery staple', tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'bh-bk-'));
const dump = 'CREATE TABLE a (id int);\nINSERT INTO a VALUES (1);\n' + 'x'.repeat(200000);

describe('AES-256-GCM backup files', () => {
  test('round trip gives back the exact bytes; the encrypted file is not readable text', async () => {
    const d = tmpDir(), src = path.join(d, 'b.sql'), enc = path.join(d, 'b.sql.enc'), back = path.join(d, 'back.sql');
    fs.writeFileSync(src, dump);
    await encryptFile(src, enc, PASS); await decryptFile(enc, back, PASS);
    expect(fs.readFileSync(back, 'utf8')).toBe(dump);
    const raw = fs.readFileSync(enc); expect(raw.subarray(0, 4).toString()).toBe('BHB1'); expect(raw.includes('CREATE TABLE')).toBe(false);
  });
  test('two encryptions of the same file differ (random salt and IV)', async () => {
    const d = tmpDir(), src = path.join(d, 'b.sql'); fs.writeFileSync(src, dump);
    await encryptFile(src, path.join(d, '1'), PASS); await encryptFile(src, path.join(d, '2'), PASS);
    expect(fs.readFileSync(path.join(d, '1')).equals(fs.readFileSync(path.join(d, '2')))).toBe(false);
  });
  test('wrong passphrase, flipped byte and truncated file all fail and leave no output', async () => {
    const d = tmpDir(), src = path.join(d, 'b.sql'), enc = path.join(d, 'b.enc'), out = path.join(d, 'o.sql'); fs.writeFileSync(src, dump);
    await encryptFile(src, enc, PASS);
    await expect(decryptFile(enc, out, 'a different passphrase')).rejects.toThrow(/Wrong passphrase or damaged/);
    const buf = fs.readFileSync(enc); buf[100] ^= 1; fs.writeFileSync(path.join(d, 'bad'), buf);
    await expect(decryptFile(path.join(d, 'bad'), out, PASS)).rejects.toThrow(/Wrong passphrase or damaged/);
    fs.writeFileSync(path.join(d, 'short'), buf.subarray(0, 20));
    await expect(decryptFile(path.join(d, 'short'), out, PASS)).rejects.toThrow(/Not an encrypted backup/);
    await new Promise(r => setTimeout(r, 50)); expect(fs.existsSync(out)).toBe(false);
  });
  test('a missing or short passphrase is refused and is never echoed in the error', async () => {
    const d = tmpDir(), src = path.join(d, 'b.sql'); fs.writeFileSync(src, dump);
    expect(() => encryptFile(src, path.join(d, 'e'), '')).toThrow(/at least 8/);
    expect(() => encryptFile(src, path.join(d, 'e'), 'short')).toThrow(/at least 8/); try { encryptFile(src, 'x', 'short'); } catch (e) { expect(e.message).not.toContain('short'); }
  });
});

describe('copyEncrypted (what runs after each backup)', () => {
  test('without BACKUP_COPY_DIR or BACKUP_PASSPHRASE: copies nothing, warns, names the missing settings only', async () => {
    const d = tmpDir(), src = path.join(d, 'bathco_owner-x.sql'); fs.writeFileSync(src, dump);
    const a = await copyEncrypted(src, { BACKUP_PASSPHRASE: PASS });
    expect(a.copied).toBe(false); expect(a.warning).toMatch(/BACKUP_COPY_DIR not set/); expect(a.warning).not.toContain(PASS);
    const dest = path.join(d, 'copies'), b = await copyEncrypted(src, { BACKUP_COPY_DIR: dest });
    expect(b.copied).toBe(false); expect(b.warning).toMatch(/BACKUP_PASSPHRASE not set/); expect(fs.existsSync(dest)).toBe(false);
  });
  test('with both set: writes <name>.sql.enc that decrypts to the original; keeps only the newest 30', async () => {
    const d = tmpDir(), cp = path.join(d, 'copies'); fs.mkdirSync(cp);
    for (let i = 0; i < 32; i++) { const f = path.join(cp, `bathco_owner-old${String(i).padStart(2, '0')}.sql.enc`); fs.writeFileSync(f, 'x'); fs.utimesSync(f, 1000 + i, 1000 + i); }
    const src = path.join(d, 'bathco_owner-new.sql'); fs.writeFileSync(src, dump);
    const r = await copyEncrypted(src, { BACKUP_COPY_DIR: cp, BACKUP_PASSPHRASE: PASS });
    expect(r.copied).toBe(true); expect(path.basename(r.dest)).toBe('bathco_owner-new.sql.enc');
    expect(fs.readdirSync(cp).filter(f => f.endsWith('.enc')).length).toBe(30);
    expect(fs.existsSync(path.join(cp, 'bathco_owner-old00.sql.enc'))).toBe(false);
    await decryptFile(r.dest, path.join(d, 'r.sql'), PASS); expect(fs.readFileSync(path.join(d, 'r.sql'), 'utf8')).toBe(dump);
    expect(fs.readdirSync(cp).some(f => f.endsWith('.check'))).toBe(false);
  });
});

describe('restoreEncrypted (throwaway database)', () => {
  const fakeRun = calls => ({ sql: (db, q) => { calls.push(['sql', db, q]); return /count\(\*\)/.test(q) ? '84' : ''; }, file: (db, f) => { calls.push(['file', db, fs.readFileSync(f, 'utf8').slice(0, 24)]); } });
  test('decrypts, loads into restore_test_*, counts tables, then drops it; never touches the real DB name', async () => {
    const d = tmpDir(), src = path.join(d, 'b.sql'), enc = path.join(d, 'b.sql.enc'); fs.writeFileSync(src, dump); await encryptFile(src, enc, PASS);
    const calls = [], logs = [];
    const r = await restoreEncrypted({ file: enc, passphrase: PASS, env: { DB_NAME: 'bathco_owner' }, run: fakeRun(calls), log: m => logs.push(m) });
    expect(r.ok).toBe(true); expect(r.tables).toBe(84); expect(r.db).toMatch(/^restore_test_\d{14}$/);
    expect(calls[0]).toEqual(['sql', 'postgres', `CREATE DATABASE ${r.db}`]);
    expect(calls[1]).toEqual(['file', r.db, 'CREATE TABLE a (id int);']);
    expect(calls[calls.length - 1]).toEqual(['sql', 'postgres', `DROP DATABASE IF EXISTS ${r.db}`]);
    expect(JSON.stringify(calls)).not.toContain('bathco_owner'); expect(logs.join(' ')).not.toContain(PASS);
  });
  test('wrong passphrase: fails before any database is created', async () => {
    const d = tmpDir(), src = path.join(d, 'b.sql'), enc = path.join(d, 'b.sql.enc'); fs.writeFileSync(src, dump); await encryptFile(src, enc, PASS);
    const calls = [];
    await expect(restoreEncrypted({ file: enc, passphrase: 'not the passphrase', env: {}, run: fakeRun(calls), log: () => {} })).rejects.toThrow(/Wrong passphrase/);
    expect(calls).toEqual([]);
  });
  test('the throwaway database is dropped even when the restore fails; --keep leaves it', async () => {
    const d = tmpDir(), src = path.join(d, 'b.sql'), enc = path.join(d, 'b.sql.enc'); fs.writeFileSync(src, dump); await encryptFile(src, enc, PASS);
    const calls = [], run = { sql: (db, q) => { calls.push(q); return ''; }, file: () => { throw new Error('psql failed'); } };
    await expect(restoreEncrypted({ file: enc, passphrase: PASS, env: {}, run, log: () => {} })).rejects.toThrow(/psql failed/);
    expect(calls.some(q => /^DROP DATABASE IF EXISTS restore_test_/.test(q))).toBe(true);
    const calls2 = []; await expect(restoreEncrypted({ file: enc, passphrase: PASS, env: {}, run: { sql: (db, q) => { calls2.push(q); return '1'; }, file: () => {} }, keep: true, log: () => {} })).resolves.toMatchObject({ ok: true });
    expect(calls2.some(q => /DROP DATABASE/.test(q))).toBe(false);
  });
  test('the backup script and restore script never print the passphrase', () => {
    for (const f of ['scripts/backup_encrypt.js', 'scripts/restore_encrypted_backup.js', 'utils/backupCrypto.js', 'scripts/backup_owner_db.ps1']) {
      const s = fs.readFileSync(path.join(__dirname, '..', '..', f), 'utf8');
      expect(s).not.toMatch(/(console\.(log|error|warn)|Write-(Host|Output|Error))[^\n]*(PASSPHRASE|passphrase|\bpass\b)\)?[^\n]*(\+|\$\{|\$env)/);
    }
  });
});
