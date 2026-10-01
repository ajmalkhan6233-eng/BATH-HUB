// routes/money_control.js
// MONEY CONTROL module for Bath Hub Thihariya — backs the owner's daily
// "cockpit" page: today's sales by payment mode, the daily reserve for fixed
// overheads, cheques due per bank account (with hold support), and a general
// money-allocation ledger (investment in, planned spend, etc.).
//
// Own Pool. Two ALTERs here are additive-only (ADD COLUMN IF NOT EXISTS) on
// cheque_register, a table THIS series created — never touches golden-core
// tables (AGENT_GUIDE/09_golden_core.md).

require('dotenv').config();
const express = require('express');
const { todayLK } = require('../utils/lkTime');
const { Pool } = require('pg');

const router = express.Router();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

// ─── Schema ───────────────────────────────────────────────────────────────
// Run in order, one after the other: bank_accounts first, then cheque_register (created here too if the cheque module has
// not started yet, same definition as routes/cheque_register.js), then the columns this module adds to it. Running them in
// parallel failed on a brand-new database (the ALTER ran before the table existed) and needed a second restart.
pool.query(`
    CREATE TABLE IF NOT EXISTS bank_accounts (
        id             SERIAL PRIMARY KEY,
        account_label  VARCHAR(100) NOT NULL,   -- e.g. "Ajmal Khan - Sampath"
        bank           VARCHAR(100),
        current_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
        active         BOOLEAN NOT NULL DEFAULT true,
        updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`).then(() => pool.query(`
    CREATE TABLE IF NOT EXISTS cheque_register (
        id          SERIAL PRIMARY KEY,
        cheque_no   VARCHAR(50),
        bank        VARCHAR(100),
        payee       VARCHAR(150) NOT NULL,
        amount      NUMERIC(12,2) NOT NULL,
        due_date    DATE NOT NULL,
        status      VARCHAR(20) NOT NULL DEFAULT 'pending',
        notes       TEXT,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`))
  .then(() => pool.query(`ALTER TABLE cheque_register ADD COLUMN IF NOT EXISTS account_id INT REFERENCES bank_accounts(id)`))
  .then(() => pool.query(`ALTER TABLE cheque_register ADD COLUMN IF NOT EXISTS held_from_date DATE`))
  .catch(e => console.error('[money_control] bank_accounts / cheque_register migration failed:', e.message));

pool.query(`
    CREATE TABLE IF NOT EXISTS daily_payment_breakdown (
        id            SERIAL PRIMARY KEY,
        report_date   DATE NOT NULL,
        mode          VARCHAR(30) NOT NULL,  -- cash / card / cheque / online_transfer / credit
        amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
        UNIQUE(report_date, mode)
    )
`).catch(e => console.error('[money_control] daily_payment_breakdown migration failed:', e.message));

pool.query(`
    CREATE TABLE IF NOT EXISTS fixed_overheads (
        id             SERIAL PRIMARY KEY,
        name           VARCHAR(100) NOT NULL,   -- Rent / Electricity / Water / Salary / ...
        monthly_amount NUMERIC(12,2) NOT NULL,
        active         BOOLEAN NOT NULL DEFAULT true,
        updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`).catch(e => console.error('[money_control] fixed_overheads migration failed:', e.message));

pool.query(`
    CREATE TABLE IF NOT EXISTS money_allocations (
        id           SERIAL PRIMARY KEY,
        label        VARCHAR(150) NOT NULL,
        category     VARCHAR(30) NOT NULL,   -- investment_in / planned_spend
        amount       NUMERIC(12,2) NOT NULL,
        planned_date DATE,
        status       VARCHAR(20) NOT NULL DEFAULT 'planned', -- planned / done / cancelled
        notes        TEXT,
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`).catch(e => console.error('[money_control] money_allocations migration failed:', e.message));

// ═══════════════════════ BANK ACCOUNTS ═══════════════════════
// ─── Input checks (reject bad values with a clear 400 instead of storing them) ───
const isDate = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v)) && !isNaN(Date.parse(v));
const isPositive = v => Number.isFinite(Number(v)) && Number(v) > 0;
const isNonNegative = v => v !== '' && v !== null && Number.isFinite(Number(v)) && Number(v) >= 0;

router.get('/bank-accounts', async (req, res) => {
    try {
        const r = await pool.query(`SELECT * FROM bank_accounts WHERE active = true ORDER BY account_label`);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/bank-accounts', async (req, res) => {
    try {
        const { account_label, bank, current_balance } = req.body;
        if (!String(account_label || '').trim()) return res.status(400).json({ error: 'account_label is required' });
        if (current_balance !== undefined && current_balance !== null && current_balance !== '' && !Number.isFinite(Number(current_balance))) return res.status(400).json({ error: 'current_balance must be a number' });
        const r = await pool.query(`
            INSERT INTO bank_accounts (account_label, bank, current_balance)
            VALUES ($1,$2,$3) RETURNING id
        `, [account_label, bank || null, current_balance || 0]);
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/bank-accounts/:id/balance', async (req, res) => {
    try {
        const { current_balance } = req.body;
        if (current_balance === undefined || current_balance === null || current_balance === '') return res.status(400).json({ error: 'current_balance is required' });
        if (!Number.isFinite(Number(current_balance))) return res.status(400).json({ error: 'current_balance must be a number' });
        const r = await pool.query(`
            UPDATE bank_accounts SET current_balance = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2 RETURNING *
        `, [current_balance, req.params.id]);
        if (!r.rows.length) return res.status(404).json({ error: 'not found' });
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════ CHEQUE HOLD (extends cheque_register) ═══════════════════════
router.post('/cheque-register/:id/hold', async (req, res) => {
    try {
        const { new_due_date } = req.body;
        if (!new_due_date) return res.status(400).json({ error: 'new_due_date is required' });
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(new_due_date)) || isNaN(Date.parse(new_due_date))) return res.status(400).json({ error: 'new_due_date must be a date (YYYY-MM-DD)' });
        const existing = await pool.query(`SELECT due_date, status FROM cheque_register WHERE id = $1`, [req.params.id]);
        if (!existing.rows.length) return res.status(404).json({ error: 'not found' });
        // Only a cheque that is still to be paid can be held. (A cleared/bounced cheque used to flip back to
        // 'held' here and reappear as money owed.)
        if (!['pending', 'held'].includes(existing.rows[0].status)) {
            return res.status(409).json({ error: `A ${existing.rows[0].status} cheque cannot be put on hold` });
        }
        // held_from_date keeps the ORIGINAL due date across repeated holds (the "old date, crossed out").
        const r = await pool.query(`
            UPDATE cheque_register
            SET status = 'held', held_from_date = COALESCE(held_from_date, due_date), due_date = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2 RETURNING *
        `, [new_due_date, req.params.id]);
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════ DAILY PAYMENT BREAKDOWN ═══════════════════════
router.post('/payment-breakdown', async (req, res) => {
    try {
        const { report_date, mode, amount } = req.body;
        if (!report_date || !mode || amount === undefined) {
            return res.status(400).json({ error: 'report_date, mode, amount are required' });
        }
        if (!isDate(report_date)) return res.status(400).json({ error: 'report_date must be a date (YYYY-MM-DD)' });
        if (!['cash', 'card', 'cheque', 'online_transfer', 'credit'].includes(mode)) return res.status(400).json({ error: 'mode must be cash, card, cheque, online_transfer or credit' });
        if (!isNonNegative(amount)) return res.status(400).json({ error: 'amount must be a number, 0 or more' });
        const r = await pool.query(`
            INSERT INTO daily_payment_breakdown (report_date, mode, amount)
            VALUES ($1,$2,$3)
            ON CONFLICT (report_date, mode) DO UPDATE SET amount = EXCLUDED.amount
            RETURNING *
        `, [report_date, mode, amount]);
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/payment-breakdown', async (req, res) => {
    try {
        const date = req.query.date || todayLK();
        const r = await pool.query(`SELECT mode, amount FROM daily_payment_breakdown WHERE report_date = $1`, [date]);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════ FIXED OVERHEADS + DAILY RESERVE ═══════════════════════
router.get('/fixed-overheads', async (req, res) => {
    try {
        const r = await pool.query(`SELECT * FROM fixed_overheads WHERE active = true ORDER BY name`);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/fixed-overheads', async (req, res) => {
    try {
        const { name, monthly_amount } = req.body;
        if (!name || !monthly_amount) return res.status(400).json({ error: 'name and monthly_amount are required' });
        if (!isPositive(monthly_amount)) return res.status(400).json({ error: 'monthly_amount must be a number greater than 0' });
        // Re-entering an existing cost updates it (otherwise the same rent would be counted twice
        // in the daily reserve and the set-aside).
        const upd = await pool.query(`
            UPDATE fixed_overheads SET monthly_amount = $2, updated_at = CURRENT_TIMESTAMP
            WHERE active = true AND LOWER(name) = LOWER($1) RETURNING id
        `, [name, monthly_amount]);
        if (upd.rows.length) return res.json({ ...upd.rows[0], updated: true });
        const r = await pool.query(`
            INSERT INTO fixed_overheads (name, monthly_amount) VALUES ($1,$2) RETURNING id
        `, [name, monthly_amount]);
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Auto-calculated: monthly total / days in the current month
router.get('/daily-reserve', async (req, res) => {
    try {
        const r = await pool.query(`SELECT COALESCE(SUM(monthly_amount),0) AS monthly_total FROM fixed_overheads WHERE active = true`);
        const monthlyTotal = Number(r.rows[0].monthly_total);
        const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
        res.json({ monthly_total: monthlyTotal, days_in_month: daysInMonth, daily_reserve: Math.round((monthlyTotal / daysInMonth) * 100) / 100 });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════ MONEY ALLOCATIONS (investment in / planned spend) ═══════════════════════
router.get('/money-allocations', async (req, res) => {
    try {
        const { status } = req.query;
        const vals = [];
        let where = '';
        if (status) { vals.push(status); where = `WHERE status = $1`; }
        const r = await pool.query(`SELECT * FROM money_allocations ${where} ORDER BY planned_date NULLS LAST, created_at DESC`, vals);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/money-allocations', async (req, res) => {
    try {
        const { label, category, amount, planned_date, notes } = req.body;
        if (!label || !category || !amount) return res.status(400).json({ error: 'label, category, amount are required' });
        if (!['investment_in', 'planned_spend'].includes(category)) return res.status(400).json({ error: 'category must be investment_in or planned_spend' });
        if (!isPositive(amount)) return res.status(400).json({ error: 'amount must be a number greater than 0' });
        if (planned_date && !isDate(planned_date)) return res.status(400).json({ error: 'planned_date must be a date (YYYY-MM-DD)' });
        const r = await pool.query(`
            INSERT INTO money_allocations (label, category, amount, planned_date, notes)
            VALUES ($1,$2,$3,$4,$5) RETURNING id
        `, [label, category, amount, planned_date || null, notes || null]);
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/money-allocations/:id', async (req, res) => {
    try {
        const { status } = req.body;
        if (status !== undefined && status !== null && !['planned', 'done', 'cancelled'].includes(status)) return res.status(400).json({ error: 'status must be planned, done or cancelled' });
        const r = await pool.query(`
            UPDATE money_allocations SET status = COALESCE($1, status) WHERE id = $2 RETURNING *
        `, [status || null, req.params.id]);
        if (!r.rows.length) return res.status(404).json({ error: 'not found' });
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════ VIEWER ACCESS (investors/trusted friends, approval-gated) ═══════════════════════
pool.query(`
    CREATE TABLE IF NOT EXISTS viewer_access_requests (
        id                SERIAL PRIMARY KEY,
        requester_name    VARCHAR(150) NOT NULL,
        requester_contact VARCHAR(150),
        status            VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending / approved / denied
        access_token      VARCHAR(64) UNIQUE,
        created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        approved_at       TIMESTAMP
    )
`).catch(e => console.error('[money_control] viewer_access_requests migration failed:', e.message));

// A friend/investor asks for access — creates a pending request, nothing is visible yet.
router.post('/viewer-requests', async (req, res) => {
    try {
        const { requester_name, requester_contact } = req.body;
        if (!requester_name) return res.status(400).json({ error: 'requester_name is required' });
        const r = await pool.query(`
            INSERT INTO viewer_access_requests (requester_name, requester_contact)
            VALUES ($1,$2) RETURNING id, status
        `, [requester_name, requester_contact || null]);
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Owner sees who's asking.
router.get('/viewer-requests', async (req, res) => {
    try {
        const { status } = req.query;
        const vals = [];
        let where = '';
        if (status) { vals.push(status); where = `WHERE status = $1`; }
        const r = await pool.query(`SELECT id, requester_name, requester_contact, status, created_at FROM viewer_access_requests ${where} ORDER BY created_at DESC`, vals);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Owner approves — generates the token that becomes that person's private link.
router.post('/viewer-requests/:id/approve', async (req, res) => {
    try {
        const token = require('crypto').randomBytes(16).toString('hex');
        const r = await pool.query(`
            UPDATE viewer_access_requests SET status = 'approved', access_token = $1, approved_at = CURRENT_TIMESTAMP
            WHERE id = $2 RETURNING id, requester_name, access_token
        `, [token, req.params.id]);
        if (!r.rows.length) return res.status(404).json({ error: 'not found' });
        res.json({ ...r.rows[0], viewer_link: `/investor-view.html?token=${token}` });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/viewer-requests/:id/deny', async (req, res) => {
    try {
        const r = await pool.query(`UPDATE viewer_access_requests SET status = 'denied' WHERE id = $1 RETURNING id`, [req.params.id]);
        if (!r.rows.length) return res.status(404).json({ error: 'not found' });
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// The limited, read-only view an approved investor/friend actually sees.
// Deliberately narrower than the owner's dashboard — no bank balances, no other
// lender's individual loan details, no low-stock/operational detail. Just
// enough to reassure an investor: today's sales, and overall cash-flow health.
router.get('/viewer-dashboard', async (req, res) => {
    try {
        const { token } = req.query;
        if (!token) return res.status(401).json({ error: 'access token required' });
        const check = await pool.query(`SELECT requester_name FROM viewer_access_requests WHERE access_token = $1 AND status = 'approved'`, [token]);
        if (!check.rows.length) return res.status(403).json({ error: 'not approved or invalid link' });

        const today = todayLK();
        const [breakdown, avgRes] = await Promise.all([
            pool.query(`SELECT COALESCE(SUM(amount),0) AS total FROM daily_payment_breakdown WHERE report_date = $1`, [today]),
            pool.query(`SELECT AVG(total_sale) AS avg_daily FROM daily_summary WHERE report_date >= CURRENT_DATE - INTERVAL '30 days'`),
        ]);
        res.json({
            viewing_as: check.rows[0].requester_name,
            date: today,
            sales_total_today: Number(breakdown.rows[0].total),
            avg_daily_sales_30d: Math.round(Number(avgRes.rows[0].avg_daily) || 0),
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

pool.query(`
    CREATE TABLE IF NOT EXISTS daily_cash_plan (
        id                 SERIAL PRIMARY KEY,
        report_date        DATE NOT NULL UNIQUE,
        sales_total        NUMERIC(12,2) NOT NULL,
        expenses_total     NUMERIC(12,2) NOT NULL DEFAULT 0,
        purchasing_reserve NUMERIC(12,2) NOT NULL DEFAULT 0,
        notes              TEXT,
        created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`).catch(e => console.error('[money_control] daily_cash_plan migration failed:', e.message));

// ═══════════════════════ DAILY CASH BREAKDOWN — "set aside X, safe to take Y" ═══════════════════════
router.post('/daily-cash-plan', async (req, res) => {
    try {
        const { report_date, sales_total, expenses_total, purchasing_reserve, notes } = req.body;
        if (!report_date || sales_total === undefined) {
            return res.status(400).json({ error: 'report_date and sales_total are required' });
        }
        if (!isDate(report_date)) return res.status(400).json({ error: 'report_date must be a date (YYYY-MM-DD)' });
        if (!isNonNegative(sales_total)) return res.status(400).json({ error: 'sales_total must be a number, 0 or more' });
        for (const [k, v] of [['expenses_total', expenses_total], ['purchasing_reserve', purchasing_reserve]]) {
            if (v !== undefined && v !== null && v !== '' && !isNonNegative(v)) return res.status(400).json({ error: `${k} must be a number, 0 or more` });
        }
        const r = await pool.query(`
            INSERT INTO daily_cash_plan (report_date, sales_total, expenses_total, purchasing_reserve, notes)
            VALUES ($1,$2,$3,$4,$5)
            ON CONFLICT (report_date) DO UPDATE SET
                sales_total = EXCLUDED.sales_total,
                expenses_total = EXCLUDED.expenses_total,
                purchasing_reserve = EXCLUDED.purchasing_reserve,
                notes = EXCLUDED.notes
            RETURNING id
        `, [report_date, sales_total, expenses_total || 0, purchasing_reserve || 0, notes || null]);
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/daily-cash-plan', async (req, res) => {
    try {
        const date = req.query.date || todayLK();

        const plan = await pool.query(`SELECT * FROM daily_cash_plan WHERE report_date = $1`, [date]);
        if (!plan.rows.length) {
            return res.status(404).json({ error: 'no plan entered for this date yet — POST sales_total and expenses_total first' });
        }
        const p = plan.rows[0];
        const salesTotal = Number(p.sales_total);
        const expensesTotal = Number(p.expenses_total);
        const grossProfit = salesTotal - expensesTotal;

        const overheadRes = await pool.query(`SELECT COALESCE(SUM(monthly_amount),0) AS monthly_total FROM fixed_overheads WHERE active = true`);
        const daysInMonth = new Date(new Date(date).getFullYear(), new Date(date).getMonth() + 1, 0).getDate();
        const overheadDaily = Math.round((Number(overheadRes.rows[0].monthly_total) / daysInMonth) * 100) / 100;

        const cheques = await pool.query(`
            SELECT payee, amount, due_date, (due_date - $1::date) AS days_left
            FROM cheque_register WHERE status IN ('pending','held') ORDER BY due_date ASC
        `, [date]);
        const chequeBreakdown = cheques.rows.map(c => {
            const daysLeft = Number(c.days_left);
            const overdue = daysLeft <= 0;
            const dailyAmount = Math.round((Number(c.amount) / Math.max(daysLeft, 1)) * 100) / 100;
            return { payee: c.payee, amount: Number(c.amount), due_date: c.due_date, days_left: daysLeft, daily_amount: dailyAmount, overdue };
        });
        const chequeDailyTotal = chequeBreakdown.reduce((a, x) => a + x.daily_amount, 0);

        const loans = await pool.query(`
            SELECT l.lender_name, l.due_date, (l.due_date - $1::date) AS days_left,
                   ROUND(l.amount + (l.amount * l.profit_rate / 100) -
                       COALESCE((SELECT SUM(pm.amount) FROM investor_loan_payments pm WHERE pm.loan_id = l.id), 0), 2) AS outstanding
            FROM investor_loans l WHERE l.status != 'repaid' AND l.due_date IS NOT NULL ORDER BY l.due_date ASC
        `, [date]);
        const loanBreakdown = loans.rows.map(l => {
            const daysLeft = Number(l.days_left);
            const overdue = daysLeft <= 0;
            const dailyAmount = Math.round((Number(l.outstanding) / Math.max(daysLeft, 1)) * 100) / 100;
            return { lender_name: l.lender_name, outstanding: Number(l.outstanding), due_date: l.due_date, days_left: daysLeft, daily_amount: dailyAmount, overdue };
        });
        const loanDailyTotal = loanBreakdown.reduce((a, x) => a + x.daily_amount, 0);

        const purchasingReserve = Number(p.purchasing_reserve);
        const totalToSetAside = Math.round((overheadDaily + chequeDailyTotal + loanDailyTotal + purchasingReserve) * 100) / 100;
        const safeToWithdraw = Math.round((grossProfit - totalToSetAside) * 100) / 100;

        res.json({
            date,
            sales_total: salesTotal,
            expenses_total: expensesTotal,
            gross_profit: grossProfit,
            set_aside: {
                overhead_reserve: overheadDaily,
                cheques: { total: Math.round(chequeDailyTotal * 100) / 100, breakdown: chequeBreakdown },
                loans: { total: Math.round(loanDailyTotal * 100) / 100, breakdown: loanBreakdown },
                purchasing_reserve: purchasingReserve,
                total_to_set_aside: totalToSetAside,
            },
            safe_to_withdraw: safeToWithdraw,
            verdict: safeToWithdraw >= 0
                ? `Set aside ${totalToSetAside.toLocaleString()} today. Safe to take out ${safeToWithdraw.toLocaleString()} as profit.`
                : `Set aside ${totalToSetAside.toLocaleString()} today — that's ${Math.abs(safeToWithdraw).toLocaleString()} more than today's gross profit. Don't take anything out; cover the gap from reserves.`,
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════ THE DASHBOARD — one call, everything the page needs ═══════════════════════
router.get('/dashboard', async (req, res) => {
    try {
        const today = todayLK();

        const [breakdown, reserve, accounts, cheques, loans, lowStock, allocations] = await Promise.all([
            pool.query(`SELECT mode, amount FROM daily_payment_breakdown WHERE report_date = $1`, [today]),
            pool.query(`SELECT COALESCE(SUM(monthly_amount),0) AS monthly_total FROM fixed_overheads WHERE active = true`),
            pool.query(`SELECT * FROM bank_accounts WHERE active = true ORDER BY account_label`),
            pool.query(`
                SELECT c.id, c.cheque_no, c.payee, c.amount, TO_CHAR(c.due_date,'YYYY-MM-DD') AS due_date,
                       TO_CHAR(c.held_from_date,'YYYY-MM-DD') AS held_from_date, c.status,
                       a.account_label
                FROM cheque_register c
                LEFT JOIN bank_accounts a ON a.id = c.account_id
                WHERE c.status IN ('pending','held') AND c.due_date <= CURRENT_DATE + 14
                ORDER BY c.due_date ASC
            `),
            pool.query(`
                SELECT l.lender_name,
                       ROUND(l.amount + (l.amount * l.profit_rate / 100) -
                           COALESCE((SELECT SUM(p.amount) FROM investor_loan_payments p WHERE p.loan_id = l.id), 0), 2) AS outstanding,
                       TO_CHAR(l.due_date,'YYYY-MM-DD') AS due_date
                FROM investor_loans l WHERE l.status != 'repaid' AND l.due_date <= CURRENT_DATE + 14
                ORDER BY l.due_date ASC
            `),
            pool.query(`SELECT item_name, current_qty, reorder_level FROM stock_items WHERE current_qty <= reorder_level`),
            pool.query(`SELECT * FROM money_allocations WHERE status = 'planned' ORDER BY planned_date NULLS LAST`)
        ]);

        const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
        const dailyReserve = Math.round((Number(reserve.rows[0].monthly_total) / daysInMonth) * 100) / 100;
        const todayTotal = breakdown.rows.reduce((a, x) => a + Number(x.amount), 0);

        // Single yes/no verdict: can today's cash + bank balances cover what's due today or tomorrow?
        const totalBankBalance = accounts.rows.reduce((a, x) => a + Number(x.current_balance), 0);
        const dueImmediately = [...cheques.rows, ...loans.rows.map(l => ({ due_date: l.due_date, amount: l.outstanding }))]
            .filter(x => x.due_date && (new Date(x.due_date) - new Date(today)) / 86400000 <= 1)
            .reduce((a, x) => a + Number(x.amount), 0);
        // Credit ("on account") sales are not money in hand yet, so they don't count towards covering today's payments.
        const cashInToday = breakdown.rows.filter(x => x.mode !== 'credit').reduce((a, x) => a + Number(x.amount), 0);
        const availableToday = cashInToday + totalBankBalance;
        const can_cover_today = availableToday >= dueImmediately;

        res.json({
            date: today,
            sales_by_mode: breakdown.rows,
            sales_total_today: todayTotal,
            cash_in_today: cashInToday,
            daily_overhead_reserve: dailyReserve,
            bank_accounts: accounts.rows,
            cheques_next_14_days: cheques.rows,
            investor_loans_next_14_days: loans.rows,
            low_stock: lowStock.rows,
            planned_allocations: allocations.rows,
            can_cover_today,
            can_cover_today_detail: `${money_control_fmt(availableToday)} available vs ${money_control_fmt(dueImmediately)} due today/tomorrow`,
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

function money_control_fmt(n) { return 'LKR ' + Math.round(n).toLocaleString(); }

module.exports = router;
