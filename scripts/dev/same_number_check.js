'use strict';
// SAME NUMBER CHECK (27 Nov 2026, AJ "one family"): asks every screen for today's and this month's sales and gross profit and
// compares them with the money core. Run on the test rig: BASE=http://localhost:3199 node scripts/dev/same_number_check.js
// Needs the DB_* env vars (same as the app). Exit 0 = every screen shows the same number, 1 = a screen is off.
require('dotenv').config();
const MC = require('../../utils/moneyCore');
const pool = require('../../utils/pool');
const BASE = process.env.BASE || 'http://localhost:3100';
const get = async (u) => { const r = await fetch(BASE + u); if (!r.ok) throw new Error(u + ' HTTP ' + r.status); return r.json(); };
const r2 = (n) => Math.round(Number(n) * 100) / 100;
(async () => {
  const t = (await pool.query(`SELECT CURRENT_DATE::text AS d, date_trunc('month', CURRENT_DATE)::date::text AS m`)).rows[0];
  const day = await MC.range(pool, t.d, t.d), mon = await MC.range(pool, t.m, t.d);
  const rows = [];
  const chk = (screen, what, got, want) => rows.push({ screen, what, got: r2(got), want: r2(want), ok: r2(got) === r2(want) });
  try { const h = await get('/api/home-solid'); chk('Home', 'sales today', h.sales.today.sales, day.sales); chk('Home', 'gross today', h.sales.today.profit, day.gross); chk('Home', 'sales month', h.sales.month.sales, mon.sales); chk('Home', 'gross month', h.sales.month.profit, mon.gross); } catch (e) { rows.push({ screen: 'Home', what: e.message, ok: false }); }
  try { const d = await get('/api/dashboard-pro'); chk('Dashboard', 'sales today', d.sales.today, day.sales); chk('Dashboard', 'sales month', d.sales.month, mon.sales); } catch (e) { rows.push({ screen: 'Dashboard', what: e.message, ok: false }); }
  try { const p = await get(`/api/profit?from=${t.d}&to=${t.d}`); const s = p.rows.reduce((a, x) => a + Number(x.sales), 0), g = p.rows.reduce((a, x) => a + Number(x.gross), 0); chk('Profit', 'sales today', s, day.sales); chk('Profit', 'gross today', g, day.gross); } catch (e) { rows.push({ screen: 'Profit', what: e.message, ok: false }); }
  try { const v = await get(`/api/sales-view?from=${t.d}&to=${t.d}`); chk('Sales view', 'sales today', v.total, day.sales); chk('Sales view', 'bills today', v.bills, day.n); } catch (e) { rows.push({ screen: 'Sales view', what: e.message, ok: false }); }
  try { const b = await get('/api/bank-money/overview'); chk('Banking & Money', 'sales today', b.sales.today.sales, day.sales); chk('Banking & Money', 'gross month', b.sales.month.gross, mon.gross); } catch (e) { rows.push({ screen: 'Banking & Money', what: e.message, ok: false }); }
  try { const s = await require('../../utils/pocketSnapshot').build(pool); chk('Pocket', 'sales today', s.sales.today, day.sales); chk('Pocket', 'gross today', s.profit.today.gross, day.gross); chk('Pocket', 'gross month', s.profit.month.gross, mon.gross); } catch (e) { rows.push({ screen: 'Pocket', what: e.message, ok: false }); }
  for (const r of rows) console.log((r.ok ? 'SAME ' : 'OFF  ') + r.screen.padEnd(16) + r.what + (r.got === undefined ? '' : '  screen ' + r.got + '  core ' + r.want));
  const bad = rows.filter((r) => !r.ok).length;
  console.log(bad ? `${bad} screen number(s) OFF` : `ALL ${rows.length} numbers match the money core`);
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error('check failed:', e.message); process.exit(2); });
