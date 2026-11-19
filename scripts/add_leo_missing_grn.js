'use strict';
// LEO invoice 0000010887 (03/11/2026): 6 lines that were never entered. Adds stock + one GRN row each. Bill total NOT changed.
//   node scripts/add_leo_missing_grn.js          rehearsal (rolls back, nothing saved)
//   node scripts/add_leo_missing_grn.js --yes    saves. Safe to repeat: a second run is refused.
require('dotenv').config({ quiet: true });
const pool = require('../utils/pool');
const { round2, weightedAvgCost } = require('../utils/grn_math');
const YES = process.argv.includes('--yes');
const INV = '0000010887'; const GN = INV + '-LATE'; const DATE = '2026-11-03';
// [by, key, name test, qty, unit cost]  by: code = our item code, name = find by name
const L = [
  ['code', '065', /305 hand shower|hand shower 305/i, 3, 780],
  ['code', '071', /leo black square/i, 10, 3180],
  ['code', '072', /006 biday/i, 10, 1250],
  ['name', 'BIDAY SPRAY COLOUR', /biday spray colou?r/i, 10, 1040],
  ['name', 'BIDAY SPRAY BK', /biday spray bk/i, 10, 1275],
  ['name', 'TOWEL BAR SINGLE 164', /towel bar single/i, 10, 2025],
];
(async () => {
  const c = await pool.connect(); const out = [];
  try {
    await c.query('BEGIN'); await c.query('SELECT pg_advisory_xact_lock($1)', [774414]);
    const s = (await c.query("SELECT id, name FROM suppliers WHERE name ILIKE '%leo%' ORDER BY id LIMIT 1")).rows[0];
    if (!s) throw new Error('supplier Leo not found. Nothing saved.');
    if ((await c.query('SELECT 1 FROM grn_records WHERE grn_number=$1 AND supplier_id=$2 LIMIT 1', [GN, s.id])).rows.length) throw new Error(GN + ' is already loaded. Nothing saved.');
    for (const [by, key, re, qty, cost] of L) {
      const r = by === 'code'
        ? await c.query('SELECT * FROM products WHERE item_code=$1 AND active=true', [key])
        : await c.query("SELECT * FROM products WHERE name ILIKE $1 AND active=true AND CAST(item_code AS INT)>=325 ORDER BY id", ['%' + key.split(' ').slice(0, 3).join('%') + '%']);
      const hit = r.rows.filter((x) => re.test(x.name));
      if (hit.length !== 1) throw new Error(`${key}: found ${hit.length} matching items (need 1). Nothing saved. Tell chat.`);
      const it = hit[0]; const before = Number(it.stock_level);
      const had = before >= qty; // stock already counted by hand: record the GRN line only, do not add twice
      const add = had ? 0 : qty;
      const avg = had ? (Number(it.avg_cost) > 0 ? Number(it.avg_cost) : cost) : round2(weightedAvgCost(before, it.avg_cost, qty, cost));
      await c.query('UPDATE products SET stock_level = stock_level + $1, avg_cost = $2 WHERE id = $3', [add, avg, it.id]);
      await c.query(`INSERT INTO grn_records (grn_number, supplier_id, supplier_name, grn_date, item_description, quantity, unit_cost, total_amount, status, notes)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'PENDING_REVIEW',$9)`,
        [GN, s.id, s.name, DATE, `${it.item_code} - ${it.name}`, qty, cost, round2(qty * cost), `Leo invoice ${INV}: line never entered earlier. Bill total unchanged.`]);
      out.push(`${it.item_code} ${it.name}: stock ${before} -> ${before + add}${had ? ' (already counted, GRN line only)' : ''}, cost ${cost}`);
    }
    await c.query(YES ? 'COMMIT' : 'ROLLBACK');
    console.log(YES ? 'SAVED:' : 'REHEARSAL ONLY (nothing saved):'); out.forEach((x) => console.log('  ' + x));
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); console.log('STOPPED: ' + e.message); process.exitCode = 1; } finally { c.release(); await pool.end().catch(() => {}); }
})();
