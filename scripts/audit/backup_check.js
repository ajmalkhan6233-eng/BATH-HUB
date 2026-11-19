'use strict';
// READ-ONLY backup check (no restore into the live database). Usage: node scripts/audit/backup_check.js [backupsDir]
// Checks the newest backups\bathco_owner-*.sql: recent (<36h), not tiny, not much smaller than the one before, and holds the key tables.
// Then compares the row counts INSIDE the dump with the live tables (read-only counts) so a dump that is empty or cut short is caught.
const fs = require('fs'), path = require('path');
const KEY = ['products', 'pos_bills', 'pos_bill_items', 'pos_bill_payments', 'grn_records', 'customers'];
function newest(dir) {
  let f = []; try { f = fs.readdirSync(dir).filter(n => /^bathco_owner-.*\.sql$/.test(n)).map(n => ({ n, p: path.join(dir, n), s: fs.statSync(path.join(dir, n)) })); } catch (e) { return []; }
  return f.sort((a, b) => b.s.mtimeMs - a.s.mtimeMs);
}
function dumpCounts(text) {   // plain pg_dump: "COPY public.table (...) FROM stdin;" rows until "\."
  const out = {}; const re = /^COPY (?:public\.)?"?(\w+)"? \([^)]*\) FROM stdin;\r?\n([\s\S]*?)^\\\.\r?$/gm; let m;
  while ((m = re.exec(text))) out[m[1]] = m[2] ? m[2].split(/\r?\n/).filter(Boolean).length : 0;
  return out;
}
function judge({ files, counts, live, complete = true, now = Date.now() }) {
  const bad = [];
  if (!complete) bad.push('dump is cut short (no end marker)');
  if (!files.length) return { ok: false, line: 'BACKUP RED: no backup file found' };
  const a = files[0], b = files[1], ageH = (now - a.s.mtimeMs) / 36e5;
  if (ageH > 36) bad.push('newest is ' + Math.round(ageH) + 'h old');
  if (a.s.size < 20000) bad.push('file is tiny (' + a.s.size + ' bytes)');
  if (b && a.s.size < b.s.size * 0.5) bad.push('half the size of the one before');
  for (const t of KEY) {
    if (!(t in counts)) bad.push('table ' + t + ' missing in dump');
    else if (live && live[t] != null && counts[t] < live[t] * 0.9 - 5) bad.push(t + ' dump ' + counts[t] + ' vs live ' + live[t]);
  }
  return bad.length ? { ok: false, line: 'BACKUP RED: ' + bad.slice(0, 3).join('; ') } : { ok: true, line: 'BACKUP OK: ' + a.n + ' (' + Math.round(a.s.size / 1024) + ' KB, ' + Math.round(ageH) + 'h old, restore-readable)' };
}
async function run(dir, pool) {
  const files = newest(dir); if (!files.length) return judge({ files, counts: {} });
  const text = fs.readFileSync(files[0].p, 'utf8'); const counts = dumpCounts(text); const complete = /PostgreSQL database dump complete/.test(text.slice(-600)); let live = null;
  if (pool) { live = {}; for (const t of KEY) { try { live[t] = Number((await pool.query(`SELECT COUNT(*) AS c FROM ${t}`)).rows[0].c); } catch (e) {} } }
  return judge({ files, counts, live, complete });
}
module.exports = { newest, dumpCounts, judge, run, KEY };
if (require.main === module) {
  require('dotenv').config(); const pool = require('../../utils/pool');
  run(process.argv[2] || path.join(process.cwd(), 'backups'), pool).then(r => { console.log(r.line); return pool.end(); }).catch(e => { console.log('BACKUP CHECK ERROR', e.message); process.exit(1); });
}
