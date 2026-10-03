'use strict';
// Usage: node scripts/restore_encrypted_backup.js <file.sql.enc> [--keep]
// Decrypts a backup copy (BACKUP_PASSPHRASE from .env) and restores it into a THROWAWAY database named restore_test_<time>,
// prints the table count, then drops it (unless --keep). It never touches the real database (DB_NAME) by design.
// Needs a Postgres login that may CREATE DATABASE: RESTORE_PGUSER / RESTORE_PGPASSWORD (default DB_USER / DB_PASSWORD); host and port from DB_HOST / DB_PORT.
require('dotenv').config();
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { decryptFile } = require('../utils/backupCrypto');

const PG_BIN = process.env.PG_BIN || 'C:\\Program Files\\PostgreSQL\\18\\bin';
const exe = n => (fs.existsSync(path.join(PG_BIN, n + '.exe')) ? path.join(PG_BIN, n + '.exe') : n);

function realRunner(env) {
    const base = ['-h', env.DB_HOST || '127.0.0.1', '-p', String(env.DB_PORT || 5432), '-U', env.RESTORE_PGUSER || env.DB_USER];
    const e = { ...process.env, PGPASSWORD: env.RESTORE_PGPASSWORD || env.DB_PASSWORD || '' };
    return {
        sql: (db, sql) => execFileSync(exe('psql'), [...base, '-d', db, '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', sql], { env: e, encoding: 'utf8' }).trim(),
        file: (db, f) => execFileSync(exe('psql'), [...base, '-d', db, '-X', '-q', '-f', f], { env: e, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }),
    };
}

async function restoreEncrypted({ file, passphrase, env = process.env, run, keep = false, log = console.log }) {
    run = run || realRunner(env);
    const name = 'restore_test_' + new Date().toISOString().replace(/\D/g, '').slice(0, 14);
    if (!/^restore_test_\d{14}$/.test(name) || name === env.DB_NAME) throw new Error('Refusing: bad throwaway database name');
    const tmp = path.join(os.tmpdir(), name + '.sql');
    try {
        await decryptFile(file, tmp, passphrase);
        log(`Decrypted OK (${fs.statSync(tmp).size} bytes). Restoring into throwaway database ${name} ...`);
        run.sql('postgres', `CREATE DATABASE ${name}`);
        try {
            run.file(name, tmp);
            const tables = Number(run.sql(name, "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'"));
            log(`RESTORE OK: ${tables} tables in ${name}.`);
            return { ok: true, db: name, tables };
        } finally {
            if (keep) log(`Kept ${name} (drop it yourself when done).`); else run.sql('postgres', `DROP DATABASE IF EXISTS ${name}`);
        }
    } finally { fs.unlink(tmp, () => {}); }
}

module.exports = { restoreEncrypted };

if (require.main === module) {
    const file = process.argv[2];
    if (!file || !fs.existsSync(file)) { console.error('usage: node scripts/restore_encrypted_backup.js <file.sql.enc> [--keep]'); process.exit(1); }
    restoreEncrypted({ file, passphrase: process.env.BACKUP_PASSPHRASE, keep: process.argv.includes('--keep') })
        .catch(e => { console.error('RESTORE FAILED: ' + e.message); process.exit(2); });
}
