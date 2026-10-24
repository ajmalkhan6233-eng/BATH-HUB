'use strict';
// MORNING CHECKLIST (AJ 24 Oct 2026): the daily reminders in ONE message, queued once per Sri Lanka day and sent with the 06:00 batch (Rule 11).
// Every part is optional: a missing table or an error just skips that line. Nothing is sent when there is nothing to do except the stock-take line.
const slDay = now => new Date(now.getTime() + 5.5 * 3600e3).toISOString().slice(0, 10);
async function q(pool, sql, args) { try { return (await pool.query(sql, args)).rows; } catch (e) { return null; } }
const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);

// Stock-take rotation: one category per day, so every category is counted once per cycle. Pure function (tested).
function categoryOfDay(categories, day) {
  const list = [...new Set((categories || []).filter(Boolean))].sort();
  if (!list.length) return null;
  const n = Math.floor(Date.parse(day + 'T00:00:00Z') / 864e5);
  return list[((n % list.length) + list.length) % list.length];
}
async function build(pool, day) {
  const L = [];
  const cats = await q(pool, `SELECT DISTINCT category FROM products WHERE active IS NOT FALSE AND category IS NOT NULL`);
  const cat = cats && categoryOfDay(cats.map(r => r.category), day);
  if (cat) L.push('🔢 Count today: ' + cat + ' (check the shelf against the app)');
  const cheq = await q(pool, `SELECT COUNT(*)::int AS n, COALESCE(SUM(amount),0)::numeric AS amt FROM vendor_bill_cheques WHERE status='ISSUED' AND due_date <= $1`, [addDays(day, 2)]);
  if (cheq && cheq[0].n > 0) L.push('🔴 Cheques due within 2 days: ' + cheq[0].n + ' (Rs ' + Math.round(cheq[0].amt).toLocaleString('en-US') + ') — keep the money in the bank');
  const bills = await q(pool, `SELECT COUNT(*)::int AS n FROM vendor_bills WHERE due_date IS NOT NULL AND due_date <= $1 AND COALESCE(status,'OPEN') NOT IN ('PAID','CANCELLED','VOID')`, [addDays(day, 3)]);
  if (bills && bills[0].n > 0) L.push('🟡 Vendor bills due within 3 days: ' + bills[0].n);
  const owed = await q(pool, `SELECT COUNT(*)::int AS n FROM oversold_owed WHERE status='OPEN'`);
  if (owed && owed[0].n > 0) L.push('🟡 Items you owe customers (sold past stock): ' + owed[0].n + ' — buy them and sort out in the app');
  const wait = await q(pool, `SELECT COUNT(*)::int AS n FROM vendor_pending_items WHERE status='WAITING'`);
  if (wait && wait[0].n > 0) L.push('📦 Vendor items still not delivered: ' + wait[0].n + ' — ask the vendor, tick Delivered when the box comes');
  const ar = await q(pool, `SELECT COUNT(*)::int AS n FROM credit_customers WHERE COALESCE(due_date, invoice_date) <= $1 AND amount > COALESCE(paid,0)`, [day]);
  if (ar && ar[0].n > 0) L.push('🟡 Customers who should pay by now: ' + ar[0].n + ' — call or message them');
  const draft = await q(pool, `SELECT COUNT(*)::int AS n FROM grn_records WHERE status='PENDING_REVIEW'`);
  if (draft && draft[0].n > 0) L.push('🟡 Stock-in lines waiting for your price check: ' + draft[0].n);
  return L;
}
async function runDaily({ pool, enqueue, now = new Date() }) {
  const day = slDay(now);
  await pool.query(`CREATE TABLE IF NOT EXISTS automation_runs (job TEXT NOT NULL, day DATE NOT NULL, PRIMARY KEY (job, day))`);
  const first = (await pool.query(`INSERT INTO automation_runs (job, day) VALUES ('morning_checklist',$1) ON CONFLICT DO NOTHING RETURNING job`, [day])).rows.length > 0;
  if (!first) return { done: false };
  const L = await build(pool, day);
  if (!L.length) return { done: true, lines: 0 };
  await enqueue('☀️ TODAY\n' + L.join('\n'), 'checklist');
  return { done: true, lines: L.length };
}
module.exports = { categoryOfDay, build, runDaily, addDays };
