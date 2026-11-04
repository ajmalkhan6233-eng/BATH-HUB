// Generates MASTER_LEDGER/master_ledger.xlsx + .md from the now-loaded daily_summary table.
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { Pool, types: pgTypes } = require('pg');
pgTypes.setTypeParser(1082, val => val); // return DATE columns as raw 'YYYY-MM-DD' strings, not JS Date (avoids UTC/local shift)
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
  host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME,
  user: process.env.DB_USER, password: process.env.DB_PASSWORD,
});

function confidence(row) {
  if (row.gp_status === 'NOT_AVAILABLE') return 'ESTIMATED';
  if (row.expenses_source === 'DEFAULT_50000' || row.gp_status === 'ESTIMATE') return 'PARTIAL';
  return 'COMPLETE';
}

async function main() {
  const outDir = path.join(__dirname, '..', 'MASTER_LEDGER');
  fs.mkdirSync(outDir, { recursive: true });

  const { rows } = await pool.query(`
    SELECT report_date, total_sale, cash_sale, card_sale, online_sale, cheq_payment, credit_sale,
           gross_profit, total_expenses, net_profit, sales_source, expenses_source, gp_status, day_status
    FROM daily_summary ORDER BY report_date`);

  const header = ['Date','Total Sale','Cash','Card','Online','Cheque','Credit','Gross Profit','Expenses','Net Profit','Source','Confidence'];
  const aoa = [header];
  const mdLines = ['| ' + header.join(' | ') + ' |', '|' + header.map(() => '---').join('|') + '|'];

  let complete = 0, partial = 0, estimated = 0;
  for (const r of rows) {
    const conf = confidence(r);
    if (conf === 'COMPLETE') complete++; else if (conf === 'PARTIAL') partial++; else estimated++;
    const src = `${r.sales_source || 'unknown'}/${r.expenses_source || 'unknown'}`;
    const npDisplay = r.net_profit === null ? '' : Number(r.net_profit).toFixed(2);
    const row = [
      r.report_date,
      Number(r.total_sale).toFixed(2), Number(r.cash_sale).toFixed(2), Number(r.card_sale).toFixed(2),
      Number(r.online_sale).toFixed(2), Number(r.cheq_payment).toFixed(2), Number(r.credit_sale).toFixed(2),
      Number(r.gross_profit).toFixed(2), Number(r.total_expenses).toFixed(2), npDisplay, src, conf,
    ];
    aoa.push(row);
    mdLines.push('| ' + row.join(' | ') + ' |');
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  XLSX.utils.book_append_sheet(wb, ws, 'Master Ledger');
  XLSX.writeFile(wb, path.join(outDir, 'master_ledger.xlsx'));

  const md = [
    '# BATHCO Master Ledger', '',
    `Generated 2026-07-02 from live \`daily_summary\` Postgres table (post pass-3 load).`,
    `Range: ${rows[0].report_date} to ${rows[rows.length-1].report_date} (${rows.length} of 192 target days present).`,
    '', `COMPLETE: ${complete} | PARTIAL: ${partial} | ESTIMATED: ${estimated}`, '', ...mdLines,
  ].join('\n');
  fs.writeFileSync(path.join(outDir, 'master_ledger.md'), md);

  console.log(`Wrote ${rows.length} rows. COMPLETE=${complete} PARTIAL=${partial} ESTIMATED=${estimated}`);
  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });
