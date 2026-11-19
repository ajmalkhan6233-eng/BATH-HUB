// Play button for the private GitHub backup (owner only). The real work is scripts/pc/github_backup.js (refuses a public repo).
const express = require('express');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const router = express.Router();
const root = path.resolve(__dirname, '..');
const statusFile = path.join(root, 'logs', 'github_backup.json');
const roleOf = req => (req.session && req.session.user && req.session.user.role) || 'staff';
const ownerOnly = (req, res, next) => (['admin', 'owner'].includes(roleOf(req)) ? next() : res.status(403).json({ error: 'Owner only' }));
let running = false;

router.get('/github-backup', ownerOnly, (req, res) => {
    let s = null; try { s = JSON.parse(fs.readFileSync(statusFile, 'utf8')); } catch (e) { /* never ran */ }
    res.json({ running, last: s });
});
router.post('/github-backup/run', ownerOnly, (req, res) => {
    if (running) return res.json({ running: true });
    running = true;
    const p = spawn(process.execPath, [path.join(root, 'scripts', 'pc', 'github_backup.js'), '--force'], { cwd: root, stdio: 'ignore', windowsHide: true });
    const done = () => { running = false; };
    p.on('close', done); p.on('error', done);
    res.json({ running: true });
});
module.exports = router;
