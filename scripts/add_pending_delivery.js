'use strict';
// AWAITING DELIVERY: items on a vendor bill that were billed but not delivered yet (shows on Stock > Awaiting delivery, clears audit R10).
//   node scripts/add_pending_delivery.js <file.json>          rehearsal (rolls back)
//   node scripts/add_pending_delivery.js <file.json> --yes    saves
// File: { bill_no, vendor_name, ref, lines:[{name, qty, unit_cost}] }. Adds NO stock and NO money (the vendor bill already holds it). Safe to repeat: a line already waiting for the same bill is skipped.
require('dotenv').config({ quiet: true });
const fs = require('fs');
const pool = require('../utils/pool');
const P = require('../utils/pendingDelivery');
const file = process.argv.find((a, i) => i > 1 && !a.startsWith('--')); const YES = process.argv.includes('--yes');
if (!file) { console.error('Usage: node scripts/add_pending_delivery.js <file.json> [--yes]'); process.exit(1); }
const D = JSON.parse(fs.readFileSync(file, 'utf8'));
(async () => {
  const c = await pool.connect();
  try {
    await P.ensure(c); await c.query('BEGIN'); const out = []; const fresh = [];
    for (const l of D.lines) {
      const ex = await c.query(`SELECT 1 FROM vendor_pending_items WHERE bill_no=$1 AND LOWER(item_name)=LOWER($2) AND status='WAITING' LIMIT 1`, [D.bill_no, l.name]);
      if (ex.rows.length) out.push(`skipped (already waiting): ${l.name}`); else fresh.push(l);
    }
    if (fresh.length) { const r = await P.add(c, { bill_no: D.bill_no, vendor_name: D.vendor_name, ref: D.ref, lines: fresh }); if (r.error) throw new Error(r.error); r.items.forEach((i) => out.push(`added: ${i.item_name} x${Number(i.qty)} = ${Number(i.amount)}`)); }
    await c.query(YES ? 'COMMIT' : 'ROLLBACK');
    console.log(YES ? 'SAVED:' : 'REHEARSAL ONLY (rolled back):'); out.forEach((x) => console.log('  ' + x));
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); console.log('STOPPED: ' + e.message); process.exitCode = 1; } finally { c.release(); await pool.end().catch(() => {}); }
})();
