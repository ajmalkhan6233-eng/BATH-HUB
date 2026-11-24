'use strict';
// VERSION LOCK (AJ 24 Nov 2026: "lock it down as version 1.0"). Writes docs/LOCK_MANIFEST.json = the fingerprint of every app file.
// After this, tests/unit/v1_lock.test.js fails if ANY locked file changes while VERSION is unchanged. To change the app on purpose:
// 1) bump the number in the VERSION file, 2) change the code, 3) run  node scripts/lock_version.js  to lock the new state.
const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const root = path.join(__dirname, '..');
const DIRS = ['public', 'routes', 'utils', 'pocket', 'cloudflare', 'middleware'], FILES = ['server.js'], EXT = /\.(html|js|css|json|webmanifest)$/;
function walk(d, out) { for (const n of fs.readdirSync(path.join(root, d), { withFileTypes: true })) { const rel = d + '/' + n.name; if (n.isDirectory()) { if (n.name !== 'node_modules' && n.name !== 'receipt-sets' && n.name !== 'fonts') walk(rel, out); } else if (EXT.test(n.name)) out.push(rel); } return out; }
function fingerprint() {
  const files = {}; [].concat(...DIRS.map((d) => walk(d, [])), FILES).sort().forEach((f) => { files[f] = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, f), 'utf8').replace(/\r\n/g, '\n')).digest('hex').slice(0, 16); });
  return files;
}
module.exports = { fingerprint };
if (require.main === module) {
  const version = fs.readFileSync(path.join(root, 'VERSION'), 'utf8').trim();
  const files = fingerprint(); fs.writeFileSync(path.join(root, 'docs', 'LOCK_MANIFEST.json'), JSON.stringify({ version, locked_at: new Date().toISOString(), files }, null, 1) + '\n');
  console.log('locked version', version, '-', Object.keys(files).length, 'files');
}
