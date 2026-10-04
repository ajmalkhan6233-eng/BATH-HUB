require('dotenv').config({ path: 'C:/BATHCO_PHASE1/.env' });
const { Pool } = require('pg');
const p = new Pool({ host: process.env.DB_HOST||'localhost', port:5432, database:'bathco', user:'postgres', password: process.env.DB_PASSWORD });

// ── Values from 6 photos read on 17-Jun-2026 ─────────────────────────────────
//
// LASERSOFT (confirmed from Profit by Sales + Rep Sales images):
//   HSL000500  32,480  CHINTHAKA       CASH      USER2
//   SL001948    9,600  CASH            CASH      USER1
//   HSL000501  50,000  M.K SILVA       USER2
//   SL001949    7,750  RIZATH          USER2
//   SL001950    5,630  CASH            USER2     [FLAGGED: Excel may show 31,630]
//   SL001951   11,000  CASH            Admin1
//   SUB TOTAL 116,460  COST 103,730.68  GPA 12,729.32
//
// RECEIPT 433: 20,700 CASH — not in Lasersoft (after-hours, PENDING_RECONCILIATION)
//
// CASH RECONCILIATION (from handwritten sheet):
//   433+HSL000500+SL001948+SL001949+HSL000501+SL001951 =
//   20,700+32,480+9,600+7,750+50,000+11,000 = 131,530 ✓ (matches handwritten)
//   SL001950 (5,630) is the sole non-cash receipt (online payment)
//
// EXPENSE SHEET (handwritten A4):
//   Bass Fee: 7,500  |  Voos transport: 18,000  |  A/C repair: 1,000
//   Lunch: 3,350     |  Sugar: 230              |  Salary: 26,500
//   TOTAL: 56,580    |  cash_in: 131,530        |  cash_in_hand: 75,000

const VALUES = {
    report_date:      '2026-06-17',
    total_sale:       137160,   // Lasersoft 116,460 + receipt 433 20,700
    lasersoft_total:  116460,
    cash_sale:        131530,   // confirmed from handwritten
    card_sale:        0,
    online_sale:      5630,     // SL001950 (Lasersoft confirmed, paid non-cash)
    cheq_payment:     0,
    credit_sale:      0,
    total_expenses:   30080,    // Bass Fee 7,500 + Voos transport 18,000 + A/C repair 1,000 + Lunch 3,350 + Sugar 230
    salary:           26500,    // from salary notepad (also in A4 expense sheet total)
    payments:         0,
    gross_profit:     12729.32, // Lasersoft SUB TOTALS GPA
    net_profit:       12729.32 - 56580,  // = -43,850.68
    cash_in:          131530,
    cash_out:         56580,
    cash_in_hand:     75000,
    source:           'PHOTOS_17JUN2026',
    day_status:       'CONFIRMED',
    reconciliation_status: 'PARTIAL_FLAGS',
    invoice_seq_start: 'HSL000500',
    invoice_seq_end:   'SL001951',
    checker_flags: JSON.stringify({
        pending_reconciliation: [
            { invoice: '433', amount: 20700, reason: 'Not in Lasersoft — after-hours sale, cash collected' }
        ],
        discrepancies: [
            { invoice: 'SL001950', lasersoft_amount: 5630, excel_amount: '31630_UNCONFIRMED',
              note: 'Excel photo may show 31,630 but Lasersoft confirms 5,630. Please open 17-06-2026.xlsx and verify C-column for SL001950.' },
            { field: 'total_sale_handwritten', handwritten: 102160, calculated: 137160,
              note: 'Handwritten sheet shows total sale 102,160 — cannot reconcile with Lasersoft 116,460 + receipt 433. May be cash-collected-only figure. Needs Ajmal clarification.' },
            { field: 'cash_h_column', amount: 2130,
              note: 'Excel H-column shows 2,130 for one row (possibly HSL000501 credit or credit-card). Could not confirm from photo — verify in Excel file.' }
        ],
        commission_assumption: 'Commission note (19,350) is NOT deducted from net_profit — assumed already in cost structure. Confirm with Ajmal if incorrect.',
        saving_rounding: 'Handwritten shows saving +50 LKR — recorded in cash_in_hand as 75,000 per Ajmal count.'
    }),
    details: JSON.stringify({
        expenses_breakdown: {
            bass_fee: 7500,
            voos_transport: 18000,
            ac_repair_service: 1000,
            lunch: 3350,
            sugar: 230,
            salary: 26500,
            total: 56580,
            note: 'Bass Fee entry prefixed "16/06" — may be yesterday carried over. Record as-is.'
        },
        staff_commission_note: {
            date: '2026-06-17',
            total: 19350,
            breakdown: {
                Imran:    { gross: 5500, deductions: 0, net: 5500 },
                Jazeel:   { gross: 3000, deductions: 0, net: 3000 },
                Nimshard: { gross: 3850, deductions: 500, net: 3350, note: '-500 loan' },
                Nicshard: { gross: 3000, deductions: 0, net: 3000 },
                Ali:      { gross: 2000, deductions: 'loan deductions', net: 2000, note: 'net of loan deductions per note' },
                Fahim:    { gross: 2500, deductions: 0, net: 2500 }
            }
        },
        staff_salary_note: {
            date: '2026-06-17',
            total: 26500,
            breakdown: {
                Imran:    5000,
                Gimhan:   2000,
                Ajmal:    5000,
                Jazeel:   3000,
                Nimshand: 3500,
                Nicshard: 3000,
                Ali:      2500,
                Fahim:    2500
            }
        },
        staff_payments_total: 45850,  // 19,350 commission + 26,500 salary
        lasersoft_invoices: [
            { number: 'HSL000500', customer: 'CHINTHAKA 07675416Z1', user: 'USER2', amount: 32480, cost: 29452.00, gpa: 3028.00, payment: 'CASH' },
            { number: 'SL001948',  customer: 'CASH',                  user: 'USER1', amount: 9600,  cost: 7512.66,  gpa: 2087.34, payment: 'CASH' },
            { number: 'HSL000501', customer: 'M.K SILVA',             user: 'USER2', amount: 50000, cost: 46505.77, gpa: 3454.23, payment: 'CASH' },
            { number: 'SL001949',  customer: 'RIZATH <PHONE>1',     user: 'USER2', amount: 7750,  cost: 6986.81,  gpa: 763.19,  payment: 'CASH' },
            { number: 'SL001950',  customer: 'CASH',                   user: 'USER2', amount: 5630,  cost: 3824.59,  gpa: 1805.41, payment: 'ONLINE_FLAG', flag: 'EXCEL_DISCREPANCY' },
            { number: 'SL001951',  customer: 'CASH',                   user: 'Admin1', amount: 11000, cost: 9448.85, gpa: 1551.15, payment: 'CASH' }
        ],
        after_hours_receipts: [
            { number: '433', amount: 20700, payment: 'CASH', status: 'PENDING_RECONCILIATION' }
        ]
    }),
    photo_data: JSON.stringify({
        files: [
            '1781706366655-WhatsApp_Image_2026-06-17_at_19.55.08.jpeg',
            '1781706366658-WhatsApp_Image_2026-06-17_at_19.55.09__1_.jpeg',
            '1781706366660-WhatsApp_Image_2026-06-17_at_19.55.09.jpeg',
            '1781706366662-WhatsApp_Image_2026-06-17_at_19.55.10__1_.jpeg',
            '1781706366663-WhatsApp_Image_2026-06-17_at_19.55.10__2_.jpeg',
            '1781706366665-WhatsApp_Image_2026-06-17_at_19.55.10.jpeg'
        ],
        count: 6,
        uploaded_at: '2026-06-17T19:55:10'
    }),
    notes: 'Updated from 6 WhatsApp photos. Lasersoft GPA confirmed 12,729.32. Receipt 433 (20,700) pending reconciliation. SL001950 Excel/Lasersoft discrepancy flagged. Handwritten total_sale 102,160 vs calculated 137,160 — needs Ajmal clarification. Commission note (19,350) stored in details.staff_commission_note only.'
};

async function run() {
    // Add staff_payments_total column if not exists
    await p.query(`ALTER TABLE daily_summary ADD COLUMN IF NOT EXISTS staff_payments_total NUMERIC(14,2)`);

    // Read current row
    const before = await p.query(`SELECT * FROM daily_summary WHERE report_date = '2026-06-17'`);
    console.log('\n── BEFORE ──');
    if (before.rowCount === 0) console.log('  (no row exists)');
    else {
        const b = before.rows[0];
        console.log(JSON.stringify({
            total_sale: b.total_sale, cash_sale: b.cash_sale, card_sale: b.card_sale,
            online_sale: b.online_sale, credit_sale: b.credit_sale,
            total_expenses: b.total_expenses, salary: b.salary, payments: b.payments,
            gross_profit: b.gross_profit, net_profit: b.net_profit,
            cash_in: b.cash_in, cash_out: b.cash_out, cash_in_hand: b.cash_in_hand,
            day_status: b.day_status
        }, null, 2));
    }

    // UPSERT
    await p.query(`
        INSERT INTO daily_summary
          (report_date, total_sale, lasersoft_total, cash_sale, card_sale, online_sale, cheq_payment,
           credit_sale, total_expenses, salary, payments, gross_profit, net_profit,
           cash_in, cash_out, cash_in_hand, source, day_status, reconciliation_status,
           invoice_seq_start, invoice_seq_end, checker_flags, details, photo_data,
           staff_payments_total, notes, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22::jsonb,$23::jsonb,$24::jsonb,$25,$26,NOW())
        ON CONFLICT (report_date) DO UPDATE SET
          total_sale = EXCLUDED.total_sale,
          lasersoft_total = EXCLUDED.lasersoft_total,
          cash_sale = EXCLUDED.cash_sale,
          card_sale = EXCLUDED.card_sale,
          online_sale = EXCLUDED.online_sale,
          cheq_payment = EXCLUDED.cheq_payment,
          credit_sale = EXCLUDED.credit_sale,
          total_expenses = EXCLUDED.total_expenses,
          salary = EXCLUDED.salary,
          payments = EXCLUDED.payments,
          gross_profit = EXCLUDED.gross_profit,
          net_profit = EXCLUDED.net_profit,
          cash_in = EXCLUDED.cash_in,
          cash_out = EXCLUDED.cash_out,
          cash_in_hand = EXCLUDED.cash_in_hand,
          source = EXCLUDED.source,
          day_status = EXCLUDED.day_status,
          reconciliation_status = EXCLUDED.reconciliation_status,
          invoice_seq_start = EXCLUDED.invoice_seq_start,
          invoice_seq_end = EXCLUDED.invoice_seq_end,
          checker_flags = EXCLUDED.checker_flags,
          details = EXCLUDED.details,
          photo_data = EXCLUDED.photo_data,
          staff_payments_total = EXCLUDED.staff_payments_total,
          notes = EXCLUDED.notes,
          updated_at = NOW()`,
        [ VALUES.report_date, VALUES.total_sale, VALUES.lasersoft_total,
          VALUES.cash_sale, VALUES.card_sale, VALUES.online_sale, VALUES.cheq_payment,
          VALUES.credit_sale, VALUES.total_expenses, VALUES.salary, VALUES.payments,
          VALUES.gross_profit, VALUES.net_profit,
          VALUES.cash_in, VALUES.cash_out, VALUES.cash_in_hand,
          VALUES.source, VALUES.day_status, VALUES.reconciliation_status,
          VALUES.invoice_seq_start, VALUES.invoice_seq_end,
          VALUES.checker_flags, VALUES.details, VALUES.photo_data,
          45850, VALUES.notes ]
    );

    // Read after
    const after = await p.query(`SELECT * FROM daily_summary WHERE report_date = '2026-06-17'`);
    const a = after.rows[0];
    console.log('\n── AFTER (2026-06-17) ──');
    console.log(JSON.stringify({
        total_sale:          +a.total_sale,
        lasersoft_total:     +a.lasersoft_total,
        cash_sale:           +a.cash_sale,
        card_sale:           +a.card_sale,
        online_sale:         +a.online_sale,
        cheq_payment:        +a.cheq_payment,
        credit_sale:         +a.credit_sale,
        total_expenses:      +a.total_expenses,
        salary:              +a.salary,
        payments:            +a.payments,
        gross_profit:        +a.gross_profit,
        net_profit:          +a.net_profit,
        cash_in:             +a.cash_in,
        cash_out:            +a.cash_out,
        cash_in_hand:        +a.cash_in_hand,
        staff_payments_total:+a.staff_payments_total,
        day_status:          a.day_status,
        reconciliation_status: a.reconciliation_status,
        photo_count:         a.photo_data ? JSON.parse(a.photo_data).count : null
    }, null, 2));

    process.exit(0);
}
run().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
