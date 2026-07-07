// routes/staff_reports.js
// Dormant STAFF + REPORTS modules for BATHCO Nature ERP.
// Ships behind feature_flags — router is mountable but inert until wired up.
// Own Pool (does NOT touch server.js's pool). Same conventions as server.js:
// pool.query with $1/$2 params, try/catch -> res.status(500).json({error}), TO_CHAR for dates.
//
// Modules covered here (module_key -> built status):
//   staff_attendance          -> real table staff_attendance
//   staff_leave_tracker       -> real table staff_leave
//   staff_salary_advances     -> reuses EXISTING staff_loans table (already has type='advance'/'repayment')
//   staff_payroll_export      -> CSV export from staff_salary
//   staff_commission_autocalc -> SCAFFOLD ONLY, genuinely blocked (see CLAUDE.md 3.6) — built=false
//   rep_monthly_trends        -> real, aggregates daily_summary by month
//   rep_daily_digest          -> real, composes yesterday's daily_summary row
//   rep_cashflow_forecast     -> real trailing-average projection (labeled ESTIMATE)
//   rep_customer_ltv          -> real, aggregates credit_customers (credit customers only)
//   rep_heatmap               -> real day-of-week pattern from daily_summary (hour/staff/category NOT computable)
//   rep_margin_by_product     -> real catalog margin from products.avg_cost/selling_price (not sales-weighted)
//   rep_top_slow_items        -> BLOCKED, no source data — built=false

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

// ─── Idempotent schema migrations (own tables only, prefixed staff_/rep_) ───────
pool.query(`
    CREATE TABLE IF NOT EXISTS staff_attendance (
        id          SERIAL PRIMARY KEY,
        staff_id    INT REFERENCES staff(id),
        work_date   DATE NOT NULL,
        status      VARCHAR(20) DEFAULT 'present',   -- present / absent / half_day / leave
        notes       TEXT,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(staff_id, work_date)
    )
`).catch(e => console.error('[staff_reports] staff_attendance migration failed:', e.message));

pool.query(`
    CREATE TABLE IF NOT EXISTS staff_leave (
        id           SERIAL PRIMARY KEY,
        staff_id     INT REFERENCES staff(id),
        leave_start  DATE NOT NULL,
        leave_end    DATE NOT NULL,
        leave_type   VARCHAR(30) DEFAULT 'casual',    -- casual / sick / annual / unpaid
        reason       TEXT,
        status       VARCHAR(20) DEFAULT 'approved',  -- approved / pending / rejected
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`).catch(e => console.error('[staff_reports] staff_leave migration failed:', e.message));

// ═══════════════════════ STAFF: ATTENDANCE (real) ═══════════════════════
router.get('/attendance', async (req, res) => {
    try {
        const { staff_id, month } = req.query;
        const clauses = [];
        const vals = [];
        if (staff_id) { vals.push(staff_id); clauses.push(`a.staff_id = $${vals.length}`); }
        if (month) { vals.push(month); clauses.push(`TO_CHAR(a.work_date,'YYYY-MM') = $${vals.length}`); }
        const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
        const r = await pool.query(`
            SELECT a.id, a.staff_id, s.name AS staff_name, TO_CHAR(a.work_date,'YYYY-MM-DD') AS work_date,
                   a.status, a.notes, a.created_at
            FROM staff_attendance a
            JOIN staff s ON s.id = a.staff_id
            ${where}
            ORDER BY a.work_date DESC, s.name ASC
        `, vals);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/attendance', async (req, res) => {
    try {
        const { staff_id, work_date, status, notes } = req.body;
        if (!staff_id || !work_date) return res.status(400).json({ error: 'staff_id and work_date are required' });
        const r = await pool.query(`
            INSERT INTO staff_attendance (staff_id, work_date, status, notes)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (staff_id, work_date)
            DO UPDATE SET status = EXCLUDED.status, notes = EXCLUDED.notes, updated_at = CURRENT_TIMESTAMP
            RETURNING id, staff_id, TO_CHAR(work_date,'YYYY-MM-DD') AS work_date, status, notes
        `, [staff_id, work_date, status || 'present', notes || null]);
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════ STAFF: LEAVE TRACKER (real) ═══════════════════════
router.get('/leave', async (req, res) => {
    try {
        const { staff_id } = req.query;
        const vals = [];
        let where = '';
        if (staff_id) { vals.push(staff_id); where = `WHERE l.staff_id = $1`; }
        const r = await pool.query(`
            SELECT l.id, l.staff_id, s.name AS staff_name,
                   TO_CHAR(l.leave_start,'YYYY-MM-DD') AS leave_start,
                   TO_CHAR(l.leave_end,'YYYY-MM-DD') AS leave_end,
                   l.leave_type, l.reason, l.status, l.created_at
            FROM staff_leave l
            JOIN staff s ON s.id = l.staff_id
            ${where}
            ORDER BY l.leave_start DESC
        `, vals);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/leave', async (req, res) => {
    try {
        const { staff_id, leave_start, leave_end, leave_type, reason } = req.body;
        if (!staff_id || !leave_start || !leave_end) return res.status(400).json({ error: 'staff_id, leave_start, leave_end are required' });
        const r = await pool.query(`
            INSERT INTO staff_leave (staff_id, leave_start, leave_end, leave_type, reason)
            VALUES ($1,$2,$3,$4,$5)
            RETURNING id
        `, [staff_id, leave_start, leave_end, leave_type || 'casual', reason || null]);
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/leave/:id', async (req, res) => {
    try {
        const { status } = req.body;
        if (!['approved', 'pending', 'rejected'].includes(status)) return res.status(400).json({ error: 'invalid status' });
        const r = await pool.query(`UPDATE staff_leave SET status=$1 WHERE id=$2 RETURNING id, status`, [status, req.params.id]);
        if (!r.rows.length) return res.status(404).json({ error: 'not found' });
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════ STAFF: SALARY ADVANCES (reuses staff_loans — real) ═══════════════════════
// staff_loans already has type='advance' / type='repayment' rows (checked before building —
// a separate table would have duplicated it), so this is a filtered view + writer on that table.
router.get('/advances', async (req, res) => {
    try {
        const { staff_id } = req.query;
        const vals = [];
        let extra = '';
        if (staff_id) { vals.push(staff_id); extra = `AND sl.staff_id = $${vals.length}`; }
        const r = await pool.query(`
            SELECT sl.id, sl.staff_id, s.name AS staff_name, TO_CHAR(sl.loan_date,'YYYY-MM-DD') AS loan_date,
                   sl.amount, sl.repaid, sl.type, sl.notes
            FROM staff_loans sl
            JOIN staff s ON s.id = sl.staff_id
            WHERE sl.type IN ('advance','repayment') ${extra}
            ORDER BY sl.loan_date DESC
        `, vals);
        const bal = await pool.query(`
            SELECT s.id AS staff_id, s.name,
                   COALESCE(SUM(CASE WHEN sl.type='advance' THEN sl.amount ELSE 0 END),0) AS total_advanced,
                   COALESCE(SUM(CASE WHEN sl.type='repayment' THEN sl.amount ELSE 0 END),0) AS total_repaid
            FROM staff s
            LEFT JOIN staff_loans sl ON sl.staff_id = s.id AND sl.type IN ('advance','repayment')
            GROUP BY s.id, s.name
            HAVING COALESCE(SUM(CASE WHEN sl.type='advance' THEN sl.amount ELSE 0 END),0) > 0
            ORDER BY s.name
        `);
        res.json({ ledger: r.rows, balances: bal.rows.map(b => ({ ...b, outstanding: Number(b.total_advanced) - Number(b.total_repaid) })) });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/advances', async (req, res) => {
    try {
        const { staff_id, loan_date, amount, type, notes } = req.body;
        if (!staff_id || !loan_date || !amount) return res.status(400).json({ error: 'staff_id, loan_date, amount are required' });
        const t = (type === 'repayment') ? 'repayment' : 'advance';
        const r = await pool.query(`
            INSERT INTO staff_loans (staff_id, loan_date, amount, type, notes)
            VALUES ($1,$2,$3,$4,$5)
            RETURNING id
        `, [staff_id, loan_date, amount, t, notes || null]);
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════ STAFF: PAYROLL EXPORT (real, CSV) ═══════════════════════
router.get('/payroll-export', async (req, res) => {
    try {
        const { start, end, format } = req.query;
        const vals = [];
        let where = '';
        if (start && end) { vals.push(start, end); where = `WHERE ss.pay_date BETWEEN $1 AND $2`; }
        const r = await pool.query(`
            SELECT s.name, s.role, TO_CHAR(ss.pay_date,'YYYY-MM-DD') AS pay_date,
                   ss.amount, ss.commission, (ss.amount + ss.commission) AS total,
                   TO_CHAR(ss.period_start,'YYYY-MM-DD') AS period_start,
                   TO_CHAR(ss.period_end,'YYYY-MM-DD') AS period_end, ss.notes
            FROM staff_salary ss
            JOIN staff s ON s.id = ss.staff_id
            ${where}
            ORDER BY ss.pay_date DESC, s.name ASC
        `, vals);

        if (format === 'csv') {
            const headers = ['Name', 'Role', 'Pay Date', 'Amount', 'Commission', 'Total', 'Period Start', 'Period End', 'Notes'];
            const escCsv = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
            const lines = [headers.join(',')];
            r.rows.forEach(row => {
                lines.push([row.name, row.role, row.pay_date, row.amount, row.commission, row.total, row.period_start, row.period_end, row.notes]
                    .map(escCsv).join(','));
            });
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="payroll_${start || 'all'}_${end || 'all'}.csv"`);
            return res.send(lines.join('\r\n'));
        }
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════ STAFF: COMMISSION AUTOCALC — SCAFFOLD ONLY, BLOCKED ═══════════════════════
// Per CLAUDE.md 3.6, real commission = 1% of each staff member's INDIVIDUALLY-attributed
// Gross Profit from Lasersoft, filtered per staff member. lasersoft_invoices (2111 rows) has no
// staff/salesperson column, and only 13 of 2111 rows even have gross_profit populated —
// per-staff GP attribution does not exist anywhere in this database. This endpoint returns the
// real, already-stored commission figures for reference and an explicit "blocked" flag; it does
// NOT compute anything. feature_flags.built stays false for staff_commission_autocalc.
router.get('/commission-autocalc', async (req, res) => {
    try {
        const r = await pool.query(`
            SELECT s.id AS staff_id, s.name, s.commission_pct,
                   COALESCE(SUM(ss.commission),0) AS total_commission_as_stored
            FROM staff s
            LEFT JOIN staff_salary ss ON ss.staff_id = s.id
            GROUP BY s.id, s.name, s.commission_pct
            ORDER BY s.name
        `);
        res.json({
            blocked: true,
            reason: 'Real commission = 1% of each staff member\'s individually-attributed Gross Profit from Lasersoft (CLAUDE.md 3.6). That per-staff GP figure does not exist in this database — lasersoft_invoices is invoice-level with no staff/salesperson column, and gross_profit is populated on only 13 of 2111 rows. daily_summary.gross_profit is shop-wide, not per-staff. Cannot compute without importing a staff-filtered Lasersoft profit report first.',
            data_source_needed: 'A Lasersoft (or equivalent POS) export with invoice-level gross profit joined to the salesperson who made the sale.',
            staff_stored_commission: r.rows,
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════ REPORTS: MONTHLY TRENDS (real) ═══════════════════════
router.get('/monthly-trends', async (req, res) => {
    try {
        const r = await pool.query(`
            SELECT TO_CHAR(report_date,'YYYY-MM') AS month,
                   SUM(total_sale) AS total_sale,
                   SUM(gross_profit) AS gross_profit,
                   SUM(total_expenses) AS total_expenses,
                   SUM(net_profit) AS net_profit,
                   COUNT(*) AS days_recorded
            FROM daily_summary
            GROUP BY 1
            ORDER BY 1
        `);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════ REPORTS: OWNER'S DAILY DIGEST (real) ═══════════════════════
router.get('/daily-digest', async (req, res) => {
    try {
        let { date } = req.query;
        if (!date) {
            const y = await pool.query(`SELECT TO_CHAR(CURRENT_DATE - INTERVAL '1 day', 'YYYY-MM-DD') AS d`);
            date = y.rows[0].d;
        }
        let r = await pool.query(`
            SELECT TO_CHAR(report_date,'YYYY-MM-DD') AS report_date, total_sale, cash_sale, card_sale, online_sale,
                   credit_sale, total_expenses, gross_profit, net_profit, day_status, gp_status
            FROM daily_summary WHERE report_date = $1
        `, [date]);
        let fallbackNote = null;
        if (!r.rows.length) {
            r = await pool.query(`
                SELECT TO_CHAR(report_date,'YYYY-MM-DD') AS report_date, total_sale, cash_sale, card_sale, online_sale,
                       credit_sale, total_expenses, gross_profit, net_profit, day_status, gp_status
                FROM daily_summary WHERE report_date <= $1 ORDER BY report_date DESC LIMIT 1
            `, [date]);
            if (r.rows.length) fallbackNote = `No daily_summary row for ${date} — showing most recent available (${r.rows[0].report_date}).`;
        }
        if (!r.rows.length) return res.json({ found: false, requested_date: date, message: 'No daily_summary data available at all.' });
        const d = r.rows[0];
        const summary_text = `${d.report_date}: Total Sale LKR ${Number(d.total_sale).toLocaleString('en-US')}, ` +
            `Gross Profit ${d.gp_status === 'NOT_AVAILABLE' ? 'PENDING' : 'LKR ' + Number(d.gross_profit).toLocaleString('en-US')}, ` +
            `Expenses LKR ${Number(d.total_expenses).toLocaleString('en-US')}, ` +
            `Net Profit LKR ${Number(d.net_profit).toLocaleString('en-US')} (${d.day_status}).`;
        res.json({ found: true, requested_date: date, fallback_note: fallbackNote, ...d, summary_text });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════ REPORTS: CASH-FLOW FORECAST (real, labeled estimate) ═══════════════════════
router.get('/cashflow-forecast', async (req, res) => {
    try {
        const trailDays = Math.min(90, Math.max(7, parseInt(req.query.trail_days) || 30));
        const r = await pool.query(`
            SELECT AVG(total_sale) AS avg_sale, AVG(total_expenses) AS avg_expenses,
                   AVG(net_profit) AS avg_net_profit, AVG(cash_in_hand) AS avg_cash_in_hand,
                   COUNT(*) AS days_used
            FROM (
                SELECT * FROM daily_summary ORDER BY report_date DESC LIMIT $1
            ) recent
        `, [trailDays]);
        const row = r.rows[0];
        if (!row.days_used || row.days_used === '0') return res.json({ estimate: false, message: 'No daily_summary rows available to base a forecast on.' });
        const avgNet = Number(row.avg_net_profit) || 0;
        const avgSale = Number(row.avg_sale) || 0;
        const avgExp = Number(row.avg_expenses) || 0;
        res.json({
            estimate: true,
            disclaimer: `Simple projection based on the trailing ${row.days_used}-day average from daily_summary. This is an ESTIMATE, not a guarantee — it assumes the recent trend continues and does not account for seasonality, promotions, or supply disruptions.`,
            trailing_days_used: Number(row.days_used),
            trailing_avg_daily_sale: avgSale,
            trailing_avg_daily_expenses: avgExp,
            trailing_avg_daily_net_profit: avgNet,
            trailing_avg_cash_in_hand: Number(row.avg_cash_in_hand) || 0,
            forecast_next_7_days_sale: avgSale * 7,
            forecast_next_7_days_net_profit: avgNet * 7,
            forecast_next_30_days_sale: avgSale * 30,
            forecast_next_30_days_net_profit: avgNet * 30,
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════ REPORTS: CUSTOMER LIFETIME VALUE (real, credit customers only) ═══════════════════════
router.get('/customer-ltv', async (req, res) => {
    try {
        const r = await pool.query(`
            SELECT COALESCE(NULLIF(TRIM(name),''), 'Unnamed') AS customer_name,
                   COUNT(*) AS invoice_count,
                   SUM(amount) AS total_invoiced,
                   SUM(paid) AS total_paid,
                   SUM(amount - paid) AS outstanding,
                   TO_CHAR(MIN(invoice_date),'YYYY-MM-DD') AS first_invoice,
                   TO_CHAR(MAX(invoice_date),'YYYY-MM-DD') AS last_invoice
            FROM credit_customers
            WHERE quarantined IS NOT TRUE
            GROUP BY 1
            ORDER BY total_invoiced DESC
        `);
        res.json({
            caveat: 'Built from credit_customers only — the only table linking invoice amounts to a named customer. Cash/card walk-in sales are not attributed to individual customers anywhere in this database, so this is lifetime value for credit customers only, not all customers.',
            rows: r.rows,
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════ REPORTS: HEATMAP (real day-of-week; hour/staff/category NOT computable) ═══════════════════════
router.get('/heatmap', async (req, res) => {
    try {
        const r = await pool.query(`
            SELECT EXTRACT(DOW FROM report_date)::int AS dow_num,
                   TRIM(TO_CHAR(report_date,'Day')) AS dow_name,
                   COUNT(*) AS day_count,
                   SUM(total_sale) AS total_sale,
                   AVG(total_sale) AS avg_sale
            FROM daily_summary
            GROUP BY 1,2
            ORDER BY 1
        `);
        res.json({
            caveat: 'Hour-of-day, per-staff, and per-category breakdowns are NOT computable — no timestamped sale, salesperson-attributed sale, or category-attributed sale data exists anywhere in this database (lasersoft_invoices is date-only with no time or staff column; daily_summary is shop-wide totals). This shows the one real granular dimension available: sales pattern by day-of-week, aggregated from daily_summary.',
            rows: r.rows,
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════ REPORTS: MARGIN BY PRODUCT (real catalog margin, not sales-weighted) ═══════════════════════
router.get('/margin-by-product', async (req, res) => {
    try {
        const r = await pool.query(`
            SELECT item_code, name, category, avg_cost, selling_price,
                   (selling_price - avg_cost) AS margin_amt,
                   CASE WHEN selling_price > 0 THEN ROUND(((selling_price - avg_cost) / selling_price) * 100, 2) ELSE NULL END AS margin_pct
            FROM products
            WHERE active IS TRUE AND avg_cost > 0 AND selling_price > 0
            ORDER BY margin_pct DESC
        `);
        res.json({
            caveat: 'This is a CATALOG margin — current selling_price minus avg_cost per product row — not a sales-volume-weighted realized margin. No line-item sales table exists anywhere in this database to know how many units of each product actually sold, so a true "realized margin by product" cannot be computed. 40 of 85 products have no cost/price data and are excluded.',
            rows: r.rows,
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════ REPORTS: TOP/SLOW ITEMS — BLOCKED, NO SOURCE DATA ═══════════════════════
// Checked: lasersoft_invoices (invoice-level, no item/product breakdown, no qty column),
// quotation_items (0 rows, and even if populated represents quotes, not confirmed sales),
// products (has stock_level as a current snapshot, not a sales-movement history).
// No table anywhere in this database records "quantity of item X sold on date Y".
router.get('/top-slow-items', async (req, res) => {
    try {
        const check = await pool.query(`SELECT COUNT(*) AS n FROM quotation_items`);
        res.json({
            available: false,
            reason: 'No line-item sales/invoice-items table exists in this database. lasersoft_invoices is invoice-level only (no product or quantity columns). quotation_items exists but has ' + check.rows[0].n + ' rows and represents draft quotations, not confirmed sales — using it would fabricate sales data that was never actually sold.',
            data_source_needed: 'A sales or invoice line-items table with product_id/item_code + quantity_sold + date, e.g. from a Lasersoft item-level export.',
            rows: [],
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
