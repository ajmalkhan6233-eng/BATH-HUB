// auditLogMiddleware.js
const pool = require('../utils/db'); // CLAUDE_CODE_WIRES_THIS

async function logAdminAction(adminId, actionType, targetTenantId, details = {}) {
  await pool.query(
    `INSERT INTO audit_log (actor_admin_id, action_type, target_tenant_id, details)
     VALUES ($1, $2, $3, $4)`,
    [adminId, actionType, targetTenantId, JSON.stringify(details)]
  );
}

// Call this inside any admin mutation route, e.g.:
// await logAdminAction(req.adminId, 'STATUS_CHANGE', tenantId, { from: 'TRIAL', to: 'SUSPENDED' });

module.exports = { logAdminAction };
