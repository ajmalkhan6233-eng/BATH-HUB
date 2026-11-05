'use strict';
// PCLINK JOB LIST (whitelist). Chat can only ask for these named jobs; nothing else ever runs. Add a job = chat pushes code, PC auto-updates.
// Every job: async (args, log) => text. `log(line)` shows live progress to chat. No secrets are ever returned.
const fs = require('fs'), path = require('path'), http = require('http');
const { execFile } = require('child_process');
const root = path.resolve(__dirname, '..', '..');
const sh = (cmd, args, o = {}) => new Promise(res => execFile(cmd, args, { cwd: o.cwd || root, shell: !!o.shell, windowsHide: true, timeout: o.timeout || 120000, maxBuffer: 20 * 1024 * 1024, env: Object.assign({}, process.env, o.env || {}) },
    (e, out, err) => res({ ok: !e, text: String(out || '') + (err ? '\n' + String(err) : '') + (e && !out ? '\n' + e.message : '') })));
const health = () => new Promise(r => { const q = http.get('http://localhost:' + (process.env.RBH_PORT || process.env.PORT || 3100) + '/health', { timeout: 5000 }, res => { res.resume(); r(res.statusCode); }); q.on('timeout', () => { q.destroy(); r(0); }); q.on('error', () => r(0)); });
const wait = ms => new Promise(r => setTimeout(r, ms));

// One SELECT only, run inside a READ ONLY transaction (the database itself refuses any write). 200 rows max, 15 s max.
function checkSql(sql) {
    const s = String(sql || '').trim().replace(/;\s*$/, '');
    if (!/^(select|with)\b/i.test(s)) throw new Error('only SELECT / WITH queries are allowed');
    if (s.includes(';')) throw new Error('one statement only');
    if (/\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|copy|vacuum|call|do)\b/i.test(s.replace(/'[^']*'/g, "''"))) throw new Error('write keywords are not allowed');
    if (/\b(password|passwd|secret|token|api_?key)\b/i.test(s.replace(/'[^']*'/g, "''"))) throw new Error('secret columns are not allowed');
    return s;
}

const jobs = {
    ping: async () => JSON.stringify({ time: new Date().toISOString(), node: process.version, health: await health(), commit: (await sh('git', ['rev-parse', '--short', 'HEAD'])).text.trim(), branch: (await sh('git', ['rev-parse', '--abbrev-ref', 'HEAD'])).text.trim() }),
    health: async () => 'health ' + await health(),
    pull: async (a, log) => { log('git pull --ff-only (branch work only)'); const b = (await sh('git', ['rev-parse', '--abbrev-ref', 'HEAD'])).text.trim(); if (b !== 'work') throw new Error('app folder is on branch ' + b + ', not work: nothing done'); const r = await sh('git', ['pull', '--ff-only']); if (!r.ok) throw new Error(r.text.slice(0, 500)); return r.text.trim().slice(-800); },
    restart_app: async (a, log) => { log('pm2 restart apex-server'); const r = await sh('pm2', ['restart', 'apex-server'], { shell: true, timeout: 60000 }); log('waiting 8 s'); await wait(8000); const h = await health(); if (h !== 200) throw new Error('restarted but health is ' + h + '\n' + r.text.slice(-300)); return 'apex-server restarted, health 200'; },
    morning_fix_status: async () => { try { return fs.readFileSync(path.join(root, 'logs', 'morning_fix.json'), 'utf8'); } catch (e) { return 'no morning_fix.json'; } },
    tail_log: async a => { const f = { watchdog: 'watchdog.log', morning: 'morning_fix.json', backup: 'github_backup.json' }[String(a && a.name)]; if (!f) throw new Error('name must be watchdog, morning or backup'); const n = Math.min(Number(a.lines) || 40, 200); try { return fs.readFileSync(path.join(root, 'logs', f), 'utf8').split(/\r?\n/).slice(-n).join('\n'); } catch (e) { return 'no such log yet'; } },
    code_sources_report: async (a, log) => { log('running scripts/dev/code_sources_report.js (read only)'); const r = await sh(process.execPath, ['scripts/dev/code_sources_report.js'], { timeout: 180000 }); return r.text; },
    query: async (a, log) => {
        const sql = checkSql(a && a.sql); log('read-only query: ' + sql.slice(0, 120));
        const pool = require('../../utils/pool'); const c = await pool.connect();
        try { await c.query('BEGIN READ ONLY'); await c.query("SET LOCAL statement_timeout = '15000'"); const r = await c.query(sql); await c.query('ROLLBACK');
            return r.rowCount + ' rows' + (r.rowCount > 200 ? ' (first 200)' : '') + '\n' + r.rows.slice(0, 200).map(x => JSON.stringify(x)).join('\n'); }
        catch (e) { try { await c.query('ROLLBACK'); } catch (x) { /* ignore */ } throw e; } finally { c.release(); }
    },
};
module.exports = { jobs, checkSql };
