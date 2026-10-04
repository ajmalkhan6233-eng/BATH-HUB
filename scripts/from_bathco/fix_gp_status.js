require('dotenv').config({ path: 'C:/BATHCO_PHASE1/.env' });
const { Pool } = require('pg');
const p = new Pool({ host: process.env.DB_HOST||'localhost', port:5432, database:'bathco', user:'postgres', password: process.env.DB_PASSWORD });
p.query(`UPDATE daily_summary SET gp_status='ACTUAL', updated_at=NOW() WHERE report_date='2026-06-17'
         RETURNING report_date, gp_status, gross_profit, total_expenses, net_profit, day_status`)
 .then(r => { console.log('Fixed:', JSON.stringify(r.rows[0])); process.exit(0); })
 .catch(e => { console.error(e.message); process.exit(1); });
