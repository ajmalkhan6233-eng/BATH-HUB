// utils/adminAudit.js: shared helpers for admin screens (written once so every module logs the same way).
//   ensureAdminAudit(pool)                         creates the table admin_audit (append-only trail of who changed what)
//   logAdmin(pool, req, action, type, id, detail)  one row: who (session user), when, what, on which record, details
//   adminOnly                                      Express middleware: 403 unless the session user is an admin
// The read-only 'owner' (uncle) account and staff are NOT admins.
const DDL = `CREATE TABLE IF NOT EXISTS admin_audit (
    id          SERIAL PRIMARY KEY,
    at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor       VARCHAR(100),
    actor_role  VARCHAR(20),
    action      VARCHAR(80) NOT NULL,
    target_type VARCHAR(60),
    target_id   VARCHAR(100),
    detail      JSONB,
    ip          VARCHAR(60)
)`;

function ensureAdminAudit(pool) {
    return pool.query(DDL).then(() => pool.query(`CREATE INDEX IF NOT EXISTS admin_audit_at_idx ON admin_audit (at DESC)`))
        .catch(e => console.error('[admin_audit] init failed:', e.message));
}

async function logAdmin(pool, req, action, targetType, targetId, detail) {
    try {
        const u = (req && req.session && req.session.user) || {};
        await pool.query(
            `INSERT INTO admin_audit (actor, actor_role, action, target_type, target_id, detail, ip) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [u.username || u.name || 'unknown', u.role || null, action, targetType || null, targetId == null ? null : String(targetId),
             detail == null ? null : JSON.stringify(detail), (req && (req.ip || (req.connection && req.connection.remoteAddress))) || null]);
    } catch (e) { console.error('[admin_audit] log failed:', e.message); }       // never block the real action on the log
}

function adminOnly(req, res, next) {
    const u = req.session && req.session.user;
    if (!u || u.role !== 'admin') return res.status(403).json({ error: 'Only the admin can do this.' });
    next();
}

module.exports = { ensureAdminAudit, logAdmin, adminOnly, DDL };