'use strict';
// Runner for utils/bridgeWatcher.js. Scheduled every 15 min by rbh_install_tasks.ps1. UNVERIFIED on the PC (written in the cloud).
// Folders (change with environment variables if yours differ):
//   RBH_BRIDGE_DIR  = the Universal-project- clone      (default: %USERPROFILE%\ai-bridge, else C:\Universal-project-)
//   RBH_PROJECT_DIR = the shop project folder           (default: C:\BATHCO_TEMPLATE)
const fs = require('fs');
const path = require('path');
const { spawnSync, spawn } = require('child_process');
const W = require('../../utils/bridgeWatcher');

const home = process.env.USERPROFILE || process.env.HOME || '.';
const bridgeDir = process.env.RBH_BRIDGE_DIR || [path.join(home, 'ai-bridge'), 'C:\\Universal-project-'].find(d => fs.existsSync(path.join(d, 'AI_BRIDGE', 'BRIDGE.md'))) || path.join(home, 'ai-bridge');
const projectDir = process.env.RBH_PROJECT_DIR || path.resolve(__dirname, '..', '..');   // the folder this script lives in
const logDir = path.join(projectDir, 'logs'); const logFile = path.join(logDir, 'bridge_watcher.log');
const stateFile = path.join(logDir, 'bridge_watcher_state.json'); const lockFile = path.join(logDir, 'bridge_watcher.lock');
const stamp = () => new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Colombo' }).slice(0, 16);
const say = s => { try { fs.mkdirSync(logDir, { recursive: true }); fs.appendFileSync(logFile, `${stamp()} | ${s}\n`); } catch (e) { /* log is a bonus */ } };

(function main() {
    try {
        // one run at a time; a lock older than 3 hours is stale
        try { const age = Date.now() - fs.statSync(lockFile).mtimeMs; if (age < 3 * 3600e3) return; } catch (e) { /* no lock */ }
        const pull = spawnSync('git', ['-C', bridgeDir, 'pull', '--ff-only', '-q'], { encoding: 'utf8', timeout: 60000 });
        if (pull.status !== 0) { say(`could not update bridge folder ${bridgeDir}: ${String(pull.stderr || pull.error || '').trim().slice(0, 120)}`); return; }
        const md = fs.readFileSync(path.join(bridgeDir, 'AI_BRIDGE', 'BRIDGE.md'), 'utf8');
        let state = {}; try { state = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch (e) { /* first run */ }
        const today = stamp().slice(0, 10);
        const d = W.decide(md, state, today);
        if (!d.run) { if (d.why !== 'nothing new') say(d.why); return; }
        fs.mkdirSync(logDir, { recursive: true });
        fs.writeFileSync(stateFile, JSON.stringify(d.state)); fs.writeFileSync(lockFile, stamp());
        say(`starting Claude Code: ${d.why}`);
        const child = spawn('claude', ['-p', 'check bridge'], { cwd: projectDir, shell: true, windowsHide: true, stdio: 'ignore' });
        child.on('exit', code => { say(`Claude Code finished (code ${code})`); try { fs.unlinkSync(lockFile); } catch (e) { /* ok */ } });
        child.on('error', e => { say(`could not start Claude Code: ${e.message}`); try { fs.unlinkSync(lockFile); } catch (e2) { /* ok */ } });
    } catch (e) { say(`watcher error: ${String(e.message).slice(0, 150)}`); }
})();
