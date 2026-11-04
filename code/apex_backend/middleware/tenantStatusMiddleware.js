// tenantStatusMiddleware.js
const pool = require('../utils/db'); // CLAUDE_CODE_WIRES_THIS: point at the real pg pool

async function tenantStatusMiddleware(req, res, next) {
  const tenantId = req.tenantId; // CLAUDE_CODE_WIRES_THIS: set earlier by the auth layer

  if (!tenantId) {
    return res.status(401).json({ error: 'No tenant context on request.' });
  }

  const { rows } = await pool.query(
    'SELECT status, trial_expires_at FROM tenants WHERE id = $1',
    [tenantId]
  );

  if (rows.length === 0) {
    return res.status(404).json({ error: 'Tenant not found.' });
  }

  let { status, trial_expires_at } = rows[0];

  // Auto-expire trials
  if (status === 'TRIAL' && trial_expires_at && new Date(trial_expires_at) < new Date()) {
    await pool.query(`UPDATE tenants SET status = 'SUSPENDED' WHERE id = $1`, [tenantId]);
    status = 'SUSPENDED';
  }

  // Set the RLS session variable for this connection/request
  await pool.query(`SET app.current_tenant_id = $1`, [tenantId]);

  if (status === 'ACTIVE' || status === 'TRIAL') {
    return next();
  }

  if (status === 'SUSPENDED') {
    if (req.method === 'GET') return next(); // read-only access allowed
    return res.status(402).json({
      error: 'Account suspended. Please settle your outstanding balance to resume full access.',
    });
  }

  if (status === 'TERMINATED') {
    return res.status(403).json({ error: 'Account terminated.' });
  }

  return res.status(500).json({ error: 'Unknown tenant status.' });
}

module.exports = tenantStatusMiddleware;
