'use strict';
// Builds one snapshot, pushes it to the worker, reads it back with the read token. Prints status only, no secrets. Usage (app folder): node scripts/pc/pocket_verify.js
require('dotenv').config();
const snap = require('../../utils/pocketSnapshot');
const pool = require('../../utils/pool');
(async () => {
  const e = process.env;
  if (!snap.configured(e)) { console.log('NOT CONFIGURED: need POCKET_URL, POCKET_PUSH_SECRET, POCKET_PASSCODE in .env'); process.exit(2); }
  const r = await snap.runOnce(pool, e);
  console.log('push:', r.ran ? 'OK at ' + r.at : 'skipped');
  const rt = e.POCKET_READ_TOKEN || (() => { try { return require('fs').readFileSync('data/pocket_link.txt', 'utf8').match(/[#&]t=([^&\s]+)/)[1]; } catch (x) { return null; } })();
  if (rt) {
    const g = await fetch(e.POCKET_URL.replace(/\/+$/, '') + '/snap', { headers: { 'X-Read-Token': rt } });
    console.log('read back: HTTP', g.status, '| bytes', (await g.text()).length);
  } else console.log('read back: skipped (no read token found)');
  process.exit(0);
})().catch((x) => { console.log('FAILED:', x.message); process.exit(1); });
