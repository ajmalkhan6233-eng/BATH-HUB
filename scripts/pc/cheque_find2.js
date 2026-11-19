// READ-ONLY. (1) every cheque on Fazaal Hardware, (2) vendors or cheque payees that look like Cool Water (cool, kool, water, cooler). No secrets.
const pool = require('../../utils/pool');
(async () => {
  const f = await pool.query(`SELECT c.cheque_no, c.bank, c.amount, to_char(c.cheque_date,'YYYY-MM-DD') AS cd, to_char(c.due_date,'YYYY-MM-DD') AS due, c.status, b.bill_no
    FROM vendor_bill_cheques c JOIN vendor_bills b ON b.id=c.bill_id WHERE b.vendor_name ILIKE '%fazaal%' OR b.vendor_name ILIKE '%fawaz%' ORDER BY c.cheque_date, c.id`);
  console.log('Fazaal Hardware cheques: ' + f.rows.length);
  f.rows.forEach(x => console.log(' ', x.cheque_no, x.bank || '-', Number(x.amount), 'cheque ' + x.cd, 'due ' + x.due, x.status, 'bill ' + x.bill_no));
  const v = await pool.query(`SELECT DISTINCT name FROM (SELECT name FROM vendors UNION SELECT vendor_name FROM vendor_bills UNION SELECT payee FROM vendor_bill_cheques WHERE payee IS NOT NULL) t(name)
    WHERE name ILIKE '%cool%' OR name ILIKE '%kool%' OR name ILIKE '%water%' OR name ILIKE '%cooler%' ORDER BY 1`).catch(e => ({ rows: [{ name: 'ERR ' + e.message.split('\n')[0] }] }));
  console.log('Names like Cool Water: ' + (v.rows.map(x => x.name).join(' | ') || 'none'));
  process.exit(0);
})().catch(e => { console.log('ERROR ' + e.message.split('\n')[0]); process.exit(1); });
