// READ-ONLY. Lists every vendor cheque row for Fawaz / Fazal / Cool Water so AJ can see what the app really holds. Prints no secrets.
const pool = require('../../utils/pool');
(async () => {
  const q = `SELECT b.vendor_name, c.cheque_no, c.bank, c.amount, to_char(c.cheque_date,'YYYY-MM-DD') AS cheque_date, to_char(c.due_date,'YYYY-MM-DD') AS due, c.status
             FROM vendor_bill_cheques c JOIN vendor_bills b ON b.id=c.bill_id
             WHERE b.vendor_name ILIKE '%fawaz%' OR b.vendor_name ILIKE '%cool%water%' OR b.vendor_name ILIKE '%coolwater%' ORDER BY b.vendor_name, c.due_date`;
  const r = await pool.query(q);
  const by = {}; r.rows.forEach(x => { (by[x.vendor_name] = by[x.vendor_name] || []).push(x); });
  console.log('Cheques in vendor_bill_cheques:'); Object.keys(by).forEach(k => console.log(' ', k, by[k].length, 'cheques, total', by[k].reduce((s, x) => s + Number(x.amount), 0)));
  if (!r.rows.length) console.log('  NONE for Fawaz or Cool Water');
  let reg; try { reg = await pool.query(`SELECT COUNT(*) AS n FROM cheque_register WHERE payee ILIKE '%fawaz%' OR payee ILIKE '%cool%water%'`); console.log('cheque_register rows for them:', reg.rows[0].n); } catch (e) { console.log('cheque_register: ' + e.message.split('\n')[0]); }
  const v = await pool.query(`SELECT name FROM vendors WHERE name ILIKE '%fawaz%' OR name ILIKE '%cool%water%'`).catch(() => ({ rows: [] }));
  console.log('Vendor names found:', v.rows.map(x => x.name).join(' | ') || 'none');
  process.exit(0);
})().catch(e => { console.log('ERROR ' + e.message.split('\n')[0]); process.exit(1); });
