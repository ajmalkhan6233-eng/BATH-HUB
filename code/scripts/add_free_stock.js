'use strict';
// FREE STOCK: goods a vendor gave at no charge (handwritten "Free" on the bill). Bill total does NOT change. Stock goes up, cost 0.
//   node scripts/add_free_stock.js <file.json>             rehearsal (rolls back, nothing saved)
//   node scripts/add_free_stock.js <file.json> --yes       saves
// File: { vendor, invoice, date, free:[{vendor_code, alt, qty, note}] }.  Finds the item by vendor_code (then alt). Not found = STOP, nothing saved.
// Safe to repeat: a second run is refused (grn_number "<invoice>-FREE" already exists).
require('dotenv').config({ quiet: true });
const fs = require('fs');
const pool = require('../utils/pool');
const { round2, weightedAvgCost } = require('../utils/grn_math');
const file = process.argv.find((a, i) => i > 1 && !a.startsWith('--'));
const YES = process.argv.includes('--yes');
if (!file) { console.error('Usage: node scripts/add_free_stock.js <file.json> [--yes]'); process.exit(1); }
const D = JSON.parse(fs.readFileSync(file, 'utf8'));
(async () => {
  const c = await pool.connect(); const out = [];
  try {
    await c.query('BEGIN'); await c.query('SELECT pg_advisory_xact_lock($1)', [774413]);
    const sid = (await c.query('SELECT id FROM suppliers WHERE LOWER(name)=LOWER($1)', [D.vendor])).rows[0];
    if (!sid) throw new Error(`vendor "${D.vendor}" not found. Nothing saved.`);
    const gn = `${D.invoice}-FREE`;
    if ((await c.query('SELECT 1 FROM grn_records WHERE grn_number=$1 AND supplier_id=$2 LIMIT 1', [gn, sid.id])).rows.length) throw new Error(`${gn} is already loaded. Nothing saved.`);
    for (const l of D.free) {
      let used = l.vendor_code; let r = await c.query('SELECT * FROM products WHERE vendor_code=$1 AND active=true ORDER BY id LIMIT 1', [used]);
      if (!r.rows.length && l.alt) { used = l.alt; r = await c.query('SELECT * FROM products WHERE vendor_code=$1 AND active=true ORDER BY id LIMIT 1', [used]); }
      if (!r.rows.length) throw new Error(`no item with vendor code ${l.vendor_code}${l.alt ? ' or ' + l.alt : ''}. Nothing saved. Tell chat which item this is.`);
      const it = r.rows[0]; const before = Number(it.stock_level);
      const avg = round2(weightedAvgCost(before, it.avg_cost, l.qty, 0));
      await c.query('UPDATE products SET stock_level = stock_level + $1, avg_cost = $2 WHERE id = $3', [l.qty, avg, it.id]);
      await c.query(`INSERT INTO grn_records (grn_number, supplier_id, supplier_name, grn_date, item_description, quantity, unit_cost, total_amount, status, notes, vendor_code, invoice_date, discount_pct)
                     VALUES ($1,$2,$3,$4,$5,$6,0,0,'PENDING_REVIEW',$7,$8,$9,0)`,
        [gn, sid.id, D.vendor, D.date, `${it.item_code} - ${it.name}`, l.qty, `FREE from ${D.vendor}, invoice ${D.invoice}. Bill total unchanged. ${l.note || ''}`.trim(), used, D.date]);
      out.push(`${it.item_code} ${it.name} (${used}): stock ${before} -> ${before + l.qty}, avg cost ${Number(it.avg_cost)} -> ${avg}`);
    }
    await c.query(YES ? 'COMMIT' : 'ROLLBACK');
    console.log(YES ? 'SAVED free stock:' : 'REHEARSAL ONLY (rolled back, nothing saved):'); out.forEach((x) => console.log('  ' + x));
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); console.log('STOPPED: ' + e.message); process.exitCode = 1; } finally { c.release(); await pool.end().catch(() => {}); }
})();
