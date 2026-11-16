'use strict';
// HOME TRUTH CHECK (16 Nov). READ ONLY. Recomputes every headline Home number with plain separate SQL and compares it with what
// /api/dashboard-pro returns. Prints OK / DIFF per number, plus facts that explain odd numbers (voids, back-dated bills, timezone, no-GRN stock).
//   node scripts/qa/home_truth.js         (on the PC app folder, or the cloud test copy with the DB_* env of cloud_rig.sh)
require('dotenv').config({ quiet: true });
require('../../utils/timezone');
const express = require('express');
const pool = require('../../utils/pool');
const http = require('http');
let qerr = 0; const one = async (sql, p) => { try { return (await pool.query(sql, p)).rows[0] || {}; } catch (e) { qerr++; console.log('QUERY FAILED:', e.message); return {}; } };
const N = v => Number(v || 0);
(async () => {
  const app = express();
  app.use((req, res, next) => { req.session = { user: { role: 'owner', username: 'check' } }; next(); });
  app.use('/api', require('../../routes/dashboard_pro'));
  const srv = http.createServer(app).listen(0);
  const port = srv.address().port;
  const api = await new Promise((ok, no) => http.get({ port, path: '/api/dashboard-pro' }, r => { let s = ''; r.on('data', d => s += d); r.on('end', () => { try { ok(JSON.parse(s)); } catch (e) { no(e); } }); }).on('error', no));
  srv.close();
  const rows = []; let diff = 0;
  const cmp = (name, got, want) => { const ok = Math.abs(N(got) - N(want)) < 0.5; if (!ok) diff++; rows.push((ok ? 'OK   ' : 'DIFF ') + name.padEnd(26) + ' home=' + N(got).toLocaleString() + '  sql=' + N(want).toLocaleString()); };
  const live = `FROM pos_bills b WHERE NOT EXISTS (SELECT 1 FROM pos_bill_voids v WHERE v.bill_id=b.id)`;
  const tz = await one(`SHOW TimeZone`); const now = await one(`SELECT now() AS n, CURRENT_DATE AS d`);
  const s = api.sales || {};
  let x;
  x = await one(`SELECT COALESCE(SUM(total),0) AS t, COUNT(*) AS n ${live} AND created_at::date = CURRENT_DATE`); cmp('Sales today', s.today, x.t); cmp('Bills today', s.bills_today, x.n);
  x = await one(`SELECT COALESCE(SUM(total),0) AS t, COUNT(*) AS n ${live} AND created_at::date >= date_trunc('week', CURRENT_DATE)::date`); cmp('Sales this week', s.week, x.t); cmp('Bills this week', s.bills_week, x.n);
  x = await one(`SELECT COALESCE(SUM(total),0) AS t, COUNT(*) AS n ${live} AND created_at::date >= date_trunc('month', CURRENT_DATE)::date`); cmp('Sales this month', s.month, x.t); cmp('Bills this month', s.bills_month, x.n);
  x = await one(`SELECT COALESCE(SUM(total),0) AS t ${live} AND created_at::date = CURRENT_DATE - 1`); cmp('Sales yesterday', s.yesterday, x.t);
  x = await one(`SELECT COUNT(*) AS n, COALESCE(SUM(GREATEST(stock_level,0)*avg_cost),0) AS c FROM products WHERE active=true`); cmp('Stock items', (api.stock || {}).items, x.n); cmp('Stock cost value', (api.stock || {}).cost_value, x.c);
  x = await one(`SELECT COALESCE(SUM(amount),0) AS t FROM cheque_register WHERE status IN ('pending','held')`); cmp('Cheques pending', (api.cheques || {}).pending, x.t);
  x = await one(`SELECT COALESCE(SUM(owed),0) AS t FROM (SELECT b.total - COALESCE((SELECT SUM(amount) FROM vendor_payments p WHERE p.bill_id=b.id),0) - COALESCE((SELECT SUM(amount) FROM vendor_credit_notes n WHERE n.bill_id=b.id),0) AS owed FROM vendor_bills b WHERE b.voided=false) z WHERE owed>0`); cmp('We owe vendors', (api.vendors || {}).owed, x.t);
  console.log('Server time zone:', tz.TimeZone, '| DB now:', String(now.n), '| DB today:', String(now.d), '| JS now:', new Date().toString());
  rows.forEach(r => console.log(r));
  console.log('--- facts that explain odd numbers ---');
  x = await one(`SELECT COUNT(*) AS n, COALESCE(SUM(b.total),0) AS t FROM pos_bills b JOIN pos_bill_voids v ON v.bill_id=b.id WHERE b.created_at::date = CURRENT_DATE`); console.log('Voided bills today (not counted):', x.n, 'worth', x.t);
  x = await one(`SELECT COUNT(*) AS n FROM pos_bills WHERE created_at::date = CURRENT_DATE AND created_at::time = '00:00:00'`); console.log('Bills today stamped exactly 00:00 (look back-dated):', x.n);
  x = await one(`SELECT COUNT(*) AS n FROM pos_bills WHERE created_at::date > CURRENT_DATE`); console.log('Bills dated in the future:', x.n);
  x = await one(`SELECT COUNT(*) AS n FROM products WHERE active=true AND (avg_cost IS NULL OR avg_cost=0)`); console.log('Active items with NO cost (profit and stock value are low because of them):', x.n);
  x = await one(`SELECT COUNT(*) AS n FROM products WHERE active=true AND (selling_price IS NULL OR selling_price<=0)`); console.log('Active items with no selling price:', x.n);
  x = await one(`SELECT COUNT(*) AS n FROM products WHERE active=true AND stock_level<0`); console.log('Items with NEGATIVE stock (counted as 0 on Home):', x.n);
  x = await one(`SELECT COUNT(*) AS n FROM (SELECT item_code FROM products GROUP BY 1 HAVING COUNT(*)>1) z`); console.log('Item codes used by two items:', x.n);
  if (qerr) { console.log('RESULT: NOT CHECKED, ' + qerr + ' query(ies) failed (see above). Do not trust this run.'); await pool.end(); process.exit(2); }
  console.log(diff ? 'RESULT: ' + diff + ' DIFF (Home and plain SQL disagree: look at the DIFF lines)' : 'RESULT: Home matches plain SQL on every number checked. If a number still looks wrong to AJ the data (facts above) is the reason, not the screen.');
  await pool.end();
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
