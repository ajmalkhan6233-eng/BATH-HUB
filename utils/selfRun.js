'use strict';
/**
 * SELF-RUN (read-only on shop data). Once a day, from 05:00 Sri Lanka, the app checks itself and queues ONE line for the
 * 06:00 message (utils/notify, Rule 11). It never changes shop data and never sends money anywhere.
 * Missed-run recovery: the check runs when no log row exists for today's Sri Lanka date, so if the computer was off at 05:00
 * it runs when the app next starts. A run that crashes is logged as FAILED and tried again at the next tick (max 3 a day).
 * Own table: selfrun_log (CREATE IF NOT EXISTS). Needs the owner's OK before any new library or paid service.
 */
const SL_OFFSET = 5.5 * 3600e3;
const slDay = (now) => new Date(now.getTime() + SL_OFFSET).toISOString().slice(0, 10);
const slMin = (now) => { const d = new Date(now.getTime() + SL_OFFSET); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
const RUN_FROM_MIN = 5 * 60, MAX_TRIES = 3;

let ready = null;
const ensure = (pool) => ready || (ready = pool.query(`CREATE TABLE IF NOT EXISTS selfrun_log (id SERIAL PRIMARY KEY, run_day DATE NOT NULL, status TEXT NOT NULL, line TEXT, detail TEXT, created_at TIMESTAMPTZ DEFAULT NOW())`));
const resetForTests = () => { ready = null; };

const money = (n) => 'Rs ' + Math.round(Number(n) || 0).toLocaleString('en-US');

async function dueLine(pool, day) {
  let overdue = 0, soon = 0, amount = 0;
  const bump = (due, amt) => {
    if (!due) return;
    const dd = (due instanceof Date ? `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}` : String(due).slice(0, 10));
    const days = Math.round((Date.parse(dd) - Date.parse(day)) / 86400000);
    if (days < 0) { overdue++; amount += Number(amt) || 0; } else if (days <= 3) { soon++; amount += Number(amt) || 0; }
  };
  try {
    const r = await pool.query(`SELECT b.due_date, b.total - COALESCE(p.paid,0) - COALESCE(n.cn,0) AS owed FROM vendor_bills b
      LEFT JOIN (SELECT bill_id, SUM(amount) AS paid FROM vendor_payments GROUP BY bill_id) p ON p.bill_id = b.id
      LEFT JOIN (SELECT bill_id, SUM(amount) AS cn FROM vendor_credit_notes GROUP BY bill_id) n ON n.bill_id = b.id
      WHERE b.voided = false AND b.total - COALESCE(p.paid,0) - COALESCE(n.cn,0) > 0 AND b.due_date IS NOT NULL`);
    r.rows.forEach((x) => bump(x.due_date, x.owed));
  } catch (_) { /* table not there yet */ }
  try {
    const r = await pool.query(`SELECT due_date, amount FROM cheque_register WHERE status IN ('pending','held') AND due_date IS NOT NULL`);
    r.rows.forEach((x) => bump(x.due_date, x.amount));
  } catch (_) { /* table not there yet */ }
  if (!overdue && !soon) return 'DUE: nothing in the next 3 days';
  return `DUE: ${overdue ? overdue + ' overdue, ' : ''}${soon} in 3 days (${money(amount)})`;
}

/** Yesterday's day-close: was cash counted, and does the count match the daily sheet's own expected cash (totals.cash_in_hand)? Read-only. */
async function closeLine(pool, day) {
  const y = new Date(Date.parse(day) - 86400000).toISOString().slice(0, 10);
  let row;
  try { row = (await pool.query(`SELECT payload FROM daily_entry_live WHERE entry_date = $1`, [y])).rows[0]; } catch (_) { return null; }
  if (!row) return `CLOSE: no day sheet for ${y}`;
  const p = row.payload || {};
  if (p.cash_counted == null || p.cash_counted === '') return `CLOSE: cash not counted on ${y}`;
  const counted = Number(p.cash_counted), expected = Number(p.totals && p.totals.cash_in_hand);
  if (!Number.isFinite(counted) || !Number.isFinite(expected)) return null;
  const diff = Math.round((counted - expected) * 100) / 100;
  return Math.abs(diff) < 1 ? `CLOSE: ${y} cash matches` : `CLOSE: ${y} cash ${diff > 0 ? 'over' : 'short'} by ${money(Math.abs(diff))} (counted ${money(counted)}, sheet ${money(expected)})`;
}

/** runOnce: returns { ran, reason?, line? }. runAudit is injectable for tests. */
async function runOnce(pool, { now = new Date(), runAudit, enqueue } = {}) {
  await ensure(pool);
  const day = slDay(now);
  if (slMin(now) < RUN_FROM_MIN) return { ran: false, reason: 'before 05:00' };
  const prev = (await pool.query(`SELECT status FROM selfrun_log WHERE run_day = $1`, [day])).rows;
  if (prev.some((r) => r.status === 'OK')) return { ran: false, reason: 'already done today' };
  if (prev.length >= MAX_TRIES) return { ran: false, reason: 'gave up for today' };
  try {
    const audit = await (runAudit || ((p) => require('./auditInvariants').runAll(p)))(pool);
    const due = await dueLine(pool, day);
    const close = await closeLine(pool, day);
    const line = [audit.line, due, close].filter(Boolean).join('\n');
    await (enqueue || ((p, t, s) => require('./notify').enqueue(p, t, s)))(pool, line, 'selfrun');
    await pool.query(`INSERT INTO selfrun_log (run_day, status, line, detail) VALUES ($1,'OK',$2,$3)`, [day, line, `red=${audit.red} warn=${audit.warn} ok=${audit.ok}`]);
    return { ran: true, line };
  } catch (e) {
    await pool.query(`INSERT INTO selfrun_log (run_day, status, detail) VALUES ($1,'FAILED',$2)`, [day, String(e.message).slice(0, 300)]).catch(() => {});
    return { ran: false, reason: 'failed: ' + e.message };
  }
}

function start(pool, everyMs = 10 * 60 * 1000) {
  const tick = () => runOnce(pool).catch((e) => console.error('[selfrun]', e.message));
  setTimeout(tick, 60 * 1000).unref();
  return setInterval(tick, everyMs).unref();
}
module.exports = { runOnce, start, dueLine, closeLine, resetForTests };
