/**
 * Daily Reconciliation Check
 * Runs automatically as part of the daily update pipeline.
 * Reports flagged days only — confirmed days produce no output.
 *
 * Checks per day:
 *  1. Sales arithmetic     — cash+card+online+credit+cheq vs total_sale (>1% gap)
 *  2. Net profit arithmetic — gross_profit - total_expenses vs net_profit (>1 LKR gap)
 *  3. GP status gaps       — NOT_AVAILABLE or ESTIMATE after T+2 (no POS report uploaded)
 *  4. High expense ratio   — total_expenses > 60% of total_sale
 *  5. Negative net profit  — net_profit < 0 (loss day)
 *  6. Cash shortfall       — cash_in_hand < -10,000 (implausible)
 *  7. Missing expense entry — total_expenses = 0 and total_sale > 0
 *  8. Pending reconciliation — lasersoft_invoices contains PENDING_RECONCILIATION items
 *  9. Unresolved sales conflict — sales_conflict = true
 * 10. Invoice gap          — invoice_seq_start exists but seq jump > 20 vs prior day
 */

'use strict';
require('dotenv').config();
const { Pool } = require('pg');

const _dbSsl = process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('.railway.internal')
    ? { rejectUnauthorized: false } : false;
const pool = process.env.DATABASE_URL
    ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: _dbSsl })
    : new Pool({
        host:     process.env.DB_HOST     || 'localhost',
        port:     process.env.DB_PORT     || 5432,
        database: process.env.DB_NAME     || 'bathco_template',
        user:     process.env.DB_USER     || 'postgres',
        password: process.env.DB_PASSWORD,
    });

const TOLERANCE_PCT  = 0.01;   // 1% allowed rounding gap in sales breakdown
const EXPENSE_RATIO  = 0.60;   // flag when expenses > 60% of sales
const GP_STALE_DAYS  = 2;      // flag NOT_AVAILABLE / ESTIMATE if day is older than this

function seqNum(s) {
    const m = String(s || '').match(/(\d+)$/);
    return m ? parseInt(m[1], 10) : null;
}

async function runCheck({ since, until, quiet = false } = {}) {
    const today = new Date().toISOString().slice(0, 10);
    const from  = since || '2026-01-01';
    const to    = until || today;

    const { rows } = await pool.query(
        `SELECT report_date, total_sale, cash_sale, card_sale, online_sale, credit_sale,
                cheq_payment, gross_profit, net_profit, total_expenses, cash_in_hand,
                gp_status, day_status, sales_conflict, sales_conflict_excel,
                invoice_seq_start, invoice_seq_end,
                checker_flags, details, gp_blend_note
         FROM daily_summary
         WHERE report_date BETWEEN $1 AND $2
         ORDER BY report_date ASC`,
        [from, to]
    );

    const flagged = [];
    let prevSeqEnd = null;
    const staleThreshold = new Date(today);
    staleThreshold.setDate(staleThreshold.getDate() - GP_STALE_DAYS);
    const staleCutoff = staleThreshold.toISOString().slice(0, 10);

    for (const r of rows) {
        const issues = [];
        // pg returns DATE as a JS Date object at local midnight — don't use toISOString()
        // (UTC offset would shift to the previous calendar day in IST +5:30)
        const dateStr = r.report_date instanceof Date
            ? `${r.report_date.getFullYear()}-${String(r.report_date.getMonth()+1).padStart(2,'0')}-${String(r.report_date.getDate()).padStart(2,'0')}`
            : String(r.report_date).slice(0, 10);

        const ts  = +r.total_sale       || 0;
        const cs  = +r.cash_sale        || 0;
        const ks  = +r.card_sale        || 0;
        const os  = +r.online_sale      || 0;
        const cr  = +r.credit_sale      || 0;
        const chq = +r.cheq_payment     || 0;
        const gp  = +r.gross_profit     || 0;
        const np  = +r.net_profit       || 0;
        const exp = +r.total_expenses   || 0;
        const cih = +r.cash_in_hand     || 0;

        // 1. Sales breakdown arithmetic
        if (ts > 0) {
            const breakdown = cs + ks + os + cr + chq;
            if (breakdown > 0 && Math.abs(ts - breakdown) > ts * TOLERANCE_PCT) {
                issues.push({
                    code: 'SALES_ARITHMETIC',
                    detail: `total_sale ${ts.toLocaleString()} ≠ cash+card+online+credit+cheq ${breakdown.toLocaleString()} (gap ${Math.abs(ts - breakdown).toLocaleString()})`,
                });
            }
        }

        // 2. Net profit arithmetic
        if (exp > 0 && r.gp_status !== 'NOT_AVAILABLE') {
            const expected = Math.round((gp - exp) * 100) / 100;
            if (Math.abs(expected - np) > 1) {
                issues.push({
                    code: 'NP_ARITHMETIC',
                    detail: `net_profit ${np.toLocaleString()} ≠ gross_profit ${gp.toLocaleString()} − expenses ${exp.toLocaleString()} = ${expected.toLocaleString()} (gap ${Math.abs(expected - np).toLocaleString()})`,
                });
            }
        }

        // 3. Stale GP status
        if ((r.gp_status === 'NOT_AVAILABLE' || r.gp_status === 'ESTIMATE') && dateStr <= staleCutoff) {
            issues.push({
                code: 'GP_STALE',
                detail: `gp_status=${r.gp_status} — POS report not uploaded (day is >${GP_STALE_DAYS}d old)`,
            });
        }

        // 4. High expense ratio
        if (ts > 0 && exp > 0 && exp / ts > EXPENSE_RATIO) {
            issues.push({
                code: 'HIGH_EXPENSE_RATIO',
                detail: `expenses ${exp.toLocaleString()} = ${(exp / ts * 100).toFixed(1)}% of sales ${ts.toLocaleString()} (threshold ${EXPENSE_RATIO * 100}%)`,
            });
        }

        // 5. Negative net profit (loss day)
        if (np < -1000 && exp > 0) {
            issues.push({
                code: 'LOSS_DAY',
                detail: `net_profit = −${Math.abs(np).toLocaleString()} LKR`,
            });
        }

        // 6. Cash shortfall
        if (cih < -10000) {
            issues.push({
                code: 'CASH_SHORTFALL',
                detail: `cash_in_hand = ${cih.toLocaleString()} LKR (implausible negative)`,
            });
        }

        // 7. Missing expense entry
        if (ts > 0 && exp === 0 && r.gp_status !== 'NOT_AVAILABLE') {
            issues.push({
                code: 'NO_EXPENSES',
                detail: `total_expenses = 0 despite sales of ${ts.toLocaleString()} — expense sheet not entered`,
            });
        }

        // 8. Pending reconciliation in invoice detail
        const det = r.details || {};
        const lsInvs = det.lasersoft_invoices || [];
        const afterHours = det.after_hours_receipts || [];
        const pending = afterHours.filter(i => i.status === 'PENDING_RECONCILIATION');
        if (pending.length) {
            issues.push({
                code: 'PENDING_RECONCILIATION',
                detail: `${pending.length} receipt(s) pending reconciliation: ${pending.map(i => `#${i.number} LKR ${i.amount}`).join(', ')}`,
            });
        }

        // 9. Unresolved sales conflict (Excel vs manual entry)
        if (r.sales_conflict) {
            issues.push({
                code: 'SALES_CONFLICT',
                detail: `manual entry ${ts.toLocaleString()} ≠ Excel ${(+r.sales_conflict_excel || 0).toLocaleString()} — open Daily Entry to resolve`,
            });
        }

        // 10. Invoice sequence jump
        if (r.invoice_seq_start && prevSeqEnd !== null) {
            const curStart = seqNum(r.invoice_seq_start);
            const gap = curStart !== null ? curStart - prevSeqEnd - 1 : null;
            if (gap !== null && gap > 20) {
                issues.push({
                    code: 'INVOICE_SEQ_GAP',
                    detail: `sequence jumps from …${prevSeqEnd} to ${r.invoice_seq_start} (gap ${gap} invoices)`,
                });
            }
        }
        if (r.invoice_seq_end) prevSeqEnd = seqNum(r.invoice_seq_end);

        // Write checker_flags back to DB so dashboard badge can read them
        const flagCodes = issues.map(i => i.code);
        await pool.query(
            `UPDATE daily_summary SET checker_flags=$1, updated_at=NOW() WHERE report_date=$2`,
            [JSON.stringify(flagCodes), dateStr]
        );

        if (issues.length) {
            flagged.push({ date: dateStr, issues });
        }
    }

    if (!quiet) {
        if (flagged.length === 0) {
            console.log(`✓ All ${rows.length} days clean (${from} → ${to})`);
        } else {
            console.log(`\n⚑ ${flagged.length} flagged / ${rows.length} checked (${from} → ${to})\n`);
            for (const { date, issues } of flagged) {
                console.log(`  ${date}`);
                for (const iss of issues) {
                    console.log(`    [${iss.code}] ${iss.detail}`);
                }
            }
            console.log('');
        }
    }

    return { checked: rows.length, flagged: flagged.length, flags: flagged };
}

// ── CLI entry-point ──────────────────────────────────────────────────────────
if (require.main === module) {
    const args = process.argv.slice(2);
    const since = args.find(a => a.startsWith('--since='))?.split('=')[1];
    const until = args.find(a => a.startsWith('--until='))?.split('=')[1];
    const date  = args.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a));
    runCheck({ since: date || since, until: date || until })
        .then(r => { pool.end(); process.exitCode = r.flagged > 0 ? 1 : 0; })
        .catch(e => { console.error(e.message); pool.end(); process.exitCode = 2; });
}

module.exports = { runCheck };
