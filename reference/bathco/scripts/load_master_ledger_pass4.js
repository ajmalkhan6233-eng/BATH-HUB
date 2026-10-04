// PASS 4 (2026-07-02): load real per-day Gross Profit for Feb 1 - Mar 8 2026 from
// "1ST_CHOICE_BATHCO_FULL_REPORT.xlsx" > DAILY SALES sheet (Lasersoft-derived, transaction-level).
// Then re-derive March's monthly avg GP% from the newly-real March 1-8 data and apply it
// to the remaining March 9-30 days that still have no GP source anywhere.
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const DRY_RUN = process.argv.includes('--dry-run');
const pool = new Pool({
  host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME,
  user: process.env.DB_USER, password: process.env.DB_PASSWORD,
});

function parseDate(s) {
  // "21 Dec 2025" -> "2025-12-21"
  const [d, mon, y] = s.split(' ');
  const months = { Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12' };
  return `${y}-${months[mon]}-${d.padStart(2,'0')}`;
}

async function main() {
  const rows = JSON.parse(fs.readFileSync('C:/Users/DELL/.claude/jobs/4206b815/tmp/daily_gp.json', 'utf8'));
  const parsed = rows.map(r => ({
    date: parseDate(r[0]),
    revenue: parseFloat(r[3].replace(/,/g, '')),
    gp: parseFloat(r[5].replace(/,/g, '')),
  }));
  const target = parsed.filter(r => r.date >= '2026-02-01' && r.date <= '2026-03-08');
  console.log(`Parsed ${rows.length} total rows, ${target.length} in Feb 1 - Mar 8 target window`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let applied = 0;
    for (const r of target) {
      const res = await client.query(
        `UPDATE daily_summary
         SET gross_profit = $2,
             gp_status = 'ACTUAL',
             gp_blend_note = COALESCE(gp_blend_note || ' | ', '') || 'real figure 2026-07-02 from 1ST_CHOICE_BATHCO_FULL_REPORT.xlsx DAILY SALES sheet (Lasersoft-derived)',
             updated_at = CURRENT_TIMESTAMP
         WHERE report_date = $1`,
        [r.date, r.gp]
      );
      if (res.rowCount === 1) applied++;
      else console.warn(`  WARN: no daily_summary row for ${r.date}`);
    }
    console.log(`Real GP applied for ${applied}/${target.length} days`);

    // Re-derive March avg GP% from now-real March 1-8 data, apply to March 9-30 gap.
    const marchAvg = await client.query(`
      SELECT SUM(gross_profit) / NULLIF(SUM(total_sale), 0) AS pct, COUNT(*) AS n
      FROM daily_summary
      WHERE report_date BETWEEN '2026-03-01' AND '2026-03-08' AND gross_profit > 0`);
    const pct = parseFloat(marchAvg.rows[0].pct);
    console.log(`March avg GP% (from ${marchAvg.rows[0].n} real days) = ${(pct*100).toFixed(2)}%`);

    const marchGap = await client.query(`
      SELECT report_date, total_sale FROM daily_summary
      WHERE gp_status = 'NOT_AVAILABLE' AND report_date BETWEEN '2026-03-09' AND '2026-03-30'
      ORDER BY report_date`);
    let marchFilled = 0;
    for (const r of marchGap.rows) {
      const gp = Math.round(parseFloat(r.total_sale) * pct * 100) / 100;
      await client.query(
        `UPDATE daily_summary
         SET gross_profit = $2, gp_status = 'ESTIMATE',
             gp_blend_note = COALESCE(gp_blend_note || ' | ', '') || 'auto-filled 2026-07-02: March avg GP% (from real 03-01..08 data) = ' || $3 || '%',
             updated_at = CURRENT_TIMESTAMP
         WHERE report_date = $1`,
        [r.report_date, gp, (pct*100).toFixed(2)]
      );
      marchFilled++;
    }
    console.log(`March 9-30 filled via March's own real-data avg: ${marchFilled} days`);

    // Recompute net_profit for everyone (NULL where GP still unknown).
    await client.query(`
      UPDATE daily_summary
      SET net_profit = CASE WHEN gp_status = 'NOT_AVAILABLE' THEN NULL ELSE gross_profit - total_expenses END,
          updated_at = CURRENT_TIMESTAMP`);

    if (DRY_RUN) { console.log('DRY RUN - rolling back'); await client.query('ROLLBACK'); }
    else { await client.query('COMMIT'); console.log('COMMITTED'); }

    const remaining = await client.query(`SELECT report_date FROM daily_summary WHERE gp_status='NOT_AVAILABLE' ORDER BY report_date`);
    console.log(`Remaining gp_status=NOT_AVAILABLE days: ${remaining.rows.length}`);
    console.log(remaining.rows.map(r=>r.report_date.toISOString().slice(0,10)).join(', '));
  } catch (e) {
    await client.query('ROLLBACK'); throw e;
  } finally {
    client.release(); await pool.end();
  }
}
main().catch(e => { console.error(e); process.exit(1); });
