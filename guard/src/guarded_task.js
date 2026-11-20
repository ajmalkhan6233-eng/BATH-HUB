'use strict';
// GUARDED TASK: the AI may make its changes, it may NOT judge them. This wrapper judges, and undoes if anything is off.
//   node guard/src/guarded_task.js --task 190 --expect guard/config/expected.json [--screens] -- node scripts/ai_task.js
// expected.json: { numbers: {stock_pieces: 25, vendor_owed: {"Leo Marketing": 41750}, ...}, allowed_changes: [{table, operation, count|row_id}], app_dir, stop_cmd? }
// Order: 1 git baseline  2 backup (pg_dump, with owners + rights)  3 stop app writes  4 numbers before  5 run the task as the AI database user
//        6 numbers after + row check + screen check  7 PASS = keep, FAIL = restore the database + undo this task's git commits + restart + alert.
// Settings come from the environment (.env), never from this file: DB_* (owner login, used for reading numbers), GUARD_AI_USER / GUARD_AI_PASSWORD (ai_pc / ai_chat),
// GUARD_ADMIN_USER / GUARD_ADMIN_PASSWORD (backup + restore), GUARD_STOP_CMD / GUARD_START_CMD (e.g. "pm2 stop bathco-server"), GUARD_REPO (app folder).
const fs = require('fs'); const path = require('path'); const { spawnSync } = require('child_process');
const { run, conf } = require('./db'); const snap = require('./snapshot'); const { compare } = require('./compare'); const rowcheck = require('./rowcheck');
const screens = require('./screen_guard'); const alert = require('./alert');
const OUT = process.env.GUARD_OUT || path.join(__dirname, '..', 'out'); const BK = process.env.GUARD_BACKUPS || path.join(OUT, 'backups');
const arg = (n) => { const i = process.argv.indexOf('--' + n); return i > -1 ? process.argv[i + 1] : null; };
const sh = (cmd, args, env, opt) => spawnSync(cmd, args, { env: { ...process.env, ...(env || {}) }, encoding: 'utf8', shell: false, ...(opt || {}) });
const shell = (line) => spawnSync(line, { shell: true, encoding: 'utf8', env: process.env });
const adminEnv = () => ({ PGPASSWORD: process.env.GUARD_ADMIN_PASSWORD || process.env.DB_PASSWORD || '' });
const adminArgs = () => { const c = conf('DB'); return ['-h', String(c.host), '-p', String(c.port), '-U', process.env.GUARD_ADMIN_USER || c.user]; };

async function main() {
  const task = arg('task'); const dd = process.argv.indexOf('--'); const cmd = dd > -1 ? process.argv.slice(dd + 1) : [];
  if (!task || !cmd.length) { console.log('usage: --task N --expect file.json [--screens] -- command ...'); process.exit(64); }
  const exp = arg('expect') ? JSON.parse(fs.readFileSync(arg('expect'), 'utf8')) : { numbers: {}, allowed_changes: [] };
  const repo = process.env.GUARD_REPO || exp.app_dir || process.cwd(); const dbname = conf('DB').database; const log = []; const note = (s) => { log.push(s); console.log(s); };
  fs.mkdirSync(BK, { recursive: true });
  // 1 git baseline
  let sha = null; { const g = sh('git', ['-C', repo, 'rev-parse', 'HEAD']); if (g.status === 0) { sha = g.stdout.trim(); note('1 git baseline ' + sha.slice(0, 8)); } else note('1 git baseline: none (not a git folder)'); }
  // 2 backup
  const file = path.join(BK, `task_${task}_${Date.now()}.dump`);
  const d = sh('pg_dump', ['-Fc', ...adminArgs(), '-d', dbname, '-f', file], adminEnv());
  if (d.status !== 0 || !fs.existsSync(file) || fs.statSync(file).size < 1000) { note('2 BACKUP FAILED, task not started: ' + (d.stderr || '').split('\n')[0]); await alert.send(`RBH GUARD task ${task}: backup failed, task NOT run.`); process.exit(3); }
  note(`2 backup ok (${Math.round(fs.statSync(file).size / 1024)} KB)`);
  // 3 stop writers
  if (process.env.GUARD_STOP_CMD) { const s = shell(process.env.GUARD_STOP_CMD); note('3 app writes stopped' + (s.status === 0 ? '' : ' (stop command returned ' + s.status + ')')); } else note('3 app writes NOT stopped (GUARD_STOP_CMD not set) UNVERIFIED');
  // 4 before
  const before = await run('DB', snap.take); const since = await rowcheck.maxLogId('DB'); note('4 numbers before taken');
  // 5 run as the AI user
  const aiEnv = { PGOPTIONS: `-c guard.task=${task}` };
  if (process.env.GUARD_AI_USER) { aiEnv.DB_USER = process.env.GUARD_AI_USER; aiEnv.DB_PASSWORD = process.env.GUARD_AI_PASSWORD || ''; }
  else note('5 WARNING: GUARD_AI_USER not set, the task runs with the owner login (no delete lock, row check blind)');
  const t = spawnSync(cmd[0], cmd.slice(1), { env: { ...process.env, ...aiEnv }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], cwd: repo });
  const taskOut = ((t.stdout || '') + (t.stderr || '')).trim().split('\n').slice(-12).join('\n');
  note(`5 task finished with code ${t.status}`); if (taskOut) console.log('   | ' + taskOut.split('\n').join('\n   | '));
  // 6 judge
  const after = await run('DB', snap.take); const fails = [];
  if (t.status !== 0) fails.push('the task itself reported an error (code ' + t.status + ')');
  const num = compare(before, after, exp.numbers); num.fails.forEach((f) => fails.push('NUMBERS ' + f));
  const row = process.env.GUARD_AI_USER ? await rowcheck.check('DB', since, task, exp.allowed_changes) : { ok: false, fails: ['row check needs the AI database user'], ai_changes: 0, other_changes: 0 };
  row.fails.forEach((f) => fails.push('ROWS ' + f));
  if (process.argv.includes('--screens')) { const sc = screens.check(repo); sc.fails.forEach((f) => fails.push('SCREEN ' + f)); note('6 screens ' + (sc.ok ? 'ok' : 'MISSING')); }
  note(`6 numbers ${num.ok ? 'ok' : 'WRONG'}, row check ${row.ok ? 'ok' : 'WRONG'} (${row.ai_changes} AI row changes${row.other_changes ? ', ' + row.other_changes + ' by owner/staff during the task' : ''})`);
  // 7 decide
  let verdict = 'GREEN'; let restoredOk = null;
  if (fails.length) {
    verdict = 'RED'; note('7 RED: ' + fails.slice(0, 6).join(' | '));
    // keep the evidence: the AI's change-log rows are saved to a file and put back after the restore (the restore itself rolls the log back too)
    const evidence = await run('DB', async (c) => (await c.query('SELECT actor, task_number, table_name, row_id, operation, before_json, after_json, changed_at FROM guard.change_log WHERE id > $1 ORDER BY id', [since])).rows).catch(() => []);
    fs.writeFileSync(path.join(OUT, `task_${task}_changes.json`), JSON.stringify(evidence, null, 1));
    // restore the database exactly as it was
    sh('psql', [...adminArgs(), '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${dbname}' AND pid <> pg_backend_pid()`], adminEnv());
    const rs = sh('pg_restore', ['--clean', '--if-exists', '--create', ...adminArgs(), '-d', 'postgres', file], adminEnv());
    const check = await run('DB', snap.take).catch((e) => ({ err: e.message }));
    const same = check && !check.err && compare(before, check, {}).ok; restoredOk = !!same; note('  database restored: ' + (same ? 'numbers equal to before' : 'NOT VERIFIED ' + (rs.stderr || '').split('\n')[0]));
    try { const { withClient } = require('./db'); await withClient({ ...conf('DB'), user: process.env.GUARD_ADMIN_USER || conf('DB').user, password: process.env.GUARD_ADMIN_PASSWORD || conf('DB').password }, async (c) => {
      for (const e of evidence) await c.query('INSERT INTO guard.change_log (actor, task_number, table_name, row_id, operation, before_json, after_json, changed_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [e.actor, e.task_number, e.table_name, e.row_id, e.operation + ' (UNDONE)', e.before_json, e.after_json, e.changed_at]);
      await c.query(`INSERT INTO guard.change_log (actor, task_number, table_name, operation) VALUES ('guard', $1, '(whole database)', 'RESTORED FROM BACKUP')`, [String(task)]); }); } catch (e) { note('  evidence not put back in the log: ' + e.message.split('\n')[0]); }
    // undo only the commits this task made
    if (sha) { const head = sh('git', ['-C', repo, 'rev-parse', 'HEAD']).stdout.trim(); if (head && head !== sha) { const rv = sh('git', ['-C', repo, 'revert', '--no-edit', `${sha}..HEAD`]); if (rv.status !== 0) { sh('git', ['-C', repo, 'revert', '--abort']); note('  git undo FAILED (left as is): ' + (rv.stderr || '').split('\n')[0]); } else note('  task commits undone with git revert'); } }
  } else note('7 GREEN: changes kept');
  if (process.env.GUARD_START_CMD) { const s = shell(process.env.GUARD_START_CMD); note('  app started' + (s.status === 0 ? '' : ' (start command returned ' + s.status + ')')); }
  const msg = verdict === 'GREEN' ? `RBH GUARD task ${task}: GREEN. Changes kept.` : `RBH GUARD task ${task}: RED, undone${restoredOk ? '' : ' (CHECK RESTORE)'}.\n${fails.slice(0, 5).join('\n')}`;
  const a = await alert.send(msg);
  fs.writeFileSync(path.join(OUT, `task_${task}.json`), JSON.stringify({ task, verdict, fails, before, after, log, taskOut, alert: a, backup: file }, null, 1));
  console.log(verdict + (verdict === 'RED' ? ' (restored: ' + restoredOk + ')' : '')); process.exit(verdict === 'GREEN' ? 0 : 2);
}
main().catch(async (e) => { console.error('GUARD STOPPED: ' + e.message); process.exit(4); });
