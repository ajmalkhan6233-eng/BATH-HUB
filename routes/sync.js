// routes/sync.js
// SYNC (isolated module): server half of the offline write queue (public/offline-queue.js).
//   1. idempotency middleware  (mount on /api AFTER the login gate, BEFORE the route modules)
//        A POST carrying a valid UUID in X-Idempotency-Key runs ONCE. The first response (2xx) is stored; the same key again gets the
//        stored status + body back with header X-Idempotent-Replay: 1 and the handler is NOT run. A non-2xx result is not kept, so a corrected
//        retry can run. A key still being processed is waited for (up to 5 s), then 409 {error:'still processing, retry'}.
//   2. routes (admin only)
//        GET  /api/sync/status                    counts by status + last 20 rows (no bodies)
//        POST /api/sync/needs-review              {uuid, method, url, body, queued_at, device} -> 'needs_review' row (id = uuid, idempotent) -> 201
//        GET  /api/sync/review                    rows waiting for the admin, newest first
//        POST /api/sync/review/:id/resolve        {action:'applied'|'dismissed', note}  (admin re-sends the original request himself)
// CONFLICT POLICY: new records made offline are ALWAYS accepted (they carry an idempotency key, so a retry never duplicates).
//   Edits / voids made offline are NEVER applied automatically: the server version wins and the edit waits in 'needs review' for the admin.
// New table only (sync_log); nothing existing is altered. Statuses: pending, done, needs_review, applied, dismissed.
const express = require('express');
const { Pool } = require('pg');
const { ensureAdminAudit, logAdmin, adminOnly } = require('../utils/adminAudit');

const router = express.Router();
const pool = new Pool({
    host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY = 512 * 1024;
const POLL_MS = 100, POLL_MAX_MS = 5000;

const DDL = `CREATE TABLE IF NOT EXISTS sync_log (
    id              UUID PRIMARY KEY,
    record_type     TEXT,
    status          TEXT NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    method          TEXT,
    path            TEXT,
    response_status INT,
    response_body   JSONB,
    device          TEXT,
    queued_at       TIMESTAMPTZ,
    detail          JSONB,
    resolved_by     TEXT,
    resolved_at     TIMESTAMPTZ
)`;

const ensured = new WeakMap();
function ensure(p) {
    const target = p || pool;
    if (!ensured.has(target)) {
        ensured.set(target, target.query(DDL).then(() => ensureAdminAudit(target)).catch(e => { console.error('[sync] init failed:', e.message); }));
    }
    return ensured.get(target);
}
ensure(pool);

const sleep = ms => new Promise(r => setTimeout(r, ms));
const recordType = url => { const m = /^\/api\/([^/?#]+)/.exec(url || ''); return m ? m[1].slice(0, 60) : null; };
const toTs = v => { const d = v ? new Date(v) : null; return d && !isNaN(d) ? d.toISOString() : null; };

// Insert a row; true = we own the key, false = it already existed (unique violation). Same effect as INSERT .. ON CONFLICT DO NOTHING
// (and race-safe), but also correct on the in-memory test database, whose RETURNING lies on conflict.
async function claim(db, sql, params) {
    try { await db.query(sql, params); return true; }
    catch (e) { if (e && (e.code === '23505' || /duplicate key|unique/i.test(e.message || ''))) return false; throw e; }
}

function idempotency(poolOrNothing) {
    const db = (poolOrNothing && typeof poolOrNothing.query === 'function') ? poolOrNothing : pool;
    return async function idempotencyMiddleware(req, res, next) {
        try {
            const key = req.get('X-Idempotency-Key');
            const url = req.originalUrl || req.url || '';
            if (req.method !== 'POST' || !key || !UUID_RE.test(key) || /^\/api\/sync(\/|\?|$)/.test(url)) return next();
            await ensure(db);
            const id = key.toLowerCase();
            const isNew = await claim(db,
                `INSERT INTO sync_log (id, record_type, status, method, path, device) VALUES ($1,$2,'pending',$3,$4,$5)`,
                [id, recordType(url), 'POST', url.split('?')[0].slice(0, 300), (req.get('X-Device') || '').slice(0, 40) || null]);
            if (!isNew) {
                // The key was seen before.
                const t0 = Date.now();
                for (;;) {
                    const r = await db.query(`SELECT status, response_status, response_body FROM sync_log WHERE id = $1`, [id]);
                    const row = r.rows[0];
                    if (!row) return next();                                   // previous attempt failed and was removed: run it now (rare race; harmless)
                    if (row.status === 'done') {
                        res.set('X-Idempotent-Replay', '1');
                        const body = row.response_body == null
                            ? { ok: true, idempotent_replay: true, note: 'original response was too large to store' } : row.response_body;
                        return res.status(row.response_status || 200).json(body);
                    }
                    if (row.status !== 'pending') return next();               // key reused by a review row etc.: do not interfere
                    if (Date.now() - t0 >= POLL_MAX_MS) return res.status(409).json({ error: 'still processing, retry' });
                    await sleep(POLL_MS);
                }
            }
            // New key: capture the final response.
            let captured = null, finished = false;
            const origSend = res.send.bind(res);
            res.send = function (body) {
                if (captured === null) captured = body;
                return origSend(body);
            };
            res.on('finish', async () => {
                finished = true;
                try {
                    const code = res.statusCode;
                    if (code >= 200 && code < 300) {
                        let json = null;
                        if (captured != null) {
                            const text = Buffer.isBuffer(captured) ? captured.toString('utf8') : (typeof captured === 'string' ? captured : JSON.stringify(captured));
                            if (Buffer.byteLength(text) <= MAX_BODY) { try { json = JSON.parse(text); } catch (e) { json = text; } }
                        }
                        await db.query(`UPDATE sync_log SET status='done', response_status=$2, response_body=$3 WHERE id=$1`,
                            [id, code, json == null ? null : JSON.stringify(json)]);
                    } else {
                        await db.query(`DELETE FROM sync_log WHERE id=$1 AND status='pending'`, [id]);
                    }
                } catch (e) { console.error('[sync] store failed:', e.message); }
            });
            res.on('close', async () => {
                if (finished) return;
                try { await db.query(`DELETE FROM sync_log WHERE id=$1 AND status='pending'`, [id]); } catch (e) { /* ignore */ }
            });
            next();
        } catch (e) {
            console.error('[sync] idempotency error:', e.message);
            next();                                                            // never block a real action because the log failed
        }
    };
}

router.use(express.json({ limit: '5mb' }));

router.get('/sync/status', adminOnly, async (req, res) => {
    try {
        await ensure(pool);
        const c = await pool.query(`SELECT status, COUNT(*) AS n FROM sync_log GROUP BY status`);
        const counts = { pending: 0, done: 0, needs_review: 0, applied: 0, dismissed: 0 };
        c.rows.forEach(r => { counts[r.status] = Number(r.n); });
        const last = await pool.query(
            `SELECT id, record_type, status, created_at, method, path, response_status, device, queued_at, resolved_by, resolved_at
               FROM sync_log ORDER BY created_at DESC LIMIT 20`);
        res.json({ counts, last: last.rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/sync/needs-review', adminOnly, async (req, res) => {
    try {
        await ensure(pool);
        const b = req.body || {};
        const uuid = String(b.uuid || '').toLowerCase();
        if (!UUID_RE.test(uuid)) return res.status(400).json({ error: 'uuid is required' });
        const method = String(b.method || '').toUpperCase().slice(0, 10);
        const url = String(b.url || '').slice(0, 300);
        if (!method || !url) return res.status(400).json({ error: 'method and url are required' });
        const isNew = await claim(pool,
            `INSERT INTO sync_log (id, record_type, status, method, path, device, queued_at, detail)
             VALUES ($1,$2,'needs_review',$3,$4,$5,$6,$7)`,
            [uuid, recordType(url), method, url.split('?')[0], (String(b.device || '').slice(0, 40)) || null, toTs(b.queued_at),
             JSON.stringify({ body: b.body === undefined ? null : b.body, url })]);
        if (isNew) await logAdmin(pool, req, 'sync_needs_review_received', 'sync_log', uuid, { method, url });
        res.status(201).json({ id: uuid, status: 'needs_review', duplicate: !isNew });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/sync/review', adminOnly, async (req, res) => {
    try {
        await ensure(pool);
        const r = await pool.query(
            `SELECT id, record_type, status, created_at, method, path, device, queued_at, detail
               FROM sync_log WHERE status = 'needs_review' ORDER BY created_at DESC`);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/sync/review/:id/resolve', adminOnly, async (req, res) => {
    try {
        await ensure(pool);
        const id = String(req.params.id || '').toLowerCase();
        const action = req.body && req.body.action;
        if (!UUID_RE.test(id)) return res.status(400).json({ error: 'bad id' });
        if (action !== 'applied' && action !== 'dismissed') return res.status(400).json({ error: "action must be 'applied' or 'dismissed'" });
        const note = String((req.body && req.body.note) || '').slice(0, 500);
        const cur = await pool.query(`SELECT status, detail FROM sync_log WHERE id = $1`, [id]);
        if (!cur.rows.length) return res.status(404).json({ error: 'not found' });
        if (cur.rows[0].status !== 'needs_review') return res.status(409).json({ error: 'already resolved' });
        const d = Object.assign({}, cur.rows[0].detail || {}, { note });
        const user = (req.session && req.session.user && req.session.user.username) || 'unknown';
        await pool.query(`UPDATE sync_log SET status=$2, resolved_by=$3, resolved_at=NOW(), detail=$4 WHERE id=$1 AND status='needs_review'`,
            [id, action, user, JSON.stringify(d)]);
        await logAdmin(pool, req, 'sync_review_' + action, 'sync_log', id, { note });
        res.json({ id, status: action });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
module.exports.idempotency = idempotency;
module.exports.ensure = ensure;
