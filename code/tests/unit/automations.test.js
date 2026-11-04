// Small daily automations (Task 24.4). Fake database and fake clock; messages go to a fake queue.
const fs = require('fs'); const os = require('os'); const path = require('path');
const A = require('../../utils/automations');

function fakePool(tables = {}) {
  const runs = new Set();
  return { query: async (sql, p = []) => {
    if (/CREATE TABLE IF NOT EXISTS automation_runs/.test(sql)) return { rows: [] };
    if (/INSERT INTO automation_runs/.test(sql)) { const k = p[0] + '|' + p[1]; if (runs.has(k)) return { rows: [] }; runs.add(k); return { rows: [{ job: p[0] }] }; }
    if (/FROM daily_summary WHERE report_date >= \$1/.test(sql)) return { rows: [tables.totals || { sales: 0, gp: 0, exp: 0, n: 0 }] };
    if (/FROM products WHERE active/.test(sql)) return { rows: tables.low || [] };
    if (/FROM grn_records/.test(sql)) return { rows: tables.grn || [] };
    if (/FROM cheque_register/.test(sql)) return { rows: tables.chq || [] };
    throw new Error('unexpected sql ' + sql);
  } };
}
const adapters = { cheques: async () => ({ today: 50000, tomorrow: 0, overdue: { count: 1, amount: 20000 } }) };
const SUN_0700 = new Date('2026-10-11T01:30:00Z');   // Sunday 07:00 Sri Lanka
const MON_0700 = new Date('2026-10-12T01:30:00Z');
const dirs = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rbh-')); fs.mkdirSync(path.join(d, 'backups')); return d; };

test('morning brief has sales, cheques, low stock, backup and is queued once a day', async () => {
  const root = dirs(); fs.writeFileSync(path.join(root, 'backups', 'a.sql'), 'x');
  const pool = fakePool({ totals: { sales: 120000, gp: 30000, exp: 5000, n: 1 }, low: [{ item_code: '001', name: 'Tap', stock_level: 1, reorder_threshold: 5 }] });
  const q = []; const enqueue = async (t, s) => q.push([s, t]);
  const r1 = await A.runDaily({ pool, adapters, enqueue, now: MON_0700, root });
  expect(r1.done).toEqual(['morning_brief', 'reorder_list']);
  const brief = q.find((x) => x[0] === 'brief')[1];
  expect(brief).toContain('YESTERDAY'); expect(brief).toContain('Sales Rs 120,000'); expect(brief).toContain('net profit Rs 25,000'); expect(brief).toContain('today Rs 50,000'); expect(brief).toContain('OVERDUE 1'); expect(brief).toContain('Stock low: 1 items'); expect(brief).toContain('Backup OK'); expect(brief).not.toContain('THIS WEEK');   // Monday: no days yet this week
  expect(q.find((x) => x[0] === 'reorder')[1]).toContain('001 Tap: have 1, order about 9');
  expect((await A.runDaily({ pool, adapters, enqueue, now: MON_0700, root })).done).toEqual([]);      // second run the same day: nothing
});
test('Sunday gives the weekly profit, not the reorder list; before 04:00 nothing runs', async () => {
  const pool = fakePool({ totals: { sales: 700000, gp: 140000, exp: 40000, n: 7 } }); const q = [];
  expect((await A.runDaily({ pool, adapters, enqueue: async (t, s) => q.push([s, t]), now: new Date('2026-10-10T20:00:00Z'), root: dirs() })).done).toEqual([]);   // 01:30 SL
  const r = await A.runDaily({ pool, adapters, enqueue: async (t, s) => q.push([s, t]), now: SUN_0700, root: dirs() });
  expect(r.done).toEqual(['morning_brief', 'weekly_profit']);
  expect(q.find((x) => x[0] === 'profit')[1]).toContain('gross profit Rs 140,000'); expect(q.find((x) => x[0] === 'profit')[1]).toContain('left after expenses Rs 100,000');
});
test('old or missing backup is shouted about', async () => {
  const root = dirs(); const f = path.join(root, 'backups', 'a.sql'); fs.writeFileSync(f, 'x'); const old = new Date(Date.now() - 72 * 36e5); fs.utimesSync(f, old, old);
  expect(A.latestBackupAgeHours(path.join(root, 'backups'), new Date())).toBeGreaterThan(60);
  expect(A.latestBackupAgeHours(path.join(root, 'nope'), new Date())).toBeNull();
});
test('tax / licence dates within 7 days come from the config file', () => {
  const f = path.join(dirs(), 't.json'); fs.writeFileSync(f, JSON.stringify({ items: [{ date: '2026-10-15', name: 'VAT return' }, { date: '2026-12-01', name: 'Far away' }, { date: 'bad', name: 'x' }] }));
  expect(A.taxDates(f, '2026-10-12')).toEqual(['2026-10-15 VAT return']); expect(A.taxDates('/no/file.json', '2026-10-12')).toEqual([]);
});
test('monthly accountant pack writes 3 CSV files with escaped cells', async () => {
  const out = dirs(); const pool = fakePool({ chq: [{ cheque_no: '1', bank: 'B', payee: 'Smith, "Bob"', amount: 5, due_date: '2026-09-02', status: 'pending' }] });
  const files = await A.accountantPack(pool, '2026-09', out);
  expect(files.map((f) => path.basename(f))).toEqual(['2026-09_sales.csv', '2026-09_purchases.csv', '2026-09_cheques.csv']);
  expect(fs.readFileSync(files[2], 'utf8')).toContain('"Smith, ""Bob"""'); expect(fs.readFileSync(files[1], 'utf8')).toBe('no rows\n');
});

test('06:00 message: three sections, empty parts left out, week totals and health shown', () => {
  const full = A.morningBrief({ today: '2026-10-14', yesterday: '2026-10-13', y: { days: 1, sales: 100000, gp: 20000, expenses: 30000 }, chqDone: { cleared: { n: 1, amount: 5 }, bounced: { n: 2, amount: 9 } }, grn: { n: 0, total: 0 }, low: [], priceChanges: 0,
    cheques: { today: 0, tomorrow: 0, next7: 70000 }, billsDue: { n: 1, total: 8000 }, reminders: [], health: { ok: false, when: '05:40', problems: ['admin login page'] }, backupHours: 50, tax: [], week: { days: 2, sales: 300000, gp: 60000, expenses: 40000 }, changed: [] });
  expect(full).toContain('net profit Rs -10,000 (LOSS)'); expect(full).toContain('Cheques BOUNCED: 2'); expect(full).toContain('Cheques cleared: 1');
  expect(full).toContain('Supplier bills due today: 1'); expect(full).toContain('Website check: PROBLEM (admin login page)'); expect(full).toContain('BACKUP: last one is 50 hours old');
  expect(full).toContain('THIS WEEK'); expect(full).toContain('net profit Rs 20,000 (2 days)'); expect(full).toContain('next 7 days: Rs 70,000');
  expect(full).not.toContain('GRNs entered'); expect(full).not.toContain('Reminders'); expect(full).not.toContain('Stock low');
});
