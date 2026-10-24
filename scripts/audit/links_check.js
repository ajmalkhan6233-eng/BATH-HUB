'use strict';
// READ-ONLY links, bridge and settings check for the PC. Prints ONE line plus short heads-ups. Never prints .env values (only true/false for one flag).
//   node scripts/audit/links_check.js [baseUrl]
const http = require('http'), fs = require('fs'), path = require('path'), cp = require('child_process');
const PAGES = ['/health', '/owner', '/profit.html', '/pending_delivery.html', '/pos_billing.html'];
const get = (url, ms = 4000) => new Promise(res => { const r = http.get(url, rs => { let b = ''; rs.on('data', d => { if (b.length < 400) b += d; }); rs.on('end', () => res({ code: rs.statusCode, body: b })); }); r.setTimeout(ms, () => { r.destroy(); res({ code: 0, body: '' }); }); r.on('error', () => res({ code: 0, body: '' })); });
function flag(name) { try { const t = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8'); const m = t.match(new RegExp('^\\s*' + name + '\\s*=\\s*(\\S+)', 'm')); return m ? /^(true|1|yes)$/i.test(m[1].replace(/["']/g, '')) : null; } catch (e) { return null; } }
function judge({ pages, bridge, pm2Apex, flags, tasks }) {
  const bad = [];
  pages.filter(p => p.code !== 200).forEach(p => bad.push(p.path + ' ' + (p.code || 'no answer')));
  if (!/authenticated|ready|connected/i.test(bridge || '') ) bad.push('WhatsApp bridge not logged in');
  if (pm2Apex > 1) bad.push('apex-server listed ' + pm2Apex + ' times in pm2');
  if (flags.deduct === false) bad.push('POS_DEDUCT_STOCK is false (sales do not reduce stock)');
  if (tasks && tasks.length) tasks.forEach(t => bad.push('scheduled task ' + t + ' missing'));
  return { ok: bad.length === 0, line: bad.length ? 'LINKS ' + bad.length + ' HEADS-UP: ' + bad.slice(0, 4).join('; ') : 'LINKS OK: pages, bridge, settings, tasks' };
}
(async () => {
  if (require.main !== module) return;
  const base = process.argv[2] || 'http://localhost:3100';
  const pages = []; for (const p of PAGES) pages.push({ path: p, code: (await get(base + p)).code });
  const qr = (await get('http://127.0.0.1:3001/qr')).body;
  let pm2Apex = 0; try { pm2Apex = (JSON.parse(cp.execSync('pm2 jlist', { timeout: 8000 }).toString()).filter(x => x.name === 'apex-server')).length; } catch (e) {}
  let missing = []; if (process.platform === 'win32') for (const t of ['RBH_Watchdog', 'RBH_BridgeGuard']) { try { cp.execSync('schtasks /query /tn ' + t, { stdio: 'ignore', timeout: 8000 }); } catch (e) { missing.push(t); } }
  const r = judge({ pages, bridge: qr, pm2Apex, flags: { deduct: flag('POS_DEDUCT_STOCK') }, tasks: missing });
  console.log(r.line);
})();
module.exports = { judge };
