'use strict';
// Real-Postgres check (test copy only): the phone snapshot reads the real tables and its numbers match what was sold.
// Usage: DB_HOST=localhost DB_PORT=5432 DB_NAME=bhtest DB_USER=bh DB_PASSWORD=bh node scripts/dev/pocket_realpg.js   (never the shop database)
if (/^(bathco|bathco_production|bathco_owner)$/i.test(process.env.DB_NAME || '')) { console.error('refusing: this looks like a real database'); process.exit(2); }
const express = require('express'); const request = require('supertest'); const pool = require('../../utils/pool');
const snap = require('../../utils/pocketSnapshot');
(async () => {
  const posRouter = require('../../routes/pos_bills'); require('../../routes/cheque_register');
  await new Promise((r) => setTimeout(r, 2000));
  await require('../migrate_vendor_ledger').migrate(pool);
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS reorder_threshold NUMERIC DEFAULT 0`);
  for (const t of ['pos_bill_voids','pos_bill_payments','pos_bill_items','pos_bills','vendor_payments','vendor_credit_notes','vendor_bills','cheque_register']) await pool.query(`DELETE FROM ${t}`).catch(() => {});   // test copy only
  await pool.query(`DELETE FROM products`);
  await pool.query(`INSERT INTO products (item_code, name, stock_level, selling_price, avg_cost, reorder_threshold, active) VALUES ('P1','Tap',10,500,100,5,true),('P2','Sink',2,900,300,5,true),('P3','Gone',0,100,50,3,true)`);
  const app = express(); app.use(express.json()); app.use((q, _r, n) => { q.session = { user: { role: 'admin', username: 't' } }; n(); });
  app.use('/api', posRouter);
  const sale = await request(app).post('/api/pos-bills').send({ items: [{ item_name: 'Tap', item_code: 'P1', qty: 2, unit_price: 500 }] });
  await pool.query(`INSERT INTO vendor_bills (vendor_name, bill_no, bill_date, total, due_date) VALUES ('Vendor A','B1',CURRENT_DATE - 30,2500, CURRENT_DATE - 3)`);
  await pool.query(`INSERT INTO cheque_register (payee, cheque_no, amount, due_date, status) VALUES ('Vendor B','C1',4000, CURRENT_DATE + 5, 'pending')`).catch((e) => console.log('cheque insert skipped:', e.message));
  const s = await snap.build(pool);
  const sealed = snap.lock(s, 'test pass');
  const ok = sale.status === 200 && s.sales && s.sales.today === 1000 && s.sales.bills_today === 1 && s.stock && s.stock.out === 1 && s.stock.low === 1
    && s.stock.low_list[0].code === 'P2' && s.due && s.due.overdue_count === 1 && s.due.overdue_amount === 2500
    && Array.isArray(s.pays_today) && s.top_month && s.top_month[0].name === 'Tap' && !JSON.stringify(sealed).includes('Vendor');
  console.log(JSON.stringify({ sale: sale.status, sales: s.sales, stock: s.stock && { out: s.stock.out, low: s.stock.low }, due: s.due && { n: s.due.overdue_count, amt: s.due.overdue_amount, items: s.due.next.length }, nullParts: Object.keys(s).filter((k) => s[k] === null), PASS: !!ok }));
  await pool.end(); process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e.message); process.exit(1); });
