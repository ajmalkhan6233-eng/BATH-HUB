// READ-ONLY check: why Vendor 360 may not show the Fawaz cheques. Prints facts only, changes nothing.
const pool = require('../../utils/pool');
(async () => {
  try {
    const r = await pool.query(`SELECT c.cheque_no, c.amount, c.cheque_date, c.due_date, COALESCE(cr.status,'?') AS reg_status, vb.bill_no, vb.voided
      FROM vendor_bill_cheques c JOIN vendor_bills vb ON vb.id=c.bill_id LEFT JOIN cheque_register cr ON cr.cheque_no=c.cheque_no
      WHERE vb.vendor_name ILIKE 'Fawaz%' ORDER BY c.cheque_date, c.id`);
    console.log('allocation rows for Fawaz:', r.rows.length, '| total', r.rows.reduce((s, x) => s + Number(x.amount), 0));
    r.rows.forEach(x => console.log(' ', x.cheque_no, x.bill_no, x.amount, String(x.due_date).slice(0, 10), 'register:', x.reg_status, 'voided:', x.voided));
    const v = await pool.query(`SELECT DISTINCT vendor_name FROM vendor_bills WHERE vendor_name ILIKE '%faw%' OR vendor_name ILIKE '%fazal%' OR vendor_name ILIKE '%fazaal%'`);
    console.log('vendor names:', v.rows.map(x => x.vendor_name).join(' | '));
  } catch (e) { console.log('ERROR', e.message); }
  process.exit(0);
})();
