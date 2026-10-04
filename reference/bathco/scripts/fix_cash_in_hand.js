// BATHCO COMMAND — Cash in Hand correction
// Formula confirmed by Ajmal:
//   cash_sale <> 0  -> cash_in_hand = cash_sale - total_expenses - payments
//   cash_sale = 0   -> cash_in_hand = NULL (no cash sale that day, figure is meaningless)
// (payments = same-drawer outflows: broker fees, staff advances/salary, savings transfers)
//
// cash_sale can be NEGATIVE: the "overpayment with cash refund" pattern (e.g. customer
// pays the full amount via Online and the shop hands back the difference in cash) is
// recorded as a negative cash_sale entry. That is a real, signed figure and must still
// run through the formula above — only an exact 0 (no cash activity / data not loaded)
// gets NULL'd.
//
// USAGE:
//   node fix_cash_in_hand.js            -> DRY RUN: shows before/after diff for every row, changes nothing
//   node fix_cash_in_hand.js --commit   -> applies the fix to all rows + relabels the 06-06 PDC flag
//
// If table/column names below don't match the real schema, run:
//   \d daily_summary   (in psql)
// and adjust TABLE/COLUMNS at the top — the formula and dry-run logic stay the same.

require('dotenv').config();
const { Pool, types } = require('pg');

// Return DATE columns as plain 'YYYY-MM-DD' strings instead of JS Date objects
// (avoids UTC-offset day-shift when JSON-serialized in a UTC+5:30 server timezone)
types.setTypeParser(1082, val => val);

const TABLE = 'daily_summary';
const COL_DATE = 'report_date';
const COL_CASH_SALE = 'cash_sale';
const COL_EXPENSES = 'total_expenses';
const COL_PAYMENTS = 'payments';
const COL_CASH_IN_HAND = 'cash_in_hand';
const COL_FLAGS = 'checker_flags';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'bathco',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});
const COMMIT = process.argv.includes('--commit');

async function main() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      SELECT
        ${COL_DATE} AS report_date,
        ${COL_CASH_SALE} AS cash_sale,
        ${COL_EXPENSES} AS total_expenses,
        COALESCE(${COL_PAYMENTS}, 0) AS payments,
        ${COL_CASH_IN_HAND} AS old_cash_in_hand,
        CASE WHEN ${COL_CASH_SALE} <> 0
             THEN (${COL_CASH_SALE} - ${COL_EXPENSES} - COALESCE(${COL_PAYMENTS}, 0))
             ELSE NULL END AS new_cash_in_hand
      FROM ${TABLE}
      ORDER BY ${COL_DATE};
    `);

    console.log(`Found ${rows.length} rows.\n`);

    const nonZero = rows.filter(r => Number(r.cash_sale) !== 0);
    const zero = rows.filter(r => Number(r.cash_sale) === 0);

    console.log(`cash_sale <> 0: ${nonZero.length} row(s) -> cash_in_hand = cash_sale - total_expenses - payments`);
    console.log(`cash_sale = 0:  ${zero.length} row(s) -> cash_in_hand = NULL\n`);

    console.log('date         old_cash_in_hand   new_cash_in_hand   delta');

    let changed = 0, minDelta = Infinity, maxDelta = -Infinity;
    for (const r of nonZero) {
      const oldV = Number(r.old_cash_in_hand);
      const newV = Number(r.new_cash_in_hand);
      const delta = newV - oldV;
      if (delta !== 0) {
        changed++;
        minDelta = Math.min(minDelta, delta);
        maxDelta = Math.max(maxDelta, delta);
        console.log(`${r.report_date}   ${String(oldV).padStart(15)}   ${String(newV).padStart(15)}   ${delta}`);
      }
    }

    console.log(`\n${changed} of ${nonZero.length} cash_sale <> 0 rows would change.`);
    if (changed > 0) console.log(`Delta range: ${minDelta} to ${maxDelta}`);

    const zeroChanged = zero.filter(r => r.old_cash_in_hand !== null).length;
    console.log(`${zeroChanged} of ${zero.length} cash_sale = 0 rows currently have a non-NULL cash_in_hand and would be cleared to NULL.`);

    const sample = rows.find(r => r.report_date === '2026-06-09');
    if (sample) {
      console.log(`\n--- 2026-06-09 check ---`);
      console.log(`date=${sample.report_date}, cash_sale=${sample.cash_sale}, total_expenses=${sample.total_expenses}, payments=${sample.payments}`);
      console.log(`new cash_in_hand = ${sample.cash_sale} - ${sample.total_expenses} - ${sample.payments} = ${sample.new_cash_in_hand}`);
      console.log(`>>> Compare "payments" above to the full handwritten Payment column total. If they don't match, STOP and fix the import before --commit. <<<`);
    }

    if (!COMMIT) {
      console.log(`\nDry run only — no changes made. Re-run with --commit to apply.`);
      return;
    }

    const upd = await client.query(`
      UPDATE ${TABLE}
      SET ${COL_CASH_IN_HAND} = CASE WHEN ${COL_CASH_SALE} <> 0
          THEN (${COL_CASH_SALE} - ${COL_EXPENSES} - COALESCE(${COL_PAYMENTS}, 0))
          ELSE NULL END;
    `);
    console.log(`\nUpdated ${upd.rowCount} rows.`);

    const flagUpd = await client.query(`
      UPDATE ${TABLE}
      SET ${COL_FLAGS} = (
        SELECT jsonb_agg(
          CASE WHEN flag::text LIKE '%breakdown_mismatch%'
               THEN '"pdc_pending:117075"'::jsonb
               ELSE flag END
        )
        FROM jsonb_array_elements(${COL_FLAGS}) AS flag
      )
      WHERE ${COL_DATE} = '2026-06-06';
    `);
    console.log(`Relabeled flags on ${flagUpd.rowCount} row(s) for 2026-06-06.`);

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => { console.error('ERROR:', err.message); process.exit(1); });
