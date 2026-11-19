// Pop-up wrapper for Claude Code hooks. Windows only; does nothing elsewhere. Local only, no network.
// node scripts/pc/rbh_notify.js attention   (red: Claude needs you)
// node scripts/pc/rbh_notify.js done        (colour from .rbh_status.json: green good news, amber heads-up, red needs you)
const fs = require('fs'), path = require('path'), cp = require('child_process');
if (process.platform !== 'win32') process.exit(0);
const root = path.resolve(__dirname, '..', '..');
const mode = process.argv[2] || 'done';
let color = 'green', title = 'Royal Bath Hub: finished', message = 'Claude finished. Check the report.';
if (mode === 'attention') { color = 'red'; title = 'Royal Bath Hub: NEEDS YOU'; message = 'Claude is waiting for you. Open the window.'; }
else { try { const s = JSON.parse(fs.readFileSync(path.join(root, '.rbh_status.json'), 'utf8')); color = s.color || color; message = 'Readiness ' + s.percent + '%. ' + s.message; if (color === 'red') title = 'Royal Bath Hub: NEEDS YOU'; else if (color === 'amber') title = 'Royal Bath Hub: heads-up'; else if (color === 'blue') title = 'Royal Bath Hub: info'; else title = 'Royal Bath Hub: GOOD NEWS'; } catch (e) {} }
try { cp.spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'rbh_popup.ps1'), '-Color', color, '-Title', title, '-Message', message], { detached: true, stdio: 'ignore' }).unref(); } catch (e) {}
