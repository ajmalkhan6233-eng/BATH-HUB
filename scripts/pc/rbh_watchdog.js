'use strict';
// Runner for utils/rbhWatchdog.js. Scheduled every 5 minutes by scripts\pc\rbh_install_tasks.ps1. No AI, no usage.
// Writes logs\watchdog.log (plain lines). Touches ONLY pm2 "apex-server".
const fs = require('fs');
const http = require('http');
const path = require('path');
const { execFile } = require('child_process');
const W = require('../../utils/rbhWatchdog');

const root = path.resolve(__dirname, '..', '..');
const logDir = path.join(root, 'logs');
const logFile = path.join(logDir, 'watchdog.log');
const localConfig = path.join(root, 'local_ops', 'ecosystem.local.config.js');

const pm2 = args => new Promise((ok, bad) => execFile('pm2', args, { shell: true, windowsHide: true, timeout: 60000, maxBuffer: 20 * 1024 * 1024 }, (e, out) => (e ? bad(e) : ok(String(out)))));

const deps = {
    port: Number(process.env.RBH_PORT) || 3100,
    sleep: ms => new Promise(r => setTimeout(r, ms)),
    health: url => new Promise(resolve => {
        const req = http.get(url, { timeout: 5000 }, res => { res.resume(); resolve({ ok: res.statusCode === 200, status: res.statusCode }); });
        req.on('timeout', () => { req.destroy(); resolve({ ok: false, status: 0 }); });
        req.on('error', () => resolve({ ok: false, status: 0 }));
    }),
    pm2List: async () => {
        const out = await pm2(['jlist']);
        const a = out.indexOf('['), b = out.lastIndexOf(']');
        const list = JSON.parse(out.slice(a, b + 1));
        return list.map(p => {
            const e = p.pm2_env || {};
            return { name: p.name, status: e.status, errLog: e.pm_err_log_path, port: Number(e.PORT || (e.env && e.env.PORT)) || null };
        });
    },
    pm2Restart: () => pm2(['restart', W.APP]),
    pm2Start: () => pm2(['start', `"${localConfig}"`, '--only', W.APP]),
    hasLocalConfig: async () => fs.existsSync(localConfig),
    readTail: async (file, n) => { try { return fs.readFileSync(file, 'utf8').split(/\r?\n/).slice(-n).join('\n'); } catch (e) { return ''; } },
    readLog: async () => { if (process.env.RBH_MANUAL) return ''; try { return fs.readFileSync(logFile, 'utf8'); } catch (e) { return ''; } },   // RBH_MANUAL=1 (the desktop shortcut): Aj asked, so no crash-loop block
    appendLog: async line => {
        fs.mkdirSync(logDir, { recursive: true });
        let cur = ''; try { cur = fs.readFileSync(logFile, 'utf8'); } catch (e) { /* first line */ }
        fs.writeFileSync(logFile, W.trimLog(cur + line + '\n'));
    },
};

W.runOnce(deps).then(r => { if (r.state !== 'up' && r.state !== 'blip') console.log(JSON.stringify(r)); process.exit(['still_down', 'failed', 'blocked', 'crashloop'].includes(r.state) ? 2 : 0); })
    .catch(e => { console.error('watchdog error:', e.message); process.exit(1); });
