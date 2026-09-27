// routes/sale_commissions.js
// SALESPERSON COMMISSION + RETURNS module for BATHCO Nature ERP (Bath Hub Thihariya).
// Own Pool. Same conventions as staff_reports.js / investor_loans.js.
//
// WHY THIS EXISTS AS ITS OWN LEDGER (not hooked into lasersoft_invoices):
// AGENT_GUIDE/09_golden_core.md forbids altering financial tables (lasersoft_invoices etc).
// There is also no staff/salesperson column on the sales table today, so commission can't
// be auto-computed from POS data yet (this is a documented, pre-existing gap — see
// routes/staff_reports.js commission-autocalc endpoint). Until sales are staff-attributed
// at the POS level, the practical fix is: staff logs the sale + commission here directly.
//
// Business rules encoded here (as described by the shop owner):
//   - Refund: full commission on that sale is clawed back (negative adjustment row).
//   - Exchange: original commission is reversed AND a new commission is added for the
//     replacement item (usually lower value/rate — reflected honestly, not assumed).
//   - 15-day return policy is a SOFT flag only (past_policy_window: true), never a block —
//     staff/owner still decide case by case.
//
// Table: sale_commissions (append-only ledger; 'sale' rows are the original commission,
// 'return_refund' / 'return_exchange' rows are adjustments linked back via linked_sale_id).

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

// ─── Idempotent schema migration ─────────────────────────────────────────────
pool.query(`
    CREATE TABLE IF NOT EXISTS sale_commissions (
        id                 SERIAL PRIMARY KEY,
        staff_id           INT REFERENCES staff(id),
        entry_type         VARCHAR(20) NOT NULL,           -- sale / return_refund / return_exchange
        sale_date          DATE NOT NULL,
        amount             NUMERIC(12,2) NOT NULL,          -- sale amount for 'sale' rows, new item amount for exchange
        commission_pct     NUMERIC(5,2) NOT NULL DEFAULT 0,
        commission_amount  NUMERIC(12,2) NOT NULL,          -- signed: negative for refund/exchange clawback
        linked_sale_id     INT REFERENCES sale_commissions(id),  -- points back to the original 'sale' row
        reference_note     TEXT,                            -- free text: bill/invoice number, item description
        notes              TEXT,
        created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`).catch(e => console.error('[sale_commissions] migration failed:', e.message));

// ═══════════════════════ LOG a sale (creates the commission entry) ═══════════════════════
// ─── Input checks (reject bad values with a clear 400 instead of storing them / leaking DB errors) ───
const isDate = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v)) && !isNaN(Date.parse(v));
const isPositive = v => Number.isFinite(Number(v)) && Number(v) > 0;
const isPct = v => Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 100;

router.post('/sale-commissions', async (req, res) => {
    try {
        const { staff_id, sale_date, amount, commission_pct, reference_note, notes } = req.body;
        if (!staff_id || !sale_date || !amount || commission_pct === undefined) {
            return res.status(400).json({ error: 'staff_id, sale_date, amount, commission_pct are required' });
        }
        if (!isPositive(amount)) return res.status(400).json({ error: 'amount must be a number greater than 0' });
        if (!isPct(commission_pct)) return res.status(400).json({ error: 'commission_pct must be between 0 and 100' });
        if (!isDate(sale_date)) return res.status(400).json({ error: 'sale_date must be a date (YYYY-MM-DD)' });
        const commission_amount = Math.round((amount * commission_pct / 100) * 100) / 100;
        const r = await pool.query(`
            INSERT INTO sale_commissions (staff_id, entry_type, sale_date, amount, commission_pct, commission_amount, reference_note, notes)
            VALUES ($1,'sale',$2,$3,$4,$5,$6,$7)
            RETURNING id, commission_amount
        `, [staff_id, sale_date, amount, commission_pct, commission_amount, reference_note || null, notes || null]);
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════ LOG a return against an earlier sale ═══════════════════════
// body: { type: 'refund' | 'exchange', new_amount, new_commission_pct, notes }
router.post('/sale-commissions/:id/return', async (req, res) => {
    try {
        const { type, new_amount, new_commission_pct, notes } = req.body;
        if (!['refund', 'exchange'].includes(type)) {
            return res.status(400).json({ error: "type must be 'refund' or 'exchange'" });
        }
        const original = await pool.query(`SELECT * FROM sale_commissions WHERE id = $1 AND entry_type = 'sale'`, [req.params.id]);
        if (!original.rows.length) return res.status(404).json({ error: 'original sale entry not found' });
        const sale = original.rows[0];

        const daysSince = Math.floor((Date.now() - new Date(sale.sale_date).getTime()) / (1000 * 60 * 60 * 24));
        const past_policy_window = daysSince > 15; // soft flag only, never blocks

        if (type === 'refund') {
            const r = await pool.query(`
                INSERT INTO sale_commissions (staff_id, entry_type, sale_date, amount, commission_pct, commission_amount, linked_sale_id, notes)
                VALUES ($1,'return_refund',CURRENT_DATE,$2,$3,$4,$5,$6)
                RETURNING id, commission_amount
            `, [sale.staff_id, sale.amount, sale.commission_pct, -sale.commission_amount, sale.id, notes || null]);
            return res.json({ ...r.rows[0], past_policy_window, days_since_sale: daysSince });
        }

        // exchange: reverse original + add new commission for the replacement item
        if (!new_amount || new_commission_pct === undefined) {
            return res.status(400).json({ error: 'exchange requires new_amount and new_commission_pct' });
        }
        if (!isPositive(new_amount)) return res.status(400).json({ error: 'new_amount must be a number greater than 0' });
        if (!isPct(new_commission_pct)) return res.status(400).json({ error: 'new_commission_pct must be between 0 and 100' });
        const new_commission_amount = Math.round((new_amount * new_commission_pct / 100) * 100) / 100;
        const net_adjustment = Math.round((new_commission_amount - sale.commission_amount) * 100) / 100;
        const r = await pool.query(`
            INSERT INTO sale_commissions (staff_id, entry_type, sale_date, amount, commission_pct, commission_amount, linked_sale_id, notes)
            VALUES ($1,'return_exchange',CURRENT_DATE,$2,$3,$4,$5,$6)
            RETURNING id, commission_amount
        `, [sale.staff_id, new_amount, new_commission_pct, net_adjustment, sale.id, notes || null]);
        res.json({ ...r.rows[0], past_policy_window, days_since_sale: daysSince });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════ LIST entries (filterable) ═══════════════════════
router.get('/sale-commissions', async (req, res) => {
    try {
        const { staff_id, from, to } = req.query;
        const clauses = [];
        const vals = [];
        if (staff_id) { vals.push(staff_id); clauses.push(`c.staff_id = $${vals.length}`); }
        if (from) { vals.push(from); clauses.push(`c.sale_date >= $${vals.length}`); }
        if (to) { vals.push(to); clauses.push(`c.sale_date <= $${vals.length}`); }
        const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
        const r = await pool.query(`
            SELECT c.id, c.staff_id, s.name AS staff_name, c.entry_type,
                   TO_CHAR(c.sale_date,'YYYY-MM-DD') AS sale_date,
                   c.amount, c.commission_pct, c.commission_amount,
                   c.linked_sale_id, c.reference_note, c.notes, c.created_at
            FROM sale_commissions c
            JOIN staff s ON s.id = c.staff_id
            ${where}
            ORDER BY c.sale_date DESC, c.id DESC
        `, vals);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════ WEEKLY NET SUMMARY (for payout) ═══════════════════════
router.get('/sale-commissions/weekly-summary', async (req, res) => {
    try {
        const { week_start } = req.query; // any date; we snap to Mon-Sun containing it
        const anchor = week_start ? new Date(week_start) : new Date();
        const r = await pool.query(`
            SELECT s.id AS staff_id, s.name AS staff_name,
                   COALESCE(SUM(c.commission_amount) FILTER (WHERE c.entry_type = 'sale'), 0) AS gross_commission,
                   COALESCE(SUM(c.commission_amount) FILTER (WHERE c.entry_type != 'sale'), 0) AS return_adjustments,
                   COALESCE(SUM(c.commission_amount), 0) AS net_commission
            FROM staff s
            LEFT JOIN sale_commissions c
                ON c.staff_id = s.id
                AND c.sale_date >= date_trunc('week', $1::date)
                AND c.sale_date < date_trunc('week', $1::date) + INTERVAL '7 days'
            GROUP BY s.id, s.name
            ORDER BY s.name
        `, [anchor.toISOString().slice(0, 10)]);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
