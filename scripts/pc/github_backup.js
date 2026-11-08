'use strict';
// FULL APP BACKUP TO A PRIVATE GITHUB BRANCH (Ajmal 2026-11-04: "if the computer dies, a new computer must get everything back").
//   node scripts/pc/github_backup.js [--tick] [--force]
//   --tick  : only runs if the last good run is older than 55 minutes (the 5-minute watchdog calls it with this, so it runs about hourly)
// What goes in: database dump (gz), the whole app code (tracked + untracked, no node_modules), .env, uploads, data, drafts_inbox, config, local_ops.
// Where: branch `rbh-backup` of the PRIVATE bridge repo (read from the bridge clone's own remote). It REFUSES to push if that repo is public.
// It never touches the app's own git branches. Restore on a new computer: scripts/pc/restore_from_backup.js (see docs/RESTORE_NEW_COMPUTER.md).
const fs = require('fs');
const path = require('path');
const https = require('https');
const zlib = require('zlib');
const { execFileSync, spawn } = require('child_process');

const root = path.resolve(__dirname, '..', '..');
const BRANCH = 'rbh-backup', MAX_FILE = 50 * 1024 * 1024, EVERY_MS = 55 * 60 * 1000, SQUASH_AT = 250;
const SKIP_DIRS = new Set(['node_modules', '.git', 'backups', 'logs', 'tmp', '.cache']);
const log = [];
const say = m => { log.push(m); console.log(m); };

function git(dir, args, opt = {}) { return execFileSync('git', args, { cwd: dir, encoding: 'utf8', windowsHide: true, timeout: opt.timeout || 300000, stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }

function readEnv(file) {
    const o = {};
    try { fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach(l => { const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(l); if (m) o[m[1]] = m[2].replace(/^["']|["']$/g, ''); }); } catch (e) { /* no .env */ }
    return o;
}

// true when anybody can read the repo without signing in (then we must NOT push private data there)
function isPublicRepo(url) {
    return new Promise(resolve => {
        const m = /github\.com[/:]([^/]+)\/([^/.\s]+?)(?:\.git)?$/i.exec(url);
        if (!m) return resolve(null);                       // not a github address: caller decides
        const req = https.get({ host: 'api.github.com', path: `/repos/${m[1]}/${m[2]}`, headers: { 'User-Agent': 'rbh-backup' }, timeout: 20000 }, res => { res.resume(); resolve(res.statusCode === 200 ? true : res.statusCode === 404 ? false : undefined); });   // only a clean 404 counts as private; rate limit / proxy answers = cannot tell = refuse
        req.on('error', () => resolve(undefined)); req.on('timeout', () => { req.destroy(); resolve(undefined); });
    });
}

function copyTree(src, dst, stats) {
    let st; try { st = fs.statSync(src); } catch (e) { return; }
    if (st.isDirectory()) {
        if (SKIP_DIRS.has(path.basename(src))) return;
        fs.mkdirSync(dst, { recursive: true });
        for (const f of fs.readdirSync(src)) copyTree(path.join(src, f), path.join(dst, f), stats);
    } else if (st.isFile()) {
        if (st.size > MAX_FILE) { stats.skipped.push(path.relative(root, src) + ' (' + Math.round(st.size / 1048576) + ' MB)'); return; }
        fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(src, dst); stats.files++;
    }
}

function findPgDump(env) {
    if (env.PG_DUMP && fs.existsSync(env.PG_DUMP)) return env.PG_DUMP;
    const base = 'C:\\Program Files\\PostgreSQL';
    try { const v = fs.readdirSync(base).sort((a, b) => Number(b) - Number(a)); for (const d of v) { const p = path.join(base, d, 'bin', 'pg_dump.exe'); if (fs.existsSync(p)) return p; } } catch (e) { /* not windows */ }
    return 'pg_dump';
}

function dumpDb(env, outFile) {
    return new Promise((resolve, reject) => {
        const args = ['-h', env.DB_HOST || '127.0.0.1', '-p', env.DB_PORT || '5432', '-U', env.DB_USER, '-d', env.DB_NAME, '--no-owner', '--no-privileges'];
        const p = spawn(findPgDump(env), args, { env: { ...process.env, PGPASSWORD: env.DB_PASSWORD || '' }, windowsHide: true });
        const gz = zlib.createGzip({ level: 9 }), out = fs.createWriteStream(outFile); let err = '', closed = null, finished = false;
        const done = () => { if (closed === null || !finished) return; closed === 0 ? resolve() : reject(new Error('pg_dump failed (' + closed + '): ' + err.slice(0, 200))); };
        p.stderr.on('data', d => { err += d; });
        p.on('error', reject); p.on('close', c => { closed = c; done(); });
        out.on('finish', () => { finished = true; done(); });
        p.stdout.pipe(gz).pipe(out);
    });
}

async function run(opts = {}) {
    const logDir = path.join(root, 'logs'); fs.mkdirSync(logDir, { recursive: true });
    const statusFile = path.join(logDir, 'github_backup.json');
    const status = (ok, msg, extra) => { try { fs.writeFileSync(statusFile, JSON.stringify({ at: new Date().toISOString(), ok, msg, ...extra }, null, 1)); } catch (e) { /* ignore */ } return { ok, msg }; };
    if (opts.tick && !opts.force) { try { const s = JSON.parse(fs.readFileSync(statusFile, 'utf8')); if (s.ok && Date.now() - Date.parse(s.at) < EVERY_MS) return { ok: true, msg: 'skipped: backed up recently' }; } catch (e) { /* first run */ } }
    const env = Object.assign({}, readEnv(path.join(root, '.env')), process.env);
    const bridge = env.OFFSITE_BRIDGE_DIR || 'C:\\Users\\Sony\\ai-bridge';
    let remote = env.BACKUP_REMOTE || '';
    if (!remote) { try { remote = git(bridge, ['remote', 'get-url', 'origin']); } catch (e) { return status(false, 'No private repo found: set BACKUP_REMOTE in .env or keep the bridge folder at ' + bridge); } }
    const isLocal = !/^https?:|^git@/.test(remote);
    if (isLocal && env.BACKUP_ALLOW_LOCAL !== '1') return status(false, 'Backup target is not a GitHub address');
    if (!isLocal) {
        const pub = await isPublicRepo(remote);
        if (pub === true) return status(false, 'REFUSED: the backup repo is PUBLIC. Make it private first. Nothing was pushed.');
        if (pub === undefined) return status(false, 'Could not check that the backup repo is private (no internet?). Nothing was pushed.');
    }
    const dir = env.BACKUP_DIR || path.join(path.dirname(root), 'RBH_FullBackup');
    fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(path.join(dir, '.git'))) {
        git(dir, ['init', '-q']); git(dir, ['remote', 'add', 'origin', remote]);
        let have = false; try { git(dir, ['fetch', '-q', 'origin', BRANCH]); have = true; } catch (e) { /* branch not there yet */ }
        if (have) git(dir, ['checkout', '-q', '-B', BRANCH, 'origin/' + BRANCH]); else git(dir, ['checkout', '-q', '--orphan', BRANCH]);
    } else { git(dir, ['remote', 'set-url', 'origin', remote]); try { git(dir, ['checkout', '-q', BRANCH]); } catch (e) { /* stays */ } }
    try { git(dir, ['config', 'user.name']); } catch (e) { git(dir, ['config', 'user.name', 'RBH backup']); git(dir, ['config', 'user.email', 'backup@rbh.local']); }

    // 1) database
    const stats = { files: 0, skipped: [] };
    fs.mkdirSync(path.join(dir, 'db', 'daily'), { recursive: true });
    const tmp = path.join(dir, 'db', 'latest.sql.gz.tmp');
    if (!env.DB_NAME || !env.DB_USER) return status(false, 'DB_NAME / DB_USER missing in .env');
    await dumpDb(env, tmp);
    const dumpBytes = fs.statSync(tmp).size;
    if (dumpBytes < 500) { fs.unlinkSync(tmp); return status(false, 'Database dump looks empty. Nothing pushed.'); }
    if (dumpBytes > MAX_FILE * 1.9) { fs.unlinkSync(tmp); return status(false, 'Database dump is over 95 MB (GitHub limit). Tell Claude: it needs a split.'); }
    fs.renameSync(tmp, path.join(dir, 'db', 'latest.sql.gz'));
    const day = new Date().toISOString().slice(0, 10);
    fs.copyFileSync(path.join(dir, 'db', 'latest.sql.gz'), path.join(dir, 'db', 'daily', day + '.sql.gz'));
    fs.readdirSync(path.join(dir, 'db', 'daily')).sort().slice(0, -14).forEach(f => fs.unlinkSync(path.join(dir, 'db', 'daily', f)));

    // 2) code (tracked + untracked, not ignored) and the private folders
    for (const d of ['code', 'files']) fs.rmSync(path.join(dir, d), { recursive: true, force: true });
    const list = git(root, ['ls-files', '-co', '--exclude-standard', '-z']).split('\0').filter(Boolean);
    for (const f of list) copyTree(path.join(root, f), path.join(dir, 'code', f), stats);
    for (const f of ['.env', 'uploads', 'data', 'drafts_inbox', 'config', 'local_ops']) copyTree(path.join(root, f), path.join(dir, 'files', f), stats);
    let appCommit = ''; try { appCommit = git(root, ['rev-parse', 'HEAD']); } catch (e) { /* ignore */ }
    fs.writeFileSync(path.join(dir, 'MANIFEST.json'), JSON.stringify({ at: new Date().toISOString(), app_commit: appCommit, db_bytes: dumpBytes, files: stats.files, skipped_big_files: stats.skipped, restore: 'node scripts/pc/restore_from_backup.js' }, null, 1));

    // 3) commit + push (own branch only)
    git(dir, ['add', '-A']);
    let changed = true; try { git(dir, ['diff', '--cached', '--quiet']); changed = false; } catch (e) { /* has changes */ }
    if (changed) git(dir, ['commit', '-q', '-m', 'backup ' + new Date().toISOString()]);
    let count = 0; try { count = Number(git(dir, ['rev-list', '--count', 'HEAD'])); } catch (e) { /* empty */ }
    if (count > SQUASH_AT) { git(dir, ['checkout', '-q', '--orphan', 'tmp_squash']); git(dir, ['add', '-A']); git(dir, ['commit', '-q', '-m', 'backup (history squashed) ' + new Date().toISOString()]); git(dir, ['branch', '-M', BRANCH]); say('history squashed'); }
    try { git(dir, ['push', '-q', 'origin', BRANCH]); }
    catch (e) { try { git(dir, ['push', '-q', '--force-with-lease', 'origin', BRANCH]); } catch (e2) { try { git(dir, ['push', '-q', '-f', 'origin', BRANCH]); } catch (e3) { return status(false, 'Push failed: ' + String(e3.message).split('\n')[0].slice(0, 160)); } } }
    return status(true, 'Backed up: DB ' + Math.round(dumpBytes / 1024) + ' KB, ' + stats.files + ' files' + (stats.skipped.length ? ', skipped ' + stats.skipped.length + ' big file(s)' : ''), { skipped: stats.skipped });
}

module.exports = { run, isPublicRepo, dumpDb, readEnv };
if (require.main === module) {
    run({ tick: process.argv.includes('--tick'), force: process.argv.includes('--force') })
        .then(r => { console.log((r.ok ? 'OK: ' : 'NOT DONE: ') + r.msg); process.exitCode = r.ok ? 0 : 1; })
        .catch(e => { console.log('NOT DONE: ' + String(e.message).slice(0, 200)); try { fs.writeFileSync(path.join(root, 'logs', 'github_backup.json'), JSON.stringify({ at: new Date().toISOString(), ok: false, msg: String(e.message).slice(0, 200) })); } catch (x) { /* ignore */ } process.exitCode = 1; });
}
