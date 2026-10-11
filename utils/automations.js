'use strict';
/**
 * Small daily automations for the owner (Task 24.4). Each job builds ONE short text and puts it in the notify queue
 * (utils/notify.js), so it reaches the owner in the single 05:45 morning message (rule 11). Money data goes only to the owner.
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
function morningBrief({ yesterday, y, cheques, low, backupHours, changed, tax }) {
  const L = [`MORNING BRIEF`];
  L.push(y.days ? `Yesterday (${yesterday}): sales ${rs(y.sales)}, gross profit ${rs(y.gp)}, expenses ${rs(y.expenses)}.` : `Yesterday (${yesterday}): no daily summary entered.`);
  L.push(`Cheques to pay: today ${rs(cheques.today)}, tomorrow ${rs(cheques.tomorrow)}${cheques.overdueCount ? `, OVERDUE ${cheques.overdueCount} (${rs(cheques.overdueAmount)})` : ''}.`);
  L.push(low.length ? `Low stock: ${low.length} items at or under the reorder level.` : 'Low stock: none.');
  if (backupHours == null) L.push('BACKUP: no backup file found!'); else if (backupHours > 36) L.push(`BACKUP: last one is ${backupHours} hours old. Please check.`); else L.push(`Backup OK (${backupHours} h ago).`);
  if (tax.length) L.push('Dates coming: ' + tax.join('; '));
  if (changed.length) L.push('Changed in the last day: ' + changed.join(' | '));
  return L.join('\n');
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
  await guard('morning_brief', async () => {
    const yesterday = addDays(today, -1);
    const ch = await adapters.cheques().catch(() => null);
    const c = ch || {};
    await enqueue(morningBrief({ yesterday, y: await dayTotals(pool, yesterday, yesterday), cheques: { today: c.today, tomorrow: c.tomorrow, overdueCount: c.overdue && c.overdue.count, overdueAmount: c.overdue && c.overdue.amount }, low: await lowStock(pool),
      backupHours: latestBackupAgeHours(backupDir || path.join(root, 'backups'), now), changed: whatChanged(root), tax: taxDates(taxFile || path.join(root, 'config', 'reminder_dates.json'), today) }), 'brief');
  });
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
module.exports = { runDaily, morningBrief, reorderList, weeklyProfit, accountantPack, toCsv, taxDates, latestBackupAgeHours, dayTotals };
