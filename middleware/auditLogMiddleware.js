// auditLogMiddleware.js (apex integration)
// Append-only admin action trail. The DB role can only INSERT/SELECT on
// audit_log (enforced by scripts/migrate_apex.js) — history can't be rewritten.
const pool = require('../utils/db');

async function logAdminAction(adminId, actionType, targetTenantId, details = {}) {
  await pool.query(
    `INSERT INTO audit_log (actor_admin_id, action_type, target_tenant_id, details)
     VALUES ($1, $2, $3, $4)`,
    [adminId, actionType, targetTenantId, JSON.stringify(details)]
  );
}

// Call this inside any admin mutation route, e.g.:
// await logAdminAction(req.session.user.id, 'STATUS_CHANGE', tenantId, { from: 'TRIAL', to: 'SUSPENDED' });

module.exports = { logAdminAction };
