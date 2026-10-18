'use strict';
// node scripts/audit/audit_user.js make     creates a TEMPORARY admin login "audit_bot" with a random password (TEST_MODE only)
// node scripts/audit/audit_user.js remove   deletes it again
// The password is written to audit_out/.cred (never printed, never committed) and read by crawl.js / money_flow.js.
require('dotenv').config();
const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const OUT = path.join(__dirname, '..', '..', 'audit_out'); const CRED = path.join(OUT, '.cred');
(async () => {
  if (String(process.env.TEST_MODE || '').toLowerCase() !== 'true') { console.error('REFUSED: TEST_MODE is not true in .env.'); process.exit(3); }
  const pool = require('../../utils/pool'); const bcrypt = require('bcryptjs'); const cmd = process.argv[2];
  if (cmd === 'make') {
    const pass = crypto.randomBytes(12).toString('base64url'); const hash = await bcrypt.hash(pass, 10);
    await pool.query(`DELETE FROM users WHERE username = 'audit_bot'`);
    await pool.query(`INSERT INTO users (username, name, password_hash, role, active) VALUES ('audit_bot','Audit robot',$1,'admin',TRUE)`, [hash]);
    fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(CRED, JSON.stringify({ user: 'audit_bot', pass }), { mode: 0o600 });
    console.log('audit_bot created (password saved to audit_out/.cred, not shown).');
  } else if (cmd === 'remove') {
    await pool.query(`DELETE FROM users WHERE username = 'audit_bot'`); try { fs.unlinkSync(CRED); } catch (_) {}
    console.log('audit_bot removed.');
  } else { console.error('usage: make | remove'); process.exit(1); }
  await pool.end().catch(() => {});
})().catch((e) => { console.error('failed:', e.message); process.exit(1); });
