'use strict';
// New vendor LUCKY TRADING (75 Prince Street, Colombo 11) + GRN V1018 (118,260, due 16-02-2027) and V1017 (198,000, due 16-01-2027), both dated 16-11-2026.
// Item codes are Aj's own (332-352). Old inactive unused items on 332-335 are ARCHIVED (code renamed OLD-xxx), not deleted. Sell price pending = NULL (blank).
//   node scripts/lucky_trading_grn.js          rehearsal (rolls back)      node scripts/lucky_trading_grn.js --yes   saves. Refuses a second run.
require('dotenv').config({ quiet: true });
const pool = require('../utils/pool');
const YES = process.argv.includes('--yes'), DATE = '2026-11-16', V = 'Lucky Trading';
const T = 'TOKAI';
// code, item, brand, qty, cost, sell(null = pending)
const A = [[332,'Plastic Angle Valve',T,6,310,990],[333,'Plastic Basin Tap',T,6,500,1480],[334,'Plastic T Bib Tap',T,6,180,390],[335,'Plastic Bib Tap',T,6,310,810],[336,'Plastic Swan Neck',T,6,610,1380],
  [337,'Swan Neck','FRINCE',6,775,1950],[338,'Galaxy Bib Tap',T,12,1265,2650],[339,'Galaxy Concealed Valve',T,6,1595,3750],[340,'Bidet Spray Chrome','BRASSCO',6,1350,3250],
  [341,'Flexible Hose 45cm',T,12,250,790],[342,'Flexible Hose 60cm',T,12,275,890],
  [343,'SQ 70x50 Gold Thick Frame Mirror',T,1,10500,null],[344,'SQ 70x50 Silver Thick Frame Mirror',T,1,10500,null],[345,'SQ 70x50 Black Thick Frame Mirror',T,1,10500,null],
  [346,'RD 60x60 Gold Thick Frame Mirror',T,1,10500,null],[347,'RD 60x60 Silver Thick Frame Mirror',T,1,10500,null],[348,'RD 60x60 Black Thick Frame Mirror',T,1,10500,null]];
const B = [[349,'Vanity 6051C',T,3,18150,null],[350,'Vanity 6166B',T,3,13750,null],[351,'Vanity 6051A',T,3,15950,null],[352,'Vanity 6051B',T,3,18150,null]];
const GRNS = [['V1018', 90, '2027-02-16', 118260, A], ['V1017', 60, '2027-01-16', 198000, B]];
(async () => {
  const c = await pool.connect();
  try {
    await c.query('BEGIN'); await c.query('SELECT pg_advisory_xact_lock($1)', [774414]);
    for (const [no, , , tot, L] of GRNS) { const s = L.reduce((a, l) => a + l[3] * l[4], 0); if (s !== tot) throw new Error(no + ' lines add to ' + s + ', not ' + tot); }
    if ((await c.query("SELECT 1 FROM vendor_bills WHERE vendor_name=$1 AND bill_no IN ('V1017','V1018')", [V])).rowCount) throw new Error('Lucky Trading bills already loaded');
    let sup = (await c.query("SELECT id FROM suppliers WHERE name ILIKE $1", [V])).rows[0];
    if (!sup) sup = (await c.query("INSERT INTO suppliers (name, active, address, city, default_credit_days) VALUES ($1,true,'75 Prince Street','Colombo 11',90) RETURNING id", [V])).rows[0];
    for (const code of [332, 333, 334, 335]) await c.query("UPDATE products SET item_code='OLD-'||item_code, active=false WHERE item_code=$1 AND active=false AND stock_level=0", [String(code)]);
    for (const [no, days, due, tot, L] of GRNS) {
      let first = null;
      for (const [code, item, brand, qty, cost, sell] of L) {
        const name = item + ' (' + brand + ')', cd = String(code);
        if ((await c.query('SELECT 1 FROM products WHERE item_code=$1', [cd])).rowCount) throw new Error('item code ' + cd + ' is already in use. Nothing saved.');
        await c.query('INSERT INTO products (item_code,name,stock_level,avg_cost,selling_price,active,preferred_supplier) VALUES ($1,$2,$3,$4,$5,true,$6)', [cd, name, qty, cost, sell, V]);
        const g = await c.query(`INSERT INTO grn_records (grn_number,supplier_id,supplier_name,grn_date,item_description,quantity,unit_cost,total_amount,status,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'PENDING_REVIEW',$9) RETURNING id`,
          [no, sup.id, V, DATE, cd + ' - ' + name, qty, cost, qty * cost, 'Lucky Trading ' + no + ', back-dated 16-11-2026' + (sell === null ? '; sell price pending' : '') + ([339, 340].includes(code) ? '; CONFIRM handwritten row' : '')]);
        if (!first) first = g.rows[0].id;
      }
      await c.query(`INSERT INTO vendor_bills (branch_id,vendor_name,bill_no,bill_date,due_date,total,grn_id,notes,created_by) VALUES (1,$1,$2,$3,$4,$5,$6,$7,'lucky-17nov')`,
        [V, no, DATE, due, tot, first, 'From GRN; paid by BILL; ' + days + ' credit days; back-dated 16-11-2026']);
      console.log(no, 'lines', L.length, 'total', tot, 'due', due);
    }
    await c.query(YES ? 'COMMIT' : 'ROLLBACK'); console.log(YES ? 'SAVED' : 'REHEARSAL only, nothing saved');
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); console.log('STOPPED:', e.message, 'Nothing saved.'); } finally { c.release(); process.exit(); }
})();
