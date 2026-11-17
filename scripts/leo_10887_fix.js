'use strict';
// Leo Marketing invoice 10887 (03-11-2026): GRN to 503,425, cheques 704938/39/40, cash 3,500 (receipt 3937). Credit note 1930 = paper copy only, NOT entered.
//   node scripts/leo_10887_fix.js          rehearsal (rolls back)      node scripts/leo_10887_fix.js --yes   saves. Refuses a second run.
require('dotenv').config({ quiet: true });
const pool = require('../utils/pool');
const YES = process.argv.includes('--yes'), GN = '0000010887';
const stockBack = [['325', 10], ['326', 10], ['327', 10], ['071', 1], ['077', 1]]; // lines never entered + Brasco 1 short
(async () => {
  const c = await pool.connect();
  try {
    await c.query('BEGIN'); await c.query('SELECT pg_advisory_xact_lock($1)', [774414]);
    const b = (await c.query("SELECT * FROM vendor_bills WHERE bill_no=$1 AND vendor_name='Leo Marketing' AND voided=FALSE FOR UPDATE", [GN])).rows[0];
    if (!b) throw new Error('bill not found');
    if (Number(b.total) !== 494300) throw new Error('bill total is ' + b.total + ', not 494300: already fixed? Nothing saved.');
    const del = await c.query("DELETE FROM grn_records WHERE supplier_name='Leo Marketing' AND ((grn_number=$1 AND id IN (466,477)) OR (grn_number=$2 AND id IN (503,504,505))) RETURNING id", [GN, GN + '-LATE']);
    if (del.rowCount !== 5) throw new Error('expected 5 GRN lines to remove, got ' + del.rowCount);
    await c.query("UPDATE grn_records SET quantity=4, total_amount=5340 WHERE id=467 AND quantity=5");
    await c.query("UPDATE grn_records SET quantity=9, total_amount=28620 WHERE id=501 AND quantity=10");
    const mv = await c.query("UPDATE grn_records SET grn_number=$1, notes=COALESCE(notes,'')||' | merged into 10887 17 Nov' WHERE grn_number=$2 AND supplier_name='Leo Marketing' RETURNING id", [GN, GN + '-LATE']);
    if (mv.rowCount !== 3) throw new Error('expected 3 late lines, got ' + mv.rowCount);
    for (const [code, q] of stockBack) { const u = await c.query('UPDATE products SET stock_level=stock_level-$1 WHERE item_code=$2 AND stock_level>=$1 RETURNING stock_level', [q, code]); if (u.rowCount !== 1) throw new Error('stock of ' + code + ' too low to take back ' + q); }
    const tot = Number((await c.query("SELECT SUM(total_amount) t FROM grn_records WHERE grn_number=$1 AND supplier_name='Leo Marketing'", [GN])).rows[0].t);
    if (tot !== 503425) throw new Error('GRN total is ' + tot + ', needs 503425. Nothing saved.');
    await c.query('UPDATE vendor_bills SET total=503425, notes=COALESCE(notes,$2)||$3 WHERE id=$1', [b.id, '', '; fixed 17 Nov: GRN 503,425 (invoice 551,340 - 46,580 never entered - 1,335 Brasco short)']);
    for (const [no, d, a] of [['704938', '2027-02-19', 150000], ['704939', '2027-02-26', 150000], ['704940', '2027-03-05', 200000]])
      await c.query("INSERT INTO vendor_bill_cheques (branch_id,bill_id,cheque_no,bank,payee,amount,cheque_date,due_date,same_bank,created_by) VALUES (1,$1,$2,'HNB Nittambuwa','Leo Marketing',$3,$4,$4,false,'leo-fix-17nov')", [b.id, no, a, d]);
    await c.query("INSERT INTO vendor_payments (branch_id,bill_id,amount,method,paid_at,note,created_by) VALUES (1,$1,3500,'CASH','2026-11-17','Leo receipt no. 3937','leo-fix-17nov')", [b.id]);
    console.log('GRN total', tot, '| bill 503425 | cheques 500000 | cash 3500 | after cheques', 503425 - 500000 - 3500);
    await c.query(YES ? 'COMMIT' : 'ROLLBACK'); console.log(YES ? 'SAVED' : 'REHEARSAL only, nothing saved');
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); console.log('STOPPED:', e.message, 'Nothing saved.'); } finally { c.release(); process.exit(); }
})();
