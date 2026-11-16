'use strict';
// Put the first bill (mirror, archived by the fresh start) back as a backdated bill, stock taken out again.
//   node scripts/rebill_first_bill.js                         rehearsal (rolls back)
//   node scripts/rebill_first_bill.js --yes                   does it
//   options: --old BHT-20261116-0001  --date 2026-10-29
// Copies the bill, its lines and payments from arch_20261116_* with the new date and number. Safe to repeat: refused if the new bill exists.
require('dotenv').config({ quiet: true });
const pool = require('../utils/pool');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const YES = process.argv.includes('--yes'); const OLD = arg('--old', 'BHT-20261116-0001'); const DATE = arg('--date', '2026-10-29');
const NEW = OLD.replace(/\d{8}/, DATE.replace(/-/g, ''));
(async () => {
  const c = await pool.connect(); const out = [];
  try {
    await c.query('BEGIN'); await c.query('SELECT pg_advisory_xact_lock($1)', [774417]);
    const b = (await c.query('SELECT * FROM arch_20261116_pos_bills WHERE bill_number=$1', [OLD])).rows[0];
    if (!b) throw new Error(`bill ${OLD} not found in the archive.`);
    if ((await c.query('SELECT 1 FROM pos_bills WHERE bill_number=$1', [NEW])).rows.length) throw new Error(`${NEW} already exists.`);
    const row = { ...b }; delete row.id; row.bill_number = NEW;
    if (row.created_at) { const d = new Date(row.created_at); const t = d.toTimeString().slice(0, 8); row.created_at = `${DATE} ${t}`; }
    const keys = Object.keys(row);
    const nb = (await c.query(`INSERT INTO pos_bills (${keys.join(',')}) VALUES (${keys.map((_, i) => '$' + (i + 1)).join(',')}) RETURNING id`, keys.map((k) => row[k]))).rows[0].id;
    const have = new Set((await c.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")).rows.map((r) => r.table_name));
    for (const t of ['pos_bill_items', 'pos_bill_payments']) {
      if (!have.has('arch_20261116_' + t)) continue;
      const rs = (await c.query(`SELECT * FROM arch_20261116_${t} WHERE bill_id=$1`, [b.id])).rows;
      for (const r of rs) { const x = { ...r }; delete x.id; x.bill_id = nb; const k = Object.keys(x); await c.query(`INSERT INTO ${t} (${k.join(',')}) VALUES (${k.map((_, i) => '$' + (i + 1)).join(',')})`, k.map((q) => x[q])); }
      out.push(`${t}: ${rs.length} rows copied`);
    }
    if (b.stock_deducted === true) {
      let ledger = null; try { ledger = require('../utils/stock_ledger'); } catch (e) { /* optional */ }
      const its = (await c.query('SELECT item_code, qty FROM pos_bill_items WHERE bill_id=$1 AND item_code IS NOT NULL', [nb])).rows;
      for (const i of its) {
        await c.query('UPDATE products SET stock_level = COALESCE(stock_level,0) - $1 WHERE item_code=$2 AND active=true', [i.qty, i.item_code]);
        if (ledger && ledger.recordSafe) await ledger.recordSafe(c, { item_code: i.item_code, qty_change: -Number(i.qty), reason: 'sale', ref_type: 'pos_bill', ref_id: NEW });
        out.push(`stock out: ${i.item_code} x ${i.qty}`);
      }
    }
    out.unshift(`${OLD} -> ${NEW} (${DATE}), total ${b.total}`);
    await c.query(YES ? 'COMMIT' : 'ROLLBACK');
    console.log(YES ? 'DONE:' : 'REHEARSAL ONLY (nothing saved):'); out.forEach((x) => console.log('  ' + x));
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); console.log('STOPPED: ' + e.message + ' Nothing saved.'); process.exitCode = 1; } finally { c.release(); await pool.end().catch(() => {}); }
})();
