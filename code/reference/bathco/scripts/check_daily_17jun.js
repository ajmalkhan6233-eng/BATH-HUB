require('dotenv').config({ path: 'C:/BATHCO_PHASE1/.env' });
const { Pool } = require('pg');
const p = new Pool({ host: process.env.DB_HOST||'localhost', port:5432, database:'bathco', user:'postgres', password: process.env.DB_PASSWORD });

async function run() {
    // 1. Show all columns in daily_summary
    const cols = await p.query(`
        SELECT column_name, data_type, column_default
        FROM information_schema.columns
        WHERE table_name = 'daily_summary'
        ORDER BY ordinal_position`);
    console.log('\n── daily_summary COLUMNS ──');
    cols.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type})`));

    // 2. Current row for 2026-06-17
    const cur = await p.query(`SELECT * FROM daily_summary WHERE date = '2026-06-17'`);
    console.log('\n── CURRENT ROW for 2026-06-17 ──');
    if (cur.rowCount === 0) console.log('  (no row exists yet)');
    else console.log(JSON.stringify(cur.rows[0], null, 2));

    process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });
