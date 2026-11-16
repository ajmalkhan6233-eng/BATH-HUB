'use strict';
// AJ 16 Nov: bills typed today by mistake (they are old sales) -> move them to an earlier day. Stock is not touched (it was taken out already).
//   node scripts/redate_today_bills.js                         rehearsal: lists today's bills, saves nothing
//   node scripts/redate_today_bills.js --yes                   moves them
//   options: --date 2026-10-31   (default 31 Oct 2026)   --upto BHT-20261116-0004  (only bills up to and including this number)
// Only the bill's date/time changes (same as a backdated bill: reports follow created_at). Bill numbers stay. Safe to repeat.
require('dotenv').config({ quiet: true });
const pool = require('../utils/pool');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const YES = process.argv.includes('--yes'), DATE = arg('--date', '2026-10-31'), UPTO = arg('--upto', null);
(async () => {
  const c = await pool.connect();
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(DATE) || isNaN(Date.parse(DATE))) throw new Error('bad --date');
    await c.query('BEGIN'); await c.query('SELECT pg_advisory_xact_lock($1)', [774418]);
    const today = (await c.query("SELECT (NOW() AT TIME ZONE 'Asia/Colombo')::date::text AS d")).rows[0].d;
    if (DATE >= today) throw new Error(`--date ${DATE} is not before today (${today}).`);
    let bills = (await c.query("SELECT id, bill_number, total, customer_name, created_at FROM pos_bills WHERE created_at::date = $1::date ORDER BY id", [today])).rows;
    if (UPTO) { const k = bills.findIndex((b) => b.bill_number === UPTO); if (k < 0) throw new Error(`${UPTO} is not among today's bills.`); bills = bills.slice(0, k + 1); }
    if (!bills.length) throw new Error(`no bills dated today (${today}). Nothing to move.`);
    const have = new Set((await c.query("SELECT table_name||'.'||column_name AS k FROM information_schema.columns WHERE table_schema='public'")).rows.map((r) => r.k));
    const ids = bills.map((b) => b.id);
    // keep the clock time of each bill, change only the day (same as reports: created_at::date)
    await c.query("UPDATE pos_bills SET created_at = ($2::date + created_at::time) WHERE id = ANY($1::int[])", [ids, DATE]);
    for (const t of ['pos_bill_items', 'pos_bill_payments']) if (have.has(t + '.created_at') && have.has(t + '.bill_id'))
      await c.query(`UPDATE ${t} SET created_at = ($2::date + created_at::time) WHERE bill_id = ANY($1::int[])`, [ids, DATE]);
    console.log(YES ? `DONE: ${bills.length} bill(s) moved to ${DATE}` : `REHEARSAL ONLY (nothing saved): ${bills.length} bill(s) would move to ${DATE}`);
    bills.forEach((b) => console.log(`  ${b.bill_number} | ${b.customer_name || 'Walk-in'} | Rs ${b.total}`));
    await c.query(YES ? 'COMMIT' : 'ROLLBACK');
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); console.log('STOPPED: ' + e.message + ' Nothing saved.'); process.exitCode = 1; } finally { c.release(); await pool.end().catch(() => {}); }
})();
