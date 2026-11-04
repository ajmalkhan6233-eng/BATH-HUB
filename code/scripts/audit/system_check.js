'use strict';
// SYSTEM CHECK: are the bridge, watchdog, scheduled tasks, backups and links there? Read-only. Prints one short line per item.
//   node scripts/audit/system_check.js
// Items that need the shop PC (pm2, Windows scheduled tasks, port 3100/3001) say SKIP when run anywhere else: that is NOT a pass.
const fs = require('fs');
const path = require('path');
const http = require('http');
const { execFile } = require('child_process');
const root = path.join(__dirname, '..', '..');
const onWindows = process.platform === 'win32';
const rows = [];
const add = (status, what, detail = '') => rows.push({ status, what, detail });

const run = (cmd, args) => new Promise((res) => execFile(cmd, args, { shell: true, windowsHide: true, timeout: 20000, maxBuffer: 4 * 1024 * 1024 }, (e, out) => res(e ? null : String(out))));
const get = (url) => new Promise((res) => { const r = http.get(url, { timeout: 4000 }, (x) => { x.resume(); res(x.statusCode); }); r.on('error', () => res(null)); r.on('timeout', () => { r.destroy(); res(null); }); });

(async () => {
  // 1. the files that keep the shop alive are in the repo
  for (const f of ['scripts/pc/rbh_bridge_guard.js', 'scripts/pc/rbh_install_bridge_guard.ps1', 'scripts/pc/rbh_watchdog.js', 'scripts/pc/rbh_install_tasks.ps1', 'scripts/pc/bridge_watcher.js', 'scripts/backup_owner_db.ps1', 'scripts/restore_encrypted_backup.js', 'ecosystem.config.js', 'utils/notify.js']) {
    add(fs.existsSync(path.join(root, f)) ? 'OK' : 'MISSING', `file ${f}`);
  }
  // 2. what is switched on (names only, never values)
  const env = {}; try { fs.readFileSync(path.join(root, '.env'), 'utf8').split(/\r?\n/).forEach((l) => { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if (m) env[m[1]] = m[2].trim(); }); } catch (_) { /* no .env here */ }
  if (Object.keys(env).length) {
    for (const k of ['WHATSAPP_VIA', 'WHATSAPP_LIVE', 'AUTO_SEND', 'LAYLA_OWNER_LIVE', 'POS_DEDUCT_STOCK', 'LOGIN_DISABLED']) add('INFO', `setting ${k}`, env[k] === undefined ? 'not set' : /secret|token|key|pass/i.test(k) ? 'set' : env[k]);
    add(env.LOGIN_DISABLED === 'true' ? 'WARN' : 'OK', 'login is switched on', env.LOGIN_DISABLED === 'true' ? 'LOGIN_DISABLED=true: anyone on the network is the owner' : '');
  } else add('SKIP', 'settings (.env)', 'no .env on this machine');
  // 3. the live pieces (shop PC only)
  const h = await get('http://127.0.0.1:3100/health');
  add(h === 200 ? 'OK' : h === null ? 'SKIP' : 'RED', 'shop app answers on port 3100', h === null ? 'not reachable from here (UNVERIFIED unless run on the shop PC)' : String(h));
  const b = await get('http://127.0.0.1:3001/qr');
  add(b !== null && b < 500 ? 'OK' : b === null ? 'SKIP' : 'RED', 'WhatsApp bridge answers on port 3001', b === null ? 'not reachable from here (UNVERIFIED unless run on the shop PC)' : String(b));
  const pm2 = await run('pm2', ['jlist']);
  if (pm2) {
    let list = []; try { list = JSON.parse(pm2.slice(pm2.indexOf('['))); } catch (_) { /* ignore */ }
    for (const n of ['apex-server', 'whatsapp-bridge']) { const p = list.find((x) => x.name === n); add(p && p.pm2_env.status === 'online' ? 'OK' : 'RED', `pm2 ${n}`, p ? p.pm2_env.status : 'not in pm2'); }
  } else add('SKIP', 'pm2 list', 'pm2 not available here');
  if (onWindows) {
    const tasks = await run('schtasks', ['/query', '/fo', 'csv', '/nh']);
    for (const n of ['RBH_Watchdog', 'RBH_BridgeGuard', 'RBH_BridgeWatcher', 'RBH_LogTidy']) add(tasks && tasks.includes(n) ? 'OK' : 'RED', `scheduled task ${n}`, tasks ? '' : 'could not read the task list');
  } else add('SKIP', 'Windows scheduled tasks', 'not Windows');
  // 4. the newest backup is recent
  const dirs = [process.env.BACKUP_DIR, path.join(root, 'backups'), path.join(root, 'data', 'backups')].filter(Boolean);
  let newest = 0; for (const d of dirs) { try { for (const f of fs.readdirSync(d)) newest = Math.max(newest, fs.statSync(path.join(d, f)).mtimeMs); } catch (_) { /* no folder */ } }
  add(newest ? (Date.now() - newest < 26 * 3600e3 ? 'OK' : 'WARN') : 'SKIP', 'newest backup is under 26 hours old', newest ? `${Math.round((Date.now() - newest) / 3600e3)} h old` : 'no backup folder found here');

  const order = { RED: 0, MISSING: 0, WARN: 1, SKIP: 2, INFO: 3, OK: 4 };
  rows.sort((a, c) => order[a.status] - order[c.status]);
  for (const r of rows) console.log(`${r.status.padEnd(7)} ${r.what}${r.detail ? ' - ' + r.detail : ''}`);
  const bad = rows.filter((r) => r.status === 'RED' || r.status === 'MISSING').length, skip = rows.filter((r) => r.status === 'SKIP').length;
  console.log(bad ? `SYSTEM RED: ${bad} item(s) missing or down` : skip ? `SYSTEM GREEN so far, ${skip} item(s) not checkable from here (UNVERIFIED)` : 'SYSTEM GREEN');
  process.exit(bad ? 1 : 0);
})();
