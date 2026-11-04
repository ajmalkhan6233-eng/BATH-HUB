// CHEQUE TRACKING (Task Batch F/G, 2026-07-21) — the daily-entry.html Cheques
// tab's own standing list (Cheque No/Bank/Payee/Amount/Due/Status/Notes),
// NOT tied to any single day's ledger.
//
// IMPORTANT — table/route naming: server.js ALREADY has a real, live
// `cheques` table + /api/cheques REST API (customer_id FK, inbound/
// receivable cheques, 28 real rows in production) that this file must never
// collide with. There is ALSO an existing empty `cheque_payments` table
// (outbound-shaped, but explicitly "not wired into any live route" per
// server.js's own comment near the whatsapp-draft cheque_note handling) that
// this feature could arguably have reused — deliberately NOT reused here,
// since repurposing a table I don't have full historical context on carries
// real risk on a live financial database; using a clearly new, uniquely-named
// table (cheque_tracking) instead is the safe choice. Both existing tables
// are left completely untouched by this file.
const { Pool } = require('pg');
require('dotenv').config();
const express = require('express');
const router = express.Router();

const pool = new Pool({
    host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
});

pool.query(`
    CREATE TABLE IF NOT EXISTS cheque_tracking (
        id text PRIMARY KEY,
        cheque_no text NOT NULL DEFAULT '',
        bank text NOT NULL DEFAULT '',
        payee text NOT NULL DEFAULT '',
        amount numeric NOT NULL DEFAULT 0,
        due_date date,
        status text NOT NULL DEFAULT 'Pending',
        notes text NOT NULL DEFAULT '',
        updated_at timestamptz NOT NULL DEFAULT now()
    )`).catch(e => console.error('[cheque_tracking] migration failed:', e.message));

router.get('/api/cheque-tracking', async (req, res) => {
    try {
        const r = await pool.query(`SELECT id, cheque_no, bank, payee, amount, due_date, status, notes FROM cheque_tracking ORDER BY due_date NULLS LAST, cheque_no`);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Whole-list replace — same simple pattern as daily_entry_sync's payload
// upsert. The client is the source of truth for the list (add/edit/delete
// all happen client-side, then the full list is pushed here).
router.post('/api/cheque-tracking', async (req, res) => {
    const list = Array.isArray(req.body) ? req.body : [];
    for (const c of list) {
        if (!c || typeof c.id !== 'string') return res.status(400).json({ error: 'each cheque needs a string id' });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM cheque_tracking');
        for (const c of list) {
            await client.query(
                `INSERT INTO cheque_tracking (id, cheque_no, bank, payee, amount, due_date, status, notes, updated_at)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())`,
                [c.id, c.no || '', c.bank || '', c.payee || '', Number(c.amount) || 0,
                 c.due || null, c.status || 'Pending', c.notes || '']);
        }
        await client.query('COMMIT');
        res.json({ ok: true, count: list.length });
    } catch (e) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally { client.release(); }
});

module.exports = router;
