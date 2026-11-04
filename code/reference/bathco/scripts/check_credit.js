'use strict';
require('dotenv').config({ path: 'C:/BATHCO_PHASE1/.env' });
const { Pool } = require('pg');
const pool = new Pool({ host: 'localhost', port: 5432, database: 'bathco', user: 'postgres', password: process.env.DB_PASSWORD });

function fmtDate(d) {
    if (d instanceof Date) return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    return String(d).slice(0, 10);
}

async function run() {
    // Schema
    const cols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='credit_customers' ORDER BY ordinal_position");
    console.log('credit_customers columns:', cols.rows.map(r => r.column_name).join(', '));

    const rows = await pool.query('SELECT * FROM credit_customers ORDER BY id');
    console.log('\n=== CREDIT CUSTOMERS ===');
    rows.rows.forEach(r => console.log(JSON.stringify(r)));

    const sum = await pool.query('SELECT SUM(credit_sale) as s FROM daily_summary WHERE credit_sale > 0');
    console.log('\nSUM of credit_sale in daily_summary:', sum.rows[0].s);

    const daily = await pool.query('SELECT report_date, credit_sale FROM daily_summary WHERE credit_sale > 0 ORDER BY report_date');
    console.log('\n=== DAILY credit_sale entries ===');
    daily.rows.forEach(r => console.log(fmtDate(r.report_date), '+', r.credit_sale));
}

run().then(() => pool.end()).catch(e => { console.error(e.message); pool.end(); });
