'use strict';
// Posts AJ's Cool Lanka return slip of 14 Nov 2026 (Rs 162,000) as ONE return: stock, average cost and vendor payable move together.
// Same rules as POST /api/vendor-returns (utils/vendorAdjust). Items are matched by name on the bill's own GRN lines. Nothing is guessed:
// any item not found, bought rate different, or stock too low => BLOCKED and nothing is saved. A second run does nothing (marker in the reason).
// node scripts/post_cool_return.js            = rehearsal (prints, saves nothing)
// node scripts/post_cool_return.js --yes      = saves
process.env.DOTENV_CONFIG_QUIET = 'true'; require('dotenv').config();
const pool = require('../utils/pool');
const A = require('../utils/vendorAdjust');
const { todayLK } = require('../utils/lkTime');
const YES = process.argv.includes('--yes');
const MARK = 'Cool 14Nov slip';
const SLIP = [['ETHAN', 3, 12000], ['7019', 3, 10000], ['JIM', 3, 12000], ['AQUA', 1, 20500], ['MARVEL', 1, 27000], ['DELTA', 1, 12500]];
const stop = (m) => { console.log('BLOCKED: ' + m); process.exit(2); };
(async () => {
  const q = await pool.query(`SELECT id, vendor_name, bill_no, total FROM vendor_bills WHERE vendor_name ILIKE '%cool%' AND total=527000 AND voided=FALSE ORDER BY id DESC`);
  if (q.rows.length !== 1) stop('expected one Cool bill of 527000, found ' + q.rows.length);
  const bill = q.rows[0];
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query('SELECT id FROM vendor_bills WHERE id=$1 FOR UPDATE', [bill.id]);
    if ((await c.query(`SELECT 1 FROM vendor_credit_notes WHERE bill_id=$1 AND reason LIKE $2`, [bill.id, '%' + MARK + '%'])).rows.length) { console.log('skip: this return is already saved'); await c.query('ROLLBACK'); process.exit(0); }
    const credited = Number((await c.query('SELECT COALESCE(SUM(amount),0) s FROM vendor_credit_notes WHERE bill_id=$1', [bill.id])).rows[0].s);
    const grn = (await c.query(`SELECT item_description, quantity, unit_cost FROM grn_records WHERE grn_number=$1 AND supplier_name ILIKE $2`, [bill.bill_no, bill.vendor_name])).rows;
    if (!grn.length) stop('no GRN lines found for bill ' + bill.bill_no);
    let total = 0; const done = [];
    for (const [key, qty, rate] of SLIP) {
      const m = grn.filter((g) => String(g.item_description).toUpperCase().includes(key));
      if (m.length !== 1) stop('item "' + key + '" matched ' + m.length + ' GRN lines (' + m.map((x) => x.item_description).join(' | ') + ')');
      if (Number(m[0].unit_cost) !== rate) stop(key + ': bill rate ' + m[0].unit_cost + ' is not ' + rate);
      if (qty > Number(m[0].quantity)) stop(key + ': slip qty ' + qty + ' is more than bought ' + m[0].quantity);
      const code = String(m[0].item_description).split(' - ')[0].trim();
      const p = (await c.query('SELECT item_code, name, stock_level, avg_cost FROM products WHERE item_code=$1 AND active=true FOR UPDATE', [code])).rows[0];
      if (!p) stop('item ' + code + ' (' + key + ') not found in stock');
      const r = A.returnLine({ stock: p.stock_level, avgCost: p.avg_cost, qty, rate });
      await c.query('UPDATE products SET stock_level=$1, avg_cost=$2 WHERE item_code=$3', [r.newStock, r.newAvgCost, code]);
      total = A.r2(total + r.credit); done.push(code + ' ' + p.name + ' x' + qty + ' = ' + r.credit + ' (stock ' + p.stock_level + ' -> ' + r.newStock + ')');
    }
    if (total !== 162000) stop('slip adds to ' + total + ', not 162000');
    if (total > A.r2(Number(bill.total) - credited) + 0.005) stop('more than the bill still owes');
    const n = Number((await c.query('SELECT COUNT(*) n FROM vendor_credit_notes WHERE bill_id=$1', [bill.id])).rows[0].n) + 1;
    done.forEach((d) => console.log(d));
    if (!YES) { console.log('REHEARSAL ok: would return Rs ' + total + ' on bill ' + bill.bill_no + '. Nothing saved.'); await c.query('ROLLBACK'); process.exit(0); }
    await c.query(`INSERT INTO vendor_credit_notes (branch_id, bill_id, note_no, amount, note_date, reason, created_by) VALUES (1,$1,$2,$3,$4,$5,'aj-slip-14nov')`,
      [bill.id, 'RET-' + bill.bill_no + '-' + n, total, todayLK(), 'RETURN: ' + MARK + ' (6 items)']);
    await c.query('COMMIT');
    console.log('SAVED: returned Rs ' + total + '. Owed on bill after returns: ' + A.r2(Number(bill.total) - credited - total));
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); console.log('BLOCKED: ' + e.message); process.exit(3); } finally { c.release(); }
  await pool.end();
})();
