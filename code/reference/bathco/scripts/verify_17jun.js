require('dotenv').config({ path: 'C:/BATHCO_PHASE1/.env' });
const { Pool } = require('pg');
const p = new Pool({ host: process.env.DB_HOST||'localhost', port:5432, database:'bathco', user:'postgres', password: process.env.DB_PASSWORD });

p.query(`SELECT
    report_date, total_sale, lasersoft_total, cash_sale, card_sale, online_sale,
    cheq_payment, credit_sale, total_expenses, salary, payments,
    gross_profit, net_profit, cash_in, cash_out, cash_in_hand,
    staff_payments_total, day_status, reconciliation_status,
    invoice_seq_start, invoice_seq_end,
    checker_flags->>'pending_reconciliation' as pending,
    jsonb_array_length(checker_flags->'discrepancies') as flag_count,
    (details->'staff_commission_note'->>'total')::numeric as commission_total,
    (details->'staff_salary_note'->>'total')::numeric as salary_note_total,
    (details->>'staff_payments_total')::numeric as staff_payments_combined,
    photo_data->>'count' as photo_count
FROM daily_summary WHERE report_date = '2026-06-17'`)
.then(r => {
    if (!r.rowCount) { console.log('No row found for 2026-06-17'); process.exit(1); }
    const row = r.rows[0];
    console.log('\n══ FINAL DB STATE — 2026-06-17 ══\n');
    console.log(`  total_sale           ${row.total_sale}  (Lasersoft 116,460 + receipt 433 20,700)`);
    console.log(`  lasersoft_total      ${row.lasersoft_total}`);
    console.log(`  cash_sale            ${row.cash_sale}`);
    console.log(`  card_sale            ${row.card_sale}`);
    console.log(`  online_sale          ${row.online_sale}  (SL001950 — FLAGGED Excel/Lasersoft discrepancy)`);
    console.log(`  cheq_payment         ${row.cheq_payment}`);
    console.log(`  credit_sale          ${row.credit_sale}`);
    console.log(`  total_expenses       ${row.total_expenses}  (non-salary: 7500+18000+1000+3350+230)`);
    console.log(`  salary               ${row.salary}  (from salary notepad)`);
    console.log(`  payments             ${row.payments}`);
    console.log(`  gross_profit         ${row.gross_profit}  (Lasersoft GPA confirmed)`);
    console.log(`  net_profit           ${row.net_profit}  (12729.32 - 56580)`);
    console.log(`  cash_in              ${row.cash_in}`);
    console.log(`  cash_out             ${row.cash_out}`);
    console.log(`  cash_in_hand         ${row.cash_in_hand}  (verified from handwritten)`);
    console.log(`  staff_payments_total ${row.staff_payments_total}  (commission 19350 + salary 26500)`);
    console.log(`  day_status           ${row.day_status}`);
    console.log(`  reconciliation       ${row.reconciliation_status}`);
    console.log(`  invoice_range        ${row.invoice_seq_start} → ${row.invoice_seq_end}`);
    console.log(`  pending_flags        ${row.flag_count} discrepancies recorded`);
    console.log(`  commission_note      ${row.commission_total} (stored in details)`);
    console.log(`  salary_note          ${row.salary_note_total} (stored in details)`);
    console.log(`  photos_uploaded      ${row.photo_count}`);
    process.exit(0);
})
.catch(e => { console.error('ERROR:', e.message); process.exit(1); });
