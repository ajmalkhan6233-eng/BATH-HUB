require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'bathco',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
});

(async () => {
    const preview = await pool.query(`
        SELECT report_date, cash_received, payments, expenses_source
        FROM daily_summary
        WHERE expenses_source = 'handwritten_log' AND payments = 0 AND cash_received > 0
        ORDER BY report_date`);
    console.log('Rows to migrate:', preview.rows.length);
    preview.rows.forEach(r =>
        console.log(' ', r.report_date, ' cash_received:', r.cash_received, '→ payments'));

    const res = await pool.query(`
        UPDATE daily_summary
        SET payments = cash_received, cash_received = 0
        WHERE expenses_source = 'handwritten_log' AND payments = 0 AND cash_received > 0`);
    console.log('Updated rows:', res.rowCount);
    await pool.end();
})().catch(e => { console.error(e.message); process.exit(1); });
