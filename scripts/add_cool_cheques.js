'use strict';
// Adds the 3 Cool Lanka cheques AJ wrote on 14 Nov 2026 (read from his photos). Cheques only: no return, no stock change.
// Usage: node scripts/add_cool_cheques.js [BILL_NO]   (default CL-0001). Skips a cheque already entered. Prints what it did.
process.env.DOTENV_CONFIG_QUIET = 'true'; require('dotenv').config();
const pool = require('../utils/pool');
const billNo = process.argv[2] || '';
const CH = [['704935', 125000, '2026-12-25'], ['704933', 120000, '2027-01-01'], ['704934', 120000, '2027-01-08']];
(async () => {
  const q = billNo ? await pool.query(`SELECT id, vendor_name, total, bill_no FROM vendor_bills WHERE bill_no=$1 AND voided=FALSE ORDER BY id DESC LIMIT 1`, [billNo])
    : await pool.query(`SELECT id, vendor_name, total, bill_no FROM vendor_bills WHERE vendor_name ILIKE '%cool%' AND total=527000 AND voided=FALSE ORDER BY id DESC LIMIT 2`);
  if (!billNo && q.rows.length > 1) { console.log('BLOCKED: two Cool bills of 527000 found, ids ' + q.rows.map(x => x.id)); process.exit(2); }
  const b = q.rows[0];
  if (!b) { console.log('BLOCKED: Cool bill 527000 not found'); process.exit(2); }
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    for (const [no, amt, due] of CH) {
      const dup = await c.query(`SELECT 1 FROM vendor_bill_cheques WHERE cheque_no=$1 AND status<>'CANCELLED'`, [no]);
      if (dup.rows.length) { console.log('skip (already entered): ' + no); continue; }
      await c.query(`INSERT INTO vendor_bill_cheques (branch_id, bill_id, cheque_no, bank, payee, amount, cheque_date, due_date, same_bank, created_by) VALUES (1,$1,$2,NULL,$3,$4,'2026-11-14',$5,FALSE,'aj-photos-14nov')`, [b.id, no, b.vendor_name, amt, due]);
      console.log('added ' + no + ' Rs ' + amt + ' due ' + due);
    }
    await c.query('COMMIT');
  } catch (e) { await c.query('ROLLBACK'); console.log('BLOCKED: ' + e.message); process.exit(3); } finally { c.release(); }
  const r = await pool.query(`SELECT COALESCE(SUM(amount),0) s, COUNT(*) n FROM vendor_bill_cheques WHERE bill_id=$1 AND status='ISSUED'`, [b.id]);
  console.log('bill ' + b.bill_no + ' total ' + b.total + ', cheques waiting ' + r.rows[0].n + ' = Rs ' + r.rows[0].s + ', left after cheques ' + (Number(b.total) - Number(r.rows[0].s)));
  await pool.end();
})();
