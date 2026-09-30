// APEX control-plane admin routes (platform vendor side): client payment
// tracking, trial client creation, tenant + package listing. Every route sits
// behind the same double gate as the server.js Admin tab: session login AND
// the Admin PIN unlock (req.session.adminUnlocked, set by the PIN endpoint).
// Every mutation is written to the append-only audit_log.
const express = require('express');
const router = express.Router();
const pool = require('../utils/db');
const { logAdminAction } = require('../middleware/auditLogMiddleware');
const { createTrialClient } = require('../utils/trialClientCreator');
const { performAction, pingHealth, controlEnabled } = require('../utils/railwayControl');

router.use('/api/apex', (req, res, next) => {
    if (!req.session || !req.session.user) return res.status(401).json({ error: 'Login required' });
    if (req.session.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    if (!req.session.adminUnlocked) return res.status(403).json({ error: 'Admin PIN required' });
    next();
});

// Log a verified manual bank-transfer payment from a client.
// verified_by comes from the logged-in session, never from the request body.
router.post('/api/apex/payments', async (req, res) => {
    const { tenant_id, amount_lkr, bank_reference, deposit_date, notes } = req.body;
    if (!tenant_id || !amount_lkr || !bank_reference || !deposit_date) {
        return res.status(400).json({ error: 'tenant_id, amount_lkr, bank_reference and deposit_date are required' });
    }
    // A logged payment is money received: it must be a positive number on a real date (a negative one would cancel a real payment).
    if (!Number.isFinite(Number(amount_lkr)) || Number(amount_lkr) <= 0) return res.status(400).json({ error: 'amount_lkr must be a number greater than 0' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(deposit_date)) || isNaN(Date.parse(deposit_date))) return res.status(400).json({ error: 'deposit_date must be a date (YYYY-MM-DD)' });
    try {
        const { rows } = await pool.query(
            `INSERT INTO client_payments (tenant_id, amount_lkr, bank_reference, deposit_date, verified_by_admin_id, notes)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [tenant_id, amount_lkr, bank_reference, deposit_date, req.session.user.id, notes || null]
        );
        await logAdminAction(req.session.user.id, 'PAYMENT_LOGGED', tenant_id, { amount_lkr, bank_reference });
        res.json(rows[0]);
    } catch (err) {
        // Most likely a duplicate bank_reference — surface it clearly
        res.status(400).json({ error: err.message });
    }
});

router.get('/api/apex/payments/:tenantId', async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT * FROM client_payments WHERE tenant_id = $1 ORDER BY deposit_date DESC`,
            [req.params.tenantId]
        );
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// New client entry — the future "New Client Entry" form posts here.
router.post('/api/apex/trial-clients', async (req, res) => {
    try {
        const result = await createTrialClient(req.body || {});
        await logAdminAction(req.session.user.id, 'TRIAL_CLIENT_CREATED', result.tenantId, {
            shop_name: req.body.shopName, package_tier: req.body.packageTier || 'Starter', trial_days: req.body.trialDays || null,
        });
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.get('/api/apex/tenants', async (req, res) => {
    try {
        const { rows } = await pool.query(`SELECT * FROM tenants ORDER BY created_at DESC`);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Activation toggle / package change from the Platform Admin page.
// Accepts { status } and/or { package_tier }; both validated, both audit-logged.
router.patch('/api/apex/tenants/:id', async (req, res) => {
    const { status, package_tier } = req.body || {};
    const ALLOWED_STATUS = ['ACTIVE', 'TRIAL', 'SUSPENDED', 'TERMINATED'];
    if (!status && !package_tier) return res.status(400).json({ error: 'Nothing to update — send status and/or package_tier' });
    if (status && !ALLOWED_STATUS.includes(status)) return res.status(400).json({ error: `status must be one of ${ALLOWED_STATUS.join(', ')}` });
    try {
        const cur = await pool.query('SELECT * FROM tenants WHERE id = $1', [req.params.id]);
        if (!cur.rows.length) return res.status(404).json({ error: 'Tenant not found' });
        if (package_tier) {
            const t = await pool.query('SELECT 1 FROM package_config WHERE tier_name = $1 AND is_addon = false', [package_tier]);
            if (!t.rows.length) return res.status(400).json({ error: 'Unknown package tier' });
        }
        const { rows } = await pool.query(
            `UPDATE tenants SET status = COALESCE($1::tenant_status, status), package_tier = COALESCE($2, package_tier)
             WHERE id = $3 RETURNING *`,
            [status || null, package_tier || null, req.params.id]
        );
        await logAdminAction(req.session.user.id, 'TENANT_UPDATED', rows[0].id, {
            from_status: cur.rows[0].status, to_status: rows[0].status,
            from_tier: cur.rows[0].package_tier, to_tier: rows[0].package_tier,
        });
        res.json(rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Package tiers/prices — always read from package_config, never hardcoded.
router.get('/api/apex/packages', async (req, res) => {
    try {
        const { rows } = await pool.query(`SELECT * FROM package_config ORDER BY is_addon, price_lkr`);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Price edit from the Platform Admin page — package_config stays the ONLY
// place prices live.
router.patch('/api/apex/packages/:id', async (req, res) => {
    const price = Number(req.body?.price_lkr);
    if (!Number.isFinite(price) || price < 0) return res.status(400).json({ error: 'price_lkr must be a non-negative number' });
    try {
        const { rows } = await pool.query(
            `UPDATE package_config SET price_lkr = $1 WHERE id = $2 RETURNING *`,
            [price, req.params.id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Unknown package id' });
        await logAdminAction(req.session.user.id, 'PACKAGE_PRICE_CHANGED', null, {
            package: rows[0].tier_name, price_lkr: price,
        });
        res.json(rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── DEDICATED FLEET (clients running as their own Railway project) ──────────
// Control-plane ONLY: names/contacts/Railway ids/subscription/health state.
// Power actions go through Railway's control API (utils/railwayControl.js);
// health pings read HTTP status codes only. Apex NEVER connects to, reads, or
// displays any client's actual database or business data — hard policy.

const FLEET_STATUS = ['TRIAL', 'ACTIVE', 'SUSPENDED', 'TERMINATED'];
const FLEET_FIELDS = ['client_name', 'contact', 'railway_project_id', 'railway_environment_id', 'railway_service_id', 'subscription_status', 'health_url'];

router.get('/api/apex/fleet', async (req, res) => {
    try {
        const { rows } = await pool.query(`SELECT * FROM dedicated_clients ORDER BY client_name`);
        res.json({ control_enabled: controlEnabled(), clients: rows });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/api/apex/fleet', async (req, res) => {
    const b = req.body || {};
    if (!b.client_name) return res.status(400).json({ error: 'client_name is required' });
    if (b.subscription_status && !FLEET_STATUS.includes(b.subscription_status))
        return res.status(400).json({ error: `subscription_status must be one of ${FLEET_STATUS.join(', ')}` });
    try {
        const { rows } = await pool.query(
            `INSERT INTO dedicated_clients (client_name, contact, railway_project_id, railway_environment_id, railway_service_id, subscription_status, health_url)
             VALUES ($1,$2,$3,$4,$5,COALESCE($6,'TRIAL'),$7) RETURNING *`,
            [b.client_name, b.contact || null, b.railway_project_id || null, b.railway_environment_id || null,
             b.railway_service_id || null, b.subscription_status || null, b.health_url || null]
        );
        await logAdminAction(req.session.user.id, 'FLEET_CLIENT_ADDED', null, {
            fleet_id: rows[0].id, client_name: rows[0].client_name, railway_project_id: rows[0].railway_project_id,
        });
        res.json(rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ error: 'That railway_project_id is already registered' });
        res.status(500).json({ error: err.message });
    }
});

router.patch('/api/apex/fleet/:id', async (req, res) => {
    const b = req.body || {};
    const updates = FLEET_FIELDS.filter(f => f in b);
    if (!updates.length) return res.status(400).json({ error: `Nothing to update — send any of ${FLEET_FIELDS.join(', ')}` });
    if ('subscription_status' in b && !FLEET_STATUS.includes(b.subscription_status))
        return res.status(400).json({ error: `subscription_status must be one of ${FLEET_STATUS.join(', ')}` });
    if ('client_name' in b && !b.client_name) return res.status(400).json({ error: 'client_name cannot be empty' });
    try {
        const cur = await pool.query(`SELECT * FROM dedicated_clients WHERE id = $1`, [req.params.id]);
        if (!cur.rows.length) return res.status(404).json({ error: 'Fleet client not found' });
        const sets = updates.map((f, i) => `${f} = $${i + 1}`).join(', ');
        const { rows } = await pool.query(
            `UPDATE dedicated_clients SET ${sets}, updated_at = now() WHERE id = $${updates.length + 1} RETURNING *`,
            [...updates.map(f => b[f] === '' ? null : b[f]), req.params.id]
        );
        await logAdminAction(req.session.user.id, 'FLEET_CLIENT_UPDATED', null, {
            fleet_id: rows[0].id, client_name: rows[0].client_name,
            changed: Object.fromEntries(updates.map(f => [f, { from: cur.rows[0][f], to: rows[0][f] }])),
        });
        res.json(rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ error: 'That railway_project_id is already registered' });
        res.status(500).json({ error: err.message });
    }
});

// Health ping — one client (:id) or the whole fleet (id = "all").
// Status-code-only check; updates last_known_state / last_checked_at.
router.post('/api/apex/fleet/:id/ping', async (req, res) => {
    try {
        const where = req.params.id === 'all' ? '' : 'WHERE id = $1';
        const args = req.params.id === 'all' ? [] : [req.params.id];
        const { rows } = await pool.query(`SELECT * FROM dedicated_clients ${where}`, args);
        if (!rows.length) return res.status(404).json({ error: 'Fleet client not found' });
        const results = await Promise.all(rows.map(async c => {
            const r = await pingHealth(c.health_url);
            await pool.query(
                `UPDATE dedicated_clients SET last_known_state = $1, last_checked_at = now() WHERE id = $2`,
                [r.state, c.id]
            );
            return { id: c.id, client_name: c.client_name, ...r };
        }));
        res.json(results);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Power actions via Railway's control API only. Never touches a client DB.
router.post('/api/apex/fleet/:id/control', async (req, res) => {
    const action = String(req.body?.action || '').toLowerCase();
    if (!['stop', 'start', 'restart', 'deploy'].includes(action))
        return res.status(400).json({ error: 'action must be stop, start, restart or deploy' });
    try {
        const { rows } = await pool.query(`SELECT * FROM dedicated_clients WHERE id = $1`, [req.params.id]);
        if (!rows.length) return res.status(404).json({ error: 'Fleet client not found' });
        const client = rows[0];
        const result = await performAction(client, action);
        await logAdminAction(req.session.user.id, 'FLEET_CONTROL_' + action.toUpperCase(), null, {
            fleet_id: client.id, client_name: client.client_name,
            railway_project_id: client.railway_project_id, result,
        });
        res.json({ ok: true, ...result });
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
    }
});

module.exports = router;
