'use strict';
// Admin core: Users + Audit Log screens (admin only). Mounted at /api/admin-core.
//   GET  /users                      list (last login from login_audit, live session count)
//   POST /users                      add user (password >= 12 chars, bcrypt 12)
//   PATCH /users/:id                 change role / name
//   POST /users/:id/disable|enable   (disable also signs the user out everywhere)
//   POST /users/:id/reset-password   admin sets a new password (also signs the user out)
//   POST /users/:id/force-logout     delete the user's sessions
//   GET  /users/:id/login-history    last 100 login attempts for that username
//   GET  /audit, /audit/export.csv   the admin_audit trail (newest first)
// Safety: an admin cannot disable / demote / force-logout themselves; the last active admin can never be disabled or demoted.
// Every change is written to admin_audit (never with passwords).
const express = require('express');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const { ensureAdminAudit, logAdmin, adminOnly } = require('../utils/adminAudit');

const router = express.Router();
const pool = new Pool({
    host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
});
ensureAdminAudit(pool);

const ROLES = ['admin', 'owner', 'staff'];
router.use(adminOnly);

const isSelf = (req, id) => String(req.session.user.id) === String(id);
const idOf = req => (/^\d+$/.test(req.params.id) ? Number(req.params.id) : null);

async function getUser(id) {
    const r = await pool.query('SELECT id, username, name, role, active FROM users WHERE id=$1', [id]);
    return r.rows[0] || null;
}
async function activeAdminCount() {
    const r = await pool.query(`SELECT COUNT(*) AS n FROM users WHERE role='admin' AND active = true`);
    return Number(r.rows[0].n);
}
// the session table may not exist in a bare test database: never let that break the action
async function clearSessions(id) {
    try {
        const r = await pool.query(`DELETE FROM session WHERE (sess::jsonb)->'user'->>'id' = $1`, [String(id)]);
        return r.rowCount || 0;
    } catch (e) { return 0; }
}
async function sessionCount(id) {
    try {
        const r = await pool.query(`SELECT COUNT(*) AS n FROM session WHERE (sess::jsonb)->'user'->>'id' = $1 AND expire > NOW()`, [String(id)]);
        return Number(r.rows[0].n);
    } catch (e) { return 0; }
}
const bad = (res, code, msg) => res.status(code).json({ error: msg });
const fail = (res, e) => res.status(500).json({ error: e.message });

router.get('/users', async (req, res) => {
    try {
        const u = await pool.query(`SELECT id, username, name, role, active, staff_id, created_at FROM users ORDER BY role, username`);
        const ll = await pool.query(`SELECT username, MAX(attempted_at) AS last_login FROM login_audit WHERE success = true GROUP BY username`);
        const last = {}; ll.rows.forEach(r => { last[r.username] = r.last_login; });
        const rows = [];
        for (const x of u.rows) rows.push({ ...x, last_login: last[x.username] || null, active_sessions: await sessionCount(x.id) });
        res.json(rows);
    } catch (e) { fail(res, e); }
});

router.post('/users', async (req, res) => {
    const { username, name, role, password } = req.body || {};
    const uname = String(username || '').trim();
    if (!uname || !name || !role || !password) return bad(res, 400, 'username, name, role and password are required');
    if (!ROLES.includes(role)) return bad(res, 400, 'role must be admin, owner or staff');
    if (String(password).length < 12) return bad(res, 400, 'password must be at least 12 characters');
    try {
        const hash = await bcrypt.hash(String(password), 12);
        const r = await pool.query(
            `INSERT INTO users (username, name, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING id, username, name, role, active`,
            [uname, String(name).trim(), hash, role]);
        await logAdmin(pool, req, 'user.create', 'user', r.rows[0].id, { username: uname, role });
        res.status(201).json(r.rows[0]);
    } catch (e) {
        if (e.code === '23505') return bad(res, 409, 'username already exists');
        fail(res, e);
    }
});

router.patch('/users/:id', async (req, res) => {
    const id = idOf(req); if (id == null) return bad(res, 400, 'bad id');
    const { role, name } = req.body || {};
    if (role === undefined && name === undefined) return bad(res, 400, 'nothing to update');
    if (role !== undefined && !ROLES.includes(role)) return bad(res, 400, 'role must be admin, owner or staff');
    if (name !== undefined && !String(name).trim()) return bad(res, 400, 'name cannot be empty');
    try {
        const u = await getUser(id); if (!u) return bad(res, 404, 'user not found');
        const roleChange = role !== undefined && role !== u.role;
        if (roleChange && isSelf(req, id)) return bad(res, 400, "You can't change the role of your own account");
        if (roleChange && u.role === 'admin' && u.active !== false && (await activeAdminCount()) <= 1)
            return bad(res, 400, 'This is the last active admin; it cannot be demoted');
        const sets = [], vals = [];
        if (role !== undefined) { vals.push(role); sets.push(`role=$${vals.length}`); }
        if (name !== undefined) { vals.push(String(name).trim()); sets.push(`name=$${vals.length}`); }
        vals.push(id);
        const r = await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id=$${vals.length} RETURNING id, username, name, role, active`, vals);
        // a session keeps the role it was created with, so a changed role must sign the user out
        if (roleChange) await clearSessions(id);
        await logAdmin(pool, req, 'user.update', 'user', id, { username: u.username, from_role: u.role, to_role: r.rows[0].role, name_changed: name !== undefined });
        res.json(r.rows[0]);
    } catch (e) { fail(res, e); }
});

router.post('/users/:id/disable', async (req, res) => {
    const id = idOf(req); if (id == null) return bad(res, 400, 'bad id');
    try {
        const u = await getUser(id); if (!u) return bad(res, 404, 'user not found');
        if (isSelf(req, id)) return bad(res, 400, "You can't disable your own account");
        if (u.role === 'admin' && u.active !== false && (await activeAdminCount()) <= 1)
            return bad(res, 400, 'This is the last active admin; it cannot be disabled');
        await pool.query('UPDATE users SET active=false WHERE id=$1', [id]);
        const n = await clearSessions(id);
        await logAdmin(pool, req, 'user.disable', 'user', id, { username: u.username, sessions_cleared: n });
        res.json({ ok: true, id, active: false, sessions_cleared: n });
    } catch (e) { fail(res, e); }
});

router.post('/users/:id/enable', async (req, res) => {
    const id = idOf(req); if (id == null) return bad(res, 400, 'bad id');
    try {
        const u = await getUser(id); if (!u) return bad(res, 404, 'user not found');
        await pool.query('UPDATE users SET active=true WHERE id=$1', [id]);
        await logAdmin(pool, req, 'user.enable', 'user', id, { username: u.username });
        res.json({ ok: true, id, active: true });
    } catch (e) { fail(res, e); }
});

router.post('/users/:id/reset-password', async (req, res) => {
    const id = idOf(req); if (id == null) return bad(res, 400, 'bad id');
    const pw = String((req.body || {}).password || '');
    if (pw.length < 12) return bad(res, 400, 'password must be at least 12 characters');
    try {
        const u = await getUser(id); if (!u) return bad(res, 404, 'user not found');
        const hash = await bcrypt.hash(pw, 12);
        await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, id]);
        const n = isSelf(req, id) ? 0 : await clearSessions(id);     // never log the admin out of their own screen
        await logAdmin(pool, req, 'user.reset_password', 'user', id, { username: u.username, sessions_cleared: n });
        res.json({ ok: true, id, sessions_cleared: n });
    } catch (e) { fail(res, e); }
});

router.post('/users/:id/force-logout', async (req, res) => {
    const id = idOf(req); if (id == null) return bad(res, 400, 'bad id');
    try {
        const u = await getUser(id); if (!u) return bad(res, 404, 'user not found');
        if (isSelf(req, id)) return bad(res, 400, "You can't force-logout your own account");
        const n = await clearSessions(id);
        await logAdmin(pool, req, 'user.force_logout', 'user', id, { username: u.username, sessions_cleared: n });
        res.json({ ok: true, id, sessions_cleared: n });
    } catch (e) { fail(res, e); }
});

router.get('/users/:id/login-history', async (req, res) => {
    const id = idOf(req); if (id == null) return bad(res, 400, 'bad id');
    try {
        const u = await getUser(id); if (!u) return bad(res, 404, 'user not found');
        const r = await pool.query(
            `SELECT attempted_at, success, ip, reason FROM login_audit WHERE username=$1 ORDER BY attempted_at DESC LIMIT 100`, [u.username]);
        res.json({ user: { id: u.id, username: u.username }, history: r.rows });
    } catch (e) { fail(res, e); }
});

// ---- audit log ----
function auditQuery(q, limit, offset) {
    const where = [], vals = [];
    if (q.actor) { vals.push(String(q.actor)); where.push(`actor = $${vals.length}`); }
    if (q.action) { vals.push(String(q.action) + '%'); where.push(`action LIKE $${vals.length}`); }
    if (q.from && /^\d{4}-\d{2}-\d{2}$/.test(q.from)) { vals.push(q.from); where.push(`at >= $${vals.length}::date`); }
    if (q.to && /^\d{4}-\d{2}-\d{2}$/.test(q.to)) { vals.push(q.to); where.push(`at < ($${vals.length}::date + 1)`); }
    const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
    vals.push(limit); const li = vals.length;
    vals.push(offset); const oi = vals.length;
    return { text: `SELECT id, at, actor, actor_role, action, target_type, target_id, detail, ip FROM admin_audit ${w} ORDER BY at DESC, id DESC LIMIT $${li} OFFSET $${oi}`, values: vals };
}

router.get('/audit', async (req, res) => {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 500);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    try {
        const r = await pool.query(auditQuery(req.query, limit, offset));
        res.json({ limit, offset, rows: r.rows });
    } catch (e) { fail(res, e); }
});

const csvCell = v => {
    let s = v == null ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v));
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;           // stop spreadsheet formula injection
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
router.get('/audit/export.csv', async (req, res) => {
    try {
        const r = await pool.query(auditQuery(req.query, 50000, 0));
        const head = ['id', 'at', 'actor', 'actor_role', 'action', 'target_type', 'target_id', 'detail', 'ip'];
        const lines = [head.join(',')].concat(r.rows.map(x => head.map(h => csvCell(h === 'at' && x.at instanceof Date ? x.at.toISOString() : x[h])).join(',')));
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="admin_audit.csv"');
        res.send('﻿' + lines.join('\r\n') + '\r\n');
    } catch (e) { fail(res, e); }
});

module.exports = router;
