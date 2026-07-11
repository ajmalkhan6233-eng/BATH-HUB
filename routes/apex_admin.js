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

// Package tiers/prices — always read from package_config, never hardcoded.
router.get('/api/apex/packages', async (req, res) => {
    try {
        const { rows } = await pool.query(`SELECT * FROM package_config ORDER BY is_addon, price_lkr`);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
