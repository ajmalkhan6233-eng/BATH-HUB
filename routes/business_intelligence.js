// routes/business_intelligence.js
// CASH-FLOW FORECAST + NON-MOVING STOCK for Bath Hub Thihariya.
//
// Cash-flow forecast logic is a direct port of the owner's own cashflow.py
// (built over ~8 months for the earlier tile-shop system) — same core idea:
// average daily sales x days in month = projected sales, minus cheques due
// that month = net position, bucketed into a status. Rewritten here as SQL
// against this app's tables (daily_summary, cheque_register, investor_loans)
// instead of a separate Python service, per the owner's decision.
//
// Non-moving stock is a fresh, simpler version — the owner's original script
// was a one-off Excel import tool, not a reusable rule, so this uses this
// app's own stock_adjustments ledger instead: an item with no 'sale'
// adjustment in the lookback window counts as non-moving.
//
// Own Pool, reads golden-core `daily_summary` (SELECT only, never writes to
// it) plus this app's own cheque_register / investor_loans / stock_* tables.

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

// ═══════════════════════ CASH-FLOW FORECAST ═══════════════════════
// GET /cash-position-forecast?months=3&healthy_threshold=200000
// healthy_threshold is configurable — the original script hardcoded a number
// sized for a bigger shop; this one shouldn't assume Bath Hub Thihariya's scale.
//
// NOTE: routes/staff_reports.js (golden-core, never modified) already owns the
// path /cashflow-forecast — a simple trailing-average sales/expenses/profit
// projection. That is a different feature from this one (a month-bucketed cash
// POSITION forecast that nets projected sales against cheques and investor-loan
// repayments actually due that month, bucketed HEALTHY/WATCH/TIGHT) — kept both,
// renamed this one to avoid colliding with and silently shadowing the golden-core
// route (Express matches route registration order; staff_reports.js is mounted
// first, so an identically-named route here would never be reached).
router.get('/cash-position-forecast', async (req, res) => {
    try {
        const months = parseInt(req.query.months) || 3;
        const healthyThreshold = req.query.healthy_threshold !== undefined
            ? Number(req.query.healthy_threshold) : 200000;

        const avgRes = await pool.query(`
            SELECT AVG(total_sale) AS avg_daily
            FROM daily_summary
            WHERE report_date >= CURRENT_DATE - INTERVAL '30 days'
        `);
        const avgDaily = Number(avgRes.rows[0].avg_daily) || 0;

        const forecast = [];
        for (let m = 0; m < months; m++) {
            const monthStartRes = await pool.query(
                `SELECT (date_trunc('month', CURRENT_DATE) + ($1 || ' months')::interval)::date AS month_start`,
                [m]
            );
            const monthStart = monthStartRes.rows[0].month_start;

            const detail = await pool.query(`
                WITH bounds AS (
                    SELECT $1::date AS month_start,
                           ($1::date + INTERVAL '1 month' - INTERVAL '1 day')::date AS month_end
                )
                SELECT
                    bounds.month_start, bounds.month_end,
                    (SELECT EXTRACT(DAY FROM bounds.month_end)::int) AS days_in_month,
                    COALESCE((SELECT SUM(total_sale) FROM daily_summary, bounds
                              WHERE report_date BETWEEN bounds.month_start AND LEAST(bounds.month_end, CURRENT_DATE)), 0) AS actual_sales,
                    COALESCE((SELECT SUM(amount) FROM cheque_register, bounds
                              WHERE status = 'pending' AND due_date BETWEEN bounds.month_start AND bounds.month_end), 0) AS cheques_due,
                    COALESCE((SELECT COUNT(*) FROM cheque_register, bounds
                              WHERE status = 'pending' AND due_date BETWEEN bounds.month_start AND bounds.month_end), 0) AS cheques_count,
                    COALESCE((SELECT SUM(l.amount + l.amount * l.interest_rate / 100 -
                                COALESCE((SELECT SUM(p.amount) FROM investor_loan_payments p WHERE p.loan_id = l.id), 0))
                              FROM investor_loans l, bounds
                              WHERE l.status != 'repaid' AND l.due_date BETWEEN bounds.month_start AND bounds.month_end), 0) AS loans_due
                FROM bounds
            `, [monthStart]);

            const d = detail.rows[0];
            const projectedSales = avgDaily * Number(d.days_in_month);
            const totalDue = Number(d.cheques_due) + Number(d.loans_due);
            const netPosition = projectedSales - totalDue;
            const status = netPosition > healthyThreshold ? 'HEALTHY' : (netPosition > 0 ? 'WATCH' : 'TIGHT');

            forecast.push({
                month_start: d.month_start,
                month_end: d.month_end,
                projected_sales: Math.round(projectedSales),
                actual_sales_to_date: Number(d.actual_sales),
                cheques_due: Number(d.cheques_due),
                cheques_count: Number(d.cheques_count),
                investor_loans_due: Number(d.loans_due),
                net_position: Math.round(netPosition),
                status
            });
        }

        res.json({
            avg_daily_sales_used: Math.round(avgDaily),
            healthy_threshold: healthyThreshold,
            forecast
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════ NON-MOVING STOCK ═══════════════════════
// GET /non-moving-stock?days=30 — items with no 'sale' adjustment in the window
router.get('/non-moving-stock', async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const r = await pool.query(`
            SELECT s.id, s.item_name, s.unit, s.current_qty, s.reorder_level,
                   (SELECT MAX(created_at) FROM stock_adjustments a
                    WHERE a.stock_item_id = s.id AND a.reason = 'sale') AS last_sale_at
            FROM stock_items s
            WHERE s.current_qty > 0
              AND NOT EXISTS (
                  SELECT 1 FROM stock_adjustments a
                  WHERE a.stock_item_id = s.id AND a.reason = 'sale'
                    AND a.created_at >= CURRENT_DATE - $1::int
              )
            ORDER BY last_sale_at ASC NULLS FIRST
        `, [days]);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
