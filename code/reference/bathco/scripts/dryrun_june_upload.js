'use strict';
require('dotenv').config({ path: 'C:/BATHCO_PHASE1/.env' });
const { Pool } = require('pg');
const pool = new Pool({ host: 'localhost', port: 5432, database: 'bathco', user: 'postgres', password: process.env.DB_PASSWORD });

function fmtDate(d) {
    if (d instanceof Date) return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    return String(d).slice(0, 10);
}

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

async function run() {
    const fs = require('fs');
    const dates = FILES.map(f => f[0]);
    const { rows } = await pool.query(
        `SELECT report_date, total_sale, gross_profit, net_profit, gp_status, day_status
         FROM daily_summary WHERE report_date = ANY($1) ORDER BY report_date`,
        [dates]
    );
    const byDate = {};
    rows.forEach(r => { byDate[fmtDate(r.report_date)] = r; });

    console.log('DRY RUN — June 1–15 upload plan\n');
    console.log(('Date').padEnd(12), ('File exists').padEnd(12), ('DB total_sale').padEnd(16), ('gp_status').padEnd(16), ('net_profit').padEnd(14), 'Action');
    console.log('-'.repeat(100));

    let uploadCount = 0;
    for (const [date, file] of FILES) {
        const exists = fs.existsSync(file);
        const db = byDate[date];
        const sale = db ? Number(db.total_sale).toLocaleString() : 'NO ROW';
        const gps  = db ? db.gp_status : 'NO ROW';
        const np   = db ? Number(db.net_profit).toLocaleString() : '—';
        const action = !exists ? 'SKIP (no file)'
                     : !db    ? 'UPLOAD → create row'
                     : gps === 'NOT_AVAILABLE' ? 'UPLOAD → will set GP + NP'
                     : gps === 'ESTIMATE'      ? 'UPLOAD → will refine GP'
                     : 'UPLOAD → already ACTUAL (re-import ok)';
        console.log(date.padEnd(12), String(exists).padEnd(12), sale.padEnd(16), String(gps).padEnd(16), np.padEnd(14), action);
        if (exists) uploadCount++;
    }
    console.log('\nTotal files to upload:', uploadCount, '/ 15');
}

run().then(() => pool.end()).catch(e => { console.error(e.message); pool.end(); });
