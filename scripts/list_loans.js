'use strict';
// READ-ONLY. Prints investor_loans (and payments total) so chat can see what is already entered. No bank numbers are stored here.
require('dotenv').config({ quiet: true });
const pool = require('../utils/pool');
(async () => {
  try {
    const cols = (await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='investor_loans'`)).rows.map(r => r.column_name);
    const qr = cols.includes('qr_outstanding') ? ', l.qr_outstanding' : ", NULL AS qr_outstanding";
    const r = await pool.query(`SELECT l.id, l.lender_name, l.amount, l.date_given, l.due_date, l.status${qr}, COALESCE((SELECT SUM(p.amount) FROM investor_loan_payments p WHERE p.loan_id = l.id),0) AS paid FROM investor_loans l ORDER BY l.id`);
    console.log('id|lender|amount|given|due|status|qr_outstanding|paid');
    for (const x of r.rows) console.log([x.id, x.lender_name, x.amount, x.date_given && x.date_given.toISOString().slice(0, 10), x.due_date ? x.due_date.toISOString().slice(0, 10) : '', x.status, x.qr_outstanding, x.paid].join('|'));
    console.error('loans:', r.rows.length);
  } catch (e) { console.error('FAILED:', e.message); process.exitCode = 1; }
  finally { await pool.end().catch(() => {}); }
})();
