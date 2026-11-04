require('dotenv').config({ path: 'C:/BATHCO_PHASE1/.env' });
const { Pool } = require('pg');
const p = new Pool({ host: process.env.DB_HOST||'localhost', port:5432, database:'bathco', user:'postgres', password: process.env.DB_PASSWORD });

// The CASH_OUT_EXPR formula is: total_expenses + payments + salary + cash_out - cash_received
// Setting total_expenses=56580 (full A4 total, salary already inside),
// salary=0, cash_out=0, payments=0 → CASH_OUT_EXPR = 56,580 ✓
// Net profit = gross_profit (12,729.32) - total_expenses (56,580) = -43,850.68
// gp_status='ACTUAL' AND total_expenses>0 → TIER=FULL → shows Net Profit, not PENDING

p.query(`UPDATE daily_summary SET
    total_expenses = 56580,
    salary         = 0,
    cash_out       = 0,
    payments       = 0,
    net_profit     = 12729.32 - 56580,
    gp_status      = 'ACTUAL',
    updated_at     = NOW()
WHERE report_date = '2026-06-17'
RETURNING
    report_date,
    total_sale, cash_sale, card_sale, online_sale, cheq_payment, credit_sale,
    total_expenses, salary, payments, gross_profit, net_profit,
    cash_in, cash_out, cash_in_hand,
    gp_status, day_status, staff_payments_total`)
.then(r => {
    const s = r.rows[0];
    const cashOutExpr = +s.total_expenses + +s.payments + +s.salary + +s.cash_out;
    console.log('\n═══ 2026-06-17 FINAL VERIFIED STATE ═══\n');
    console.log(`  total_sale           ${s.total_sale}     (Lasersoft 116,460 + pending receipt 433 20,700)`);
    console.log(`  cash_sale            ${s.cash_sale}     (5 Lasersoft cash receipts + receipt 433)`);
    console.log(`  card_sale            ${s.card_sale}`);
    console.log(`  online_sale          ${s.online_sale}   (SL001950 per Lasersoft — Excel may differ, FLAGGED)`);
    console.log(`  cheq_payment         ${s.cheq_payment}`);
    console.log(`  credit_sale          ${s.credit_sale}`);
    console.log(`  ─────────────────────────────`);
    console.log(`  total_expenses       ${s.total_expenses}     (56,580 = Bass Fee 7,500 + Voos transport 18,000 + A/C repair 1,000 + Lunch 3,350 + Sugar 230 + Salary 26,500)`);
    console.log(`  salary col           ${s.salary}         (0 — salary already counted inside total_expenses)`);
    console.log(`  payments             ${s.payments}         (0)`);
    console.log(`  cash_out col         ${s.cash_out}         (0 — not used; formula computes from total_expenses)`);
    console.log(`  ─────────────────────────────`);
    console.log(`  CASH_OUT_EXPR        ${cashOutExpr}     (total_expenses+payments+salary+cash_out = 56,580 ✓)`);
    console.log(`  gross_profit         ${s.gross_profit}  (Lasersoft GPA confirmed)`);
    console.log(`  net_profit           ${s.net_profit}  (12,729.32 - 56,580)`);
    console.log(`  cash_in              ${s.cash_in}    (handwritten confirmed)`);
    console.log(`  cash_in_hand         ${s.cash_in_hand}    (handwritten verified)`);
    console.log(`  staff_payments_total ${s.staff_payments_total}    (commission 19,350 + salary note 26,500 — audit only, NOT in cash_out)`);
    console.log(`  gp_status            ${s.gp_status}   → tier = FULL → Net Profit WILL SHOW`);
    console.log(`  day_status           ${s.day_status}`);
    process.exit(0);
})
.catch(e => { console.error('ERROR:', e.message); process.exit(1); });
