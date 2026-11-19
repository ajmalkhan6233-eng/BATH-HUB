'use strict';
// Renumber the LIVE items to 001.. in the same order as now (= the order the bills were entered). Old hidden items become OLD-<code>.
//   node scripts/renumber_items.js          -> shows the plan only (nothing changes)
//   node scripts/renumber_items.js --yes    -> does it, all-or-nothing (one transaction). Take a backup first.
// Safe rules: refuses if any POS bill exists; only renames; nothing is deleted.
require('dotenv').config({ quiet: true });
const pool = require('../utils/pool');
const YES = process.argv.includes('--yes');
const plain = n => { if (!/^[a-z][a-z0-9_]*$/.test(n)) throw new Error('odd name ' + n); return n; };
const pad = n => String(n).padStart(3, '0');
(async () => {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const bills = await c.query(`SELECT to_regclass('public.pos_bills') AS t`);
    if (bills.rows[0].t) {
      const n = (await c.query('SELECT COUNT(*)::int AS n FROM pos_bills')).rows[0].n;
      if (n > 0) throw new Error(`STOPPED: ${n} POS bills exist; renumbering now would break them. Nothing changed.`);
    }
    const live = (await c.query(`SELECT id, item_code, name FROM products WHERE active = true AND item_code ~ '^[0-9]{1,9}$' ORDER BY item_code::int, id`)).rows;
    const old = (await c.query(`SELECT id, item_code FROM products WHERE active = false AND item_code ~ '^[0-9]{1,9}$'`)).rows;
    if (!live.length) throw new Error('STOPPED: no live items found. Nothing changed.');
    const map = live.map((p, i) => ({ id: p.id, from: p.item_code, to: pad(i + 1), name: p.name }));
    console.log(`live items: ${live.length}  old hidden numeric: ${old.length}`);
    console.log('first:', map[0].from, '->', map[0].to, '| last:', map[map.length - 1].from, '->', map[map.length - 1].to);
    if (!YES) { await c.query('ROLLBACK'); console.log('REHEARSAL only. Add --yes to do it.'); return; }
    // 1 free the low numbers: old hidden items become OLD-<code>
    await c.query(`UPDATE products SET item_code = 'OLD-' || item_code WHERE active = false AND item_code ~ '^[0-9]{1,9}$'`);
    // 2 other tables that carry item_code (not products)
    const cols = (await c.query(`SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='item_code' AND table_name <> 'products'`)).rows.map(r => r.table_name);
    // 3 live items get the new codes
    let grnFixed = 0;
    for (const m of map) {
      await c.query('UPDATE products SET item_code = $1 WHERE id = $2', [m.to, m.id]);
      for (const t of cols) await c.query(`UPDATE ${plain(t)} SET item_code = $1 WHERE item_code = $2`, [m.to, m.from]);
      const r = await c.query(`UPDATE grn_records SET item_description = $1 || substr(item_description, length($2) + 1) WHERE item_description LIKE $2 || '%'`, [m.to, m.from + ' - ']);
      grnFixed += r.rowCount;
    }
    // checks
    const chk = (await c.query(`SELECT COUNT(*)::int AS n, COUNT(DISTINCT item_code)::int AS d, MIN(item_code) AS lo, MAX(item_code) AS hi FROM products WHERE active = true`)).rows[0];
    if (chk.n !== live.length || chk.d !== live.length) throw new Error('CHECK FAILED: codes not unique. Rolled back.');
    await c.query('COMMIT');
    console.log(`DONE: ${chk.n} live items now ${chk.lo}..${chk.hi}; GRN lines updated: ${grnFixed}; extra tables updated: ${cols.join(',') || 'none'}`);
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); console.error(e.message); process.exitCode = 1; }
  finally { c.release(); await pool.end().catch(() => {}); }
})();
