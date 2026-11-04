'use strict';
/**
 * TEST MODE helper (run on the shop PC by Claude Code, never by hand).
 *   node scripts/test_mode.js status                 shows TEST_MODE and whether a baseline exists
 *   node scripts/test_mode.js start                  takes the BASELINE copy of the database now (plain SQL, backups/test_baseline.sql)
 *   node scripts/test_mode.js wipe                   DRY RUN: says exactly what would happen. Changes nothing.
 *   node scripts/test_mode.js wipe --yes             puts the database back to the baseline. Refuses unless TEST_MODE=true in .env.
 * Wipe takes a safety copy of the CURRENT database first (backups/before_wipe-<time>.sql) so nothing is ever unrecoverable.
 * The app (apex-server) must be stopped during "wipe --yes" and started again after: Claude Code does that with pm2 --only apex-server.
 * Uses the same Postgres settings as the app (.env) and the same pg tools folder as the backups (PG_BIN).
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const stamp = (d = new Date()) => { const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; };

function tools(env) {
  const bin = env.PG_BIN || 'C:\\Program Files\\PostgreSQL\\18\\bin';
  const exe = (n) => (fs.existsSync(path.join(bin, n + '.exe')) ? path.join(bin, n + '.exe') : n);
  const base = ['-h', env.DB_HOST || '127.0.0.1', '-p', String(env.DB_PORT || 5432), '-U', env.DB_USER];
  return { dump: (file) => [exe('pg_dump'), [...base, '-d', env.DB_NAME, '--no-owner', '--no-privileges', '-f', file]],
           sql: (q) => [exe('psql'), [...base, '-d', env.DB_NAME, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-c', q]],
           file: (f) => [exe('psql'), [...base, '-d', env.DB_NAME, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', f]] };
}

function run({ cmd, args = [], root = path.join(__dirname, '..'), env = process.env, spawn = spawnSync, now = new Date(), log = console.log } = {}) {
  try { require('dotenv').config({ path: path.join(root, '.env'), quiet: true }); } catch (_) { /* optional */ }
  env = { ...process.env, ...env };
  const dir = env.BACKUP_DIR || path.join(root, 'backups');
  const baseline = path.join(dir, 'test_baseline.sql');
  const testOn = String(env.TEST_MODE || '').toLowerCase() === 'true';
  const t = tools(env);
  const exec = ([bin, a]) => spawn(bin, a, { env: { ...env, PGPASSWORD: env.DB_PASSWORD }, stdio: 'pipe', encoding: 'utf8' });
  const fail = (m) => { log('FAILED: ' + m); return { ok: false, reason: m }; };

  if (cmd === 'status') {
    const r = { ok: true, test_mode: testOn, baseline: fs.existsSync(baseline) ? fs.statSync(baseline).mtime.toISOString() : null };
    log(JSON.stringify(r)); return r;
  }
  if (cmd === 'start') {
    fs.mkdirSync(dir, { recursive: true });
    const tmp = baseline + '.tmp';
    const r = exec(t.dump(tmp));
    if (r.status !== 0 || !fs.existsSync(tmp) || fs.statSync(tmp).size < 1000) { fs.rmSync(tmp, { force: true }); return fail('baseline copy failed'); }
    fs.renameSync(tmp, baseline);
    log(`Baseline saved (${fs.statSync(baseline).size} bytes). Now set TEST_MODE=true and TEST_WA_ALLOW=<owner number> in .env and restart apex-server.`);
    return { ok: true, baseline };
  }
  if (cmd === 'wipe') {
    if (!fs.existsSync(baseline)) return fail('no baseline: run "start" first');
    const steps = ['1. stop apex-server (pm2 stop apex-server)', `2. safety copy of the current database -> backups/before_wipe-${stamp(now)}.sql`,
      '3. DROP SCHEMA public CASCADE; CREATE SCHEMA public;', '4. load backups/test_baseline.sql', '5. start apex-server (pm2 start/restart apex-server --only)'];
    if (!args.includes('--yes')) { log('DRY RUN (nothing changed). Wipe would:\n' + steps.join('\n') + '\nTo do it: wipe --yes'); return { ok: true, dry: true, steps }; }
    if (!testOn) return fail('TEST_MODE is not true in .env: refusing to wipe');
    const safety = path.join(dir, `before_wipe-${stamp(now)}.sql`);
    let r = exec(t.dump(safety));
    if (r.status !== 0 || !fs.existsSync(safety) || fs.statSync(safety).size < 1000) return fail('safety copy failed, nothing wiped');
    r = exec(t.sql('DROP SCHEMA public CASCADE; CREATE SCHEMA public;'));
    if (r.status !== 0) return fail('could not clear the database (is apex-server stopped?). Safety copy kept: ' + path.basename(safety));
    r = exec(t.file(baseline));
    if (r.status !== 0) return fail('baseline load failed. RESTORE with: psql -f backups/' + path.basename(safety));
    log('Wiped to baseline. Safety copy: ' + path.basename(safety)); return { ok: true, safety };
  }
  return fail('use: status | start | wipe [--yes]');
}
if (require.main === module) { const r = run({ cmd: process.argv[2], args: process.argv.slice(3) }); process.exitCode = r.ok ? 0 : 1; }
module.exports = { run };
