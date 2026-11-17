'use strict';
// Fills the item lines of the Cool Lanka return (credit note dated 2026-11-14, Rs 162,000). Stock was ALREADY reduced when the return was posted
// (scripts/post_cool_return.js), so this does NOT touch stock. It only records the 6 lines in vendor_return_lines and clears any "Items missing" text.
//   node scripts/cool_return_lines.js   rehearsal      node scripts/cool_return_lines.js --yes   saves. Safe to repeat (second run refused).
require('dotenv').config({ quiet: true });
const pool = require('../utils/pool');
const YES = process.argv.includes('--yes');
const L = [['167', 'Wall hung basin ETHAN', 3, 12000], ['168', '7019 Table top', 3, 10000], ['166', 'Wall hung basin JIM', 3, 12000], ['159', 'AQUA COMMODE', 1, 20500], ['160', 'MARVEL COMMODE', 1, 27000], ['162', 'DELTA BASIN', 1, 12500]];
(async () => {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query('CREATE TABLE IF NOT EXISTS vendor_return_lines (id SERIAL PRIMARY KEY, credit_note_id INT NOT NULL, item_code TEXT, item_name TEXT, qty NUMERIC(12,3) NOT NULL, rate NUMERIC(14,2) NOT NULL, amount NUMERIC(14,2) NOT NULL, created_at TIMESTAMPTZ DEFAULT now())');
    const n = (await c.query("SELECT n.* FROM vendor_credit_notes n JOIN vendor_bills b ON b.id=n.bill_id WHERE b.vendor_name ILIKE '%cool%' AND n.amount=162000 AND n.note_date='2026-11-14'")).rows;
    if (n.length !== 1) throw new Error('expected one Cool return of 162000 dated 2026-11-14, found ' + n.length);
    if ((await c.query('SELECT 1 FROM vendor_return_lines WHERE credit_note_id=$1', [n[0].id])).rowCount) throw new Error('lines already filled');
    let tot = 0;
    for (const [code, name, qty, rate] of L) {
      const p = (await c.query('SELECT name, stock_level FROM products WHERE item_code=$1', [code])).rows[0];
      if (!p || p.name !== name) throw new Error('item ' + code + ' is not ' + name);
      await c.query('INSERT INTO vendor_return_lines (credit_note_id,item_code,item_name,qty,rate,amount) VALUES ($1,$2,$3,$4,$5,$6)', [n[0].id, code, name, qty, rate, qty * rate]); tot += qty * rate;
    }
    if (tot !== 162000) throw new Error('lines add to ' + tot);
    await c.query('UPDATE vendor_credit_notes SET reason=$2 WHERE id=$1', [n[0].id, String(n[0].reason || '').replace(/\s*\(?items missing\)?/gi, '') + ' | lines filled 17 Nov']);
    console.log('lines total', tot); await c.query(YES ? 'COMMIT' : 'ROLLBACK'); console.log(YES ? 'SAVED' : 'REHEARSAL only');
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); console.log('STOPPED:', e.message); } finally { c.release(); process.exit(); }
})();
