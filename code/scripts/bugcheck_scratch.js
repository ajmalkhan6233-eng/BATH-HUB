'use strict';
// `npm run bugcheck`: builds a throwaway Postgres (port 5440) from the newest backup, starts a scratch copy of the app on port 3190
// (from a temp folder, so the real .env is never loaded), runs every bug check against it, then tears everything down.
// The real database and the real app are never touched. Test logins exist only inside the scratch copy.
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PG_BIN = process.env.PG_BIN || 'C:\\Program Files\\PostgreSQL\\18\\bin';
const exe = n => (fs.existsSync(path.join(PG_BIN, n + '.exe')) ? path.join(PG_BIN, n + '.exe') : n);
const PG_PORT = 5440, APP_PORT = 3190, USER = 'ajmal', PASS = 'BugCheck-test-9921', STAFF = 'jazeel';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tcpUp = port => new Promise(res => { const s = net.connect(port, '127.0.0.1'); s.on('connect', () => { s.destroy(); res(true); }); s.on('error', () => res(false)); });
async function waitFor(fn, ms, what) { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return; await sleep(500); } throw new Error('timed out waiting for ' + what); }

function newestBackup() {
    if (process.env.BUGCHECK_BACKUP) return process.env.BUGCHECK_BACKUP;
    for (let dir = ROOT, i = 0; i < 5; i++, dir = path.dirname(dir)) {
        const b = path.join(dir, 'backups'); if (!fs.existsSync(b)) continue;
        const f = fs.readdirSync(b).filter(x => /^bathco_owner-.*\.sql$/.test(x)).sort().pop(); if (f) return path.join(b, f);
    }
    throw new Error('No backup file found (set BUGCHECK_BACKUP=path\\to\\file.sql)');
}

(async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bh-bugcheck-')), pgdir = path.join(dir, 'pg'), logf = path.join(dir, 'server.log');
    let server = null, started = false;
    const psql = (db, args) => execFileSync(exe('psql'), ['-h', '127.0.0.1', '-p', String(PG_PORT), '-U', 'postgres', '-d', db, '-X', '-A', '-t', ...args], { encoding: 'utf8' }).trim();
    try {
        const dump = newestBackup(); console.log('scratch database from', path.basename(dump));
        execFileSync(exe('initdb'), ['-D', pgdir, '-U', 'postgres', '-A', 'trust', '-E', 'UTF8'], { stdio: 'ignore' });
        spawn(exe('pg_ctl'), ['-D', pgdir, '-o', `-p ${PG_PORT} -c listen_addresses=127.0.0.1`, '-l', path.join(dir, 'pg.log'), 'start'], { detached: true, stdio: 'ignore' }).unref();
        await waitFor(() => tcpUp(PG_PORT), 30000, 'scratch Postgres'); started = true; await sleep(1500);
        psql('postgres', ['-c', 'CREATE ROLE bathco_owner_user LOGIN SUPERUSER', '-c', 'CREATE DATABASE bathco_owner OWNER bathco_owner_user']);
        execFileSync(exe('psql'), ['-h', '127.0.0.1', '-p', String(PG_PORT), '-U', 'postgres', '-d', 'bathco_owner', '-q', '-f', dump], { stdio: 'ignore' });
        const bcrypt = require('bcryptjs'), { Client } = require('pg');
        const c = new Client({ host: '127.0.0.1', port: PG_PORT, user: 'postgres', database: 'bathco_owner' }); await c.connect();
        const hash = bcrypt.hashSync(PASS, 8);
        await c.query('UPDATE users SET password_hash=$1, totp_enabled=false WHERE username = ANY($2)', [hash, [USER, STAFF]]); await c.end();

        const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, PORT: String(APP_PORT), DB_HOST: '127.0.0.1', DB_PORT: String(PG_PORT), DB_NAME: 'bathco_owner', DB_USER: 'bathco_owner_user', DB_PASSWORD: 'x', SESSION_SECRET: 'scratch-bugcheck', ADMIN_PIN: '4821', NODE_ENV: 'production', SITE_UPLOAD_DIR: path.join(dir, 'site') };
        const out = fs.openSync(logf, 'a');
        server = spawn(process.execPath, [path.join(ROOT, 'server.js')], { cwd: dir, env, stdio: ['ignore', out, out] });   // cwd = temp folder: the real .env is never read
        await waitFor(async () => { try { return (await fetch(`http://localhost:${APP_PORT}/health`)).ok; } catch (e) { return false; } }, 60000, 'scratch app');

        process.env.BUGCHECK_BASE = `http://localhost:${APP_PORT}`; process.env.BUGCHECK_USER = USER; process.env.BUGCHECK_PASS = PASS; process.env.BUGCHECK_STAFF_USER = STAFF; process.env.BUGCHECK_STAFF_PASS = PASS;
        const { run } = require('./bugcheck');
        const ctxExtra = {
            serverLog: () => fs.readFileSync(logf, 'utf8'),
            dbCount: async () => Number(psql('bathco_owner', ['-c', "select count(*) from pg_stat_activity where datname='bathco_owner'"])),
            restoreCheck: async () => {
                const { encryptFile } = require('../utils/backupCrypto'), { restoreEncrypted } = require('./restore_encrypted_backup');
                const enc = path.join(dir, 'b.sql.enc'); await encryptFile(dump, enc, 'bugcheck-passphrase');
                const r = await restoreEncrypted({ file: enc, passphrase: 'bugcheck-passphrase', env: { DB_HOST: '127.0.0.1', DB_PORT: String(PG_PORT), DB_NAME: 'bathco_owner', RESTORE_PGUSER: 'postgres' }, log: () => {} });
                return r.ok && r.tables > 20 ? { ok: true, detail: r.tables + ' tables restored and dropped' } : { ok: false, detail: JSON.stringify(r) };
            },
        };
        const { results, barrage } = await run({ ctxExtra });
        const n = s => results.filter(r => r.status === s).length;
        results.forEach((r, i) => console.log(`${String(i + 1).padStart(2)} ${r.status.padEnd(4)} [${r.area}] ${r.name}${r.detail ? '  -> ' + r.detail : ''}`));
        console.log(`\nBUGCHECK: ${results.length} checks, ${n('PASS')} pass, ${n('FAIL')} fail, ${n('KNOWN')} known/pending, ${n('SKIP')} skipped (scratch copy only)`);
        if (process.env.BUGCHECK_RAW && barrage) fs.writeFileSync(process.env.BUGCHECK_RAW, JSON.stringify(barrage, null, 1));
        process.exitCode = n('FAIL') ? 1 : 0;
    } catch (e) { console.error('BUGCHECK could not run: ' + e.message); process.exitCode = 2; }
    finally {
        try { if (server) { server.kill(); } } catch (e) { /* ignore */ }
        try { if (started) execFileSync(exe('pg_ctl'), ['-D', pgdir, '-m', 'fast', 'stop'], { stdio: 'ignore' }); } catch (e) { /* ignore */ }
        await sleep(1500); try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* temp folder: leave it */ }
    }
})();
