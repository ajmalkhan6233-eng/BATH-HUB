'use strict';
// Keeps the shop's WhatsApp bridge (pm2 "whatsapp-bridge", port 3001) alive. No AI, no usage. Touches ONLY pm2 "whatsapp-bridge".
// Runs at computer start, at sign-in, and every 5 minutes (scripts\pc\rbh_install_bridge_guard.ps1). Never starts a second copy.
// Logs one line per action to logs\bridge_guard.log (nothing when all is well).
const fs = require('fs'), http = require('http'), path = require('path'), { execFile } = require('child_process');
const root = path.resolve(__dirname, '..', '..'), logDir = path.join(root, 'logs'), logFile = path.join(logDir, 'bridge_guard.log');
const log = m => { try { fs.mkdirSync(logDir, { recursive: true }); fs.appendFileSync(logFile, new Date().toISOString() + ' ' + m + '\n'); } catch (_) {} };
const pm2 = args => new Promise(res => execFile('pm2', args, { shell: true, windowsHide: true, cwd: root, timeout: 90000, maxBuffer: 20 * 1024 * 1024 }, (e, out) => res({ ok: !e, out: String(out || '') })));
const up = () => new Promise(res => { const r = http.get('http://127.0.0.1:3001/qr', { timeout: 5000 }, x => { x.resume(); res(x.statusCode < 500); }); r.on('timeout', () => { r.destroy(); res(false); }); r.on('error', () => res(false)); });

// Decide what to do from the pm2 list and the port. Pure, so it can be tested.
function decide({ reachable, found, status }) {
  if (reachable) return 'none';                       // answering: leave it alone (even if it shows a QR, that is AJ's job)
  if (!found) return 'start';                         // not in pm2 at all: start the one from ecosystem.config.js
  if (status === 'online') return 'restart_wait';     // pm2 says online but not answering: give it time first (starting up)
  return 'restart';                                   // stopped / errored
}
module.exports = { decide };

if (require.main === module) (async () => {
  if (await up()) return;
  const l = await pm2(['jlist']); let found = false, status = '';
  try { const a = JSON.parse(l.out.slice(l.out.indexOf('['))); const p = a.find(x => x.name === 'whatsapp-bridge'); if (p) { found = true; status = p.pm2_env && p.pm2_env.status; } } catch (_) {}
  const act = decide({ reachable: false, found, status });
  if (act === 'restart_wait') { await new Promise(r => setTimeout(r, 45000)); if (await up()) return; }
  const r = act === 'start' ? await pm2(['start', 'ecosystem.config.js', '--only', 'whatsapp-bridge']) : await pm2(['restart', 'whatsapp-bridge']);
  await pm2(['save']);
  log((act === 'restart_wait' ? 'restart' : act) + ' whatsapp-bridge ' + (r.ok ? 'ok' : 'FAILED') + ' (was: ' + (found ? status : 'missing') + ')');
})();
