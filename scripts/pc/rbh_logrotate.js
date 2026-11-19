'use strict';
// Keeps the apex-server logs small. Plain code, no AI. Scheduled daily by scripts\pc\rbh_install_tasks.ps1.
// For ONLY the pm2 app "apex-server": when a log passes 5 MB, save the last 500 KB into logs\archive\ and empty that log
// with "pm2 flush apex-server" (flushes only this app). Keeps the 5 newest archives. Never touches other pm2 apps.
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const APP = 'apex-server', LIMIT = 5 * 1024 * 1024, KEEP_BYTES = 500 * 1024, KEEP_FILES = 5;
const root = path.resolve(__dirname, '..', '..');
const arch = path.join(root, 'logs', 'archive');
const pm2 = args => new Promise((ok, bad) => execFile('pm2', args, { shell: true, windowsHide: true, timeout: 60000, maxBuffer: 20 * 1024 * 1024 }, (e, out) => (e ? bad(e) : ok(String(out)))));

(async () => {
    const out = await pm2(['jlist']);
    const list = JSON.parse(out.slice(out.indexOf('['), out.lastIndexOf(']') + 1));
    const app = list.find(p => p.name === APP);
    if (!app) { console.log('apex-server not in pm2: nothing to do'); return; }
    const files = [app.pm2_env.pm_out_log_path, app.pm2_env.pm_err_log_path].filter(Boolean);
    let did = 0;
    for (const f of files) {
        let st; try { st = fs.statSync(f); } catch (e) { continue; }
        if (st.size <= LIMIT) continue;
        fs.mkdirSync(arch, { recursive: true });
        const fd = fs.openSync(f, 'r'); const len = Math.min(KEEP_BYTES, st.size); const buf = Buffer.alloc(len);
        fs.readSync(fd, buf, 0, len, st.size - len); fs.closeSync(fd);
        const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
        fs.writeFileSync(path.join(arch, `${path.basename(f)}.${stamp}.txt`), buf);
        did++;
    }
    if (did) await pm2(['flush', APP]);
    const old = fs.existsSync(arch) ? fs.readdirSync(arch).map(n => ({ n, t: fs.statSync(path.join(arch, n)).mtimeMs })).sort((a, b) => b.t - a.t).slice(KEEP_FILES) : [];
    for (const o of old) fs.unlinkSync(path.join(arch, o.n));
    console.log(`log rotate: ${did} log(s) trimmed, ${old.length} old archive(s) removed`);
})().catch(e => { console.error('log rotate error:', e.message); process.exit(1); });
