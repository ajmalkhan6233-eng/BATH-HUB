'use strict';
// Adds ONE watch line (the shop's own list, no money changed).  node scripts/audit/add_bill_watch.js "Fazaal Hardware" 400 "Handwritten bill, waiting for the corrected bill"
require('dotenv').config();
const pool = require('../../utils/pool'); const W = require('../../utils/billWatch');
(async () => { const [v, d, n, b] = process.argv.slice(2); const r = await W.add(pool, { vendor_name: v, diff_amount: d, note: n, bill_no: b }); console.log(JSON.stringify(r).slice(0, 200)); await pool.end(); })().catch(e => { console.log('ERROR', e.message); process.exit(1); });
