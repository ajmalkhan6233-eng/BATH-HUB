'use strict';
/**
 * import_ocr_expenses.js
 *
 * Reads ocr_expense_results.json, re-runs the same aggregation logic
 * as the Python script, then UPDATEs daily_summary rows in the live DB.
 *
 * Rules:
 *   - Only updates dates where a daily_summary row ALREADY EXISTS
 *   - Only updates rows where total_expenses is currently 0 or NULL
 *     (manual entries win — OCR never overwrites human input)
 *   - Sets day_status='ESTIMATED' and expenses_source='ocr_photo'
 *   - Recalculates net_profit if gp_status='ACTUAL' (Lasersoft confirmed)
 *   - Skips 'error' and 'skipped' (timeout) photo results silently
 *   - Dry-run mode: node import_ocr_expenses.js --dry-run
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const path  = require('path');
const fs    = require('fs');
const { Pool } = require('pg');

const RESULTS_JSON  = path.join(__dirname, 'ocr_expense_results.json');
const DRY_RUN       = process.argv.includes('--dry-run');

// ── DB connection (uses same env vars as server.js / layla.js) ──────────────
const pool = new Pool({
    host:     process.env.DB_HOST     || process.env.PGHOST     || 'localhost',
    port:     process.env.DB_PORT     || process.env.PGPORT     || 5432,
    database: process.env.DB_NAME     || process.env.PGDATABASE,
    user:     process.env.DB_USER     || process.env.PGUSER,
    password: process.env.DB_PASSWORD || process.env.PGPASSWORD,
    ssl:      process.env.DB_SSL      === 'true' ? { rejectUnauthorized: false } : false,
});

// ── Re-implement Python aggregation logic in JS ──────────────────────────────
function aggregateByDate(allResults) {
    const safe = v => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };

    // Group by date from filename (skip errors/timeouts)
    const byDate = {};
    for (const r of allResults) {
        if (!r._file) continue;
        if (r.confidence === 'error' || r.confidence === 'skipped') continue;
        const m = r._file.match(/(\d{4}-\d{2}-\d{2})/);
        if (!m) continue;
        const date = m[1];
        (byDate[date] = byDate[date] || []).push(r);
    }

    const out = {};
    for (const [date, photos] of Object.entries(byDate)) {
        // Summary sheets: sheet_type=daily_summary OR total_sale > 0
        const summarySheets = photos.filter(r =>
            r.sheet_type === 'daily_summary' || safe(r.total_sale) > 0
        );

        if (summarySheets.length > 0) {
            // Use the summary sheet with the highest total_expenses
            const best = summarySheets.reduce((a, b) =>
                safe(a.total_expenses) >= safe(b.total_expenses) ? a : b
            );
            const total = safe(best.total_expenses);
            if (total > 0) {
                out[date] = {
                    total, method: 'summary_sheet',
                    confidence: best.confidence,
                    sourceFile: best._file,
                    items: best.expense_items || '',
                };
            }
            continue;
        }

        // No summary sheet: sum unique expense items across all photos
        const allItems = {};
        for (const r of photos) {
            for (const part of (r.expense_items || '').split(',')) {
                const t = part.trim();
                const colon = t.lastIndexOf(':');
                if (colon < 0) continue;
                const desc = t.slice(0, colon).trim();
                const amt  = parseFloat(t.slice(colon + 1).replace(/,/g, ''));
                if (!desc || isNaN(amt) || amt <= 0) continue;
                const key = `${desc.toLowerCase()}:${Math.round(amt)}`;
                allItems[key] = { desc, amt };
            }
        }
        if (Object.keys(allItems).length > 0) {
            const total = Object.values(allItems).reduce((s, { amt }) => s + amt, 0);
            const lowConf = photos.filter(r => r.confidence === 'low').length;
            out[date] = {
                total, method: 'sum_of_items',
                confidence: lowConf === 0 ? 'medium' : 'low',
                sourceFile: 'multiple',
                items: Object.values(allItems).map(({ desc, amt }) => `${desc}:${amt}`).join(', '),
            };
            continue;
        }

        // Final fallback: sum total_expenses fields
        const total = photos.reduce((s, r) => s + safe(r.total_expenses), 0);
        if (total > 0) {
            out[date] = {
                total, method: 'sum_of_totals',
                confidence: 'low', sourceFile: 'multiple', items: '',
            };
        }
    }
    return out;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
    console.log(`=== BATHCO OCR EXPENSE IMPORT${DRY_RUN ? ' [DRY RUN]' : ''} ===\n`);

    // Load OCR results
    if (!fs.existsSync(RESULTS_JSON)) {
        console.error('ERROR: ocr_expense_results.json not found. Run the OCR script first.');
        process.exit(1);
    }
    const allResults = JSON.parse(fs.readFileSync(RESULTS_JSON, 'utf8'));
    console.log(`Loaded ${allResults.length} photo OCR records from JSON`);

    // Aggregate per date
    const expByDate = aggregateByDate(allResults);
    const dates = Object.keys(expByDate).sort();
    console.log(`\nAggregated expense data for ${dates.length} date(s):`);
    for (const d of dates) {
        const a = expByDate[d];
        console.log(`  ${d}  expenses=${a.total.toLocaleString()}  method=${a.method}  conf=${a.confidence}`);
    }

    if (dates.length === 0) {
        console.log('\nNothing to import.'); await pool.end(); return;
    }

    // Fetch DB state for all target dates in one query
    const { rows: dbRows } = await pool.query(
        `SELECT report_date::text AS date_str,
                total_expenses, gp_status, gross_profit, net_profit,
                expenses_source, day_status
         FROM daily_summary
         WHERE report_date = ANY($1::date[])`,
        [dates]
    );
    const dbByDate = {};
    for (const r of dbRows) dbByDate[r.date_str] = r;

    console.log(`\nDB rows found for target dates: ${dbRows.length} / ${dates.length}`);

    // Process each date
    const updated   = [];
    const skipped   = [];
    const notInDb   = [];

    for (const date of dates) {
        const agg = expByDate[date];
        const db  = dbByDate[date];

        if (!db) {
            notInDb.push({ date, reason: 'no daily_summary row — day never entered' });
            continue;
        }

        const existingExp = parseFloat(db.total_expenses) || 0;
        if (existingExp > 0) {
            skipped.push({
                date,
                reason: `already has expenses=${existingExp.toLocaleString()} from source=${db.expenses_source || 'unknown'} — not overwriting`,
            });
            continue;
        }

        // UPDATE the row
        if (!DRY_RUN) {
            // Set expenses + source + day_status
            await pool.query(
                `UPDATE daily_summary
                 SET total_expenses = $1,
                     expenses_source = 'ocr_photo',
                     day_status = 'ESTIMATED',
                     updated_at = NOW()
                 WHERE report_date = $2`,
                [agg.total, date]
            );

            // Recalculate net_profit if GP is confirmed from Lasersoft
            if (db.gp_status === 'ACTUAL' && parseFloat(db.gross_profit) > 0) {
                await pool.query(
                    `UPDATE daily_summary
                     SET net_profit = ROUND(gross_profit - $1, 2)
                     WHERE report_date = $2`,
                    [agg.total, date]
                );
            }
        }

        const gp  = parseFloat(db.gross_profit) || 0;
        const np  = db.gp_status === 'ACTUAL' && gp > 0 ? gp - agg.total : null;
        updated.push({
            date,
            expenses: agg.total,
            method:   agg.method,
            confidence: agg.confidence,
            gp_status: db.gp_status,
            net_profit: np,
        });
    }

    // ── Report ───────────────────────────────────────────────────────────────
    console.log(`\n── Updated (${updated.length}) ──`);
    for (const u of updated) {
        const npStr = u.net_profit !== null
            ? `  → Net Profit = ${u.net_profit.toLocaleString()}`
            : `  (NP not recalculated — gp_status=${u.gp_status})`;
        console.log(`  ${u.date}  expenses=${u.expenses.toLocaleString()}  [${u.method}, ${u.confidence}]${npStr}`);
    }

    if (skipped.length > 0) {
        console.log(`\n── Skipped — existing manual data protected (${skipped.length}) ──`);
        for (const s of skipped) console.log(`  ${s.date}: ${s.reason}`);
    }

    if (notInDb.length > 0) {
        console.log(`\n── Not in DB — no row to update (${notInDb.length}) ──`);
        for (const n of notInDb) console.log(`  ${n.date}: ${n.reason}`);
    }

    console.log(`\n=== DONE${DRY_RUN ? ' [DRY RUN — no changes written]' : ''} ===`);
    console.log(`Updated: ${updated.length}  |  Skipped (had data): ${skipped.length}  |  Not in DB: ${notInDb.length}`);

    await pool.end();
}

if (require.main === module) {
    main().catch(e => { console.error('FATAL:', e.message); pool.end(); process.exit(1); });
}

module.exports = { aggregateByDate };
