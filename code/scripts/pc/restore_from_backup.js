'use strict';
// NEW COMPUTER RESTORE. Run inside a fresh clone of the PRIVATE backup repo, branch rbh-backup (or pass its folder):
//   node scripts/pc/restore_from_backup.js <backup-folder> <target-app-folder> [--no-db]
// It puts back: the whole app (code/), .env + uploads + data + drafts + config (files/), and loads db/latest.sql.gz into PostgreSQL
// using the DB_* values from the restored .env (create the empty database and user first, or use RESTORE_PGUSER / RESTORE_PGPASSWORD).
// Then: cd <target-app-folder>; npm install; pm2 start (see docs/RESTORE_NEW_COMPUTER.md).
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { spawn } = require('child_process');

function copyAll(src, dst) {
    if (!fs.existsSync(src)) return 0;
    let n = 0;
    for (const e of fs.readdirSync(src, { withFileTypes: true })) {
        const s = path.join(src, e.name), d = path.join(dst, e.name);
        if (e.isDirectory()) n += copyAll(s, d); else { fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(s, d); n++; }
    }
    return n;
}
function readEnv(file) { const o = {}; fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach(l => { const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(l); if (m) o[m[1]] = m[2].replace(/^["']|["']$/g, ''); }); return o; }

async function main() {
    const [bk, target] = process.argv.slice(2).filter(a => !a.startsWith('--'));
    if (!bk || !target) { console.log('usage: node scripts/pc/restore_from_backup.js <backup-folder> <target-app-folder> [--no-db]'); process.exit(2); }
    const code = copyAll(path.join(bk, 'code'), target), files = copyAll(path.join(bk, 'files'), target);
    console.log('Restored ' + code + ' code files and ' + files + ' data/config files into ' + target);
    if (process.argv.includes('--no-db')) return;
    const dump = path.join(bk, 'db', 'latest.sql.gz');
    if (!fs.existsSync(dump)) { console.log('No database dump found.'); process.exit(1); }
    const env = Object.assign({}, readEnv(path.join(target, '.env')), process.env);
    const args = ['-h', env.DB_HOST || '127.0.0.1', '-p', env.DB_PORT || '5432', '-U', env.RESTORE_PGUSER || env.DB_USER, '-d', env.DB_NAME, '-v', 'ON_ERROR_STOP=0', '-q'];
    await new Promise((resolve, reject) => {
        const p = spawn('psql', args, { env: { ...process.env, PGPASSWORD: env.RESTORE_PGPASSWORD || env.DB_PASSWORD || '' }, stdio: ['pipe', 'inherit', 'inherit'] });
        p.on('error', reject); p.on('close', c => c === 0 ? resolve() : reject(new Error('psql exited ' + c)));
        fs.createReadStream(dump).pipe(zlib.createGunzip()).pipe(p.stdin);
    });
    console.log('Database restored into ' + env.DB_NAME + '.');
}
main().catch(e => { console.log('RESTORE FAILED: ' + e.message); process.exit(1); });
