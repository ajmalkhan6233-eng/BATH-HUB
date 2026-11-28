// SHOP SYNC (AJ 27 Nov). READ ONLY on the shop database. Writes DATA/SHOP_LATEST + SYNC_STATUS.md into a dedicated clone of the PRIVATE
// Universal repo and pushes. Runs every 15 minutes and at logon (task RBH_ShopSync).
// Only the tables and columns listed in DATA/SHOP_LATEST/MANIFEST.md are exported (a whitelist: logins, passwords, staff, investor and
// home/personal records are not in it). Phones are cut to the last 3 digits; any 9+ digit run (account numbers) is hidden.
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const HOME_WORDS = /\b(home|personal|family|household)\b/i;
function clean(column, value) {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (/phone|whatsapp/i.test(column)) return s ? '***' + s.replace(/\D/g, '').slice(-3) : '';
  if (!/_at$|date/i.test(column)) s = s.replace(/(?<![\d.])\d{9,}(?![\d.])/g, '#hidden#');
  return s;
}
const cell = (s) => (/[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s);
const parseManifest = (md) => md.split(/\r?\n/).map((l) => l.split('|').map((x) => x.trim()))
  .filter((p) => p.length >= 5 && /^[a-z_]+$/.test(p[1]) && /^\d+$/.test(p[2]))
  .map((p) => ({ table: p[1], columns: p[3].split(',').map((c) => c.trim()).filter((c) => /^[a-z0-9_]+$/.test(c)), left: p[4] }));

async function main() {
  const ROOT = path.join(__dirname, '..', '..');
  require('dotenv').config({ path: path.join(ROOT, '.env'), quiet: true });
  const REPO = process.env.RBH_SYNC_DIR || 'C:\\Users\\Sony\\ai-sync';
  const OUT = path.join(REPO, 'DATA', 'SHOP_LATEST');
  const git = (...a) => execFileSync('git', ['-C', REPO, ...a], { stdio: 'pipe', timeout: 90000, windowsHide: true }).toString();
  try { git('pull', '--rebase', '--autostash', '-q'); } catch (e) { try { git('rebase', '--abort'); } catch (_) {} console.log('pull skipped (offline?)'); }
  const manifest = fs.readFileSync(path.join(OUT, 'MANIFEST.md'), 'utf8');
  const pool = require(path.join(ROOT, 'utils', 'pool'));
  const rows = [];
  for (const t of parseManifest(manifest)) {
    const have = new Set((await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1", [t.table])).rows.map((r) => r.column_name));
    const cols = t.columns.filter((c) => have.has(c));
    if (!cols.length) continue;
    let data = (await pool.query(`SELECT ${cols.map((c) => `"${c}"::text AS "${c}"`).join(', ')} FROM "${t.table}" ORDER BY 1`)).rows;
    if (/expense|petty|bank_transactions/.test(t.table)) data = data.filter((r) => !HOME_WORDS.test(Object.values(r).join(' ')));
    fs.writeFileSync(path.join(OUT, t.table + '.csv'), [cols.join(','), ...data.map((r) => cols.map((c) => cell(clean(c, r[c]))).join(','))].join('\n') + '\n');
    rows.push(`| ${t.table} | ${data.length} | ${cols.join(', ')} | ${t.left} |`);
  }
  const bill = (await pool.query('SELECT bill_number, created_at::text AS at FROM pos_bills ORDER BY created_at DESC, id DESC LIMIT 1')).rows[0];
  const noItems = Number((await pool.query('SELECT COUNT(*) n FROM pos_bills b WHERE NOT EXISTS (SELECT 1 FROM pos_bill_items i WHERE i.bill_id=b.id)')).rows[0].n);
  // 28 Nov: the last 100 screen and server errors, so chat can read them (no stack, numbers hidden)
  let errors = [];
  try { errors = (await pool.query("SELECT to_char(e.at AT TIME ZONE 'Asia/Colombo','YYYY-MM-DD HH24:MI') AS at, e.page, e.message, e.count FROM client_errors e ORDER BY e.at DESC LIMIT 100")).rows; } catch (_) { /* no table yet */ }
  await pool.end();
  const hide = (s) => clean('message', s).replace(/\+?\d(?:[ -]?\d){8,}/g, '#').replace(/\|/g, '/');
  fs.writeFileSync(path.join(OUT, 'ERRORS.md'), [`# Last ${errors.length} app errors (newest first)`, '', '| time | page | what | times |', '|---|---|---|---|', ...errors.map((e) => `| ${e.at} | ${hide(e.page)} | ${hide(e.message)} | ${e.count} |`)].join('\n') + '\n');
  const now = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Colombo', hour12: false });
  const head = manifest.split(/\r?\n/).filter((l) => !/^\|/.test(l)).join('\n').replace(/^Taken:.*$/m, `Taken: ${now} Sri Lanka, automatic, from the live PC database.`).trim();
  fs.writeFileSync(path.join(OUT, 'MANIFEST.md'), `${head}\n\n| table | rows | columns | left out |\n|---|---|---|---|\n${rows.join('\n')}\n`);
  fs.writeFileSync(path.join(OUT, 'SYNC_STATUS.md'), `# Shop sync\nLast sync: ${now} (Sri Lanka)\nLatest bill: ${bill ? `${bill.bill_number} (${bill.at.slice(0, 16)})` : 'none'}\nTables: ${rows.length}\nBills with no item lines: ${noItems}\n`);
  git('add', 'DATA/SHOP_LATEST');
  if (git('status', '--porcelain', 'DATA/SHOP_LATEST').trim()) git('commit', '-q', '-m', 'shop sync (auto)');
  try { git('push', '-q'); } catch (e) { git('pull', '--rebase', '--autostash', '-q'); git('push', '-q'); }
  console.log('synced', rows.length, 'tables, latest', bill && bill.bill_number, 'no-item bills', noItems);
}

module.exports = { clean, parseManifest };
if (require.main === module) main().then(() => process.exit(0)).catch((e) => { console.error('SYNC FAILED:', String(e.message).split('\n')[0]); process.exit(1); });
