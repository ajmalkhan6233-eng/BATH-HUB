'use strict';
// AUDIT MACHINE, part 2: BILL-CHAIN TEST. TEST COPY ONLY (it creates bills, a GRN and a vendor payment). Never point it at the live shop.
//   BASE=http://localhost:3199 node scripts/audit/bill_chain.js [--fuzz 200]
// Makes real things happen through the app's own API, then checks that every screen and table moved by exactly the right amount:
//   stock, bill lines, payments, dashboard, profit, vendor balance, receipts, voids. Prints each broken check once.
try { require('dotenv').config(); } catch (_) {}
const fs = require('fs'), path = require('path');
const BASE = process.env.BASE || 'http://localhost:3199';
if (!/localhost|127\.0\.0\.1/.test(BASE) || /:3100\b/.test(BASE)) { console.log('REFUSED: this test only runs on a local TEST copy (not port 3100).'); process.exit(3); }
const pool = require('../../utils/pool');
const I = require('./invariants');
const r2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const fuzzN = (() => { const i = process.argv.indexOf('--fuzz'); return i > 0 ? Number(process.argv[i + 1]) || 100 : 0; })();
let seed = 12345; const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = a => a[Math.floor(rnd() * a.length)];
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const fails = [], passes = []; let checks = 0;
function check(name, got, want, ctx) { checks++; const ok = typeof want === 'number' ? Math.abs(Number(got) - want) < 0.011 : got === want; if (ok) passes.push(name); else fails.push({ name, got, want, ctx: ctx || '' }); return ok; }
async function api(method, url, body, form) {
  const h = { 'Idempotency-Key': uid() }; let b;
  if (form) b = form; else if (body !== undefined) { h['Content-Type'] = 'application/json'; b = JSON.stringify(body); }
  const r = await fetch(BASE + url, { method, headers: h, body: b }); let j = null; try { j = await r.json(); } catch (_) {}
  return { status: r.status, body: j };
}
const today = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
async function dash() { const r = (await api('GET', '/api/dashboard-pro')).body || {}; return { today: Number((r.sales || {}).today) || 0, month: Number((r.sales || {}).month) || 0, owed: Number((r.customers_owe || {}).owed_to_us) || 0 }; }
async function prof() { const d = today(); const r = (await api('GET', '/api/profit?group=day&from=' + d + '&to=' + d)).body || {}; const t = r.total || {}; return { sales: Number(t.sales) || 0, cogs: Number(t.cogs) || 0, gross: Number(t.gross) || 0, bills: Number(t.bills) || 0 }; }
async function vendorOwed(name) { const r = (await api('GET', '/api/vendor360/list')).body || {}; const v = (r.vendors || []).find(x => x.vendor_name === name); return v ? Number(v.outstanding_balance) : 0; }
async function stockOf(code) { const r = await pool.query('SELECT stock_level FROM products WHERE item_code=$1', [code]); return r.rows[0] ? Number(r.rows[0].stock_level) : null; }
async function billRow(num) { return (await pool.query('SELECT * FROM pos_bills WHERE bill_number=$1', [num])).rows[0]; }

async function makeGrn(vendor, lines) {
  const fd = new FormData(); fd.append('payload', JSON.stringify({ supplier_name: vendor, grn_date: today(), credit_days: 30, lines }));
  return api('POST', '/api/grn-manual', undefined, fd);
}
async function bill(items, pct, payments, cust) {
  return api('POST', '/api/pos-bills', Object.assign({ items, discount_pct: pct, payments }, cust || {}));
}

(async () => {
  const V = 'AUDIT Vendor ' + uid().slice(0, 5);
  const names = ['AUDIT Mixer ' + uid().slice(0, 4), 'AUDIT Dish ' + uid().slice(0, 4), 'AUDIT Tile ' + uid().slice(0, 4), 'AUDIT Hose ' + uid().slice(0, 4)];
  const spec = [[100, 600, 1000], [50, 200, 400], [500, 350, 700.5], [80, 33.33, 99.99]];
  // S1 GRN: stock, vendor bill, vendor balance
  const owed0 = await vendorOwed(V);
  const g = await makeGrn(V, names.map((n, i) => ({ name: n, qty: spec[i][0], unit_cost: spec[i][1], selling_price: spec[i][2], category: 'AUDIT' })));
  check('S1 GRN accepted', g.status < 300 ? 200 : g.status, 200, JSON.stringify(g.body || {}).slice(0, 150));
  const items = ((g.body || {}).results || (g.body || {}).items || []).map(x => ({ code: x.item_code, name: x.name }));
  if (items.length !== 4) { console.log('AUDIT STOPPED: GRN did not return 4 items. Body: ' + JSON.stringify(g.body).slice(0, 200)); process.exit(2); }
  const code = {}; names.forEach(n => { code[n] = (items.find(x => x.name === n) || {}).code; });
  for (let i = 0; i < 4; i++) check('S1 stock after GRN: ' + names[i].split(' ')[1], await stockOf(code[names[i]]), spec[i][0]);
  const grnTotal = r2(spec.reduce((a, s) => a + r2(s[0] * s[1]), 0));
  check('S1 vendor balance rose by the GRN total', r2((await vendorOwed(V)) - owed0), grnTotal, 'check GRN creates a vendor bill');

  // S2 cash bill with 10% discount
  const D0 = await dash(), P0 = await prof(); const st0 = [await stockOf(code[names[0]]), await stockOf(code[names[1]])];
  const lines = [{ item_name: names[0], item_code: code[names[0]], qty: 3, unit_price: 1000 }, { item_name: names[1], item_code: code[names[1]], qty: 2, unit_price: 400 }];
  const b1 = await bill(lines, 10, [{ method: 'cash', amount: 3420 }]);
  check('S2 cash bill accepted', b1.status < 300 ? 201 : b1.status, 201, JSON.stringify(b1.body || {}).slice(0, 150));
  const n1 = (b1.body || {}).bill_number; const row = n1 && await billRow(n1);
  if (row) { check('S2 bill total 3420', row.total, 3420); check('S2 discount 380', row.discount_amount, 380); }
  check('S2 mixer stock -3', await stockOf(code[names[0]]), st0[0] - 3); check('S2 dish stock -2', await stockOf(code[names[1]]), st0[1] - 2);
  const D1 = await dash(), P1 = await prof();
  check('S2 dashboard sales today +3420', r2(D1.today - D0.today), 3420, 'dashboard-pro'); check('S2 dashboard month +3420', r2(D1.month - D0.month), 3420);
  check('S2 profit screen sales +3420', r2(P1.sales - P0.sales), 3420); check('S2 profit cost of goods +2200', r2(P1.cogs - P0.cogs), 2200);
  check('S2 profit gross +1220', r2(P1.gross - P0.gross), 1220); check('S2 profit bills +1', P1.bills - P0.bills, 1);

  // S3 split payment
  const b2 = await bill([{ item_name: names[2], item_code: code[names[2]], qty: 2.5, unit_price: 700.5 }], 0, [{ method: 'cash', amount: 1000 }, { method: 'card', amount: 751.25 }]);
  check('S3 split bill accepted', b2.status < 300 ? 201 : b2.status, 201, JSON.stringify(b2.body || {}).slice(0, 150));
  const row2 = (b2.body || {}).bill_number && await billRow(b2.body.bill_number); if (row2) check('S3 total = 2.5 x 700.50 = 1751.25', row2.total, 1751.25);
  check('S3 tile stock -2.5', await stockOf(code[names[2]]), spec[2][0] - 2.5);

  // S4 credit bill: customer owes us
  const Dc0 = await dash();
  const b3 = await bill([{ item_name: names[3], item_code: code[names[3]], qty: 4, unit_price: 99.99 }], 0, [{ method: 'credit', amount: 399.96 }], { customer_name: 'AUDIT Customer', customer_phone: '0770000000' });
  check('S4 credit bill accepted', b3.status < 300 ? 201 : b3.status, 201, JSON.stringify(b3.body || {}).slice(0, 150));
  check('S4 customers-owe-us rose by 399.96 (credit sale must reach receivables)', r2((await dash()).owed - Dc0.owed), 399.96, 'credit bill vs credit_customers');

  // S5 void the cash bill: everything goes back
  const Dv0 = await dash(), Pv0 = await prof();
  if (b1.body && b1.body.id) {
    const v = await api('POST', '/api/pos-bills/' + b1.body.id + '/void', { reason: 'audit test' });
    check('S5 void accepted', v.status, 200, JSON.stringify(v.body || {}).slice(0, 150));
    check('S5 mixer stock back', await stockOf(code[names[0]]), st0[0]); check('S5 dish stock back', await stockOf(code[names[1]]), st0[1]);
    const Dv1 = await dash(), Pv1 = await prof();
    check('S5 dashboard sales today -3420', r2(Dv0.today - Dv1.today), 3420); check('S5 profit sales -3420', r2(Pv0.sales - Pv1.sales), 3420); check('S5 profit cogs -2200', r2(Pv0.cogs - Pv1.cogs), 2200);
  }

  // S6 vendor payment
  const vb = (await pool.query(`SELECT id, total FROM vendor_bills WHERE vendor_name=$1 AND voided=FALSE ORDER BY id DESC LIMIT 1`, [V])).rows[0];
  if (vb) { const o = await vendorOwed(V); const pay = await api('POST', '/api/vendor-ledger/bills/' + vb.id + '/payments', { amount: 1000, method: 'cash', paid_at: today() });
    check('S6 vendor payment accepted', pay.status, 201, JSON.stringify(pay.body || {}).slice(0, 150)); check('S6 vendor balance -1000', r2(o - (await vendorOwed(V))), 1000); }
  else check('S6 vendor bill exists after GRN', false, true, 'no vendor_bill row for ' + V);

  // S7 rules hold after all that
  const rules = await I.run(pool); rules.filter(r => !r.ok && !r.skipped && !r.warn).forEach(r => check('RULE ' + r.id + ' ' + r.name, r.bad, 0, JSON.stringify(r.detail.slice(0, 2))));

  // FUZZ: many random bills, checked one by one, then random voids
  if (fuzzN) {
    const made = []; const stock = {}; for (const n of names) stock[n] = await stockOf(code[n]);
    for (let k = 0; k < fuzzN; k++) {
      const nl = 1 + Math.floor(rnd() * 4), used = new Set(), ls = [];
      for (let j = 0; j < nl; j++) { const n = pick(names); if (used.has(n)) continue; used.add(n); const qty = pick([1, 2, 3, 0.5, 1.5, 2.25, 4, 7]); const price = pick([1000, 400, 700.5, 99.99, 12.345, 0.01, 1999.99, 33.33]); ls.push({ item_name: n, item_code: code[n], qty, unit_price: price }); }
      const pct = pick([0, 0, 5, 10, 12.5, 33.33, 7.77, 100]);
      const sub = r2(ls.reduce((a, l) => a + r2(r2(l.qty) * r2(l.unit_price)), 0)), total = r2(sub - r2(sub * pct / 100));
      if (total <= 0) continue;
      const m = pick(['cash', 'card', 'split', 'credit']); const pays = m === 'split' ? [{ method: 'cash', amount: r2(total / 3) }, { method: 'card', amount: r2(total - r2(total / 3)) }] : [{ method: m, amount: total }];
      const r = await bill(ls, pct, pays, m === 'credit' ? { customer_name: 'AUDIT Fuzz', customer_phone: '0771111111' } : {});
      if (r.status >= 300) { check('F accepted ' + JSON.stringify({ pct, total, m }), r.status, 200, JSON.stringify(r.body || {}).slice(0, 120)); continue; }
      const row = await billRow(r.body.bill_number);
      check('F total matches the maths (' + pct + '% off ' + sub + ')', row.total, total, r.body.bill_number);
      const sum = (await pool.query('SELECT COALESCE(SUM(amount),0) s FROM pos_bill_payments WHERE bill_id=$1', [row.id])).rows[0].s; check('F payments = total', sum, Number(row.total), r.body.bill_number);
      ls.forEach(l => { stock[l.item_name] -= l.qty; }); made.push({ id: row.id, num: r.body.bill_number, ls });
    }
    for (const n of names) check('F stock after ' + made.length + ' bills: ' + n.split(' ')[1], await stockOf(code[n]), r2(stock[n]));
    let vc = 0; for (const b of made) { if (rnd() < 0.25) { const v = await api('POST', '/api/pos-bills/' + b.id + '/void', { reason: 'fuzz' }); if (v.status === 200) { b.ls.forEach(l => { stock[l.item_name] += l.qty; }); vc++; } else check('F void accepted', v.status, 200, JSON.stringify(v.body || {}).slice(0, 100)); } }
    for (const n of names) check('F stock after ' + vc + ' voids: ' + n.split(' ')[1], await stockOf(code[n]), r2(stock[n]));
    const d = today(); const sq = (await pool.query(`SELECT COALESCE(SUM(total),0) s FROM pos_bills b WHERE NOT EXISTS (SELECT 1 FROM pos_bill_voids v WHERE v.bill_id=b.id) AND (b.created_at AT TIME ZONE 'Asia/Colombo')::date = $1::date`, [d])).rows[0].s;
    check('F dashboard today = sum of bills in the database', (await dash()).today, Number(sq)); check('F profit screen sales = sum of bills in the database', (await prof()).sales, Number(sq));
    const rules2 = await I.run(pool); rules2.filter(r => !r.ok && !r.skipped && !r.warn).forEach(r => check('F RULE ' + r.id + ' ' + r.name, r.bad, 0, JSON.stringify(r.detail.slice(0, 2))));
  }

  // report: each broken check once (grouped by name prefix)
  const seen = new Set(), uniq = fails.filter(f => { const k = f.name.replace(/\d+(\.\d+)?/g, '#'); if (seen.has(k)) return false; seen.add(k); return true; });
  console.log('AUDIT CHAIN: ' + checks + ' checks, ' + fails.length + ' broken (' + uniq.length + ' different)');
  uniq.forEach(f => console.log(' x ' + f.name + ' | got ' + f.got + ' want ' + f.want + (f.ctx ? ' | ' + String(f.ctx).slice(0, 140) : '')));
  try { fs.mkdirSync(path.join(__dirname, '../../data'), { recursive: true }); fs.writeFileSync(path.join(__dirname, '../../data/audit_chain_last.json'), JSON.stringify({ at: new Date().toISOString(), checks, fails }, null, 1)); } catch (_) {}
  await pool.end().catch(() => {}); process.exit(fails.length ? 2 : 0);
})().catch(e => { console.log('AUDIT CHAIN COULD NOT RUN: ' + String(e.stack || e).slice(0, 300)); process.exit(3); });
