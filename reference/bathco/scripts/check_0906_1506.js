'use strict';
require('dotenv').config({ path: 'C:/BATHCO_PHASE1/.env' });
const { Pool } = require('pg');
const pool = new Pool({ host: 'localhost', port: 5432, database: 'bathco', user: 'postgres', password: process.env.DB_PASSWORD });

function fmtDate(d) {
    if (d instanceof Date) return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    return String(d).slice(0, 10);
}

async function run() {
    const rows = await pool.query(
        `SELECT report_date, total_sale, gross_profit, total_expenses, net_profit,
                gp_status, day_status, checker_flags
         FROM daily_summary
         WHERE report_date IN ('2026-06-09','2026-06-15')
         ORDER BY report_date`
    );
    rows.rows.forEach(r => {
        console.log('Date:       ', fmtDate(r.report_date));
        console.log('total_sale: ', r.total_sale);
        console.log('gross_profit:', r.gross_profit);
        console.log('total_expenses:', r.total_expenses);
        console.log('net_profit: ', r.net_profit);
        console.log('gp_status:  ', r.gp_status);
        console.log('day_status: ', r.day_status);
        console.log('flags:      ', r.checker_flags);
        console.log('---');
    });
}

run().then(() => pool.end()).catch(e => { console.error(e.message); pool.end(); });
