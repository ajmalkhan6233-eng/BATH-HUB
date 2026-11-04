// LIVE SYNC for the offline daily-entry.html page (FINAL_BUILD task, added 2026-07-20).
// Own pool, own router - mounted from server.js, matching routes/audit.js's pattern.
// One new table only (daily_entry_live) - no existing schema touched. This is the
// page's own working data (may be an unclosed/in-progress day), kept separate from
// daily_summary, which remains the authoritative CLOSED-day record.
const { Pool } = require('pg');
require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const pool = new Pool({
    host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
});

// Host-laptop backup so data entered from ANY computer on the network also
// lands here, independent of the browser's own linked-folder backup.
const BACKUP_DIR = path.join(__dirname, '..', 'backups', 'daily');

// Idempotent migration - own table only, safe to run on every boot.
pool.query(`
    CREATE TABLE IF NOT EXISTS daily_entry_live (
        entry_date date PRIMARY KEY,
        payload jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
    )`).catch(e => console.error('[daily_entry_sync] migration failed:', e.message));
// Same-WiFi live sync (Part 3, 2026-07-21) — which device made the last write,
// so pollers can tell "my own save echoing back" apart from "another device changed this".
pool.query(`ALTER TABLE daily_entry_live ADD COLUMN IF NOT EXISTS updated_by text`)
    .catch(e => console.error('[daily_entry_sync] updated_by migration failed:', e.message));

router.post('/api/daily-entry/sync', async (req, res) => {
    const { date, rows, expenses, payouts, totals, dayRemarks, cash_counted, csv, device_id, pending_advances } = req.body || {};
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'date (YYYY-MM-DD) required' });
    try {
        const payload = {
            date, rows: rows || [], expenses: expenses || [], payouts: payouts || [], totals: totals || {},
            dayRemarks: dayRemarks || '', cash_counted: cash_counted == null ? null : cash_counted,
            pending_advances: pending_advances || [],
        };
        const upd = await pool.query(`
            INSERT INTO daily_entry_live (entry_date, payload, updated_at, updated_by)
            VALUES ($1, $2, now(), $3)
            ON CONFLICT (entry_date) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now(), updated_by = EXCLUDED.updated_by
            RETURNING updated_at`,
            [date, JSON.stringify(payload), device_id || null]);
        // Host-laptop backup — best-effort; a failure here never fails the sync response.
        try {
            fs.mkdirSync(BACKUP_DIR, { recursive: true });
            fs.writeFileSync(path.join(BACKUP_DIR, date + '.json'), JSON.stringify(payload, null, 2));
            if (csv) fs.writeFileSync(path.join(BACKUP_DIR, 'BATHCO_SALES_' + date + '.csv'), csv);
        } catch (fsErr) { console.error('[daily_entry_sync] backup file write failed:', fsErr.message); }
        res.json({ ok: true, updated_at: upd.rows[0].updated_at });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/api/daily-entry/sync/:date', async (req, res) => {
    try {
        const r = await pool.query(`SELECT payload, updated_at, updated_by FROM daily_entry_live WHERE entry_date = $1`, [req.params.date]);
        if (!r.rows.length) return res.status(404).json({ error: 'not found' });
        res.json(Object.assign({}, r.rows[0].payload, { updated_at: r.rows[0].updated_at, updated_by: r.rows[0].updated_by }));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Lightweight polling endpoint (Part 3: same-WiFi live sync) — just the
// version stamp, not the full payload, so devices can poll every few seconds
// without shipping the whole day's data back and forth each time.
router.get('/api/daily-entry/meta/:date', async (req, res) => {
    try {
        const r = await pool.query(`SELECT updated_at, updated_by FROM daily_entry_live WHERE entry_date = $1`, [req.params.date]);
        if (!r.rows.length) return res.json({ updated_at: null, updated_by: null });
        res.json({ updated_at: r.rows[0].updated_at, updated_by: r.rows[0].updated_by });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
