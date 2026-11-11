'use strict';
// BLOCK: split-vendor-fazal (AJ 11 Nov 2026). Real-data change, so: dry run by default, ONE transaction, undo file.
//  1) Fazal Hardware keeps bill G1CR008312 (the commode set). Bills G1CR008289, 8290, 8291 (cash memos 46221 to 46223, accessories)
//     move to a NEW vendor "Fawaz (Fazal Hardware Pvt Ltd)". Moved in vendor_bills AND grn_records (supplier_name only; amounts untouched).
//  2) The 6 HNB cheques AJ handed over are put on the cheque register (payee = Fazal group, due = date on the cheque). Bills are NOT marked
//     paid: a bill drops only when its cheque clears (ledger rule). No bank account number is stored anywhere.
//   node scripts/split_vendor_fazal.js           DRY RUN (changes nothing)
//   node scripts/split_vendor_fazal.js --apply   do it (take a backup first: scripts/backup_owner_db.ps1)
//   node scripts/split_vendor_fazal.js --undo    put names back and remove these 6 register rows
const fs = require('fs');
const path = require('path');
const pool = require('../utils/pool');

const KEEP = 'G1CR008312';
const MOVE = ['G1CR008289', 'G1CR008290', 'G1CR008291'];
const NEW_VENDOR = 'Fawaz (Fazal Hardware Pvt Ltd)';
const TAG = '[fazal-split]';
const PAYEE = 'Fazal Hardware (Pvt) Ltd';
const BANK = 'Hatton National Bank, Nittambuwa';
// read from the 6 cheque photos, AJ 11 Nov 2026 (dd/mm/yyyy on the cheque)
const CHEQUES = [
  { no: '704927', due: '2027-02-04', amt: 150000 },
  { no: '704930', due: '2027-02-11', amt: 150000 },
  { no: '704931', due: '2027-02-18', amt: 300000 },
  { no: '704929', due: '2027-02-26', amt: 300000 },
  { no: '704926', due: '2027-03-05', amt: 150000, note: 'date was overwritten (08 to 05), second signature beside it' },
  { no: '704928', due: '2027-03-12', amt: 300000 },
];
const UNDO = path.join(__dirname, '..', 'data', 'fazal_split_undo.json');
const like = list => list.map(b => b + '%');
const day = d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(d + 'T00:00:00Z').getUTCDay()];
// money usually leaves the next banking day (Fri-dated: Monday). A bank holiday can add one day.
const clears = d => { const t = new Date(d + 'T00:00:00Z'); do { t.setUTCDate(t.getUTCDate() + 1); } while ([0, 6].includes(t.getUTCDay())); return t.toISOString().slice(0, 10); };

async function find(db) {
  const keep = (await db.query(`SELECT id, vendor_name, bill_no, total FROM vendor_bills WHERE voided=FALSE AND vendor_name ILIKE '%fazal%' AND bill_no LIKE ANY($1)`, [like([KEEP])])).rows;
  const done = (await db.query(`SELECT id FROM vendor_bills WHERE voided=FALSE AND vendor_name=$2 AND bill_no LIKE ANY($1)`, [like(MOVE), NEW_VENDOR])).rows.length;
  const move = (await db.query(`SELECT id, vendor_name, bill_no, total, grn_id FROM vendor_bills WHERE voided=FALSE AND vendor_name ILIKE '%fazal%' AND vendor_name <> $2 AND bill_no LIKE ANY($1) ORDER BY bill_no`, [like(MOVE), NEW_VENDOR])).rows;
  const grn = (await db.query(`SELECT id, supplier_name, grn_number FROM grn_records WHERE supplier_name ILIKE '%fazal%' AND supplier_name <> $2 AND (grn_number LIKE ANY($1) OR id = ANY($3::int[]))`,
    [like(MOVE), NEW_VENDOR, move.map(m => m.grn_id).filter(Boolean)])).rows;
  return { keep, move, grn, done };
}

async function main() {
  const apply = process.argv.includes('--apply'), undo = process.argv.includes('--undo');
  const client = await pool.connect();
  try {
    if (undo) {
      const u = JSON.parse(fs.readFileSync(UNDO, 'utf8'));
      await client.query('BEGIN');
      for (const b of u.bills) await client.query('UPDATE vendor_bills SET vendor_name=$1 WHERE id=$2', [b.vendor_name, b.id]);
      for (const g of u.grn) await client.query('UPDATE grn_records SET supplier_name=$1 WHERE id=$2', [g.supplier_name, g.id]);
      const d = await client.query(`DELETE FROM cheque_register WHERE notes LIKE $1`, ['%' + TAG + '%']);
      await client.query('COMMIT'); console.log('UNDONE: bills', u.bills.length, 'grn lines', u.grn.length, 'cheques removed', d.rowCount); return;
    }
    const f = await find(client);
    console.log('KEEP under Fazal :', f.keep.map(r => `${r.bill_no} Rs ${r.total}`).join(' | ') || '(NOT FOUND)');
    console.log('MOVE to', NEW_VENDOR, ':'); f.move.forEach(r => console.log('   ', r.bill_no, 'Rs', r.total, '(from', r.vendor_name + ')'));
    console.log('GRN lines to rename:', f.grn.length);
    console.log('CHEQUES (register, bills stay unpaid until cleared):');
    CHEQUES.forEach(c => console.log('   ', c.no, c.due, day(c.due), 'Rs', c.amt, '-> money leaves about', clears(c.due), day(clears(c.due))));
    const tot = CHEQUES.reduce((s, c) => s + c.amt, 0), owed = [...f.keep, ...f.move].reduce((s, r) => s + Number(r.total), 0);
    console.log('Cheques total Rs', tot, '| these 4 bills Rs', owed, '| not covered Rs', owed - tot);
    if (f.done === MOVE.length) console.log('Bills are ALREADY split (nothing to move); only missing cheques will be added.');
    else if (f.move.length !== MOVE.length || f.keep.length !== 1) { console.log('STOP: expected 3 bills to move and 1 to keep. Nothing changed.'); process.exitCode = 2; return; }
    if (!apply) { console.log('DRY RUN: nothing was changed. Add --apply after a backup.'); return; }
    if (f.move.length) { fs.mkdirSync(path.dirname(UNDO), { recursive: true });
    fs.writeFileSync(UNDO, JSON.stringify({ at: new Date().toISOString(), bills: f.move.map(r => ({ id: r.id, vendor_name: r.vendor_name })), grn: f.grn.map(g => ({ id: g.id, supplier_name: g.supplier_name })) }, null, 1)); }
    await client.query('BEGIN');
    if (f.move.length) await client.query('UPDATE vendor_bills SET vendor_name=$1 WHERE id = ANY($2::int[])', [NEW_VENDOR, f.move.map(r => r.id)]);
    if (f.grn.length) await client.query('UPDATE grn_records SET supplier_name=$1 WHERE id = ANY($2::int[])', [NEW_VENDOR, f.grn.map(g => g.id)]);
    let added = 0;
    for (const c of CHEQUES) {
      const dup = await client.query(`SELECT 1 FROM cheque_register WHERE cheque_no=$1 AND status<>'cancelled' LIMIT 1`, [c.no]);
      if (dup.rows.length) { console.log('   cheque', c.no, 'already on the register, skipped'); continue; }
      await client.query(`INSERT INTO cheque_register (cheque_no, bank, payee, amount, due_date, notes) VALUES ($1,$2,$3,$4,$5,$6)`,
        [c.no, BANK, PAYEE, c.amt, c.due, ['Cash cheque for Fazal group (Fazal + Fawaz bills)', c.note, TAG].filter(Boolean).join('. ')]); added++;
    }
    await client.query('COMMIT');
    const after = await find(client);
    console.log('DONE: moved bills', f.move.length, '| grn lines', f.grn.length, '| cheques added', added, '| still to move:', after.move.length, '| undo file', UNDO);
  } catch (e) { try { await client.query('ROLLBACK'); } catch (_) {} console.error('FAILED, nothing changed:', e.message); process.exitCode = 1; }
  finally { client.release(); await pool.end(); }
}
main();
