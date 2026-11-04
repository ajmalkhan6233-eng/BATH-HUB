'use strict';
// READ-ONLY. Shows one vendor bill next to its GRN lines so the missing amount can be spotted. Usage: node scripts/audit/vendor_bill_diff.js 26OCT_0039_01384
require('dotenv').config();
const pool = require('../../utils/pool');
(async () => {
  const no = process.argv[2]; if (!no) { console.log('give the bill number'); process.exit(1); }
  const vb = (await pool.query(`SELECT bill_no, vendor_name, bill_date, total, voided FROM vendor_bills WHERE bill_no = $1`, [no])).rows;
  const g = (await pool.query(`SELECT item_description, quantity, unit_cost, total_amount, status FROM grn_records WHERE grn_number = $1 ORDER BY id`, [no])).rows;
  const sum = g.reduce((a, r) => a + Number(r.total_amount || 0), 0), tot = vb[0] ? Number(vb[0].total) : 0;
  console.log('BILL', JSON.stringify(vb)); g.forEach(r => console.log('LINE', r.item_description, 'x', r.quantity, '@', r.unit_cost, '=', r.total_amount, r.status));
  console.log('GRN SUM', sum.toFixed(2), '| BILL', tot.toFixed(2), '| MISSING', (tot - sum).toFixed(2));
  const diff = tot - sum; console.log('Lines whose total equals the gap:', g.filter(r => Math.abs(Number(r.total_amount) - diff) < 1).length, '| Gap / 1.0 as qty*cost possibilities: check the bill photo');
  await pool.end();
})().catch(e => { console.log('ERROR', e.message); process.exit(1); });
