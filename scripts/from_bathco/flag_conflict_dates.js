'use strict';
require('dotenv').config({ path: 'C:/BATHCO_PHASE1/.env' });
const { Pool } = require('pg');
const pool = new Pool({ host: 'localhost', port: 5432, database: 'bathco', user: 'postgres', password: process.env.DB_PASSWORD });

async function run() {
    // Jun 9: keep DB, flag reconciliation, note HSL000447
    await pool.query(`
        UPDATE daily_summary SET
            sales_conflict = TRUE,
            sales_conflict_excel = 910300,
            checker_flags = (
                SELECT jsonb_agg(DISTINCT v)
                FROM jsonb_array_elements_text(COALESCE(checker_flags::jsonb, '[]'::jsonb) || '["PENDING_RECONCILIATION"]'::jsonb) v
            ),
            updated_at = NOW()
        WHERE report_date = '2026-06-09'`);
    // Store note in details
    const r9 = await pool.query(`SELECT details FROM daily_summary WHERE report_date='2026-06-09'`);
    const d9 = r9.rows[0]?.details || {};
    d9.reconciliation_note = 'xlsx total 910,300 vs DB 1,387,300. Known gap: HSL000447 (Zuhail Akam Transport 237,300) not in xlsx. DB figure kept as authoritative. Needs full reconciliation against Lasersoft invoice list.';
    await pool.query(`UPDATE daily_summary SET details=$1 WHERE report_date='2026-06-09'`, [JSON.stringify(d9)]);
    console.log('Jun 9: flagged PENDING_RECONCILIATION, HSL000447 note written, DB figure kept.');

    // Jun 10: flag for manual review only — no data change
    const r10 = await pool.query(`SELECT details FROM daily_summary WHERE report_date='2026-06-10'`);
    const d10 = r10.rows[0]?.details || {};
    d10.reconciliation_note = 'MANUAL REVIEW REQUIRED. xlsx total 604,190 vs DB 190,540 (diff +413,650). xlsx may be more complete. Do not auto-resolve — Ajmal to compare invoice lists.';
    await pool.query(`
        UPDATE daily_summary SET
            details=$1,
            checker_flags = (
                SELECT jsonb_agg(DISTINCT v)
                FROM jsonb_array_elements_text(COALESCE(checker_flags::jsonb, '[]'::jsonb) || '["MANUAL_REVIEW_REQUIRED"]'::jsonb) v
            ),
            updated_at = NOW()
        WHERE report_date = '2026-06-10'`, [JSON.stringify(d10)]);
    console.log('Jun 10: flagged MANUAL_REVIEW_REQUIRED, no data changed.');

    // Jun 11: flag for re-export, keep DB
    const r11 = await pool.query(`SELECT details FROM daily_summary WHERE report_date='2026-06-11'`);
    const d11 = r11.rows[0]?.details || {};
    d11.reconciliation_note = 'Excel file 11-06-2026.xlsx appears empty (0 rows). DB figure 944,950 kept. Action: re-export Jun 11 from Lasersoft and re-upload.';
    await pool.query(`
        UPDATE daily_summary SET
            details=$1,
            checker_flags = (
                SELECT jsonb_agg(DISTINCT v)
                FROM jsonb_array_elements_text(COALESCE(checker_flags::jsonb, '[]'::jsonb) || '["REUPLOAD_REQUIRED"]'::jsonb) v
            ),
            updated_at = NOW()
        WHERE report_date = '2026-06-11'`, [JSON.stringify(d11)]);
    console.log('Jun 11: flagged REUPLOAD_REQUIRED (empty Excel), DB figure kept.');

    // Jun 15: flag for re-upload, keep DB
    const r15 = await pool.query(`SELECT details FROM daily_summary WHERE report_date='2026-06-15'`);
    const d15 = r15.rows[0]?.details || {};
    d15.reconciliation_note = 'Excel file 15-06-2026.xlsx incomplete (xlsx total 95,830 vs DB 418,860). DB figure kept. Action: re-export Jun 15 from Lasersoft and re-upload correct Excel.';
    await pool.query(`
        UPDATE daily_summary SET
            details=$1,
            checker_flags = (
                SELECT jsonb_agg(DISTINCT v)
                FROM jsonb_array_elements_text(COALESCE(checker_flags::jsonb, '[]'::jsonb) || '["REUPLOAD_REQUIRED"]'::jsonb) v
            ),
            updated_at = NOW()
        WHERE report_date = '2026-06-15'`, [JSON.stringify(d15)]);
    console.log('Jun 15: flagged REUPLOAD_REQUIRED (incomplete Excel), DB figure kept.');
}

run().then(() => pool.end()).catch(e => { console.error(e.message); pool.end(); });
