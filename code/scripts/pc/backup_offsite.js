'use strict';
// node scripts/pc/backup_offsite.js --setup | --run | --verify     (never prints the key)
const fs = require('fs'); const path = require('path'); const crypto = require('crypto'); const B = require('../../utils/offsiteBackup');
const keyFile = path.join(process.cwd(), 'data', 'backup_key.txt'); const bridgeDir = process.env.OFFSITE_BRIDGE_DIR || 'C:\\Users\\Sony\\ai-bridge';
(async () => {
  const a = process.argv[2];
  if (a === '--setup') { if (fs.existsSync(keyFile)) return console.log('KEY ALREADY EXISTS at ' + keyFile + ' (left as it is)'); fs.mkdirSync(path.dirname(keyFile), { recursive: true }); fs.writeFileSync(keyFile, crypto.randomBytes(24).toString('hex') + '\n', { mode: 0o600 }); return console.log('KEY CREATED at ' + keyFile + '  (not shown here). AJ: open this file once and keep a copy on paper or phone.'); }
  if (a === '--run') { const r = await B.run({ backupDir: path.join(process.cwd(), 'backups'), bridgeDir, keyFile, force: true }); return console.log(r.line); }
  if (a === '--verify') { const r = B.verify({ bridgeDir, keyFile }); console.log(r.line); process.exitCode = r.ok ? 0 : 1; return; }
  console.log('use --setup, --run or --verify');
})().catch(e => { console.log('FAILED:', e.message); process.exitCode = 1; });
