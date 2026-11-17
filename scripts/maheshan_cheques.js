'use strict';
// Task 239: Maheshan 3 post-dated HNB cheques (704941 / 704942 / 704943). No account number anywhere. Skips any cheque_no+bank already there.
//   node scripts/maheshan_cheques.js <MAHESHAN_PAYMENT_17NOV.json>           rehearsal (rolls back)
//   node scripts/maheshan_cheques.js <MAHESHAN_PAYMENT_17NOV.json> --yes     saves
require('dotenv').config({ quiet: true });
const fs = require('fs'); const pool = require('../utils/pool');
const D = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); const YES = process.argv.includes('--yes');
(async () => {
  const c = await pool.connect();
  try {
    await c.query('BEGIN'); await c.query('SELECT pg_advisory_xact_lock($1)', [774414]);
    const billId = {};
    for (const no of ['26OCT_0039_01384', '26OCT_0039_01386']) {
      const b = (await c.query("SELECT id, total, voided FROM vendor_bills WHERE vendor_name ILIKE '%maheshan%' AND bill_no=$1", [no])).rows;
      if (b.length !== 1 || b[0].voided) throw new Error('bill ' + no + ' not found exactly once and active: BLOCKED');
      billId[no] = b[0].id;
    }
    let added = 0, skipped = [];
    for (const ch of D.cheques) {
      const rows = ch.split ? ch.split.map(s => ({ bill: s.bill, amount: s.amount })) : [{ bill: ch.bill, amount: ch.amount }];
      if ((await c.query("SELECT 1 FROM vendor_bill_cheques WHERE cheque_no=$1 AND COALESCE(bank,'')=$2 AND status<>'CANCELLED'", [ch.cheque_no, ch.bank])).rowCount) { skipped.push(ch.cheque_no); continue; }
      for (const r of rows) {
        await c.query("INSERT INTO vendor_bill_cheques (branch_id,bill_id,cheque_no,bank,payee,amount,cheque_date,due_date,same_bank,created_by) VALUES (1,$1,$2,$3,$4,$5,$6,$6,false,'maheshan-17nov')", [billId[r.bill], ch.cheque_no, ch.bank, ch.payee, r.amount, ch.cheque_date]);
        added++;
      }
    }
    const s = (await c.query("SELECT COALESCE(SUM(amount),0) s, COUNT(*) n, MIN(to_char(cheque_date,'YYYY-MM-DD')) a, MAX(to_char(cheque_date,'YYYY-MM-DD')) z FROM vendor_bill_cheques WHERE cheque_no IN ('704941','704942','704943') AND status='ISSUED'")).rows[0];
    console.log('rows added', added, '| skipped', skipped.join(',') || 'none', '| now in register: rows', s.n, 'sum', s.s, 'dates', s.a, 'to', s.z);
    if (Number(s.s) !== 329561 || Number(s.n) !== 4) throw new Error('sum/rows do not match 329,561 and 4 rows. Nothing saved.');
    await c.query(YES ? 'COMMIT' : 'ROLLBACK'); console.log(YES ? 'SAVED' : 'REHEARSAL only');
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); console.log('STOPPED:', e.message); } finally { c.release(); process.exit(); }
})();
