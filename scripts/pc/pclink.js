'use strict';
// PCLINK (Ajmal 5 Nov 2026): live line between Claude chat (cloud) and this PC. NO AI, NO usage: a plain script.
// Chat writes tasks/<id>.json on branch `pclink` of the PRIVATE bridge repo; this script checks every 30 s, runs the named job from
// pclink_jobs.js (whitelist only), and writes results/<id>.json (progress every 30 s while it runs) + status.json (heartbeat).
// Own clone folder (never touches the app folder's branch). Refuses to push if the repo is public or cannot be checked.
// Started by the 5-minute watchdog (--ensure). Switch off: create local_ops\NO_PCLINK. Run once for a test: node scripts/pc/pclink.js --once
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync, spawn } = require('child_process');
const root = path.resolve(__dirname, '..', '..');
const INTERVAL = Number(process.env.PCLINK_INTERVAL_MS) || 30000, IDLE_PUSH = 5 * 60000, LIMIT = 20000;
const lockFile = path.join(root, 'local_ops', 'pclink.lock');
const dirOf = () => process.env.PCLINK_DIR || path.join(os.homedir(), 'pclink_repo');
const git = (dir, args, t) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', windowsHide: true, timeout: t || 120000, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const rj = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
const wj = (f, o) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(o, null, 1)); };
const now = () => new Date().toISOString();
let lastPush = 0, lastPublicCheck = 0, publicOk = false;

function remoteUrl() {
    if (process.env.PCLINK_REMOTE) return process.env.PCLINK_REMOTE;
    const B = require('./github_backup'); const env = Object.assign({}, B.readEnv(path.join(root, '.env')), process.env);
    return env.BACKUP_REMOTE || git(env.OFFSITE_BRIDGE_DIR || path.join(os.homedir(), 'ai-bridge'), ['remote', 'get-url', 'origin']);
}
async function privateOk(url) {
    if (!/^https?:|^git@/.test(url)) return true;   // local test remote
    if (Date.now() - lastPublicCheck < 3600000) return publicOk;
    const pub = await require('./github_backup').isPublicRepo(url); lastPublicCheck = Date.now(); publicOk = pub === false; return publicOk;
}
function ensureClone(url) {
    const d = dirOf();
    if (!fs.existsSync(path.join(d, '.git'))) { fs.mkdirSync(path.dirname(d), { recursive: true }); execFileSync('git', ['clone', '--branch', 'pclink', '--single-branch', url, d], { encoding: 'utf8', windowsHide: true, timeout: 300000, stdio: ['ignore', 'pipe', 'pipe'] }); }
    try { git(d, ['config', 'user.name', 'RBH PC link']); git(d, ['config', 'user.email', 'pclink@localhost']); } catch (e) { /* ignore */ }
    return d;
}
function sync(d) { git(d, ['fetch', 'origin', 'pclink']); git(d, ['pull', '--rebase', '--autostash', 'origin', 'pclink']); }
function push(d, msg) {   // commit only if something changed; retry once after a rebase
    git(d, ['add', '-A']);
    if (!git(d, ['status', '--porcelain'])) return false;
    git(d, ['commit', '-q', '-m', msg]);
    try { git(d, ['push', '-q', 'origin', 'HEAD:pclink']); } catch (e) { git(d, ['pull', '--rebase', '--autostash', 'origin', 'pclink']); git(d, ['push', '-q', 'origin', 'HEAD:pclink']); }
    lastPush = Date.now(); return true;
}
const cap = s => { s = String(s == null ? '' : s); return s.length > LIMIT ? s.slice(0, LIMIT / 2) + '\n...[cut]...\n' + s.slice(-LIMIT / 2) : s; };

async function runTask(d, file) {
    const t = rj(path.join(d, 'tasks', file)); const id = String((t && t.id) || file.replace(/\.json$/, '')).replace(/[^\w.-]/g, '_');
    const resF = path.join(d, 'results', id + '.json'), prog = [];
    const res = o => wj(resF, Object.assign({ id, job: t && t.job, started: res.started, updated: now(), progress: prog.slice(-30) }, o));
    res.started = now();
    const log = l => { prog.push(now().slice(11, 19) + ' ' + cap(l).slice(0, 300)); };
    const jf = path.join(__dirname, 'pclink_jobs.js'); delete require.cache[require.resolve(jf)];
    const J = require(jf).jobs; let timer;
    status(d, { busy: true, current: id + ' ' + (t && t.job) });
    res({ status: 'running' }); log('started'); push(d, 'running ' + id);
    timer = setInterval(() => { try { res({ status: 'running' }); push(d, 'progress ' + id); } catch (e) { /* ignore */ } }, INTERVAL);
    try {
        if (!t || !J[t.job]) throw new Error('unknown job "' + (t && t.job) + '". Allowed: ' + Object.keys(J).join(', '));
        const out = await J[t.job](t.args || {}, log); log('finished'); res({ status: 'done', output: cap(out) });
    } catch (e) { log('FAILED'); res({ status: 'error', error: cap(e.message || e) }); }
    clearInterval(timer); status(d, { busy: false, current: '' }); push(d, 'done ' + id);
}
function status(d, o) { const f = path.join(d, 'status.json'); wj(f, Object.assign({ host: os.hostname(), alive_at: now(), busy: false, current: '' }, rj(f) || {}, o, { alive_at: now() })); }

// One 30-second cycle. Returns what it did (used by the test).
async function cycle() {
    const url = remoteUrl(); if (!(await privateOk(url))) return { state: 'refused', why: 'repo is public or cannot be checked' };
    const d = ensureClone(url); sync(d);
    for (const f of (fs.existsSync(path.join(d, 'results')) ? fs.readdirSync(path.join(d, 'results')) : [])) {   // a task left "running" by a crash is closed, never re-run
        const r = rj(path.join(d, 'results', f)); if (r && r.status === 'running') { wj(path.join(d, 'results', f), Object.assign(r, { status: 'error', error: 'interrupted (PC script restarted). Send it again.', updated: now() })); }
    }
    const done = new Set(fs.existsSync(path.join(d, 'results')) ? fs.readdirSync(path.join(d, 'results')).map(f => f.replace(/\.json$/, '')) : []);
    const todo = (fs.existsSync(path.join(d, 'tasks')) ? fs.readdirSync(path.join(d, 'tasks')) : []).filter(f => /\.json$/.test(f) && !done.has(f.replace(/\.json$/, ''))).sort();
    if (todo.length) { await runTask(d, todo[0]); return { state: 'ran', task: todo[0] }; }
    status(d, { busy: false, current: '' });
    if (Date.now() - lastPush > IDLE_PUSH) push(d, 'heartbeat');
    return { state: 'idle' };
}
const lock = () => { try { wj(lockFile, { pid: process.pid, at: Date.now() }); } catch (e) { /* ignore */ } };
const fresh = () => { const l = rj(lockFile); return l && Date.now() - l.at < 90000 && l.pid !== process.pid; };

async function main() {
    const arg = process.argv[2];
    if (fs.existsSync(path.join(root, 'local_ops', 'NO_PCLINK'))) return;
    if (arg === '--ensure') { if (!fresh()) spawn(process.execPath, [__filename, '--run'], { cwd: root, detached: true, stdio: 'ignore', windowsHide: true }).unref(); return; }
    if (arg === '--once') { console.log(JSON.stringify(await cycle())); return; }
    if (fresh()) return;   // already running
    const mt = fs.statSync(__filename).mtimeMs;
    for (;;) {   // --run: loop forever; restarts itself (via the watchdog) when this file changes
        lock();
        try { await cycle(); } catch (e) { try { fs.appendFileSync(path.join(root, 'logs', 'pclink.log'), now() + ' ' + String(e.message).slice(0, 200) + '\n'); } catch (x) { /* ignore */ } }
        if (fs.existsSync(path.join(root, 'local_ops', 'NO_PCLINK')) || fs.statSync(__filename).mtimeMs !== mt) return;
        await new Promise(r => setTimeout(r, INTERVAL));
    }
}
if (require.main === module) main().catch(e => { console.error(e.message); process.exit(1); });
module.exports = { cycle };
