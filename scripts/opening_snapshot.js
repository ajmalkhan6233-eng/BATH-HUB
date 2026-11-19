'use strict';
/** Opening-day stock snapshot: writes backups/opening_stock-<time>.csv (item code, name, stock, unit cost) from the products table.
 *  Read-only. Run on the shop PC on opening day, after the real GRNs are in:  node scripts/opening_snapshot.js */
require('dotenv').config();
const fs = require('fs'); const path = require('path');
const pool = require('../utils/pool');
(async () => {
  const r = await pool.query(`SELECT item_code, name, stock_level, avg_cost FROM products ORDER BY item_code`);
  const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const csv = ['item_code,name,stock,unit_cost'].concat(r.rows.map((x) => [x.item_code, x.name, x.stock_level, x.avg_cost].map(q).join(','))).join('\n');
  const dir = path.join(__dirname, '..', 'backups'); fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, `opening_stock-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '')}.csv`);
  fs.writeFileSync(f, csv); console.log(`${r.rows.length} items saved to ${f}`); await pool.end();
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
