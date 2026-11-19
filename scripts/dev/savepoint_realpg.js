'use strict';
// Real-Postgres check (test copy only): a failing side-check inside the bill's transaction must not fail the sale.
// Usage: DB_HOST=127.0.0.1 DB_PORT=5599 DB_NAME=sp_test DB_USER=postgres node scripts/dev/savepoint_realpg.js   (never the shop database)
if (/^(bathco|bathco_production|bathco_owner)$/i.test(process.env.DB_NAME || '')) { console.error('refusing: this looks like a real database'); process.exit(2); }
const express = require('express'); const request = require('supertest'); const pool = require('../../utils/pool');
(async () => {
  await pool.query(`CREATE TABLE IF NOT EXISTS products (id SERIAL PRIMARY KEY, item_code TEXT, name TEXT, stock_level NUMERIC DEFAULT 0, selling_price NUMERIC DEFAULT 0, avg_cost NUMERIC DEFAULT 0, active BOOLEAN DEFAULT TRUE)`);
  await pool.query(`DELETE FROM products`); await pool.query(`INSERT INTO products (item_code, name, stock_level, selling_price) VALUES ('SP1','Tap',1,500)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS customers (id SERIAL PRIMARY KEY, name TEXT, phone TEXT, whatsapp TEXT, source TEXT, notes TEXT)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS credit_customers (id SERIAL PRIMARY KEY, customer_id INT, invoice_date DATE, invoice_no TEXT, amount NUMERIC(12,2), paid NUMERIC(12,2) DEFAULT 0, due_date DATE, notes TEXT)`);
  await pool.query(`DROP TABLE IF EXISTS oversold_owed`); await pool.query(`CREATE TABLE oversold_owed (id SERIAL PRIMARY KEY, wrong_shape TEXT)`);   // makes the side-check's INSERT fail
  const app = express(); app.use(express.json()); app.use((q, _r, n) => { q.session = { user: { role: 'admin', username: 't' } }; n(); });
  app.use('/api', require('../../routes/pos_bills')); app.use('/api', require('../../routes/pos_bill_corrections'));
  await new Promise(r => setTimeout(r, 1500));
  process.env.POS_DEDUCT_STOCK = 'true';
  const r = await request(app).post('/api/pos-bills').send({ items: [{ item_name: 'Tap', item_code: 'SP1', qty: 3, unit_price: 500 }] });
  const stock = Number((await pool.query(`SELECT stock_level FROM products WHERE item_code='SP1'`)).rows[0].stock_level);
  const v = await request(app).post(`/api/pos-bills/${r.body.id}/void`).send({ reason: 'check' });
  const stock2 = Number((await pool.query(`SELECT stock_level FROM products WHERE item_code='SP1'`)).rows[0].stock_level);
  const ok = r.status === 200 && stock === -2 && v.status === 200 && stock2 === 1;
  console.log(JSON.stringify({ bill: r.status, stock_after_sale: stock, void: v.status, stock_after_void: stock2, PASS: ok }));
  await pool.end(); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e.message); process.exit(1); });
