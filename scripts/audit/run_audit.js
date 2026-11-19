'use strict';
// AUDIT MACHINE runner. READ ONLY on the shop database.   node scripts/audit/run_audit.js [--json] [--reset-baseline]
// Prints one line (AUDIT GREEN / AUDIT RED), then each broken rule. Saves data/audit_last.json. Exit code 0 = GREEN, 2 = RED.
const fs = require('fs'), path = require('path');
try { require('dotenv').config(); } catch (_) { /* env may already be set */ }
const pool = require('../../utils/pool');
const I = require('./invariants');
(async () => {
  const results = await I.run(pool, { resetBaseline: process.argv.includes('--reset-baseline') });
  const line = I.oneLine(results);
  try { fs.mkdirSync(path.join(__dirname, '../../data'), { recursive: true }); fs.writeFileSync(path.join(__dirname, '../../data/audit_last.json'), JSON.stringify({ at: new Date().toISOString(), line, results }, null, 1)); } catch (_) {}
  if (process.argv.includes('--json')) console.log(JSON.stringify({ line, results }, null, 1));
  else { console.log(line); results.filter(r => !r.ok && !r.skipped).forEach(r => console.log(' - ' + r.id + ' ' + r.name + ': ' + r.bad + ' bad ' + JSON.stringify(r.detail.slice(0, 2)))); const sk = results.filter(r => r.skipped).length; if (sk) console.log(' (' + sk + ' rules skipped: table not there yet)'); }
  await pool.end().catch(() => {});
  process.exit(results.some(r => !r.ok && !r.skipped && !r.warn) ? 2 : 0);
})().catch(e => { console.log('AUDIT COULD NOT RUN: ' + String(e.message || e).slice(0, 120)); process.exit(3); });
