'use strict';
// Keeps ONE copy of each POCKET_* line in .env, the LAST one (the newest from deploy_pocket.ps1), because dotenv keeps the first.
// Backs up .env first. Prints key names only, never values. Usage: node scripts/pc/fix_pocket_env.js [path-to-.env]
const fs = require('fs');
const f = process.argv[2] || '.env';
const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
const last = new Map();
lines.forEach((l, i) => { const m = /^\s*(POCKET_[A-Z_]+)\s*=/.exec(l); if (m) last.set(m[1], i); });
let removed = 0;
const out = lines.filter((l, i) => { const m = /^\s*(POCKET_[A-Z_]+)\s*=/.exec(l); if (m && last.get(m[1]) !== i) { removed++; return false; } return true; });
if (removed) { fs.copyFileSync(f, f + '.bak-pocket'); fs.writeFileSync(f, out.join('\n')); }
console.log('kept:', [...last.keys()].join(','), '| removed old duplicates:', removed);
