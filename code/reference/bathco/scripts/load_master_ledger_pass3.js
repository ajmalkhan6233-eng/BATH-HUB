// PASS 3 (2026-07-02): load BATHCO_HISTORICAL_DATA.md's reconciled expense table into
// daily_summary (previously documented but never persisted), then fill missing gross_profit
// via that month's average GP% on known days, per the locked reconciliation rules.
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const DRY_RUN = process.argv.includes('--dry-run');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

function parseMdTable() {
  const md = fs.readFileSync(path.join(__dirname, '..', 'BATHCO_HISTORICAL_DATA.md'), 'utf8');
  const lines = md.split('\n');
  const start = lines.findIndex(l => l.startsWith('| Date | Total Sale'));
  if (start === -1) throw new Error('table header not found');
  const rows = [];
  for (let i = start + 2; i < lines.length; i++) {
    const l = lines[i];
    if (!l.startsWith('|')) break;
    const cols = l.split('|').map(s => s.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
    if (cols.length !== 7) throw new Error(`unexpected column count on line ${i + 1}: ${l}`);
    const [date, totalSaleStr, expenseStr, paymentCheck, dayStatus, gpStatus, fullyReconciled] = cols;
    const totalSale = parseFloat(totalSaleStr.replace(/,/g, ''));
    const m = expenseStr.match(/^([\d,]+\.\d+)\s*\(([A-Z0-9_]+)\)$/);
    if (!m) throw new Error(`unparseable expense col on line ${i + 1}: ${expenseStr}`);
    const expense = parseFloat(m[1].replace(/,/g, ''));
    const expenseFlag = m[2];
    rows.push({ date, totalSale, expense, expenseFlag, paymentCheck, dayStatus, gpStatus, fullyReconciled });
  }
  return rows;
}

async function main() {
  const rows = parseMdTable();
  console.log(`Parsed ${rows.length} rows from BATHCO_HISTORICAL_DATA.md`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Load expense figures + status flags for every day the doc covers.
    let expenseUpdates = 0;
    for (const r of rows) {
      const res = await client.query(
        `UPDATE daily_summary
         SET total_expenses = $2,
             expenses_source = $3,
             day_status = $4,
             reconciliation_status = $5,
             updated_at = CURRENT_TIMESTAMP
         WHERE report_date = $1`,
        [r.date, r.expense, r.expenseFlag, r.dayStatus, `${r.expenseFlag} | payment:${r.paymentCheck}`]
      );
      if (res.rowCount === 1) expenseUpdates++;
      else console.warn(`  WARN: no daily_summary row for ${r.date} (expected from historical data doc)`);
    }
    console.log(`Expense figures loaded for ${expenseUpdates}/${rows.length} days`);

    // 2. Compute monthly avg GP% from days with real (nonzero) GP already on file.
    const gpByMonth = await client.query(`
      SELECT to_char(report_date, 'YYYY-MM') AS month,
             SUM(gross_profit) / NULLIF(SUM(total_sale), 0) AS gp_pct,
             COUNT(*) AS known_days
      FROM daily_summary
      WHERE gp_status IN ('ACTUAL','ESTIMATE','BLENDED') AND gross_profit > 0
      GROUP BY 1 ORDER BY 1`);
    console.table(gpByMonth.rows);

    const gpPctByMonth = {};
    for (const row of gpByMonth.rows) gpPctByMonth[row.month] = parseFloat(row.gp_pct);

    // 3. Fill gp_status = NOT_AVAILABLE days using their month's avg GP%.
    const missingGp = await client.query(`
      SELECT report_date, total_sale FROM daily_summary
      WHERE gp_status = 'NOT_AVAILABLE' ORDER BY report_date`);

    let gpFilled = 0, gpUnresolvable = [];
    for (const r of missingGp.rows) {
      const month = r.report_date.toISOString().slice(0, 7);
      const pct = gpPctByMonth[month];
      if (pct === undefined) {
        gpUnresolvable.push(r.report_date.toISOString().slice(0, 10));
        continue;
      }
      const gp = Math.round(parseFloat(r.total_sale) * pct * 100) / 100;
      await client.query(
        `UPDATE daily_summary
         SET gross_profit = $2,
             gp_status = 'ESTIMATE',
             gp_blend_note = COALESCE(gp_blend_note || ' | ', '') || 'auto-filled 2026-07-02: month avg GP% = ' || $3 || '%',
             updated_at = CURRENT_TIMESTAMP
         WHERE report_date = $1`,
        [r.report_date, gp, (pct * 100).toFixed(2)]
      );
      gpFilled++;
    }
    console.log(`GP filled for ${gpFilled} days via monthly average`);
    if (gpUnresolvable.length) console.log(`GP UNRESOLVABLE (no month average available): ${gpUnresolvable.join(', ')}`);

    // 3b. Recompute net_profit for everyone: NULL (not a fake number) where GP is still unknown,
    // so the dashboard shows "no data" rather than a misleading loss figure.
    await client.query(`
      UPDATE daily_summary
      SET net_profit = CASE WHEN gp_status = 'NOT_AVAILABLE' THEN NULL ELSE gross_profit - total_expenses END,
          updated_at = CURRENT_TIMESTAMP`);

    if (DRY_RUN) {
      console.log('DRY RUN — rolling back, no changes committed');
      await client.query('ROLLBACK');
    } else {
      await client.query('COMMIT');
      console.log('COMMITTED');
    }

    // 4. Final report numbers
    const summary = await client.query(`
      SELECT day_status, gp_status, COUNT(*) FROM daily_summary GROUP BY 1,2 ORDER BY 3 DESC`);
    console.table(summary.rows);
    const zeroCheck = await client.query(`
      SELECT COUNT(*) FILTER (WHERE gross_profit=0) AS zero_gp,
             COUNT(*) FILTER (WHERE total_expenses=0) AS zero_exp,
             MIN(report_date), MAX(report_date), COUNT(*) FROM daily_summary`);
    console.table(zeroCheck.rows);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
