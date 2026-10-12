'use strict';
/**
 * Small daily automations for the owner (Task 24.4). Each job builds ONE short text and puts it in the notify queue
 * (utils/notify.js), so it reaches the owner in the single 06:00 morning message (rule 11). Money data goes only to the owner.
 * Every job runs at most once per Sri Lanka day (table automation_runs). A job that fails is skipped and logged, never blocks the others.
 *
 * Jobs:  1 morning brief (daily)  2 low-stock reorder list (Mondays)  3 weekly profit (Sundays)  4 backup check (inside the brief)
 *        17 tax / licence dates (config/reminder_dates.json)  16 monthly accountant pack (1st of month, CSV files)  19 what changed (inside the brief)
 * Schema used (not verified against the live database): daily_summary(report_date,total_sale,gross_profit,total_expenses),
 * products(item_code,name,stock_level,reorder_threshold,active), cheque_register, grn_records.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const rs = (n) => 'Rs ' + Number(n || 0).toLocaleString('en-LK', { maximumFractionDigits: 0 });
const slDate = (now) => new Date(now.getTime() + 5.5 * 3600e3);
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (isoDate, n) => { const d = new Date(isoDate + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d); };

async function dayTotals(pool, from, to) {
  const r = await pool.query(`SELECT COALESCE(SUM(total_sale),0) AS sales, COALESCE(SUM(gross_profit),0) AS gp, COALESCE(SUM(total_expenses),0) AS exp, COUNT(*) AS n
      FROM daily_summary WHERE report_date >= $1 AND report_date <= $2`, [from, to]);
  const x = r.rows[0];
  return { sales: Number(x.sales), gp: Number(x.gp), expenses: Number(x.exp), days: Number(x.n) };
}
async function lowStock(pool) {
  const r = await pool.query(`SELECT item_code, name, stock_level, reorder_threshold FROM products WHERE active = true AND stock_level <= reorder_threshold ORDER BY (stock_level - reorder_threshold), item_code`);
  return r.rows.map((x) => ({ code: x.item_code, name: x.name, stock: Number(x.stock_level), level: Number(x.reorder_threshold), order: Math.max(1, Math.ceil(Number(x.reorder_threshold) * 2 - Number(x.stock_level))) }));
}
function latestBackupAgeHours(dir, now) {
  try {
    const files = fs.readdirSync(dir).filter((f) => /\.sql$/.test(f)).map((f) => fs.statSync(path.join(dir, f)).mtimeMs);
    return files.length ? Math.round((now.getTime() - Math.max(...files)) / 36e5) : null;
  } catch (_) { return null; }
}
function whatChanged(cwd) {
  try { return execFileSync('git', ['-C', cwd, 'log', '--since=24 hours ago', '--pretty=%s'], { stdio: 'pipe' }).toString().split('\n').filter(Boolean).slice(0, 5); } catch (_) { return []; }
}
function taxDates(file, todayISO) {
  try {
    const list = JSON.parse(fs.readFileSync(file, 'utf8')).items || [];
    return list.filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.date) && x.date >= todayISO && x.date <= addDays(todayISO, 7)).map((x) => `${x.date} ${x.name}`);
  } catch (_) { return []; }
}

// ---- text builders (pure, tested) ----
function morningBrief(d) {
  const L = [`MORNING UPDATE ${d.today}`];
  const sec = (title, lines) => { const x = lines.filter(Boolean); if (x.length) L.push('', title, ...x); };
  // (a) YESTERDAY
  const y = d.y || { days: 0 };
  const net = y.gp - y.expenses;
  sec(`YESTERDAY (${d.yesterday})`, [
    y.days ? `Sales ${rs(y.sales)}, expenses ${rs(y.expenses)}, net profit ${rs(net)}${net < 0 ? ' (LOSS)' : ''}.` : 'Daily summary was not entered.',
    d.chqDone && d.chqDone.cleared.n ? `Cheques cleared: ${d.chqDone.cleared.n} (${rs(d.chqDone.cleared.amount)}).` : '',
    d.chqDone && d.chqDone.bounced.n ? `Cheques BOUNCED: ${d.chqDone.bounced.n} (${rs(d.chqDone.bounced.amount)}). Please act.` : '',
    d.grn && d.grn.n ? `GRNs entered: ${d.grn.n} (${rs(d.grn.total)}).` : '',
    d.low && d.low.length ? `Stock low: ${d.low.length} items.` : '',
    d.priceChanges ? `Supplier price changes: ${d.priceChanges} (see alerts in this message).` : '',
  ]);
  // (b) TODAY
  const c = d.cheques || {};
  const hl = d.health;
  sec('TODAY', [
    (c.today || c.tomorrow || c.overdueCount) ? `Cheques to pay: today ${rs(c.today)}, tomorrow ${rs(c.tomorrow)}${c.overdueCount ? `, OVERDUE ${c.overdueCount} (${rs(c.overdueAmount)})` : ''}.` : '',
    d.billsDue && d.billsDue.n ? `Supplier bills due today: ${d.billsDue.n} (${rs(d.billsDue.total)}).` : '',
    d.reminders && d.reminders.length ? 'Reminders: ' + d.reminders.join('; ') + '.' : '',
    hl ? (hl.ok ? `Website check: OK (${hl.when}).` : `Website check: PROBLEM (${(hl.problems || []).join(', ') || 'see health report'}).`) : '',
    d.backupHours == null ? 'BACKUP: no backup file found!' : d.backupHours > 36 ? `BACKUP: last one is ${d.backupHours} hours old. Please check.` : `Backup OK (${d.backupHours < 1 ? 'under 1' : d.backupHours} h ago).`,
    d.tax && d.tax.length ? 'Dates coming: ' + d.tax.join('; ') : '',
  ]);
  // (c) THIS WEEK
  const w = d.week;
  sec('THIS WEEK', [
    w && w.days ? `So far (Mon to yesterday): sales ${rs(w.sales)}, expenses ${rs(w.expenses)}, net profit ${rs(w.gp - w.expenses)} (${w.days} days).` : '',
    c.next7 ? `Cheques to pay in the next 7 days: ${rs(c.next7)}.` : '',
    d.changed && d.changed.length ? 'Changed in the last day: ' + d.changed.join(' | ') : '',
  ]);
  return L.join('\n');
}
async function safe(fn, fallback) { try { return await fn(); } catch (_) { return fallback; } }
/** All the facts for the 06:00 message. Every query is separate so one missing table never stops the rest. */
async function gatherBrief({ pool, adapters, now, root, backupDir, taxFile, healthFile }) {
  const sl = slDate(now), today = iso(sl), yesterday = addDays(today, -1), dow = sl.getUTCDay();
  const monday = addDays(today, -((dow + 6) % 7));
  const ch = (await safe(() => adapters.cheques(), null)) || {};
  const done = async (st) => { const r = (await pool.query(`SELECT COUNT(*) AS n, COALESCE(SUM(amount),0) AS a FROM cheque_register WHERE status = $1 AND updated_at::date = $2`, [st, yesterday])).rows[0]; return { n: Number(r.n), amount: Number(r.a) }; };
  const health = await safe(async () => JSON.parse(fs.readFileSync(healthFile || path.join(root, 'uploads', 'health_last.json'), 'utf8')), null);
  return {
    today, yesterday,
    y: await safe(() => dayTotals(pool, yesterday, yesterday), null),
    chqDone: await safe(async () => ({ cleared: await done('cleared'), bounced: await done('bounced') }), null),
    grn: await safe(async () => { const r = (await pool.query(`SELECT COUNT(DISTINCT grn_number) AS n, COALESCE(SUM(total_amount),0) AS t FROM grn_records WHERE grn_date = $1`, [yesterday])).rows[0]; return { n: Number(r.n), total: Number(r.t) }; }, null),
    low: await safe(() => lowStock(pool), []),
    priceChanges: await safe(async () => Number((await pool.query(`SELECT COUNT(*) AS n FROM notify_queue WHERE source = 'alert' AND body LIKE 'SUPPLIER PRICE CHANGE%' AND created_at::date = $1`, [today])).rows[0].n), 0),
    cheques: { today: ch.today, tomorrow: ch.tomorrow, overdueCount: ch.overdue && ch.overdue.count, overdueAmount: ch.overdue && ch.overdue.amount, next7: ch.windows && ch.windows[7] },
    billsDue: await safe(async () => { const r = (await pool.query(`SELECT COUNT(*) AS n, COALESCE(SUM(total),0) AS t FROM vendor_bills WHERE voided = FALSE AND due_date = $1`, [today])).rows[0]; return { n: Number(r.n), total: Number(r.t) }; }, null),
    reminders: await safe(async () => (await pool.query(`SELECT title FROM owner_tasks WHERE status = 'OPEN' AND due_at < ($1::date + 1) ORDER BY due_at LIMIT 3`, [today])).rows.map((r) => r.title), []),
    health,
    backupHours: latestBackupAgeHours(backupDir || path.join(root, 'backups'), now),
    tax: taxDates(taxFile || path.join(root, 'config', 'reminder_dates.json'), today),
    week: monday < today ? await safe(() => dayTotals(pool, monday, yesterday), null) : null,
    changed: whatChanged(root),
  };
}
const reorderList = (low) => `REORDER LIST (${low.length} items)\n` + low.slice(0, 25).map((x) => `${x.code} ${x.name}: have ${x.stock}, order about ${x.order}`).join('\n') + (low.length > 25 ? `\n...and ${low.length - 25} more` : '');
const weeklyProfit = (from, to, t) => `WEEKLY PROFIT ${from} to ${to}\nSales ${rs(t.sales)}, gross profit ${rs(t.gp)}, expenses ${rs(t.expenses)}, left after expenses ${rs(t.gp - t.expenses)} (${t.days} days entered).\n(Profit-split rules not applied here yet.)`;

// ---- CSV pack ----
const csvCell = (v) => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const toCsv = (rows) => rows.length ? [Object.keys(rows[0]).join(','), ...rows.map((r) => Object.values(r).map(csvCell).join(','))].join('\n') + '\n' : 'no rows\n';
async function accountantPack(pool, month /* 'YYYY-MM' */, outDir) {
  const from = `${month}-01`, to = addDays(iso(new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1))), -1);
  const q = {
    sales: [`SELECT report_date, total_sale, gross_profit, total_expenses FROM daily_summary WHERE report_date >= $1 AND report_date <= $2 ORDER BY report_date`, [from, to]],
    purchases: [`SELECT grn_date, supplier_name, item_description, quantity, unit_cost, total_amount FROM grn_records WHERE grn_date >= $1 AND grn_date <= $2 ORDER BY grn_date`, [from, to]],
    cheques: [`SELECT cheque_no, bank, payee, amount, due_date, status FROM cheque_register WHERE due_date >= $1 AND due_date <= $2 ORDER BY due_date`, [from, to]],
  };
  fs.mkdirSync(outDir, { recursive: true }); const files = [];
  for (const [name, [sql, p]] of Object.entries(q)) { const f = path.join(outDir, `${month}_${name}.csv`); fs.writeFileSync(f, toCsv((await pool.query(sql, p)).rows)); files.push(f); }
  return files;
}

async function once(pool, job, day) {
  await pool.query(`CREATE TABLE IF NOT EXISTS automation_runs (job TEXT NOT NULL, day DATE NOT NULL, PRIMARY KEY (job, day))`);
  const r = await pool.query(`INSERT INTO automation_runs (job, day) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING job`, [job, day]);
  return r.rows.length > 0;
}

/** deps: { pool, adapters, enqueue(text, source), now, root, backupDir, taxFile } ; call every ~30 minutes from 04:00 Sri Lanka time. */
async function runDaily({ pool, adapters, enqueue, now = new Date(), root = process.cwd(), backupDir, taxFile, outRoot }) {
  const sl = slDate(now), today = iso(sl), dow = sl.getUTCDay(), done = [];
  if (sl.getUTCHours() < 4) return { done };
  const guard = async (job, fn) => { try { if (await once(pool, job, today)) { await fn(); done.push(job); } } catch (e) { console.error('[automations]', job, e.message); } };
  await guard('morning_brief', async () => { await enqueue(morningBrief(await gatherBrief({ pool, adapters, now, root, backupDir, taxFile })), 'brief'); });
  if (dow === 1) await guard('reorder_list', async () => { const low = await lowStock(pool); if (low.length) await enqueue(reorderList(low), 'reorder'); });
  if (dow === 0) await guard('weekly_profit', async () => { const from = addDays(today, -7), to = addDays(today, -1); await enqueue(weeklyProfit(from, to, await dayTotals(pool, from, to)), 'profit'); });
  if (sl.getUTCDate() === 1) await guard('accountant_pack', async () => {
    const prev = iso(new Date(Date.UTC(sl.getUTCFullYear(), sl.getUTCMonth() - 1, 1))).slice(0, 7);
    const dir = path.join(outRoot || path.join(root, 'uploads', 'accountant'), prev);
    const files = await accountantPack(pool, prev, dir);
    await enqueue(`ACCOUNTANT PACK ${prev} ready: ${files.length} files in ${dir}`, 'pack');
  });
  return { done };
}
module.exports = { runDaily, morningBrief, gatherBrief, reorderList, weeklyProfit, accountantPack, toCsv, taxDates, latestBackupAgeHours, dayTotals };
