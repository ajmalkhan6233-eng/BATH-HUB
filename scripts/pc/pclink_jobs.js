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
    // Item names + Leo codes (Ajmal 5 Nov). mode "plan" changes nothing. mode "apply" makes a database backup first and stops if it fails.
    catalog_fix: async (a, log) => {
        for (const m of ['../../routes/item_catalog_fix', '../../scripts/renumber_item_codes']) { try { delete require.cache[require.resolve(m)]; } catch (e) { /* not loaded yet */ } } const F = require('../../routes/item_catalog_fix'), pool = require('../../utils/pool'); const mode = String((a && a.mode) || 'plan');
        if (mode === 'plan') { const p = await F.plan(pool, a && a.extra); return JSON.stringify({ products: p.products, will_rename: p.renames.length, will_change_codes: p.codes.length, grn_lines_with_old_codes: p.grn_lines_with_old_codes, skipped: p.skipped, problems: p.problems }) + '\nRENAMES\n' + p.renames.map(r => r.code + ' | ' + r.old + ' => ' + r.new).join('\n') + '\nCODES\n' + p.codes.map(c => c.old + ' => ' + c.new + ' | ' + c.name).join('\n'); }
        if (mode !== 'apply') throw new Error('mode must be plan or apply');
        log('backup first'); const B = require('./github_backup'); const env = Object.assign({}, B.readEnv(path.join(root, '.env')), process.env);
        const dir = path.join(root, 'backups'); fs.mkdirSync(dir, { recursive: true }); const out = path.join(dir, 'pre_catalog_fix_' + new Date().toISOString().replace(/[:.]/g, '-') + '.sql.gz');
        await B.dumpDb(env, out); if (fs.statSync(out).size < 500) throw new Error('backup looks empty: nothing changed'); log('backup ok ' + path.basename(out));
        const r = await F.apply(pool, { extra: a && a.extra }); if (!r.ok) throw new Error(r.error); return JSON.stringify(r);
    },
    // Fazaal twins (AJ 5 Nov): the real item (200+) takes the typed number 059-098, the empty placeholder is retired. mode plan changes nothing; apply backs up first.
    dupe_merge: async (a, log) => {
        for (const m of ['../../routes/item_dupe_merge', '../../scripts/renumber_item_codes']) { try { delete require.cache[require.resolve(m)]; } catch (e) { /* not loaded */ } } const M = require('../../routes/item_dupe_merge'), pool = require('../../utils/pool'); const mode = String((a && a.mode) || 'plan');
        if (mode === 'plan') { const p = await M.plan(pool, a && a.extra); return JSON.stringify({ will_merge: p.pairs.length, problems: p.problems, skipped: p.skipped }) + '\n' + p.pairs.map(x => x.twin_code + ' (stock ' + x.twin_stock + ') takes ' + x.code + ' | ' + x.name).join('\n'); }
        if (mode !== 'apply') throw new Error('mode must be plan or apply');
        log('backup first'); const B = require('./github_backup'); const env = Object.assign({}, B.readEnv(path.join(root, '.env')), process.env);
        const dir = path.join(root, 'backups'); fs.mkdirSync(dir, { recursive: true }); const out = path.join(dir, 'pre_dupe_merge_' + new Date().toISOString().replace(/[:.]/g, '-') + '.sql.gz');
        await B.dumpDb(env, out); if (fs.statSync(out).size < 500) throw new Error('backup looks empty: nothing changed'); log('backup ok ' + path.basename(out));
        const r = await M.apply(pool, { extra: a && a.extra }); if (!r.ok) throw new Error(r.error); return JSON.stringify(r);
    },
    // Why does the PC switch off? Read only: Windows event log (unexpected shutdown 41/6008, planned 1074/1076, CPU heat 37), battery, uptime.
    power_events: async (a, log) => {
        log('reading the Windows event log (read only)');
        const ps = "$e=Get-WinEvent -FilterHashtable @{LogName='System';Id=41,6008,1074,1076,37;StartTime=(Get-Date).AddDays(-14)} -ErrorAction SilentlyContinue | Select-Object -First 25 | ForEach-Object { ($_.TimeCreated.ToString('yyyy-MM-dd HH:mm')+' | id '+$_.Id+' | '+$_.ProviderName+' | '+(($_.Message -split \"`n\")[0])) }; if($e){$e}else{'no shutdown events in 14 days'}; $b=Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue; if($b){'battery % '+$b.EstimatedChargeRemaining+' status '+$b.BatteryStatus}else{'no battery (desktop)'}; 'boot '+(Get-CimInstance Win32_OperatingSystem).LastBootUpTime.ToString('yyyy-MM-dd HH:mm'); 'now '+(Get-Date).ToString('yyyy-MM-dd HH:mm')";
        const r = await sh('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { timeout: 60000 }); return r.text;
    },
    // What opens a browser or a web link when Windows or the app starts. Read only; cleaning is a separate step AJ approves.
    startup_scan: async (a, log) => {
        log('scanning startup items (read only)');
        const ps = [
            "Write-Output '== STARTUP FOLDERS =='",
            "Get-ChildItem \"$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\",\"$env:ProgramData\\Microsoft\\Windows\\Start Menu\\Programs\\StartUp\" -ErrorAction SilentlyContinue | ForEach-Object { $t=''; if($_.Extension -eq '.lnk'){ $t=(New-Object -ComObject WScript.Shell).CreateShortcut($_.FullName).TargetPath+' '+(New-Object -ComObject WScript.Shell).CreateShortcut($_.FullName).Arguments }; $_.FullName+' -> '+$t }",
            "Write-Output '== RUN KEYS =='",
            "foreach($k in 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run','HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'){ (Get-ItemProperty $k -ErrorAction SilentlyContinue).PSObject.Properties | Where-Object { $_.Name -notlike 'PS*' } | ForEach-Object { $k+' | '+$_.Name+' = '+$_.Value } }",
            "Write-Output '== SCHEDULED TASKS THAT OPEN A BROWSER OR LINK =='",
            "Get-ScheduledTask | Where-Object { $_.State -ne 'Disabled' } | ForEach-Object { $n=$_.TaskName; $_.Actions | ForEach-Object { $c=($_.Execute+' '+$_.Arguments); if($c -match 'msedge|chrome|firefox|http|explorer|start ') { $n+' | '+$c } } }",
        ].join('; ');
        const r = await sh('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { timeout: 60000 }); return r.text;
    },
    // Saved-bill drafts (data/grn_bills.json): vendor | bill | code | name | qty | unit cost. Read only.
    read_drafts: async () => { const L = JSON.parse(fs.readFileSync(path.join(root, 'data', 'grn_bills.json'), 'utf8')); const out = []; L.forEach((b, i) => (b.lines || []).forEach(l => out.push([i, b.vendor || b.supplier || '?', (b.bill_no || b.number || b.date || ''), l.code, l.name, l.qty, l.unit].join(' | ')))); return out.length + ' lines\n' + out.join('\n'); },
    query: async (a, log) => {
        const sql = checkSql(a && a.sql); log('read-only query: ' + sql.slice(0, 120));
        const pool = require('../../utils/pool'); const c = await pool.connect();
        try { await c.query('BEGIN READ ONLY'); await c.query("SET LOCAL statement_timeout = '15000'"); const r = await c.query(sql); await c.query('ROLLBACK');
            return r.rowCount + ' rows' + (r.rowCount > 200 ? ' (first 200)' : '') + '\n' + r.rows.slice(0, 200).map(x => JSON.stringify(x)).join('\n'); }
        catch (e) { try { await c.query('ROLLBACK'); } catch (x) { /* ignore */ } throw e; } finally { c.release(); }
    },
};
module.exports = { jobs, checkSql };
