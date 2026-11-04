// tenantStatusMiddleware.js (apex integration — rewritten from apex_backend)
// Gates the app by this instance's tenant status in the apex control plane.
//
// Differences from the apex original, per the 2026-07-11 audit:
// - This product runs ONE tenant per instance (one DB per client via
//   scripts/create_instance.js), so the tenant id comes from APEX_TENANT_ID
//   in .env — not from a per-request auth layer.
// - The RLS session-variable line was removed: `SET x = $1` is not valid
//   Postgres (SET takes no bind parameters), and a session var set through a
//   pg Pool doesn't stick to later queries anyway. RLS itself was skipped by
//   owner decision — isolation stays DB-per-client.
// - Enforcement is OFF unless APEX_ENFORCE_TENANT_STATUS=true, and any lookup
//   failure fails OPEN: a template copy (or a client with a broken tenants
//   row) must never lock itself out of its own data.
const pool = require('../utils/db');

// Paths a suspended client still needs so the owner can log in and read data.
// /webhook/ is skipped so customer-facing LAYLA replies are never cut off by a
// billing state — suspension gates the dashboard app, not the chat channel.
const SKIP_PREFIXES = ['/api/login', '/api/logout', '/api/setup', '/api/branding', '/api/health', '/webhook/'];

async function tenantStatusMiddleware(req, res, next) {
    if (process.env.APEX_ENFORCE_TENANT_STATUS !== 'true') return next();
    const tenantId = parseInt(process.env.APEX_TENANT_ID || '', 10);
    if (!tenantId) return next(); // no tenant configured — nothing to enforce
    if (SKIP_PREFIXES.some(p => req.path.startsWith(p))) return next();

    try {
        const { rows } = await pool.query(
            'SELECT status, trial_expires_at FROM tenants WHERE id = $1',
            [tenantId]
        );
        if (!rows.length) return next(); // tenant row missing — don't brick the app

        let { status, trial_expires_at } = rows[0];

        // Auto-expire trials
        if (status === 'TRIAL' && trial_expires_at && new Date(trial_expires_at) < new Date()) {
            await pool.query(`UPDATE tenants SET status = 'SUSPENDED' WHERE id = $1`, [tenantId]);
            status = 'SUSPENDED';
        }

        if (status === 'ACTIVE' || status === 'TRIAL') return next();

        if (status === 'SUSPENDED') {
            if (req.method === 'GET') return next(); // read-only access allowed
            return res.status(402).json({
                error: 'Account suspended. Please settle your outstanding balance to resume full access.',
            });
        }

        if (status === 'TERMINATED') {
            return res.status(403).json({ error: 'Account terminated.' });
        }

        return next();
    } catch (e) {
        console.error('[APEX] tenant status check failed (failing open):', e.message);
        return next();
    }
}

module.exports = tenantStatusMiddleware;
