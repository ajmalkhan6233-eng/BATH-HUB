'use strict';
// READ-ONLY. Prints active products as: item_code|name|avg_cost|stock. node scripts/list_item_codes.js > out.txt
require('dotenv').config({ quiet: true });
const pool = require('../utils/pool');
(async () => {
  try {
    const r = await pool.query('SELECT item_code, name, avg_cost, stock_level FROM products WHERE active = true ORDER BY item_code');
    for (const x of r.rows) console.log([x.item_code, x.name, x.avg_cost, x.stock_level].join('|'));
    console.error('rows:', r.rows.length);
  } catch (e) { console.error('FAILED:', e.message); process.exitCode = 1; }
  finally { await pool.end().catch(() => {}); }
})();
