// routes/shop_operations.js
// SHOP OPERATIONS module for Bath Hub Thihariya: discount caps, manual stock/low-stock
// tracking, and a WhatsApp receipt queue. Own Pool, same conventions as staff_reports.js.
//
// Notes on scope:
// - Discount rules: a simple max-% cap staff can be checked against before applying a
//   discount. Corresponds to the existing 'crm_discount_rules' feature flag.
// - Stock items: manual quantity tracking (no live POS link exists yet — same gap
//   documented in sale_commissions.js), so quantities are adjusted by hand (sale/restock).
//   Corresponds to the existing 'inv_reorder_alerts' feature flag.
// - Receipt queue: only queues a receipt record. Does NOT send WhatsApp messages —
//   CLAUDE.md has a hard rule against starting this repo's whatsapp-bridge locally
//   (it can kill the live WhatsApp session). Wiring actual sending to the existing
//   bridge needs to be done carefully by Claude Code, on the machine, with that rule in mind.

require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');

const router = express.Router();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

// ─── Idempotent schema migrations ────────────────────────────────────────────
pool.query(`
    CREATE TABLE IF NOT EXISTS discount_rules (
        id             SERIAL PRIMARY KEY,
        role           VARCHAR(30) NOT NULL DEFAULT 'all',   -- 'all' or a specific staff role
        max_discount_pct NUMERIC(5,2) NOT NULL,
        notes          TEXT,
        active         BOOLEAN NOT NULL DEFAULT true,
        created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`).catch(e => console.error('[shop_operations] discount_rules migration failed:', e.message));

pool.query(`
    CREATE TABLE IF NOT EXISTS stock_items (
        id             SERIAL PRIMARY KEY,
        item_name      VARCHAR(150) NOT NULL UNIQUE,
        unit           VARCHAR(30) DEFAULT 'pcs',
        current_qty    NUMERIC(12,2) NOT NULL DEFAULT 0,
        reorder_level  NUMERIC(12,2) NOT NULL DEFAULT 0,
        notes          TEXT,
        updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`).catch(e => console.error('[shop_operations] stock_items migration failed:', e.message));

pool.query(`
    CREATE TABLE IF NOT EXISTS stock_adjustments (
        id            SERIAL PRIMARY KEY,
        stock_item_id INT REFERENCES stock_items(id) ON DELETE CASCADE,
        delta         NUMERIC(12,2) NOT NULL,   -- positive = restock, negative = sale/loss
        reason        VARCHAR(30) NOT NULL,      -- restock / sale / correction
        notes         TEXT,
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`).catch(e => console.error('[shop_operations] stock_adjustments migration failed:', e.message));

pool.query(`
    CREATE TABLE IF NOT EXISTS receipt_queue (
        id              SERIAL PRIMARY KEY,
        customer_phone  VARCHAR(30) NOT NULL,
        sale_reference  TEXT,
        amount          NUMERIC(12,2),
        status          VARCHAR(20) NOT NULL DEFAULT 'queued', -- queued / sent / failed
        created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        sent_at         TIMESTAMP
    )
`).catch(e => console.error('[shop_operations] receipt_queue migration failed:', e.message));

pool.query(`
    CREATE TABLE IF NOT EXISTS customer_credit_limits (
        id            SERIAL PRIMARY KEY,
        customer_name VARCHAR(150) NOT NULL UNIQUE,
        credit_limit  NUMERIC(12,2) NOT NULL,
        notes         TEXT,
        updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`).catch(e => console.error('[shop_operations] customer_credit_limits migration failed:', e.message));

// ═══════════════════════ CUSTOMER CREDIT LIMITS ═══════════════════════
router.get('/credit-limits', async (req, res) => {
    try {
        const r = await pool.query(`SELECT * FROM customer_credit_limits ORDER BY customer_name`);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/credit-limits', async (req, res) => {
    try {
        const { customer_name, credit_limit, notes } = req.body;
        if (!customer_name || !credit_limit) return res.status(400).json({ error: 'customer_name and credit_limit are required' });
        const r = await pool.query(`
            INSERT INTO customer_credit_limits (customer_name, credit_limit, notes)
            VALUES ($1,$2,$3)
            ON CONFLICT (customer_name) DO UPDATE SET credit_limit = EXCLUDED.credit_limit, notes = EXCLUDED.notes, updated_at = CURRENT_TIMESTAMP
            RETURNING id
        `, [customer_name, credit_limit, notes || null]);
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// NOT FINISHED ON PURPOSE: this only returns the limit itself. Comparing it
// against a customer's actual outstanding balance needs the real column names
// on whatever table tracks credit sales (referenced elsewhere as either
// `credit_customers` or `lasersoft_invoices` — never independently verified
// in this session). Claude Code: confirm the real table/columns before wiring
// the comparison, don't guess at golden-core schema.
router.get('/credit-limits/:customer_name', async (req, res) => {
    try {
        const r = await pool.query(`SELECT * FROM customer_credit_limits WHERE customer_name = $1`, [req.params.customer_name]);
        if (!r.rows.length) return res.status(404).json({ error: 'no limit set for this customer' });
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════ DISCOUNT RULES ═══════════════════════
router.get('/discount-rules', async (req, res) => {
    try {
        const r = await pool.query(`SELECT * FROM discount_rules WHERE active = true ORDER BY role`);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/discount-rules', async (req, res) => {
    try {
        const { role, max_discount_pct, notes } = req.body;
        if (max_discount_pct === undefined) return res.status(400).json({ error: 'max_discount_pct is required' });
        // One active rule per role: setting a limit again replaces the old one, so the
        // discount check never has two conflicting caps for the same role.
        const upd = await pool.query(`
            UPDATE discount_rules SET max_discount_pct = $2, notes = COALESCE($3, notes)
            WHERE active = true AND role = $1 RETURNING id
        `, [role || 'all', max_discount_pct, notes || null]);
        if (upd.rows.length) return res.json({ ...upd.rows[0], updated: true });
        const r = await pool.query(`
            INSERT INTO discount_rules (role, max_discount_pct, notes)
            VALUES ($1,$2,$3) RETURNING id
        `, [role || 'all', max_discount_pct, notes || null]);
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Check a proposed discount against the applicable rule (role-specific first, else 'all')
router.post('/discount-check', async (req, res) => {
    try {
        const { discount_pct, role } = req.body;
        if (discount_pct === undefined) return res.status(400).json({ error: 'discount_pct is required' });
        const r = await pool.query(`
            SELECT max_discount_pct FROM discount_rules
            WHERE active = true AND role IN ($1, 'all')
            ORDER BY (role = 'all'), id DESC
            LIMIT 1
        `, [role || 'all']);
        if (!r.rows.length) return res.json({ allowed: true, max_allowed: null, note: 'No rule set — no cap enforced' });
        const max_allowed = Number(r.rows[0].max_discount_pct);
        res.json({ allowed: Number(discount_pct) <= max_allowed, max_allowed });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════ STOCK ITEMS + LOW STOCK ═══════════════════════
router.get('/stock-items', async (req, res) => {
    try {
        const r = await pool.query(`
            SELECT *, (current_qty <= reorder_level) AS low_stock
            FROM stock_items ORDER BY item_name
        `);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/stock-items/low-stock', async (req, res) => {
    try {
        const r = await pool.query(`
            SELECT *, (current_qty <= reorder_level) AS low_stock
            FROM stock_items WHERE current_qty <= reorder_level ORDER BY item_name
        `);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Create or update an item by name (upsert)
router.post('/stock-items', async (req, res) => {
    try {
        const { item_name, unit, current_qty, reorder_level, notes } = req.body;
        if (!item_name) return res.status(400).json({ error: 'item_name is required' });
        const r = await pool.query(`
            INSERT INTO stock_items (item_name, unit, current_qty, reorder_level, notes)
            VALUES ($1,$2,$3,$4,$5)
            ON CONFLICT (item_name) DO UPDATE SET
                unit = COALESCE(EXCLUDED.unit, stock_items.unit),
                reorder_level = COALESCE(EXCLUDED.reorder_level, stock_items.reorder_level),
                notes = COALESCE(EXCLUDED.notes, stock_items.notes),
                updated_at = CURRENT_TIMESTAMP
            RETURNING id
        `, [item_name, unit || 'pcs', current_qty || 0, reorder_level || 0, notes || null]);
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Adjust quantity (sale = negative delta, restock = positive delta)
router.post('/stock-items/:id/adjust', async (req, res) => {
    try {
        const { delta, reason, notes } = req.body;
        if (delta === undefined || !['restock', 'sale', 'correction'].includes(reason)) {
            return res.status(400).json({ error: 'delta and a valid reason (restock/sale/correction) are required' });
        }
        const item = await pool.query(`SELECT id FROM stock_items WHERE id = $1`, [req.params.id]);
        if (!item.rows.length) return res.status(404).json({ error: 'stock item not found' });

        await pool.query(`
            INSERT INTO stock_adjustments (stock_item_id, delta, reason, notes)
            VALUES ($1,$2,$3,$4)
        `, [req.params.id, delta, reason, notes || null]);

        const r = await pool.query(`
            UPDATE stock_items SET current_qty = current_qty + $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING *, (current_qty <= reorder_level) AS low_stock
        `, [delta, req.params.id]);
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════ WHATSAPP RECEIPT QUEUE (queue only — no sending) ═══════════════════════
router.post('/receipt-queue', async (req, res) => {
    try {
        const { customer_phone, sale_reference, amount } = req.body;
        if (!customer_phone) return res.status(400).json({ error: 'customer_phone is required' });
        const r = await pool.query(`
            INSERT INTO receipt_queue (customer_phone, sale_reference, amount)
            VALUES ($1,$2,$3) RETURNING id
        `, [customer_phone, sale_reference || null, amount || null]);
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/receipt-queue', async (req, res) => {
    try {
        const { status } = req.query;
        const vals = [];
        let where = '';
        if (status) { vals.push(status); where = `WHERE status = $1`; }
        const r = await pool.query(`SELECT * FROM receipt_queue ${where} ORDER BY created_at DESC`, vals);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
