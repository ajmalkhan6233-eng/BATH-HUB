'use strict';
// Usage: node scripts/backup_encrypt.js <backup.sql>
// Encrypts the backup into BACKUP_COPY_DIR as <name>.sql.enc (AES-256-GCM, key from BACKUP_PASSPHRASE) and keeps the newest 30 there.
// If BACKUP_COPY_DIR or BACKUP_PASSPHRASE is not set: prints a warning and copies nothing (exit 0).
// Exit 2 = the copy was attempted and failed. The passphrase is never printed.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { encryptFile, decryptFile } = require('../utils/backupCrypto');

async function copyEncrypted(src, env = process.env) {
    const dir = (env.BACKUP_COPY_DIR || '').trim().replace(/^"|"$/g, ''), pass = env.BACKUP_PASSPHRASE || '';
    if (!dir || !pass) {
        const missing = [!dir && 'BACKUP_COPY_DIR', !pass && 'BACKUP_PASSPHRASE'].filter(Boolean).join(' and ');
        return { copied: false, warning: `WARNING: ${missing} not set in .env: the backup was NOT copied off this machine.` };
    }
    fs.mkdirSync(dir, { recursive: true });
    const dest = path.join(dir, path.basename(src) + '.enc');
    await encryptFile(src, dest, pass);
    const tmp = dest + '.check';                       // prove the copy decrypts and is the same size before trusting it
    try { await decryptFile(dest, tmp, pass); if (fs.statSync(tmp).size !== fs.statSync(src).size) throw new Error('size mismatch after decrypt'); }
    finally { fs.unlink(tmp, () => {}); }
    fs.readdirSync(dir).filter(f => /^bathco_owner-.*\.sql\.enc$/.test(f)).map(f => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
        .sort((a, b) => b.t - a.t).slice(30).forEach(x => fs.unlinkSync(path.join(dir, x.f)));
    return { copied: true, dest };
}

module.exports = { copyEncrypted };

if (require.main === module) {
    const src = process.argv[2];
    if (!src || !fs.existsSync(src)) { console.error('usage: node scripts/backup_encrypt.js <backup.sql>'); process.exit(1); }
    copyEncrypted(src).then(r => { console.log(r.copied ? `Encrypted off-machine copy written: ${r.dest}` : r.warning); })
        .catch(e => { console.error('Off-machine copy FAILED: ' + e.message); process.exit(2); });
}
