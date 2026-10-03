'use strict';
// Backup, Restore and System Status (admin only). Mounted at /api/system.
// No existing table is touched. Writes admin_audit (shared helper) for every action.
// The DB password only travels in the PGPASSWORD env of the child process: never in args, logs or responses.
const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { Pool } = require('pg');
const { ensureAdminAudit, logAdmin, adminOnly } = require('../utils/adminAudit');

const router = express.Router();
const pool = require('../utils/pool');
ensureAdminAudit(pool);

const ROOT = path.join(__dirname, '..');
const NAME_RE = /^[\w.-]+\.sql$/;
const KEEP = 14;
const MIN_BYTES = 1000;                         // same "tiny means failed" rule as local_ops\backup_owner_db.ps1
const PIN_MAX_FAILS = 5, PIN_WINDOW_MS = 15 * 60 * 1000;
const STALE_HOURS = 26;

const backupDir = () => process.env.BACKUP_DIR || path.join(ROOT, 'backups');
const pgBin = exe => path.join(process.env.PG_BIN || 'C:\\Program Files\\PostgreSQL\\18\\bin', exe + (process.platform === 'win32' ? '.exe' : ''));
const dbName = () => process.env.DB_NAME || '';
const stamp = (d = new Date()) => { const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`; };
const validName = n => typeof n === 'string' && n.length <= 200 && NAME_RE.test(n) && !n.includes('..') && path.basename(n) === n;

// Child-process runner (replaceable in tests). Password goes in env only.
const runner = {
    run(exe, args, { timeoutMs = 600000 } = {}) {
        return new Promise(resolve => {
            let err = '', done = false;
            const env = { ...process.env, PGPASSWORD: process.env.DB_PASSWORD || '' };
            let child;
            try { child = spawn(pgBin(exe), args, { env, windowsHide: true }); }
            catch (e) { return resolve({ code: -1, stderr: e.message }); }
            const t = setTimeout(() => { try { child.kill(); } catch (_) { /* */ } }, timeoutMs);
            child.stdout.on('data', () => {});
            child.stderr.on('data', d => { if (err.length < 4000) err += d; });
            const fin = r => { if (!done) { done = true; clearTimeout(t); resolve(r); } };
            child.on('error', e => fin({ code: -1, stderr: e.message }));
            child.on('close', code => fin({ code, stderr: err }));
        });
    },
};

function clean(s) {                              // keep secrets out of anything we show
    let out = String(s || '');
    for (const v of [process.env.DB_PASSWORD, process.env.ADMIN_PIN]) if (v && v.length >= 3) out = out.split(v).join('***');
    return out.replace(/[0-9a-fA-F]{41,}/g, '[hex]').replace(/(password|pwd|secret|token)\s*[=:]\s*\S+/gi, '$1=***').trim().slice(0, 600);
}
const connArgs = () => ['-h', process.env.DB_HOST || '127.0.0.1', '-p', String(process.env.DB_PORT || 5432), '-U', process.env.DB_USER || 'postgres', '-w'];

function listBackups() {
    const dir = backupDir();
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter(n => NAME_RE.test(n)).map(n => {
        const st = fs.statSync(path.join(dir, n));
        return st.isFile() ? { name: n, size: st.size, created: st.mtime.toISOString() } : null;
    }).filter(Boolean).sort((a, b) => b.created.localeCompare(a.created) || b.name.localeCompare(a.name));
}

let busy = false;                                // one backup/restore at a time
async function dumpTo(file) {
    if (!dbName()) return { ok: false, error: 'DB_NAME is not set' };
    fs.mkdirSync(backupDir(), { recursive: true });
    const r = await runner.run('pg_dump', [...connArgs(), '-d', dbName(), '-f', file]);
    const size = fs.existsSync(file) ? fs.statSync(file).size : 0;
    if (r.code !== 0 || size < MIN_BYTES) {
        try { fs.unlinkSync(file); } catch (_) { /* */ }
        return { ok: false, error: 'pg_dump failed' + (r.stderr ? ': ' + clean(r.stderr) : ' (file too small)') };
    }
    return { ok: true, size };
}
function pruneOld() {                            // keep the newest 14 daily-style files for this db; pre-restore files are never auto-deleted
    const re = new RegExp('^' + dbName().replace(/[^\w]/g, '\\$&') + '-\\d{4}-\\d{2}-\\d{2}_\\d{4}\\.sql$');
    const old = listBackups().filter(b => re.test(b.name)).slice(KEEP);
    for (const b of old) { try { fs.unlinkSync(path.join(backupDir(), b.name)); } catch (_) { /* */ } }
    return old.length;
}

router.use(adminOnly);

router.get('/backups', (req, res) => {
    try { res.json({ backups: listBackups() }); } catch (e) { res.status(500).json({ error: 'Could not list backups' }); }
});

router.post('/backups', async (req, res) => {
    if (busy) return res.status(409).json({ error: 'A backup or restore is already running.' });
    busy = true;
    try {
        const name = `${dbName()}-${stamp()}.sql`;
        const r = await dumpTo(path.join(backupDir(), name));
        if (!r.ok) { await logAdmin(pool, req, 'backup_failed', 'backup', name, { error: r.error }); return res.status(500).json({ error: r.error }); }
        const pruned = pruneOld();
        await logAdmin(pool, req, 'backup_created', 'backup', name, { size: r.size, pruned });
        res.status(201).json({ ok: true, name, size: r.size, pruned });
    } catch (e) { res.status(500).json({ error: 'Backup failed' }); }
    finally { busy = false; }
});

router.get('/backups/:name/download', async (req, res) => {
    const n = req.params.name;
    if (!validName(n)) return res.status(400).json({ error: 'Bad file name' });
    const full = path.join(backupDir(), n);
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return res.status(404).json({ error: 'Not found' });
    await logAdmin(pool, req, 'backup_downloaded', 'backup', n, null);
    res.download(full, n);
});

// ---- restore ----
const pinFails = [];                             // timestamps of wrong PINs (global: there is one admin PIN)
const recentFails = () => { const cut = Date.now() - PIN_WINDOW_MS; while (pinFails.length && pinFails[0] < cut) pinFails.shift(); return pinFails.length; };
function pinOk(given) {
    const real = process.env.ADMIN_PIN;
    if (!real || typeof given !== 'string') return false;
    const a = crypto.createHash('sha256').update(given).digest(), b = crypto.createHash('sha256').update(real).digest();
    return crypto.timingSafeEqual(a, b);
}

router.post('/restore', async (req, res) => {
    const { name, confirm, pin } = req.body || {};
    if (confirm !== 'RESTORE') return res.status(400).json({ error: 'Type RESTORE (capital letters) to confirm.' });
    if (!validName(name)) return res.status(400).json({ error: 'Bad backup name' });
    if (!process.env.ADMIN_PIN) return res.status(503).json({ error: 'Admin PIN is not configured on the server.' });
    if (recentFails() >= PIN_MAX_FAILS) {
        await logAdmin(pool, req, 'restore_blocked_rate_limit', 'backup', name, null);
        return res.status(429).json({ error: 'Too many wrong PINs. Try again in 15 minutes.' });
    }
    if (!pinOk(pin)) {
        pinFails.push(Date.now());
        await logAdmin(pool, req, 'restore_wrong_pin', 'backup', name, { fails_in_window: recentFails() });
        return res.status(403).json({ error: 'Wrong PIN.' });
    }
    const file = path.join(backupDir(), name);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return res.status(404).json({ error: 'Backup not found' });
    if (busy) return res.status(409).json({ error: 'A backup or restore is already running.' });
    busy = true;
    try {
        const pre = `${dbName()}-pre-restore-${stamp()}.sql`;
        const pr = await dumpTo(path.join(backupDir(), pre));
        if (!pr.ok) {
            await logAdmin(pool, req, 'restore_aborted', 'backup', name, { reason: 'pre-restore backup failed', error: pr.error });
            return res.status(500).json({ error: 'Restore cancelled: the safety backup failed, nothing was changed. ' + pr.error });
        }
        await logAdmin(pool, req, 'restore_started', 'backup', name, { pre_restore_backup: pre });
        const r = await runner.run('psql', [...connArgs(), '-d', dbName(), '-v', 'ON_ERROR_STOP=1', '--single-transaction', '-q',
            '-c', 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;', '-f', file]);
        if (r.code !== 0) {
            await logAdmin(pool, req, 'restore_failed', 'backup', name, { pre_restore_backup: pre, error: clean(r.stderr) });
            return res.status(500).json({ error: 'Restore failed and was rolled back (database unchanged). ' + clean(r.stderr), pre_restore_backup: pre });
        }
        await ensureAdminAudit(pool);            // the restored copy may pre-date the audit table
        await logAdmin(pool, req, 'restore_done', 'backup', name, { pre_restore_backup: pre });
        res.json({ ok: true, restored: name, pre_restore_backup: pre });
    } catch (e) { res.status(500).json({ error: 'Restore failed' }); }
    finally { busy = false; }
});

// ---- status ----
function diskInfo() {
    try {
        const s = fs.statfsSync(ROOT);
        const gb = n => Math.round(n / 1073741824 * 10) / 10;
        const total = s.blocks * s.bsize, free = s.bavail * s.bsize;
        return { free_gb: gb(free), total_gb: gb(total), used_pct: total ? Math.round((1 - free / total) * 100) : null };
    } catch (e) { return { error: 'unavailable' }; }
}
function errorTail() {
    try {
        const dirs = [path.join(ROOT, 'local_ops'), ROOT, path.join(ROOT, 'logs')];
        const re = /^(apex-server\.err.*|server_err.*)\.log$/;
        let best = null;
        for (const d of dirs) {
            if (!fs.existsSync(d)) continue;
            for (const n of fs.readdirSync(d)) {
                if (!re.test(n)) continue;
                const st = fs.statSync(path.join(d, n));
                if (st.isFile() && (!best || st.mtimeMs > best.m)) best = { f: path.join(d, n), n, m: st.mtimeMs };
            }
        }
        if (!best) return { file: null, lines: [] };
        const fd = fs.openSync(best.f, 'r'); const size = fs.fstatSync(fd).size, len = Math.min(size, 64 * 1024);
        const buf = Buffer.alloc(len); fs.readSync(fd, buf, 0, len, size - len); fs.closeSync(fd);
        const lines = buf.toString('utf8').split(/\r?\n/).filter(Boolean).slice(-30).map(l => clean(l).slice(0, 400));
        return { file: best.n, modified: new Date(best.m).toISOString(), lines };
    } catch (e) { return { file: null, lines: [] }; }
}

router.get('/status', async (req, res) => {
    const out = { server: {}, health: {}, db: {}, last_backup: null, disk: diskInfo(), errors: errorTail(), version: null };
    const m = process.memoryUsage();
    out.server = { uptime_seconds: Math.round(process.uptime()), node: process.version, pid: process.pid,
        memory_mb: Math.round(m.rss / 1048576), heap_mb: Math.round(m.heapUsed / 1048576), host: os.hostname() };
    try { out.version = require('../package.json').version; } catch (_) { /* */ }
    const t0 = Date.now();
    try {
        await pool.query('SELECT 1');
        out.health = { ok: true, latency_ms: Date.now() - t0 };
        const q = await pool.query(`SELECT current_database() AS name, pg_database_size(current_database()) AS bytes,
            (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public') AS tables,
            (SELECT COUNT(*) FROM pg_stat_activity WHERE datname=current_database()) AS connections`);
        const r = q.rows[0] || {};
        out.db = { name: r.name, size_mb: Math.round(Number(r.bytes) / 1048576 * 10) / 10, tables: Number(r.tables), connections: Number(r.connections) };
    } catch (e) { out.health = { ok: false, error: 'database not answering' }; }
    try {
        const b = listBackups()[0];
        if (b) { const age = Math.round((Date.now() - new Date(b.created).getTime()) / 36e5 * 10) / 10; out.last_backup = { name: b.name, created: b.created, age_hours: age, warn: age > STALE_HOURS }; }
        else out.last_backup = { name: null, warn: true };
    } catch (_) { out.last_backup = { name: null, warn: true }; }
    res.json(out);
});

module.exports = router;
module.exports._runner = runner;
module.exports._resetPinFails = () => { pinFails.length = 0; };
