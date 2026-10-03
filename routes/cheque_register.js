// routes/cheque_register.js
// CHEQUE REGISTER for Bath Hub Thihariya — the checks YOU write (to suppliers,
// investors, etc.), tracked with due dates, so Sunday's cash can be checked
// against what clears Saturday. Own Pool, own table, isolated by design.
//
// Adapted from a real fix found in the owner's earlier tile-shop system, where
// two different cheque features existed and collided (a customer-linked
// receivable-cheque table vs. a free-text payee register). Same risk applies
// here: DO NOT reuse or alter the golden-core `cheques` table
// (AGENT_GUIDE/09_golden_core.md) — that one is for money owed TO the shop.
// This is a clean, separate table for money the shop owes OUT.

require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');

const router = express.Router();

const pool = require('../utils/pool');

pool.query(`
    CREATE TABLE IF NOT EXISTS cheque_register (
        id          SERIAL PRIMARY KEY,
        cheque_no   VARCHAR(50),
        bank        VARCHAR(100),
        payee       VARCHAR(150) NOT NULL,
        amount      NUMERIC(12,2) NOT NULL,
        due_date    DATE NOT NULL,
        status      VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending / cleared / bounced
        notes       TEXT,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`).catch(e => console.error('[cheque_register] migration failed:', e.message));

router.get('/cheque-register', async (req, res) => {
    try {
        const { status } = req.query;
        const vals = [];
        let where = '';
        if (status) { vals.push(status); where = `WHERE status = $1`; }
        const r = await pool.query(`
            SELECT id, cheque_no, bank, payee, amount,
                   TO_CHAR(due_date,'YYYY-MM-DD') AS due_date,
                   status, notes, created_at
            FROM cheque_register ${where}
            ORDER BY due_date ASC
        `, vals);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Cheques due within N days (default 7) — for the "check due soon" alert
router.get('/cheque-register/due-soon', async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 7;
        const r = await pool.query(`
            SELECT id, cheque_no, bank, payee, amount,
                   TO_CHAR(due_date,'YYYY-MM-DD') AS due_date, status, notes
            FROM cheque_register
            WHERE status IN ('pending','held') AND due_date <= CURRENT_DATE + $1::int   -- a held cheque is still to be paid, on its new date
            ORDER BY due_date ASC
        `, [days]);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Cheques already past their due date and still to be paid (pending or held), oldest first.
router.get('/cheque-register/overdue', async (req, res) => {
    try {
        const r = await pool.query(`
            SELECT id, cheque_no, bank, payee, amount, TO_CHAR(due_date,'YYYY-MM-DD') AS due_date, status,
                   (CURRENT_DATE - due_date) AS days_overdue
            FROM cheque_register
            WHERE status IN ('pending','held') AND due_date < CURRENT_DATE
            ORDER BY due_date ASC`);
        res.json(r.rows.map(x => ({ ...x, amount: Number(x.amount), days_overdue: Number(x.days_overdue) })));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Input checks (reject bad values with a clear 400 instead of storing them / leaking DB errors) ───
const { isRealDate: isDate } = require('../utils/validate');   // real calendar dates only (2026-02-30 is refused)
const isPositive = v => Number.isFinite(Number(v)) && Number(v) > 0;
const isPct = v => Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 100;

router.post('/cheque-register', async (req, res) => {
    try {
        const { cheque_no, bank, payee, amount, due_date, notes } = req.body;
        if (!payee || !amount || !due_date) {
            return res.status(400).json({ error: 'payee, amount, due_date are required' });
        }
        if (!isPositive(amount)) return res.status(400).json({ error: 'amount must be a number greater than 0' });
        if (!isDate(due_date)) return res.status(400).json({ error: 'due_date must be a date (YYYY-MM-DD)' });
        const r = await pool.query(`
            INSERT INTO cheque_register (cheque_no, bank, payee, amount, due_date, notes)
            VALUES ($1,$2,$3,$4,$5,$6) RETURNING id
        `, [cheque_no || null, bank || null, payee, amount, due_date, notes || null]);
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/cheque-register/:id', async (req, res) => {
    try {
        const { status, notes } = req.body;
        if (status && !['pending', 'cleared', 'bounced', 'held'].includes(status)) return res.status(400).json({ error: "status must be 'pending', 'cleared', 'bounced' or 'held'" });
        const r = await pool.query(`
            UPDATE cheque_register
            SET status = COALESCE($1, status), notes = COALESCE($2, notes), updated_at = CURRENT_TIMESTAMP
            WHERE id = $3 RETURNING id
        `, [status || null, notes || null, req.params.id]);
        if (!r.rows.length) return res.status(404).json({ error: 'not found' });
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
