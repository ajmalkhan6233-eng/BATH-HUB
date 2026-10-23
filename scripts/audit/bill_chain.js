'use strict';
// BILL-CHAIN TESTS on the cloud test copy. Every flow below is run for real over HTTP, then the numbers are compared in
// every place the app shows them. TEST COPY ONLY (lib.guard refuses anything else).
//   node scripts/audit/bill_chain.js            (needs: bash scripts/dev/cloud_rig.sh, DB_* env of the test DB)
const pool = require('../../utils/pool');
const inv = require('../../utils/auditInvariants');
const { guard, api, Run, r2, near, today, grn, stockOf, uuid } = require('./lib');

const sql = async (q, p) => (await pool.query(q, p)).rows;
const num = async (q, p) => Number((await sql(q, p))[0].v || 0);
const NV = `NOT EXISTS (SELECT 1 FROM pos_bill_voids v WHERE v.bill_id = b.id)`;

async function sale(items, extra = {}, key) {
  return api('POST', '/api/pos-bills', { items, ...extra }, { key });
}
async function agree(t, label) {          // the whole invariant set must stay green after every step
  const out = await inv.runAll(pool);
  const red = out.checks.filter((c) => c.status === 'RED');
  t.check(`${label}: all invariants agree`, red.length === 0, red.map((c) => `${c.id}: ${c.detail}`).join(' | '));
}

async function run() {
  guard();
  const t = new Run('BILL CHAIN');
  const stamp = Date.now().toString().slice(-6);

  // ── GRN: stock in, vendor bill out ───────────────────────────────────────────
  const g = await grn(pool, `AuditCo ${stamp}`, [
    { name: `Audit Tap A ${stamp}`, qty: 20, unit_cost: 1000, selling_price: 2500, category: 'Accessories' },
    { name: `Audit Tile B ${stamp}`, qty: 50, unit_cost: 800, selling_price: 1900, category: 'Tiles' },
    { name: `Audit Sink C ${stamp}`, qty: 5, unit_cost: 6000, selling_price: 12000, category: 'Fittings' },
  ]);
  t.check('GRN saves (201)', g.status === 201, `${g.status} ${g.text.slice(0, 200)}`);
  if (g.status !== 201) return t;
  const [A, B, C] = g.json.items.map((x) => x.item_code);
  t.check('GRN total = 20x1000 + 50x800 + 5x6000', near(g.json.total, 90000), g.json.total);
  t.check('stock after GRN: 20 / 50 / 5', (await stockOf(pool, A)) === 20 && (await stockOf(pool, B)) === 50 && (await stockOf(pool, C)) === 5);
  const billRow = (await sql(`SELECT * FROM vendor_bills WHERE bill_no = $1`, [g.json.grn_number]))[0];
  t.check('GRN made a vendor bill of the same total', billRow && near(billRow.total, 90000), JSON.stringify(billRow));
  const dueRow = (await sql(`SELECT to_char(due_date,'YYYY-MM-DD') AS d, to_char(bill_date + 60,'YYYY-MM-DD') AS want FROM vendor_bills WHERE id = $1`, [billRow.id]))[0];
  t.check('vendor bill due date = bill date + 60 days', dueRow && dueRow.d === dueRow.want, JSON.stringify(dueRow));
  await agree(t, 'after GRN');

  // ── POS: cash ────────────────────────────────────────────────────────────────
  const s1 = await sale([{ item_name: 'Audit Tap A', item_code: A, qty: 3, unit_price: 2500 }]);
  t.check('cash sale saves', s1.status === 200 && near(s1.json.total, 7500), s1.text.slice(0, 200));
  t.check('stock A 20 -> 17', (await stockOf(pool, A)) === 17);
  await agree(t, 'after cash sale');

  // ── POS: split cash + card ───────────────────────────────────────────────────
  const s2 = await sale([{ item_name: 'Audit Tile B', item_code: B, qty: 2, unit_price: 1900 }], { payments: [{ method: 'cash', amount: 1800 }, { method: 'card', amount: 2000 }] });
  t.check('split payment saves, method = split', s2.status === 200 && s2.json.payment_method === 'split', s2.text.slice(0, 200));
  t.check('stock B 50 -> 48', (await stockOf(pool, B)) === 48);
  const s2bad = await sale([{ item_name: 'Audit Tile B', item_code: B, qty: 1, unit_price: 1900 }], { payments: [{ method: 'cash', amount: 1000 }, { method: 'card', amount: 800 }] });
  t.check('split that does not add up is refused (400) and stock untouched', s2bad.status === 400 && (await stockOf(pool, B)) === 48, `${s2bad.status}`);

  // ── POS: credit needs a customer; cheque needs a reference ───────────────────
  const c0 = await sale([{ item_name: 'Audit Tap A', item_code: A, qty: 1, unit_price: 2500 }], { payments: [{ method: 'credit', amount: 2500 }] });
  t.check('credit bill with no customer is refused', c0.status === 400 && c0.json && c0.json.code === 'credit_needs_customer', c0.text.slice(0, 160));
  const c1 = await sale([{ item_name: 'Audit Tap A', item_code: A, qty: 1, unit_price: 2500 }], { customer_name: 'Audit Customer', customer_phone: '0770000001', payments: [{ method: 'credit', amount: 2500 }] });
  t.check('credit bill with customer saves', c1.status === 200, c1.text.slice(0, 200));
  const ch0 = await sale([{ item_name: 'Audit Tap A', item_code: A, qty: 1, unit_price: 2500 }], { payments: [{ method: 'cheque', amount: 2500 }] });
  t.check('cheque payment without a number is refused', ch0.status === 400, ch0.text.slice(0, 160));
  const ch1 = await sale([{ item_name: 'Audit Tap A', item_code: A, qty: 1, unit_price: 2500 }], { payments: [{ method: 'cheque', amount: 2500, reference: 'CHQ 000123 / BOC / 2026-11-10' }] });
  t.check('cheque payment with a number saves', ch1.status === 200, ch1.text.slice(0, 200));
  t.check('stock A 17 -> 15 after credit + cheque sales (refused ones took nothing)', (await stockOf(pool, A)) === 15, await stockOf(pool, A));
  await agree(t, 'after credit and cheque sales');

  // ── POS: discount ────────────────────────────────────────────────────────────
  const d1 = await sale([{ item_name: 'Audit Sink C', item_code: C, qty: 1, unit_price: 12000 }], { discount_pct: 10 });
  t.check('10% discount: total 10,800, discount 1,200', d1.status === 200 && near(d1.json.total, 10800) && near(d1.json.discount_amount, 1200), d1.text.slice(0, 200));
  const d2 = await sale([{ item_name: 'Odd cents', qty: 3, unit_price: 333.33 }], { discount_pct: 7.5 });
  t.check('odd cents: 3 x 333.33 less 7.5% = 925.00 (rounded once)', d2.status === 200 && near(d2.json.total, 924.99, 0.011) || near(d2.json.total, 925, 0.011), d2.text.slice(0, 200));

  // ── double tap ───────────────────────────────────────────────────────────────
  const key = uuid();
  const before = await num(`SELECT COUNT(*) AS v FROM pos_bills`);
  const dt1 = await sale([{ item_name: 'Audit Tap A', item_code: A, qty: 1, unit_price: 2500 }], {}, key);
  const dt2 = await sale([{ item_name: 'Audit Tap A', item_code: A, qty: 1, unit_price: 2500 }], {}, key);
  const after = await num(`SELECT COUNT(*) AS v FROM pos_bills`);
  t.check('same bill sent twice with the same key = ONE bill', after - before === 1 && dt1.status === 200 && dt2.status === 200, `bills added ${after - before}, statuses ${dt1.status}/${dt2.status}`);
  t.check('stock A 15 -> 14 after the double tap (taken once)', (await stockOf(pool, A)) === 14, await stockOf(pool, A));
  const noKey = await sale([{ item_name: 'Audit Tap A', item_code: A, qty: 1, unit_price: 2500 }]);
  const noKey2 = await sale([{ item_name: 'Audit Tap A', item_code: A, qty: 1, unit_price: 2500 }]);
  t.note(`double tap WITHOUT a key makes two bills (${noKey.status}/${noKey2.status}); the screen must send a key (offline-queue does)`);

  // ── void restores stock, leaves the record ───────────────────────────────────
  const stockA0 = await stockOf(pool, A);
  const v1 = await api('POST', `/api/pos-bills/${s1.json.id}/void`, { reason: 'audit test' });
  t.check('void works', v1.status === 200, v1.text.slice(0, 200));
  t.check('void gave stock back (+3)', (await stockOf(pool, A)) === stockA0 + 3, `${stockA0} -> ${await stockOf(pool, A)}`);
  const v1b = await api('POST', `/api/pos-bills/${s1.json.id}/void`, { reason: 'audit test again' });
  t.check('second void is refused (409), stock not given back twice', v1b.status === 409 && (await stockOf(pool, A)) === stockA0 + 3, `${v1b.status}`);
  const gone = (await sql(`SELECT 1 FROM pos_bills WHERE id = $1`, [s1.json.id])).length === 1;
  t.check('void keeps the bill row (never deleted)', gone);
  await agree(t, 'after void');

  // ── edit a plain bill ────────────────────────────────────────────────────────
  const e0 = await sale([{ item_name: 'Audit Tile B', item_code: B, qty: 4, unit_price: 1900 }]);
  const stockB0 = await stockOf(pool, B);
  const e1 = await api('PUT', `/api/pos-bills/${e0.json.id}`, { items: [{ item_name: 'Audit Tile B', item_code: B, qty: 6, unit_price: 1900 }], reason: 'customer took 2 more' });
  t.check('edit works and total follows (6 x 1900 = 11,400)', e1.status === 200 && near(e1.json.total, 11400), e1.text.slice(0, 200));
  t.check('edit took 2 more from stock', (await stockOf(pool, B)) === stockB0 - 2, `${stockB0} -> ${await stockOf(pool, B)}`);
  await agree(t, 'after edit');

  // ── the same sales in every place the app shows them ─────────────────────────
  const dayTotal = await num(`SELECT COALESCE(SUM(b.total),0) AS v FROM pos_bills b WHERE ${NV}`);
  const dayCount = await num(`SELECT COUNT(*) AS v FROM pos_bills b WHERE ${NV}`);
  const summ = await api('GET', '/api/pos-bills/summary');
  t.check('bill summary = database (non-void)', summ.json && near(summ.json.total, dayTotal), `${summ.json && summ.json.total} vs ${dayTotal}`);
  const dash = await api('GET', '/api/dashboard-pro');
  t.check('dashboard "sales today" = database', dash.json && dash.json.sales && near(dash.json.sales.today, dayTotal), `${dash.json && dash.json.sales && dash.json.sales.today} vs ${dayTotal}`);
  t.check('dashboard "bills today" = database', dash.json && dash.json.sales && dash.json.sales.bills_today === dayCount, `${dash.json && dash.json.sales && dash.json.sales.bills_today} vs ${dayCount}`);
  const brk = await api('GET', '/api/daily-breakdown');
  t.check('day breakdown sales = database', brk.json && near(brk.json.pos_sales, dayTotal), `${brk.json && brk.json.pos_sales} vs ${dayTotal}`);
  t.check('day breakdown bill count = database', brk.json && brk.json.bills_count === dayCount, `${brk.json && brk.json.bills_count} vs ${dayCount}`);
  // cost of goods on the breakdown must be what was sold x cost
  const cogs = await num(`SELECT COALESCE(SUM(i.qty * COALESCE(p.avg_cost,0)),0) AS v FROM pos_bill_items i JOIN pos_bills b ON b.id = i.bill_id LEFT JOIN products p ON p.item_code = i.item_code WHERE ${NV} AND i.item_code IS NOT NULL`);
  t.check('day breakdown cost = sold qty x item cost', brk.json && near(brk.json.stock_cost, cogs, 0.05), `${brk.json && brk.json.stock_cost} vs ${cogs}`);
  // payment split on the dashboard = money taken by method
  const payRows = await sql(`SELECT m, SUM(a) AS v FROM (SELECT p.method AS m, p.amount AS a FROM pos_bill_payments p JOIN pos_bills b ON b.id = p.bill_id WHERE ${NV}
      UNION ALL SELECT COALESCE(b.payment_method,'cash'), b.total FROM pos_bills b WHERE ${NV} AND NOT EXISTS (SELECT 1 FROM pos_bill_payments p WHERE p.bill_id = b.id)) x GROUP BY m`);
  const byMethod = Object.fromEntries(payRows.map((r) => [r.m, Number(r.v)]));
  const payTotal = r2(Object.values(byMethod).reduce((a, b) => a + b, 0));
  t.check('money by payment method adds up to sales', near(payTotal, dayTotal), `${payTotal} vs ${dayTotal}`);

  // receipt queue: observe only (the app queues a WhatsApp receipt only when auto-send is on; never sends here)
  const rq = await num(`SELECT COUNT(*) AS v FROM receipt_queue`).catch(() => null);
  t.note(`receipt queue rows after ${dayCount} bills: ${rq === null ? 'table missing' : rq} (auto-send is off on the test copy; nothing is sent)`);

  // ── vendor side: cheque issued, cleared, payment, credit note ────────────────
  const bid = billRow.id;
  const ck1 = await api('POST', `/api/vendor-ledger/bills/${bid}/cheques`, { cheque_no: `A${stamp}1`, bank: 'BOC', amount: 30000, cheque_date: today() });
  t.check('vendor cheque issued', ck1.status === 201, ck1.text.slice(0, 200));
  let led = (await api('GET', '/api/vendor-ledger/bills?vendor=' + encodeURIComponent(`AuditCo ${stamp}`))).json;
  const mine = () => (Array.isArray(led) ? led : led.bills || []).find((b) => b.id === bid);
  t.check('ledger: bill is part covered after the cheque is written, still owed in full', mine() && near(mine().outstanding !== undefined ? mine().outstanding : mine().status && mine().status.outstanding, 90000), JSON.stringify(mine()).slice(0, 220));
  const clr = await api('POST', `/api/vendor-ledger/cheques/${ck1.json.cheque.id}/clear`, {});
  t.check('cheque clears', clr.status === 200, clr.text.slice(0, 160));
  const owedSql = await num(`SELECT b.total - COALESCE((SELECT SUM(amount) FROM vendor_bill_cheques WHERE bill_id=b.id AND status='CLEARED'),0) - COALESCE((SELECT SUM(amount) FROM vendor_payments WHERE bill_id=b.id),0) - COALESCE((SELECT SUM(amount) FROM vendor_credit_notes WHERE bill_id=b.id),0) AS v FROM vendor_bills b WHERE b.id = $1`, [bid]);
  t.check('after clearing 30,000 the bill owes 60,000', near(owedSql, 60000), owedSql);
  const sumry = (await api('GET', '/api/vendor-ledger/summary')).json;
  const myV = sumry && (sumry.vendors || []).find((v) => v.vendor === `AuditCo ${stamp}`);
  t.check('vendor ledger summary agrees (60,000)', myV && near(myV.outstanding, 60000), JSON.stringify(myV));
  const dash2 = (await api('GET', '/api/dashboard-pro')).json;
  const dashV = dash2 && dash2.vendors;
  const ledgerTotal = sumry && sumry.totals ? sumry.totals.outstanding : null;
  const dashOwed = dashV ? Number(dashV.owed) : null;
  const same = dashOwed !== null && ledgerTotal !== null && near(dashOwed, ledgerTotal);
  t.check('dashboard "owed to vendors" = vendor ledger total (after a cheque cleared)', same, `dashboard ${dashOwed} vs ledger ${ledgerTotal}`);
  if (!same) t.bug('B1', 'Dashboard shows vendors owed too much after a cheque clears', `dashboard owed ${dashOwed}, vendor ledger ${ledgerTotal}: routes/dashboard_pro.js subtracts payments and credit notes but not CLEARED cheques`);

  const pay = await api('POST', `/api/vendor-ledger/bills/${bid}/payments`, { amount: 10000, method: 'cash' });
  t.check('vendor cash payment saves', pay.status === 201, pay.text.slice(0, 160));
  const cn = await api('POST', `/api/vendor-ledger/bills/${bid}/credit-notes`, { amount: 5000, reason: 'audit credit note' });
  t.check('vendor credit note saves', cn.status === 201, cn.text.slice(0, 160));
  const ov = await api('POST', `/api/vendor-ledger/bills/${bid}/payments`, { amount: 500000, method: 'cash' });
  t.check('paying far more than owed is refused', ov.status >= 400, `status ${ov.status}: it was saved`);
  if (ov.status < 400) t.bug('B2', 'A vendor payment far above what is owed is accepted', `POST /bills/:id/payments with 500,000 on a bill owing 45,000 returned ${ov.status}`);
  const ck2 = await api('POST', `/api/vendor-ledger/bills/${bid}/cheques`, { cheque_no: `A${stamp}2`, bank: 'BOC', amount: 400000, cheque_date: today() });
  t.check('writing cheques far above the bill is refused', ck2.status >= 400, `status ${ck2.status}: it was saved`);
  if (ck2.status < 400) t.bug('B3', 'A vendor cheque far above the bill is accepted', `POST /bills/:id/cheques with 400,000 on a 90,000 bill returned ${ck2.status}`);
  const dupCk = await api('POST', `/api/vendor-ledger/bills/${bid}/cheques`, { cheque_no: `A${stamp}1`, bank: 'BOC', amount: 1000, cheque_date: today() });
  t.check('the same cheque number twice gives a warning (the app warns, it does not block)', dupCk.status === 201 && (dupCk.json.warnings || []).includes('CHEQUE_NUMBER_USED'), `status ${dupCk.status}, warnings ${JSON.stringify(dupCk.json && dupCk.json.warnings)}`);
  if (!(dupCk.json && (dupCk.json.warnings || []).includes('CHEQUE_NUMBER_USED'))) t.bug('B4', 'The same cheque number can be written twice with no warning', `cheque A${stamp}1 accepted twice (${dupCk.status})`);
  const audit = await sql(`SELECT COUNT(*)::int AS n FROM admin_audit`).catch(() => [{ n: -1 }]);
  t.note(`money_audit_log rows: ${(await sql('SELECT COUNT(*)::int AS n FROM money_audit_log').catch(() => [{ n: -1 }]))[0].n} (cheque changes are logged there)`);
  return t;
}

if (require.main === module) {
  run().then(async (t) => {
    console.log(t.summary());
    t.failed.forEach((c) => console.log('  FAIL', c.name, '->', c.detail));
    t.bugs.forEach((b) => console.log('  BUG ', b.id, b.title, '|', b.evidence));
    t.notes.forEach((n) => console.log('  note', n));
    await pool.end();
    process.exit(t.failed.length ? 1 : 0);
  }).catch(async (e) => { console.error('AUDIT STOPPED:', e.message); await pool.end().catch(() => {}); process.exit(2); });
}
module.exports = { run };
