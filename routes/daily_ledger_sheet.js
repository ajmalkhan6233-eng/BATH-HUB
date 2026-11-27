// routes/daily_ledger_sheet.js: ONE-CLICK daily balancing sheet (xlsx). READ ONLY, isolated module.
// GET /api/daily-ledger-sheet/:date.xlsx  (YYYY-MM-DD)  -> every sale with its receipt number (money IN),
// money OUT (expenses, supplier payments), and the balance. Reads pos_bills, pos_bill_payments, pos_bill_voids,
// expenses_detail, supplier_payments. Writes nothing. Golden core untouched.
const { advanceDay } = require('../utils/advanceCash');
const express = require('express');
const XLSX = require('xlsx');
const pool = require('../utils/pool');
const router = express.Router();
const isDay = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v)) && !isNaN(Date.parse(v));
const q = (sql, p) => pool.query(sql, p).then(r => r.rows).catch(() => []);
const n = v => Math.round(Number(v || 0) * 100) / 100;

router.get('/daily-ledger-sheet/:date', async (req, res) => {
    const d = String(req.params.date).replace(/\.xlsx$/, '');
    if (!isDay(d)) return res.status(400).json({ error: 'Date must be YYYY-MM-DD' });
    const bills = await q(`SELECT b.id, b.bill_number, to_char(b.created_at,'HH24:MI') t, COALESCE(b.customer_name,'') cust,
        COALESCE(b.payment_method,'cash') pm, b.total, (v.bill_id IS NOT NULL) voided
        FROM pos_bills b LEFT JOIN pos_bill_voids v ON v.bill_id=b.id WHERE b.created_at::date=$1::date ORDER BY b.created_at, b.id`, [d]);
    const pays = await q(`SELECT p.bill_id, p.method, p.amount, COALESCE(p.reference,'') ref FROM pos_bill_payments p
        JOIN pos_bills b ON b.id=p.bill_id WHERE b.created_at::date=$1::date`, [d]);
    const exp = await q(`SELECT category, COALESCE(description,'') description, amount FROM expenses_detail WHERE report_date=$1::date ORDER BY id`, [d]);
    const sup = await q(`SELECT s.name, p.method, p.amount, COALESCE(p.notes,'') notes FROM supplier_payments p LEFT JOIN suppliers s ON s.id=p.supplier_id WHERE p.pay_date=$1::date ORDER BY p.id`, [d]);
    const by = {}; pays.forEach(p => (by[p.bill_id] = by[p.bill_id] || []).push(p));

    const IN = [['Receipt no', 'Time', 'Customer', 'Method', 'Reference', 'Amount (IN)', 'Status']];
    const tot = { cash: 0, card: 0, online: 0, cheque: 0, credit: 0, other: 0 };
    let sales = 0;
    bills.forEach(b => {
        const parts = by[b.id] && by[b.id].length ? by[b.id] : [{ method: b.pm, amount: b.total, ref: '' }];
        parts.forEach((p, i) => {
            const m = String(p.method).toLowerCase(); const a = n(p.amount);
            IN.push([i ? '' : b.bill_number, i ? '' : b.t, i ? '' : b.cust, m, p.ref, a, b.voided ? 'VOIDED (not counted)' : '']);
            if (!b.voided) { tot[m in tot ? m : 'other'] += a; sales += a; }
        });
    });
    // 27 Nov (AJ): advances are drawer money but NOT sales. Shown on their own lines; the drawer cash takes them in and takes the applied part out on the settle day.
    const adv = await advanceDay(pool, d);
    adv.rows.forEach(x => IN.push([x.order_no, x.time, x.customer, x.method, x.ref, x.amount, 'ADVANCE (not a sale yet)']));
    const out = n(exp.reduce((s, x) => s + Number(x.amount), 0) + sup.reduce((s, x) => s + Number(x.amount), 0));
    const cashIn = n(tot.cash + adv.received.cash - adv.applied.cash);
    const OUT = [['What', 'Detail', 'Amount (OUT)']];
    exp.forEach(x => OUT.push(['Expense: ' + x.category, x.description, n(x.amount)]));
    sup.forEach(x => OUT.push(['Supplier paid: ' + (x.name || ''), (x.method || '') + ' ' + x.notes, n(x.amount)]));
    const SUM = [['Daily balancing sheet', d], [],
        ['Money IN (all sales)', n(sales)], ['  Cash', cashIn], ['  Card', n(tot.card)], ['  Online', n(tot.online)], ['  Cheque (not cash yet)', n(tot.cheque)], ['  Credit (customer owes us)', n(tot.credit)], [],
        ['  Advances received today (not sales)', n(adv.received.total)], ['  Advance already taken on earlier days, settled today', n(-adv.applied.total)],
        ['Money OUT (expenses + supplier payments)', out], [],
        ['Cash left from the day (cash sales + advance cash - advance already counted - money out)', n(cashIn - out)], ['Bills counted', bills.filter(b => !b.voided).length], ['Bills voided', bills.filter(b => b.voided).length]];
    const wb = XLSX.utils.book_new();
    [['Summary', SUM], ['Sales IN', IN], ['Money OUT', OUT]].forEach(([nm, rows]) => {
        const ws = XLSX.utils.aoa_to_sheet(rows); ws['!cols'] = [{ wch: 34 }, { wch: 24 }, { wch: 22 }, { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(wb, ws, nm);
    });
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="daily-ledger-${d}.xlsx"` });
    res.send(buf);
});
module.exports = router;
