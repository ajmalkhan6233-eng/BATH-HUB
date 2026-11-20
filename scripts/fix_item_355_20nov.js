'use strict';
// AJ 20 Nov 10:21: item 355 (Maheshan bib tap, vendor code WT00052):
//   name gets the vendor code BEHIND it, selling price 890 (the tag on the tap), twin 190 hidden (active=false, never deleted).
// Dry run by default. Add --apply to write. Old rows saved to backups/item_355_before_<time>.json first. Safe to re-run.
const fs = require('fs');
const path = require('path');
const pool = require('../utils/pool');

const APPLY = process.argv.includes('--apply');
const CODE = '355', TWIN = '190', VCODE = 'WT00052', NEW_SELL = 890;
const NEW_NAME = 'BIB TAP T101 NIPPLE 3/4B WTC WT00052';

(async () => {
  const { rows } = await pool.query('SELECT id,item_code,name,stock_level,selling_price,avg_cost,active,vendor_code FROM products WHERE item_code = ANY($1)', [[CODE, TWIN]]);
  const it = rows.find(r => r.item_code === CODE), tw = rows.find(r => r.item_code === TWIN);
  if (!it) throw new Error('item 355 not found (stop, nothing written)');
  if (String(it.vendor_code || '').toUpperCase() !== VCODE && !String(it.name).toUpperCase().includes('BIB TAP T101')) throw new Error('item 355 is not the WT00052 bib tap (stop)');
  console.log(APPLY ? 'APPLY' : 'DRY RUN');
  console.log(`355 name: "${it.name}" -> "${NEW_NAME}" | sell ${it.selling_price} -> ${NEW_SELL} | cost ${it.avg_cost} | stock ${it.stock_level} (kept)`);
  let hideTwin = false;
  if (!tw) console.log('190 not found, nothing to hide');
  else if (!String(tw.name).toUpperCase().includes('BIB TAP T101')) console.log(`190 is "${tw.name}", NOT the twin, left alone (heads-up in LIVE)`);
  else if (Number(tw.stock_level) !== 0) console.log(`190 has stock ${tw.stock_level}, NOT hidden (heads-up in LIVE: stock must be moved first)`);
  else if (tw.active === false) console.log('190 already hidden');
  else { hideTwin = true; console.log(`190 "${tw.name}" stock 0 -> hidden (active=false, not deleted)`); }

  if (APPLY) {
    const dir = path.join(__dirname, '..', 'backups');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `item_355_before_${new Date().toISOString().replace(/[:.]/g, '-')}.json`), JSON.stringify(rows, null, 1));
  }
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query('UPDATE products SET name=$1, selling_price=$2 WHERE item_code=$3', [NEW_NAME, NEW_SELL, CODE]);
    if (Number(it.selling_price) !== NEW_SELL) {
      const t = await c.query("SELECT 1 FROM information_schema.tables WHERE table_name='price_history'");
      if (t.rows.length) await c.query('INSERT INTO price_history (item_code, old_price, new_price, changed_by, reason) VALUES ($1,$2,$3,$4,$5)', [CODE, it.selling_price, NEW_SELL, 'aj-20nov', 'selling_price: tag on the tap says 890 (AJ 20 Nov)']);
    }
    if (hideTwin) await c.query('UPDATE products SET active=false WHERE item_code=$1', [TWIN]);
    await c.query(APPLY ? 'COMMIT' : 'ROLLBACK');
  } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }

  const chk = await pool.query('SELECT item_code,name,selling_price,stock_level,active FROM products WHERE item_code = ANY($1) ORDER BY item_code', [[CODE, TWIN]]);
  chk.rows.forEach(r => console.log(`CHECK ${r.item_code} | ${r.name} | sell ${r.selling_price} | stock ${r.stock_level} | active ${r.active}`));
  await pool.end();
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
