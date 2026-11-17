'use strict';
// READ ONLY money picture. Run: node scripts/money_check.js [--from 2026-10-29] [--to 2026-11-16]
// Sales, cost of goods, gross profit, vendor payable, and net profit after AJ's listed costs. Changes nothing.
try { require('dotenv').config(); } catch (_) {}
const pool = require('../utils/pool');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const from = arg('from', '2026-10-29'), to = arg('to', new Date().toISOString().slice(0, 10));
// AJ's costs (16 Nov). Change here if he corrects them.
const C = { jazeelDay: 3000, commPct: 5, commOn: 'gp', rentMonth: 70000, loanMonth: 70000, foodDay: 400 + 800, elecMonth: 30000 };
const n = x => Math.round(+x || 0), f = x => n(x).toLocaleString('en-US');
(async () => {
  const q = async (s, p) => (await pool.query(s, p)).rows;
  const has = async t => (await q('SELECT to_regclass($1) r', [t]))[0].r;
  const days = Math.round((new Date(to) - new Date(from)) / 864e5) + 1;
  const voided = 'NOT EXISTS (SELECT 1 FROM pos_bill_voids v WHERE v.bill_id=b.id)';
  const s = (await q(`SELECT COUNT(*) bills, COALESCE(SUM(b.total),0) sales FROM pos_bills b WHERE b.created_at::date BETWEEN $1 AND $2 AND ${voided}`, [from, to]))[0];
  const c = (await q(`SELECT COALESCE(SUM(i.qty*COALESCE(NULLIF(i.unit_cost,0),p.avg_cost,0)),0) cost,
      COUNT(*) FILTER (WHERE COALESCE(NULLIF(i.unit_cost,0),p.avg_cost,0)=0) nocost
    FROM pos_bill_items i JOIN pos_bills b ON b.id=i.bill_id LEFT JOIN products p ON p.item_code=i.item_code
    WHERE b.created_at::date BETWEEN $1 AND $2 AND ${voided}`, [from, to]))[0];
  const perDay = await q(`SELECT b.created_at::date d, COUNT(*) bills, SUM(b.total) sales FROM pos_bills b WHERE b.created_at::date BETWEEN $1 AND $2 AND ${voided} GROUP BY 1 ORDER BY 1`, [from, to]);
  const sales = +s.sales, cogs = +c.cost, gp = sales - cogs;
  let v = null;
  if (await has('vendor_bills')) {
    v = (await q(`SELECT vendor_name,
      SUM(total) billed,
      COALESCE(SUM((SELECT SUM(amount) FROM vendor_payments p WHERE p.bill_id=vb.id)),0) paid,
      COALESCE(SUM((SELECT SUM(amount) FROM vendor_credit_notes c WHERE c.bill_id=vb.id)),0) credits,
      COALESCE(SUM((SELECT SUM(amount) FROM vendor_bill_cheques h WHERE h.bill_id=vb.id AND h.status='ISSUED')),0) cheques_pending
      FROM vendor_bills vb WHERE NOT voided GROUP BY vendor_name ORDER BY 2 DESC`));
  }
  const comm = C.commPct / 100 * (C.commOn === 'gp' ? gp : sales);
  const costs = { 'Jazeel salary': C.jazeelDay * days, 'Jazeel commission': comm, 'Rent': C.rentMonth / 30 * days, 'Vehicle loan': C.loanMonth / 30 * days, 'Food (400+800/day)': C.foodDay * days, 'Electricity (rough)': C.elecMonth / 30 * days };
  const tot = Object.values(costs).reduce((a, b) => a + b, 0);
  console.log(`MONEY CHECK ${from} to ${to} (${days} days)`);
  console.log(`Sales ${f(sales)} in ${s.bills} bills | Cost of goods ${f(cogs)} | GROSS PROFIT ${f(gp)} (${sales ? (gp / sales * 100).toFixed(1) : 0}%)`);
  if (+c.nocost) console.log(`Heads-up: ${c.nocost} sold lines have no cost, so gross profit is a little high`);
  console.log('Per day:'); perDay.forEach(r => console.log(`  ${new Date(r.d.getTime()-r.d.getTimezoneOffset()*6e4).toISOString().slice(0,10)}  ${r.bills} bills  ${f(r.sales)}`));
  console.log('Costs so far (assumed):'); Object.entries(costs).forEach(([k, x]) => console.log(`  ${k} ${f(x)}`));
  console.log(`Costs total ${f(tot)} | NET PROFIT ${f(gp - tot)}`);
  if (v) {
    let owe = 0; console.log('Vendors (billed - paid - credits = to pay; cheques given not yet cleared):');
    v.forEach(r => { const o = r.billed - r.paid - r.credits; owe += o; console.log(`  ${r.vendor_name}: ${f(o)} (cheques pending ${f(r.cheques_pending)})`); });
    console.log(`TOTAL TO PAY VENDORS ${f(owe)}`);
  } else console.log('Vendor ledger table not found');
  process.exit(0);
})().catch(e => { console.error('failed:', e.message); process.exit(1); });
