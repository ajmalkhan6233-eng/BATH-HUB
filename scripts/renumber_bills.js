'use strict';
// AJ 16 Nov: short bill numbers. Renames the old BHT-... bills to RBH-S001, RBH-S002 ... in date order (first bill = RBH-S001).
//   node scripts/renumber_bills.js          rehearsal: shows the list, saves nothing
//   node scripts/renumber_bills.js --yes    does it
// Run it BEFORE the app restart that brings the new numbering (it refuses if an RBH-S bill already exists). Run redate_today_bills.js first so the order is right.
// Every other table that carries the bill number (a column called bill_number, or ref_id of a bill) is renamed with it. One transaction, all or nothing.
require('dotenv').config({ quiet: true });
const pool = require('../utils/pool');
const YES = process.argv.includes('--yes');
(async () => {
  const c = await pool.connect();
  try {
    await c.query('BEGIN'); await c.query('SELECT pg_advisory_xact_lock($1)', [774413]);
    if ((await c.query("SELECT 1 FROM pos_bills WHERE bill_number ~ '^RBH-(S|HS)[0-9]+$'")).rows.length) throw new Error('an RBH-S / RBH-HS bill already exists. Not renaming.');
    const bills = (await c.query("SELECT id, bill_number, total, created_at FROM pos_bills WHERE bill_number LIKE 'BHT-%' ORDER BY created_at, id")).rows;
    if (!bills.length) throw new Error('no BHT- bills to rename.');
    const cols = (await c.query("SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public' AND column_name='bill_number' AND table_name NOT LIKE 'arch\\_%' AND table_name<>'pos_bills'")).rows;
    const refs = (await c.query("SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='ref_id' AND table_name NOT LIKE 'arch\\_%' AND table_name IN (SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='ref_type')")).rows;
    const out = [];
    let n = 0;
    for (const b of bills) {
      n += 1; const nn = 'RBH-S' + String(n).padStart(3, '0');
      await c.query('UPDATE pos_bills SET bill_number=$1 WHERE id=$2', [nn, b.id]);
      for (const t of cols) await c.query(`UPDATE ${t.table_name} SET bill_number=$1 WHERE bill_number=$2`, [nn, b.bill_number]);
      for (const t of refs) await c.query(`UPDATE ${t.table_name} SET ref_id=$1 WHERE ref_id=$2 AND ref_type ILIKE '%bill%'`, [nn, b.bill_number]);
      out.push(`${b.bill_number} -> ${nn} | ${String(b.created_at).slice(0, 10)} | Rs ${b.total}`);
    }
    await c.query(YES ? 'COMMIT' : 'ROLLBACK');
    console.log(YES ? `DONE: ${n} bill(s) renamed` : `REHEARSAL ONLY (nothing saved): ${n} bill(s) would be renamed`); out.forEach((x) => console.log('  ' + x));
    console.log(`tables also renamed: ${cols.map((t) => t.table_name).concat(refs.map((t) => t.table_name + '.ref_id')).join(', ') || 'none'}`);
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); console.log('STOPPED: ' + e.message + ' Nothing saved.'); process.exitCode = 1; } finally { c.release(); await pool.end().catch(() => {}); }
})();
