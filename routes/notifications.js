// routes/notifications.js
// In-app "Rule #1" notifications — pending cheques (out) and investor/friend
// loans due soon, read-only against cheque_register and investor_loans
// (both are this project's own tables, not golden core). Own Pool, own
// small dismissals table, same conventions as the rest of this module set.
//
// Pay-early window: 5 days, matching the Money Control / Cheque Register
// "act now" alert (owner's Rule #1 — a cheque must never bounce or return).

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

const DUE_SOON_DAYS = 5;

pool.query(`
    CREATE TABLE IF NOT EXISTS notification_dismissals (
        id            SERIAL PRIMARY KEY,
        category      VARCHAR(20) NOT NULL,  -- 'cheque' | 'loan'
        ref_id        INT NOT NULL,
        due_date      DATE NOT NULL,
        dismissed_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(category, ref_id, due_date)
    )
`).catch(e => console.error('[notifications] notification_dismissals migration failed:', e.message));

// Shared: everything due soon, minus whatever's been dismissed for that
// exact due_date (editing the due date naturally un-dismisses it).
async function getDueSoonNotifications() {
    const [cheques, loans, dismissals] = await Promise.all([
        pool.query(`
            SELECT id, payee, amount, TO_CHAR(due_date,'YYYY-MM-DD') AS due_date,
                   (due_date - CURRENT_DATE) AS days_to_due
            FROM cheque_register
            WHERE status IN ('pending','held') AND due_date <= CURRENT_DATE + $1::int
            ORDER BY due_date ASC
        `, [DUE_SOON_DAYS]),
        pool.query(`
            SELECT l.id, l.lender_name,
                   ROUND(l.amount + (l.amount * l.profit_rate / 100) -
                       COALESCE((SELECT SUM(p.amount) FROM investor_loan_payments p WHERE p.loan_id = l.id), 0), 2) AS outstanding,
                   TO_CHAR(l.due_date,'YYYY-MM-DD') AS due_date,
                   (l.due_date - CURRENT_DATE) AS days_to_due
            FROM investor_loans l
            WHERE l.status != 'repaid' AND l.due_date IS NOT NULL AND l.due_date <= CURRENT_DATE + $1::int
            ORDER BY l.due_date ASC
        `, [DUE_SOON_DAYS]),
        pool.query(`SELECT category, ref_id, TO_CHAR(due_date,'YYYY-MM-DD') AS due_date FROM notification_dismissals`)
    ]);

    const dismissed = new Set(dismissals.rows.map(d => `${d.category}:${d.ref_id}:${d.due_date}`));

    const items = [];
    for (const c of cheques.rows) {
        if (dismissed.has(`cheque:${c.id}:${c.due_date}`)) continue;
        items.push({
            category: 'cheque', ref_id: c.id, due_date: c.due_date, days_to_due: c.days_to_due,
            title: `Cheque — ${c.payee}`, amount: c.amount,
            detail: `LKR ${Number(c.amount).toLocaleString()} due ${c.due_date}`
        });
    }
    for (const l of loans.rows) {
        if (dismissed.has(`loan:${l.id}:${l.due_date}`)) continue;
        items.push({
            category: 'loan', ref_id: l.id, due_date: l.due_date, days_to_due: l.days_to_due,
            title: `Loan repayment — ${l.lender_name}`, amount: l.outstanding,
            detail: `LKR ${Number(l.outstanding).toLocaleString()} due ${l.due_date}`
        });
    }
    items.sort((a, b) => a.days_to_due - b.days_to_due);
    return items;
}

// ═══════════════════════ LIST active (non-dismissed) due-soon notifications ═══════════════════════
router.get('/notifications', async (req, res) => {
    try {
        res.json(await getDueSoonNotifications());
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════ DISMISS one (until its due_date changes) ═══════════════════════
router.post('/notifications/dismiss', async (req, res) => {
    try {
        const { category, ref_id, due_date } = req.body;
        if (!category || !ref_id || !due_date) return res.status(400).json({ error: 'category, ref_id, due_date are required' });
        await pool.query(
            `INSERT INTO notification_dismissals (category, ref_id, due_date) VALUES ($1,$2,$3) ON CONFLICT (category, ref_id, due_date) DO NOTHING`,
            [category, ref_id, due_date]
        );
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
module.exports.getDueSoonNotifications = getDueSoonNotifications;
