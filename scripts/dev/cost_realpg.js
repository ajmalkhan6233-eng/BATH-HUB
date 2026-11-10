'use strict';
// Real-Postgres check (test copy only): the cost is saved on the bill line at sale time, so a later cost change does not move past profit.
// Usage: DB_HOST=127.0.0.1 DB_PORT=5599 DB_NAME=sp_test DB_USER=postgres node scripts/dev/cost_realpg.js   (never the shop database)
if (/^(bathco|bathco_production|bathco_owner)$/i.test(process.env.DB_NAME || '')) { console.error('refusing: this looks like a real database'); process.exit(2); }
const express = require('express'); const request = require('supertest'); const pool = require('../../utils/pool');
(async () => {
  await pool.query(`CREATE TABLE IF NOT EXISTS products (id SERIAL PRIMARY KEY, item_code TEXT, name TEXT, category TEXT, stock_level NUMERIC DEFAULT 0, selling_price NUMERIC DEFAULT 0, avg_cost NUMERIC DEFAULT 0, active BOOLEAN DEFAULT TRUE)`);
  await pool.query(`DELETE FROM products`); await pool.query(`INSERT INTO products (item_code, name, stock_level, selling_price, avg_cost) VALUES ('CS1','Tap',10,500,100)`);
  const app = express(); app.use(express.json()); app.use((q, _r, n) => { q.session = { user: { role: 'admin', username: 't' } }; n(); });
  app.use('/api', require('../../routes/pos_bills')); app.use('/api/profit', require('../../routes/profit'));
  await new Promise(r => setTimeout(r, 1500));
  const r = await request(app).post('/api/pos-bills').send({ items: [{ item_name: 'Tap', item_code: 'CS1', qty: 2, unit_price: 500 }] });
  const before = (await request(app).get('/api/profit')).body;
  await pool.query(`UPDATE products SET avg_cost = 300 WHERE item_code='CS1'`);   // a later GRN changes the cost
  const after = (await request(app).get('/api/profit')).body;
  const cogs = (b) => Number(b.total && b.total.cogs);
  const ok = r.status === 200 && cogs(before) === 200 && cogs(after) === 200;
  console.log(JSON.stringify({ bill: r.status, cogs_before: cogs(before), cogs_after_cost_change: cogs(after), PASS: ok }));
  await pool.end(); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e.message); process.exit(1); });
