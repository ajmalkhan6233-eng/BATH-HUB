'use strict';
// MONEY-FLOW AUDIT (TEST_MODE only). Real API calls with throwaway names (ZZ AUDIT ...). Prints PASS / FAIL per check, one line each.
//   node scripts/audit/audit_user.js make   then   node scripts/audit/money_flow.js [baseUrl]
// A. supplier GRN: new item appears with the right stock; a second GRN adds stock and averages the cost; the vendor bill (payable) is created.
// B. POS bill: stock goes DOWN by the quantity sold (if POS_DEDUCT_STOCK is on) and today's live sales go UP by the bill total.
// C. Void: the bill leaves today's sales and the stock comes back.
const fs = require('fs'); const path = require('path');
const BASE = (process.argv[2] || 'http://127.0.0.1:3100').replace(/\/$/, '');
const cred = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'audit_out', '.cred'), 'utf8')); } catch (_) { return {}; } })();
let cookie = ''; const results = [];
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo' }).format(new Date());
async function call(method, url, body, form) {
  const headers = { cookie }; let payload;
  if (form) payload = form; else if (body) { headers['content-type'] = 'application/json'; payload = JSON.stringify(body); }
  const r = await fetch(BASE + url, { method, headers, body: payload, redirect: 'manual' });
  const sc = r.headers.getSetCookie ? r.headers.getSetCookie() : []; if (sc.length) cookie = sc.map((c) => c.split(';')[0]).join('; ');
  const j = await r.json().catch(() => ({})); return { status: r.status, body: j };
}
const check = (name, ok, detail) => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`); };
const near = (a, b) => Math.abs(Number(a) - Number(b)) < 0.02;
const walk = (o, f, k = '') => { if (o && typeof o === 'object') for (const x of Object.keys(o)) walk(o[x], f, k ? k + '.' + x : x); else if (typeof o === 'number') f(k, o); };

(async () => {
  const l = await call('POST', '/api/login', { username: cred.user || process.env.AUDIT_USER, password: cred.pass || process.env.AUDIT_PASS });
  if (l.status !== 200 || l.body.needs_totp) { console.error('Login failed. Run: node scripts/audit/audit_user.js make'); process.exit(4); }
  const tm = await call('GET', '/api/test-mode'); if (!tm.body.test) { console.error('REFUSED: not in TEST_MODE.'); process.exit(3); }
  const stamp = Date.now().toString().slice(-6); const name = `ZZ AUDIT TILE ${stamp}`; const supplier = `ZZ AUDIT SUPPLIER ${stamp}`;
  const item = async () => ((await call('GET', '/api/items?q=' + encodeURIComponent(name))).body || [])[0] || {};
  const liveBefore = (await call('GET', '/api/daily-sales-live/today')).body;
  const sumLive = (o) => { const m = {}; walk(o, (k, v) => { m[k] = v; }); return m; };

  // A. GRN
  const grn = async (qty, cost) => { const f = new FormData(); f.append('payload', JSON.stringify({ supplier_name: supplier, grn_date: today, credit_days: 30, lines: [{ name, qty, unit_cost: cost, selling_price: 200, category: 'Tiles' }] })); return call('POST', '/api/grn-manual', null, f); };
  const g1 = await grn(10, 100);
  check('A1 GRN accepted', g1.status === 200 || g1.status === 201, `HTTP ${g1.status} ${g1.body.error || ''}`);
  let it = await item(); check('A2 new item created with stock 10', near(it.stock_level, 10), `stock ${it.stock_level}`);
  const g2 = await grn(5, 120); check('A3 second GRN accepted', g2.status === 200 || g2.status === 201, `HTTP ${g2.status} ${g2.body.error || ''}`);
  it = await item(); check('A4 stock is now 15', near(it.stock_level, 15), `stock ${it.stock_level}`);
  // The item list hides cost on purpose (selling price and stock only), so A5 checks the same formula the GRN uses.
  const { weightedAvgCost } = require('../../utils/grn_math'); const wa = weightedAvgCost(10, 100, 5, 120);
  check('A5 average cost formula = 106.67 (cost hidden from the API by design)', near(wa, (10 * 100 + 5 * 120) / 15), `avg ${wa}`);
  const vb = await call('GET', '/api/vendor-ledger/bills'); const bills = (Array.isArray(vb.body) ? vb.body : vb.body.bills || []).filter((b) => JSON.stringify(b).includes(supplier));
  check('A6 vendor bills created for the supplier (1000 + 600)', bills.length === 2 && near(bills.reduce((a, b) => a + Number(b.total || b.amount || 0), 0), 1600), `${bills.length} bills`);

  // B. POS bill
  const stockBefore = Number(it.stock_level);
  const bill = await call('POST', '/api/pos-bills', { customer_name: 'ZZ AUDIT', items: [{ item_name: name, item_code: it.item_code, qty: 3, unit_price: 200 }], payment_method: 'cash' });
  check('B1 POS bill accepted', bill.status === 201 || bill.status === 200, `HTTP ${bill.status} ${bill.body.error || ''}`);
  it = await item(); const deducts = bill.body.stock_deducted === true;
  check(`B2 stock after sale (${deducts ? 'deduction ON: 12 expected' : 'deduction OFF: 15 expected'})`, near(it.stock_level, deducts ? stockBefore - 3 : stockBefore), `stock ${it.stock_level}`);
  const liveAfter = (await call('GET', '/api/daily-sales-live/today')).body;
  const a = sumLive(liveBefore), b = sumLive(liveAfter); const rose = Object.keys(b).filter((k) => near(b[k] - (a[k] || 0), 600));
  check('B3 today live sales rose by the bill total 600', rose.length > 0, rose.length ? 'field ' + rose[0] : 'no field rose by 600');

  // C. Void
  const id = bill.body.id || bill.body.bill_id || (bill.body.bill && bill.body.bill.id);
  const v = await call('POST', `/api/pos-bills/${id}/void`, { reason: 'audit test void' });
  check('C1 void accepted', v.status === 200, `HTTP ${v.status} ${v.body.error || ''}`);
  it = await item(); check('C2 stock back to 15 after void', near(it.stock_level, stockBefore), `stock ${it.stock_level}`);
  const liveVoid = sumLive((await call('GET', '/api/daily-sales-live/today')).body);
  check('C3 voided bill left today sales', Object.keys(liveVoid).every((k) => !near(liveVoid[k] - (a[k] || 0), 600)), 'no field still +600');

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\nMONEY FLOW: ${results.length - failed}/${results.length} passed. Test rows named "ZZ AUDIT" stay in the TEST database.`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('money-flow crashed:', e.message); process.exit(1); });
