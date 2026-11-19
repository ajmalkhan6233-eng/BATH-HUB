'use strict';
// READ-ONLY WhatsApp login diagnosis (no secrets, changes nothing).  node scripts/audit/wa_session_diag.js
// Answers: WHY does WhatsApp ask for a QR again after the PC restarts? Prints where the login is stored, how pm2 started the bridge, and the
// log lines that mention disconnects, logouts and QR requests, with their times.
const fs = require('fs'), path = require('path'), cp = require('child_process');
const root = path.resolve(__dirname, '..', '..'), out = [];
const say = m => { out.push(m); console.log(m); };
function stat(p) { try { const s = fs.statSync(p); return s.isDirectory() ? 'folder, changed ' + s.mtime.toISOString().slice(0, 16).replace('T', ' ') : 'file'; } catch (e) { return 'NOT FOUND'; } }
say('LOGIN FOLDER (should be here): ' + path.join(root, '.wwebjs_auth') + ' -> ' + stat(path.join(root, '.wwebjs_auth')));
say('  session inside: ' + (function () { try { return fs.readdirSync(path.join(root, '.wwebjs_auth')).join(', ') || 'empty'; } catch (e) { return 'none'; } })());
for (const alt of [process.cwd(), path.join(root, '..'), process.env.USERPROFILE || '']) { if (alt && path.resolve(alt) !== root && stat(path.join(alt, '.wwebjs_auth')) !== 'NOT FOUND') say('  ALSO FOUND a login folder in a different place: ' + path.join(alt, '.wwebjs_auth') + ' (' + stat(path.join(alt, '.wwebjs_auth')) + ')'); }
try {
  const l = JSON.parse(cp.execSync('pm2 jlist', { timeout: 10000 }).toString().replace(/^[^[]*/, '')); const p = l.find(x => x.name === 'whatsapp-bridge');
  if (p) say('PM2: status ' + p.pm2_env.status + ', restarts ' + p.pm2_env.restart_time + ', up since ' + new Date(p.pm2_env.pm_uptime).toISOString().slice(0, 16).replace('T', ' ') + ', started from folder: ' + p.pm2_env.pm_cwd);
  else say('PM2: whatsapp-bridge not listed');
} catch (e) { say('PM2: could not read (' + String(e.message).slice(0, 60) + ')'); }
const pat = /disconnected|LOGOUT|auth_failure|Auth failure|QR|qr code|LIVENESS|Cleared any orphaned|READY|ready/i;
for (const f of ['whatsapp_bridge.log', 'whatsapp_bridge_err.log']) {
  const file = path.join(root, f); if (!fs.existsSync(file)) { say(f + ': not found'); continue; }
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(x => pat.test(x)).slice(-14).map(x => x.slice(0, 160));
  say(f + ' (last ' + lines.length + ' matching lines):'); lines.forEach(x => say('  ' + x));
}
const dest = path.join(root, 'logs'); try { fs.mkdirSync(dest, { recursive: true }); fs.writeFileSync(path.join(dest, 'wa_session_diag.txt'), out.join('\n')); } catch (e) {}
