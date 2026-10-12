'use strict';
/**
 * Database backup every 30 minutes (Windows Task Scheduler runs this file). Cheap on purpose:
 *  - the dump is small plain SQL (a few hundred KB); a run is SKIPPED when nothing changed since the last backup (hash of the dump, ignoring the random \restrict lines)
 *  - keeps the newest 48 (about a day of half-hours), plus the newest of each of the last 14 days, plus the newest of each of the last 8 weeks; deletes the rest
 *  - only files named bathco_owner-YYYY-MM-DD_HHmm.sql inside backups/ are ever touched; backups/ is ignored by git
 * Needs DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD in the app's .env (read here, never printed). pg_dump path: PG_DUMP or the PostgreSQL 18 default.
 * An encrypted off-machine copy is made only when BACKUP_COPY_DIR and BACKUP_PASSPHRASE are set (scripts/backup_encrypt.js); a failed copy never removes a backup.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const NAME_RE = /^bathco_owner-(\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})\.sql$/;
const KEEP_RECENT = 48, KEEP_DAYS = 14, KEEP_WEEKS = 8;

const stamp = (d) => { const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`; };
function parseName(name) { const m = NAME_RE.exec(name); return m ? { name, day: `${m[1]}-${m[2]}-${m[3]}`, t: Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) } : null; }
function weekKey(t) { const d = new Date(t); const day = (d.getUTCDay() + 6) % 7; const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day)); return monday.toISOString().slice(0, 10); }

/** names -> { keep: [...], remove: [...] }. Files that do not match the backup name are never listed. */
function plan(names) {
  const files = names.map(parseName).filter(Boolean).sort((a, b) => b.t - a.t);
  const keep = new Set(files.slice(0, KEEP_RECENT).map((f) => f.name));
  const days = new Set(), weeks = new Set();
  for (const f of files) {
    if (!days.has(f.day) && days.size < KEEP_DAYS) { days.add(f.day); keep.add(f.name); }
    const w = weekKey(f.t);
    if (!weeks.has(w) && weeks.size < KEEP_WEEKS) { weeks.add(w); keep.add(f.name); }
  }
  return { keep: files.filter((f) => keep.has(f.name)).map((f) => f.name), remove: files.filter((f) => !keep.has(f.name)).map((f) => f.name) };
}
const dumpHash = (text) => crypto.createHash('sha256').update(String(text).split('\n').filter((l) => !/^\\(un)?restrict\b/.test(l)).join('\n')).digest('hex');

function run({ root = path.join(__dirname, '..'), env = process.env, now = new Date(), spawn = spawnSync } = {}) {
  try { require('dotenv').config({ path: path.join(root, '.env'), quiet: true }); } catch (_) { /* dotenv optional */ }
  const dir = env.BACKUP_DIR || path.join(root, 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `bathco_owner-tmp-${process.pid}.sql`);
  const pgDump = env.PG_DUMP || 'C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe';
  const r = spawn(pgDump, ['-h', env.DB_HOST || '127.0.0.1', '-p', String(env.DB_PORT || 5432), '-U', env.DB_USER, '-d', env.DB_NAME, '-f', tmp], { env: { ...env, PGPASSWORD: env.DB_PASSWORD }, stdio: 'pipe' });
  if (r.status !== 0 || !fs.existsSync(tmp) || fs.statSync(tmp).size < 1000) { fs.rmSync(tmp, { force: true }); return { ok: false, reason: 'dump failed' }; }
  const hash = dumpHash(fs.readFileSync(tmp, 'utf8'));
  const hashFile = path.join(dir, '.last_hash');
  const last = fs.existsSync(hashFile) ? fs.readFileSync(hashFile, 'utf8').trim() : '';
  if (hash === last) { fs.rmSync(tmp, { force: true }); return { ok: true, skipped: true }; }
  const final = path.join(dir, `bathco_owner-${stamp(now)}.sql`);
  fs.renameSync(tmp, final); fs.writeFileSync(hashFile, hash);
  const { remove } = plan(fs.readdirSync(dir));
  for (const n of remove) fs.rmSync(path.join(dir, n), { force: true });
  if (env.BACKUP_COPY_DIR && env.BACKUP_PASSPHRASE) spawn(process.execPath, [path.join(root, 'scripts', 'backup_encrypt.js'), final], { cwd: root, stdio: 'pipe' });
  return { ok: true, saved: path.basename(final), removed: remove.length };
}
if (require.main === module) { const r = run(); console.log(JSON.stringify(r)); process.exitCode = r.ok ? 0 : 1; }
module.exports = { plan, dumpHash, run, parseName };
