'use strict';
// Home (solid): ONE read-only endpoint, GET /api/home-solid (owner or admin only). Writes nothing.
// Every number comes straight from the tables the audit of 18 Nov 2026 matched (POS bills, products, GRN lines, vendor bills, cheques).
// The "checks" block recomputes the matches live, so a drift shows on the screen the same minute: GRN = vendor bills, cheque register = bill cheques,
// stock = GRN - sold - returned, every bill = its items minus discount.
const express = require('express');
const pool = require('../utils/pool');
const { billStatus } = require('../utils/vendorLedger');
const router = express.Router();
const roleOf = req => (req.session && req.session.user && req.session.user.role) || 'staff';
const ownerOnly = (req, res, next) => (['admin', 'owner'].includes(roleOf(req)) ? next() : res.status(403).json({ error: 'Owner only' }));
const r2 = n => Math.round(Number(n || 0) * 100) / 100;
const q = (sql, p) => pool.query(sql, p).then(r => r.rows);
const LIVE = 'NOT EXISTS (SELECT 1 FROM pos_bill_voids v WHERE v.bill_id = b.id)';

let cache = null;   // 15 s memory copy
router.get('/home-solid', ownerOnly, async (req, res) => {
  if (cache && Date.now() - cache.at < 15000) return res.json(cache.body);
  try {
    const bills = await q(`SELECT b.id, b.created_at::date AS d, b.total, b.discount_amount,
        (SELECT COALESCE(SUM(i.line_total),0) FROM pos_bill_items i WHERE i.bill_id = b.id) AS items,
        (SELECT COALESCE(SUM(i.qty * COALESCE(NULLIF(i.unit_cost,0), p.avg_cost, 0)),0) FROM pos_bill_items i LEFT JOIN products p ON p.item_code = i.item_code WHERE i.bill_id = b.id) AS cost
      FROM pos_bills b WHERE ${LIVE}`);
    const today = (await q('SELECT CURRENT_DATE::text AS d'))[0].d;
    const day = x => new Date(x.d.getTime() - x.d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);   // date column arrives as a local-midnight Date
    const dayStr = new Date(today + 'T00:00:00Z');
    const ymd = n => new Date(dayStr.getTime() - n * 864e5).toISOString().slice(0, 10);
    const monthStart = today.slice(0, 8) + '01';
    const agg = f => bills.filter(f).reduce((a, b) => ({ n: a.n + 1, sales: a.sales + Number(b.total), profit: a.profit + Number(b.total) - Number(b.cost) }), { n: 0, sales: 0, profit: 0 });
    const S = { today: agg(b => day(b) === today), yesterday: agg(b => day(b) === ymd(1)), month: agg(b => day(b) >= monthStart), all: agg(() => true) };
    Object.values(S).forEach(o => { o.sales = r2(o.sales); o.profit = r2(o.profit); });
    const billsBad = bills.filter(b => Math.abs(Number(b.items) - Number(b.discount_amount || 0) - Number(b.total)) > 1).length;

    const st = (await q(`SELECT COALESCE(SUM(stock_level),0) units, COALESCE(SUM(stock_level*avg_cost),0) cost, COALESCE(SUM(stock_level*selling_price),0) sell,
        COUNT(*) FILTER (WHERE stock_level > 0) items, COUNT(*) FILTER (WHERE stock_level < 0) neg,
        COUNT(*) FILTER (WHERE stock_level > 0 AND COALESCE(selling_price,0) = 0) nosell FROM products WHERE active IS NOT FALSE`))[0];
    const stockAll = Number((await q('SELECT COALESCE(SUM(stock_level),0) s FROM products'))[0].s);

    const vb = await q('SELECT * FROM vendor_bills WHERE voided = FALSE');
    const ids = vb.map(b => b.id);
    const [ch, pa, cr] = ids.length ? await Promise.all([q('SELECT * FROM vendor_bill_cheques WHERE bill_id = ANY($1::int[])', [ids]), q('SELECT * FROM vendor_payments WHERE bill_id = ANY($1::int[])', [ids]), q('SELECT * FROM vendor_credit_notes WHERE bill_id = ANY($1::int[])', [ids])]) : [[], [], []];
    let billed = 0, owed = 0, covered = 0, overdue = 0;
    const per = {};
    for (const b of vb) {
      const s = billStatus(b, ch.filter(x => x.bill_id === b.id), pa.filter(x => x.bill_id === b.id), cr.filter(x => x.bill_id === b.id));
      billed += Number(b.total); owed += s.outstanding; covered += s.covered;
      if (s.outstanding > 0 && b.due_date && new Date(b.due_date) < new Date(today + 'T00:00:00')) overdue += s.outstanding;
      per[b.vendor_name] = r2((per[b.vendor_name] || 0) + s.outstanding);
    }
    const topVendors = Object.entries(per).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([name, owed]) => ({ name, owed }));

    const reg = await q(`SELECT cheque_no, payee, amount, to_char(due_date,'YYYY-MM-DD') AS due FROM cheque_register WHERE status IN ('pending','held') ORDER BY due_date, id`);
    const regSum = r2(reg.reduce((a, x) => a + Number(x.amount), 0));
    const billChq = r2(ch.filter(x => x.status === 'ISSUED').reduce((a, x) => a + Number(x.amount), 0));
    const due7 = reg.filter(x => x.due <= new Date(dayStr.getTime() + 7 * 864e5).toISOString().slice(0, 10));

    const grn = (await q('SELECT COALESCE(SUM(total_amount),0) amt, COALESCE(SUM(quantity),0) qty FROM grn_records'))[0];
    const pend = Number((await q("SELECT COALESCE(SUM(amount),0) s FROM vendor_pending_items WHERE status = 'PENDING'").catch(() => [{ s: 0 }]))[0].s);
    const sold = Number((await q(`SELECT COALESCE(SUM(i.qty),0) s FROM pos_bill_items i JOIN pos_bills b ON b.id = i.bill_id WHERE ${LIVE}`))[0].s);
    const ret = Number((await q('SELECT COALESCE(SUM(qty),0) s FROM vendor_return_lines').catch(() => [{ s: 0 }]))[0].s);
    const opening = Number((await q("SELECT COALESCE(SUM(qty_change),0) s FROM stock_movements WHERE reason = 'opening_stock_confirmed'").catch(() => [{ s: 0 }]))[0].s);   // stock AJ confirmed by hand (no GRN), e.g. item 331
    const stockGap = r2(stockAll - (Number(grn.qty) - sold - ret + opening));
    const grnGap = r2(billed - Number(grn.amt) - pend);
    const body = {
      as_at: new Date().toISOString(), today,
      sales: S, bills_bad: billsBad,
      stock: { units: r2(st.units), items: Number(st.items), cost: r2(st.cost), sell: r2(st.sell), negative: Number(st.neg), no_price: Number(st.nosell) },
      vendors: { billed: r2(billed), owed: r2(owed), overdue: r2(overdue), top: topVendors },
      cheques: { count: reg.length, amount: regSum, due7: { count: due7.length, amount: r2(due7.reduce((a, x) => a + Number(x.amount), 0)) }, next: reg.slice(0, 3).map(x => ({ no: x.cheque_no, payee: x.payee, amount: Number(x.amount), due: x.due })) },
      grn: { received: r2(grn.amt), pending_delivery: r2(pend) },
      checks: [
        { key: 'grn', label: 'GRN received = vendor bills', ok: Math.abs(grnGap) < 1, note: Math.abs(grnGap) < 1 ? (pend ? 'incl. ' + r2(pend) + ' not yet delivered' : '') : 'difference ' + grnGap },
        { key: 'cheques', label: 'Cheque list = cheques on bills', ok: Math.abs(regSum - billChq) < 1, note: Math.abs(regSum - billChq) < 1 ? '' : 'difference ' + r2(regSum - billChq) },
        { key: 'stock', label: 'Stock = GRN - sold - returned' + (opening ? ' (+' + opening + ' opening confirmed)' : ''), ok: Math.abs(stockGap) < 0.001, note: Math.abs(stockGap) < 0.001 ? '' : stockGap + ' units not explained' },
        { key: 'bills', label: 'Every bill = items - discount', ok: billsBad === 0, note: billsBad ? billsBad + ' bills differ' : '' },
        { key: 'neg', label: 'No negative stock', ok: Number(st.neg) === 0, note: Number(st.neg) ? st.neg + ' items' : '' },
      ],
    };
    cache = { at: Date.now(), body };
    res.json(body);
  } catch (e) { console.error('[home_solid]', e.message); res.status(500).json({ error: 'Could not load Home numbers' }); }
});

module.exports = router;
