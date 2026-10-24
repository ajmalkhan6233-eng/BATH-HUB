'use strict';
// WEEKLY COMMISSION (AJ 24 Oct 2026): 5% of GROSS PROFIT (price - cost), paid weekly, after voids.
// A line sold at or below cost earns nothing (losses are NOT taken off other lines). A line with no known cost earns nothing and is counted for AJ.
// Report goes into the single 06:00 message (Rule 11) every Sunday, covering the 7 days that ended yesterday. Estimate: uses each item's average cost today.
const round2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const pctOf = (env = process.env) => { const p = Number(env.COMMISSION_PCT); return p >= 0 && p <= 50 ? p : 5; };
const slDate = d => new Date(d.getTime() + 5.5 * 3600e3);
const iso = d => d.toISOString().slice(0, 10);
const addDays = (s, n) => iso(new Date(Date.parse(s + 'T00:00:00Z') + n * 864e5));
// rows: [{revenue, cost}]  cost 0/null = unknown
function compute(rows, pct) {
  let gross = 0, eligible = 0, below = 0, nocost = 0;
  for (const r of rows) {
    const rev = Number(r.revenue) || 0, cost = Number(r.cost) || 0;
    if (!(cost > 0)) { nocost++; continue; }
    const p = rev - cost; gross += p;
    if (p > 0) eligible += p; else below++;
  }
  return { gross: round2(gross), eligible: round2(eligible), commission: round2(eligible * pct / 100), below_cost_lines: below, no_cost_lines: nocost, pct };
}
async function weekRows(pool, from, to) {   // from/to inclusive Sri Lanka dates
  return (await pool.query(`SELECT i.line_total * CASE WHEN b.subtotal > 0 THEN b.total / b.subtotal ELSE 1 END AS revenue, i.qty * COALESCE(p.avg_cost, 0) AS cost
      FROM pos_bill_items i JOIN pos_bills b ON b.id = i.bill_id LEFT JOIN products p ON p.item_code = i.item_code
     WHERE (b.created_at AT TIME ZONE 'Asia/Colombo')::date BETWEEN $1 AND $2 AND NOT EXISTS (SELECT 1 FROM pos_bill_voids v WHERE v.bill_id = b.id)`, [from, to])).rows;
}
const fmt = n => 'Rs ' + Math.round(n).toLocaleString('en-US');
function message(from, to, c) {
  return '💰 WEEKLY COMMISSION ' + from + ' to ' + to + '\nCommission to pay: ' + fmt(c.commission) + ' (' + c.pct + '% of gross profit ' + fmt(c.eligible) + ')\nGross profit this week: ' + fmt(c.gross) +
    (c.below_cost_lines ? '\nSold at or below cost (no commission): ' + c.below_cost_lines + ' lines' : '') + (c.no_cost_lines ? '\nItems with no cost known (no commission yet): ' + c.no_cost_lines + ' lines' : '') + '\nEstimate: uses today\'s average cost. Pay only after you agree.';
}
async function runWeekly({ pool, enqueue, now = new Date(), env = process.env }) {
  const sl = slDate(now), day = iso(sl);
  if (sl.getUTCDay() !== 0) return { done: false };      // Sunday only
  await pool.query(`CREATE TABLE IF NOT EXISTS automation_runs (job TEXT NOT NULL, day DATE NOT NULL, PRIMARY KEY (job, day))`);
  if (!(await pool.query(`INSERT INTO automation_runs (job, day) VALUES ('commission_weekly',$1) ON CONFLICT DO NOTHING RETURNING job`, [day])).rows.length) return { done: false };
  const to = addDays(day, -1), from = addDays(day, -7);
  const c = compute(await weekRows(pool, from, to), pctOf(env));
  await enqueue(message(from, to, c), 'commission');
  return { done: true, ...c };
}
module.exports = { compute, pctOf, message, runWeekly, addDays };
