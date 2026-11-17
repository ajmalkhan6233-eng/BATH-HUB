'use strict';
// Move ONE POS bill to another day (AJ's back-dating rule). Report first; --apply changes only if exactly 1 bill matches.
//   node scripts/move_bill_date.js <customer-name-part> <from YYYY-MM-DD> <to YYYY-MM-DD> [--apply]
require('dotenv').config({ quiet: true });
const pool = require('../utils/pool');
const [name, from, to] = process.argv.slice(2).filter(a => !a.startsWith('--'));
const APPLY = process.argv.includes('--apply');
(async () => {
  const r = (await pool.query(`SELECT id,bill_number,customer_name,total,created_at FROM pos_bills WHERE created_at::date=$1::date AND LOWER(COALESCE(customer_name,'')) LIKE $2 ORDER BY id`, [from, '%' + name.toLowerCase() + '%'])).rows;
  r.forEach(b => console.log(`#${b.id} ${b.bill_number} ${b.customer_name} ${b.total} ${b.created_at.toISOString()}`));
  if (r.length !== 1) { console.log(`MATCHES: ${r.length}. Need exactly 1. Nothing changed.`); return pool.end(); }
  if (!APPLY) { console.log('Report only. Add --apply to move it to ' + to); return pool.end(); }
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86400000);
  await pool.query(`UPDATE pos_bills SET created_at = created_at + ($2 || ' days')::interval WHERE id=$1`, [r[0].id, String(days)]);
  console.log(`MOVED ${r[0].bill_number} to ${to}. Check: Daily Ledger for ${to}.`); await pool.end();
})().catch(e => { console.error(e.message); process.exit(1); });
