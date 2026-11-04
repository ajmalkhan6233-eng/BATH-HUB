// PLAY BUTTONS (Ajmal 4 Nov 2026: "never give me a paste line, give me a play button"). Owner only. A fixed list of safe actions, nothing else can be run.
//   GET  /pc-actions              -> list of actions
//   POST /pc-actions/update       -> pull the newest app from branch work (clean fast-forward only), restart the app if server code changed
//   POST /pc-actions/restart      -> restart the app (pm2 apex-server only)
//   POST /pc-actions/backup       -> same as the backup button in GRN
const express = require('express');
const path = require('path');
const { spawn } = require('child_process');
const router = express.Router();
const root = path.resolve(__dirname, '..');
const roleOf = req => (req.session && req.session.user && req.session.user.role) || 'staff';
const ownerOnly = (req, res, next) => (['admin', 'owner'].includes(roleOf(req)) ? next() : res.status(403).json({ error: 'Owner only' }));
const ACTIONS = [
    { id: 'update', label: 'Update the app to the newest version' },
    { id: 'restart', label: 'Restart the app' },
    { id: 'backup', label: 'Backup everything to GitHub now' },
];
function restartSoon() {
    setTimeout(() => { try { spawn('pm2', ['restart', 'apex-server'], { shell: true, detached: true, stdio: 'ignore', windowsHide: true }).unref(); } catch (e) { /* not under pm2 */ } }, 900);
}
router.get('/pc-actions', ownerOnly, (req, res) => res.json(ACTIONS));
router.post('/pc-actions/update', ownerOnly, (req, res) => {
    try {
        const r = require('../utils/autoUpdate').autoUpdate(root, { force: true });
        const restart = r.state === 'updated' && !!r.restart && !r.deps;
        res.json({ state: r.state, why: r.why || null, files: (r.files || []).length, restart, needsInstall: !!r.deps });
        if (restart) restartSoon();
    } catch (e) { res.status(500).json({ error: 'Could not update: ' + String(e.message).slice(0, 120) }); }
});
router.post('/pc-actions/restart', ownerOnly, (req, res) => { res.json({ restart: true }); restartSoon(); });
router.post('/pc-actions/backup', ownerOnly, (req, res) => {
    try { spawn(process.execPath, [path.join(root, 'scripts', 'pc', 'github_backup.js'), '--force'], { cwd: root, detached: true, stdio: 'ignore', windowsHide: true }).unref(); res.json({ started: true }); }
    catch (e) { res.status(500).json({ error: String(e.message).slice(0, 120) }); }
});
module.exports = router;
