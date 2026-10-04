'use strict';
/**
 * Standalone import: Jun 1–15 daily xlsx files → daily_summary
 * Updates payment splits (cash/card/online/cheq/credit) and invoice details.
 * Does NOT touch gross_profit or gp_status — these files are Type A (no GP data).
 * Run with --dry to preview without writing.
 */
require('dotenv').config({ path: 'C:/BATHCO_PHASE1/.env' });
const XLSX = require('xlsx');
const fs   = require('fs');
const { Pool } = require('pg');
const pool = new Pool({ host: 'localhost', port: 5432, database: 'bathco', user: 'postgres', password: process.env.DB_PASSWORD });

const DRY = process.argv.includes('--dry');

const FILES = [
    ['2026-06-01', 'C:/Users/DELL/Desktop/1122/DAY SALE/01-06-2026.xlsx'],
    ['2026-06-02', 'C:/Users/DELL/Desktop/1122/DAY SALE/02-06-2026.xlsx'],
    ['2026-06-03', 'C:/Users/DELL/Desktop/1122/DAY SALE/03-06-2026.xlsx'],
    ['2026-06-04', 'C:/Users/DELL/Desktop/1122/DAY SALE/04-06-2026.xlsx'],
    ['2026-06-05', 'C:/Users/DELL/Desktop/1122/DAY SALE/05-06-2026.xlsx'],
    ['2026-06-06', 'C:/Users/DELL/Desktop/1122/DAY SALE/06-06-2026.xlsx'],
    ['2026-06-07', 'C:/Users/DELL/Desktop/1122/DAY SALE/07-06-2026.xlsx'],
    ['2026-06-08', 'C:/Users/DELL/Desktop/1122/DAY SALE/08-06-2026.xlsx'],
    ['2026-06-09', 'C:/Users/DELL/Desktop/1122/DAY SALE/09-06-2026.xlsx'],
    ['2026-06-10', 'C:/Users/DELL/Desktop/1122/DAY SALE/10-06-2026.xlsx'],
    ['2026-06-11', 'C:/Users/DELL/Desktop/1122/DAY SALE/11-06-2026.xlsx'],
    ['2026-06-12', 'C:/Users/DELL/Desktop/1122/DAY SALE/12-06-2026.xlsx'],
    ['2026-06-13', 'C:/Users/DELL/Desktop/1122/DAY SALE/13-06-2026.xlsx'],
    ['2026-06-14', 'C:/Users/DELL/Desktop/1122/DAY SALE/14-06-2026.xlsx'],
    ['2026-06-15', 'C:/Users/DELL/Desktop/1122/DAY SALE/15-06-2026.xlsx'],
];

function parseXlsx(filePath, dateStr) {
    const wb   = XLSX.read(fs.readFileSync(filePath), { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: 0 });
    if (!rows.length) return null;

    const col = (row, ...cands) => {
        for (const c of cands) {
            const k = Object.keys(row).find(k => String(k).trim().toUpperCase() === c);
            if (k !== undefined) return parseFloat(row[k]) || 0;
        }
        return 0;
    };
    const strCol = (row, ...cands) => {
        for (const c of cands) {
            const k = Object.keys(row).find(k => String(k).trim().toUpperCase() === c);
            if (k !== undefined) return String(row[k]).trim();
        }
        return '';
    };

    let saleA = 0, cardA = 0, onlineA = 0, cheqA = 0, creditA = 0;
    const invoices = [];

    for (const r of rows) {
        const sale   = col(r, 'SALES', 'SALE');
        const card   = col(r, 'CARD PAYMENT', 'CARD');
        const online = col(r, 'ONLINE PAYMENT', 'ONLINE');
        const cheq   = col(r, 'CHEQ PAYMENT', 'CHEQUE PAYMENT', 'CHECK PAYMENT');
        const credit = col(r, 'CREDIT');
        const inv    = strCol(r, 'RECEPT NO', 'RECEIPT NO', 'RECEIPT NUMBER', 'RECPT NO');
        if (!sale && !card && !online && !cheq && !credit) continue;
        saleA   += sale;
        cardA   += card;
        onlineA += online;
        cheqA   += cheq;
        creditA += credit;
        if (inv) invoices.push({ number: inv, amount: sale, payment: credit > 0 ? 'CREDIT' : 'CASH' });
    }

    const cashA = Math.max(0, saleA - cardA - onlineA - cheqA - creditA);
    return { saleA, cashA, cardA, onlineA, cheqA, creditA, invoices };
}

async function run() {
    console.log(DRY ? '=== DRY RUN ===' : '=== IMPORTING ===');
    console.log('Files:', FILES.length, '| Dates: Jun 1–15 2026');
    console.log('NOTE: These are Type A (daily sales Excel) — updates payment splits only.');
    console.log('      gross_profit / gp_status will NOT change (no GP data in these files).');
    console.log('-'.repeat(80));

    let ok = 0, skip = 0, fail = 0;
    for (const [date, file] of FILES) {
        process.stdout.write(date + '  ');
        try {
            const p = parseXlsx(file, date);
            if (!p) { console.log('SKIP (empty file)'); skip++; continue; }

            // Check existing DB row
            const ex = await pool.query(
                'SELECT total_sale, cash_sale, card_sale, online_sale, cheq_payment, credit_sale, details FROM daily_summary WHERE report_date=$1',
                [date]
            );
            const row = ex.rows[0];
            if (!row) { console.log('SKIP (no DB row — date not in daily_summary)'); skip++; continue; }

            const diff = Math.abs(p.saleA - parseFloat(row.total_sale || 0));
            if (diff > 50) {
                console.log('CONFLICT  xlsx_total=' + p.saleA.toLocaleString() + '  db_total=' + Number(row.total_sale).toLocaleString() + '  diff=' + diff.toLocaleString());
                skip++; continue;
            }

            console.log(
                'cash=' + p.cashA.toLocaleString().padStart(8) +
                '  card=' + p.cardA.toLocaleString().padStart(7) +
                '  online=' + p.onlineA.toLocaleString().padStart(7) +
                '  cheq=' + p.cheqA.toLocaleString().padStart(7) +
                '  credit=' + p.creditA.toLocaleString().padStart(8) +
                '  invoices=' + p.invoices.length
            );

            if (!DRY) {
                // Merge invoice rows into existing details JSONB
                const det = row.details || {};
                if (p.invoices.length && !det.lasersoft_invoices?.length) {
                    det.lasersoft_invoices = p.invoices;
                }
                await pool.query(
                    `UPDATE daily_summary SET
                       cash_sale=$1, card_sale=$2, online_sale=$3,
                       cheq_payment=$4, credit_sale=$5,
                       details=$6, sales_source='excel_import', updated_at=NOW()
                     WHERE report_date=$7`,
                    [p.cashA, p.cardA, p.onlineA, p.cheqA, p.creditA, JSON.stringify(det), date]
                );
            }
            ok++;
        } catch (e) {
            console.log('ERROR  ' + e.message.slice(0, 100));
            fail++;
        }
    }

    console.log('-'.repeat(80));
    console.log('Result:', ok, 'updated,', skip, 'skipped,', fail, 'errors' + (DRY ? ' (DRY RUN — nothing written)' : ''));
    console.log();
    console.log('Next step for GP: upload Lasersoft daily printout photos (WhatsApp images)');
    console.log('for Jun 1–15 via the dashboard, same as you did for Jun 16/17.');
    console.log('That will set gp_status=ACTUAL and calculate net_profit for each day.');
}

run().then(() => pool.end()).catch(e => { console.error(e.message); pool.end(); });
