'use strict';
// MORNING FIX (Ajmal 5 Nov 2026: "just fix everything and open the app"). Runs by itself ~40 s after the app starts on the PC.
// Order: 1) local DB backup (abort if it fails)  2) item codes  3) Metro double-count  4) private GitHub backup  5) open the app in the browser (once a day).
// Each step runs once only (logs/morning_fix.json), max 3 tries. Skip all: create local_ops/NO_MORNING_FIX.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const root = path.resolve(__dirname, '..');
const file = path.join(root, 'logs', 'morning_fix.json');
const load = () => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return { steps: {} }; } };
const save = s => { try { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(s, null, 1)); } catch (e) { /* ignore */ } };
let running = false;

async function step(s, name, fn) {
    const st = s.steps[name] = s.steps[name] || { done: false, tries: 0 };
    if (st.done || st.tries >= 3) return st.done;
    st.tries++; st.at = new Date().toISOString();
    try { const r = await fn(); st.done = true; st.msg = String(r || 'ok').slice(0, 300); }
    catch (e) { st.msg = 'NOT DONE: ' + String(e.message || e).slice(0, 250); }
    save(s); return st.done;
}

async function run(opts = {}) {
    if (running) return load();
    if (!opts.force && (fs.existsSync(path.join(root, 'local_ops', 'NO_MORNING_FIX')) || (process.platform !== 'win32' && process.env.RBH_MORNING_FIX !== 'force'))) return load();
    running = true;
    const s = load();
    try {
        const B = require('../scripts/pc/github_backup');
        const env = Object.assign({}, B.readEnv(path.join(root, '.env')), process.env);
        // 1) safety backup first; nothing is changed if it fails
        const ok = await step(s, 'pre_backup', async () => {
            const dir = path.join(root, 'backups'); fs.mkdirSync(dir, { recursive: true });
            const out = path.join(dir, 'pre_morning_fix_' + new Date().toISOString().replace(/[:.]/g, '-') + '.sql.gz');
            await B.dumpDb(env, out);
            const n = fs.statSync(out).size; if (n < 500) throw new Error('backup looks empty');
            return 'saved ' + Math.round(n / 1024) + ' KB';
        });
        if (ok) {
            await step(s, 'item_codes', async () => { const r = await require('../routes/item_codes_fix').applyFix(); if (!r.ok) throw new Error(r.error); return r.message; });
            await step(s, 'double_count', async () => {
                const G = require('../routes/grn_dupes'); const found = await G.plan();
                const nums = found.flatMap(f => f.duplicate_numbers.map(String));
                if (!nums.length) return 'nothing double-counted';
                const r = await G.fixDupes(nums); return r.lines + ' lines archived, ' + r.items + ' items corrected';
            });
            await step(s, 'github_backup', async () => { const r = await B.run({ force: true }); if (!r.ok) throw new Error(r.msg); return r.msg; });
        }
        // 5) open the app once per day
        const today = new Date().toISOString().slice(0, 10);
        if (s.opened !== today && (process.platform === 'win32' || opts.force)) {
            s.opened = today; save(s);
            if (process.platform === 'win32') { try { spawn('cmd', ['/c', 'start', '', 'http://localhost:' + (process.env.PORT || 3100) + '/owner'], { windowsHide: true, stdio: 'ignore', detached: true }).unref(); } catch (e) { /* ignore */ } }
        }
    } catch (e) { s.error = String(e.message).slice(0, 200); save(s); }
    finally { running = false; }
    return load();
}
module.exports = { run, status: load };
