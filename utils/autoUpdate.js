'use strict';
// AUTO UPDATE (Ajmal 2026-11-04: "I just refresh the page, it should be there"). Runs inside the 5-minute watchdog on the PC.
// Pulls branch `work` from origin ONLY when it is a clean fast-forward. Never pushes, never forces, never touches other branches,
// never overwrites local changes. If server code changed it restarts pm2 "apex-server" only. Opt out: create local_ops\NO_AUTOUPDATE.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const BRANCH = 'work', EVERY_MS = 10 * 60 * 1000;
const SERVER_FILES = /^(server\.js|routes\/|middleware\/|migrations\/|utils\/|layla_owner\/|layla_v2\/|config\/|openrouter\.config\.js|drafts_inbox\/.*\.json$)/;

function git(root, args) { return execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 60000 }).trim(); }

// returns { state: 'skipped'|'current'|'updated'|'blocked', why?, files?, restart? }
function autoUpdate(root, opts = {}) {
    const stamp = path.join(root, 'logs', 'autoupdate.stamp'), now = opts.now || Date.now();
    try {
        if (fs.existsSync(path.join(root, 'local_ops', 'NO_AUTOUPDATE'))) return { state: 'skipped', why: 'opted out' };
        try { if (now - Number(fs.readFileSync(stamp, 'utf8')) < EVERY_MS && !opts.force) return { state: 'skipped', why: 'checked recently' }; } catch (e) { /* first run */ }
        fs.mkdirSync(path.dirname(stamp), { recursive: true }); fs.writeFileSync(stamp, String(now));
        if (git(root, ['rev-parse', '--abbrev-ref', 'HEAD']) !== BRANCH) return { state: 'blocked', why: 'not on branch ' + BRANCH };
        if (git(root, ['status', '--porcelain', '--untracked-files=no'])) return { state: 'blocked', why: 'local changes in tracked files, not touching them' };
        git(root, ['fetch', '--quiet', 'origin', BRANCH]);
        const head = git(root, ['rev-parse', 'HEAD']), remote = git(root, ['rev-parse', 'origin/' + BRANCH]);
        if (head === remote) return { state: 'current' };
        try { git(root, ['merge-base', '--is-ancestor', head, remote]); } catch (e) { return { state: 'blocked', why: 'PC has commits the cloud does not (not a clean fast-forward)' }; }
        const files = git(root, ['diff', '--name-only', head, remote]).split('\n').filter(Boolean);
        git(root, ['merge', '--ff-only', '--quiet', 'origin/' + BRANCH]);
        return { state: 'updated', files, restart: files.some(f => SERVER_FILES.test(f)), deps: files.includes('package.json') };
    } catch (e) { return { state: 'blocked', why: String(e.message).split('\n')[0].slice(0, 120) }; }
}
module.exports = { autoUpdate, SERVER_FILES };
