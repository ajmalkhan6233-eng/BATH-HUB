'use strict';
// DAILY AUDIT LINE (read-only on the shop data). Runs utils/auditInvariants against the database in .env and prints ONE line.
//   node scripts/audit/daily_check.js            prints the line (and the detail for any RED or WARN)
//   node scripts/audit/daily_check.js --notify   also queues the line for the 06:00 message (Rule 11), via utils/notify.enqueue
// It never changes shop data. It keeps its own small memory of stock gaps in data/audit_state.json (gitignored) so a stock
// change with no GRN or bill behind it shows up as RED the next day. Exit code 0 = GREEN, 1 = RED.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../../utils/pool');
const { runAll } = require('../../utils/auditInvariants');

const STATE = path.join(__dirname, '..', '..', 'data', 'audit_state.json');
const readState = () => { try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch (_) { return {}; } };

(async () => {
  const state = readState();
  const out = await runAll(pool, { previousGaps: state.gaps });
  // The baseline moves forward only when the day is clean, so a RED stock change keeps showing until someone fixes it.
  const stockRed = out.checks.some((c) => c.id === 'stock_vs_ledger' && c.status === 'RED');
  if (out.gaps && (!state.gaps || !stockRed)) {
    fs.mkdirSync(path.dirname(STATE), { recursive: true });
    fs.writeFileSync(STATE, JSON.stringify({ at: new Date().toISOString(), gaps: out.gaps }));
  }
  console.log(out.line);
  out.checks.filter((c) => c.status === 'RED' || c.status === 'WARN').forEach((c) => {
    console.log(`  ${c.status} ${c.name}: ${c.detail}`);
    c.rows.slice(0, 3).forEach((r) => console.log('    ' + JSON.stringify(r).slice(0, 160)));
  });
  if (process.argv.includes('--notify')) await require('../../utils/notify').enqueue(pool, out.line, 'audit');
  await pool.end();
  process.exit(out.red ? 1 : 0);
})().catch(async (e) => { console.log(`AUDIT COULD NOT RUN: ${e.message}`); await pool.end().catch(() => {}); process.exit(2); });
