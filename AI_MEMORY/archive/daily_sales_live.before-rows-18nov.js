// routes/daily_sales_live.js: LIVE DAILY SALES from POS bills (READ ONLY, isolated module)
//
// Problem: a bill saved in POS goes only to pos_bills, but Daily Sales and the Dashboard read only daily_summary
// (the day sheets), so a day's sales stayed 0 until the sheet was filled in.
//
// Rule (decided by Aj):
//   - A daily_summary row exists for the date = CLOSED day. The sheet is the truth; the bills total is returned only as a
//     reference ("Bills total (reference, not added)"). Nothing is ever added to the sheet.
//   - No row = OPEN day. Sales = sum of pos_bills.total (after discount), void bills left out, split by payment_method.
//   - Dates are Sri Lanka dates: created_at is stored in Colombo wall-clock time (utils/timezone.js sets the session zone).
//
// Reads pos_bills, pos_bill_voids and daily_summary. Writes nothing, alters nothing. Golden core is not touched:
// no daily_summary write, no VAT/tax/fiscal-year code, no change to routes/pos_bills.js.
//
//   GET /api/daily-sales-live/today
//   GET /api/daily-sales-live/:date        (YYYY-MM-DD)
const express = require('express');
const pool = require('../utils/pool');
const { todayLK } = require('../utils/lkTime');

const router = express.Router();

const OPEN_LABEL = 'Open day: from bills';
const REF_LABEL = 'Bills total (reference, not added)';
const METHODS = ['cash', 'card', 'online', 'credit', 'cheque'];

const isDay = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v)) && !isNaN(Date.parse(v));
const money2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// If the payments table does not exist yet (older database), fall back to the plain bills query.
const noPayTable = date => async () => pool.query(
    `SELECT COALESCE(payment_method, 'cash') AS pm, COUNT(*) AS n, SUM(total) AS total
     FROM pos_bills LEFT JOIN pos_bill_voids v ON v.bill_id = pos_bills.id
     WHERE v.bill_id IS NULL AND created_at::date = $1::date GROUP BY COALESCE(payment_method, 'cash')`, [date]);

async function liveDay(date) {
    const sheet = await pool.query(`SELECT 1 FROM daily_summary WHERE report_date = $1::date LIMIT 1`, [date]);
    const bills = await pool.query(
        `SELECT COALESCE(payment_method, 'cash') AS pm, COUNT(*) AS n, SUM(total) AS total
         FROM pos_bills LEFT JOIN pos_bill_voids v ON v.bill_id = pos_bills.id
         LEFT JOIN (SELECT DISTINCT bill_id FROM pos_bill_payments) pp ON pp.bill_id = pos_bills.id
         WHERE v.bill_id IS NULL AND pp.bill_id IS NULL AND created_at::date = $1::date
         GROUP BY COALESCE(payment_method, 'cash')`, [date]).catch(noPayTable(date));
    // Bills paid by cheque, credit or split have their own payment rows: counted from those, per method.
    const paid = await pool.query(
        `SELECT p.method AS pm, SUM(p.amount) AS total
         FROM pos_bill_payments p JOIN pos_bills b ON b.id = p.bill_id LEFT JOIN pos_bill_voids v ON v.bill_id = b.id
         WHERE v.bill_id IS NULL AND b.created_at::date = $1::date GROUP BY p.method`, [date]).catch(() => ({ rows: [] }));
    const paidCount = await pool.query(
        `SELECT COUNT(DISTINCT p.bill_id) AS n
         FROM pos_bill_payments p JOIN pos_bills b ON b.id = p.bill_id LEFT JOIN pos_bill_voids v ON v.bill_id = b.id
         WHERE v.bill_id IS NULL AND b.created_at::date = $1::date`, [date]).catch(() => ({ rows: [{ n: 0 }] }));

    const pay = { cash: 0, card: 0, online: 0, credit: 0, cheque: 0, other: 0 };
    let count = Number(paidCount.rows[0].n || 0);
    for (const r of paid.rows) {
        const pm = String(r.pm).trim().toLowerCase();
        const key = METHODS.includes(pm) ? pm : 'other';
        pay[key] = money2(pay[key] + Number(r.total || 0));
    }
    for (const r of bills.rows) {
        const pm = String(r.pm).trim().toLowerCase();   // 'Cash ' and 'cash' are the same method
        const key = METHODS.includes(pm) ? pm : 'other';
        pay[key] = money2(pay[key] + Number(r.total || 0));
        count += Number(r.n);
    }
    const total = money2(Object.values(pay).reduce((a, b) => a + b, 0));

    if (sheet.rows.length) {
        return { date, mode: 'day_sheet', label: REF_LABEL, bills_count: count, bills_total: total };
    }
    return { date, mode: 'open_day', label: OPEN_LABEL, bills_count: count, bills_total: total, sale: total, pay };
}

router.get('/daily-sales-live/today', async (req, res) => {
    try { res.json(await liveDay(todayLK())); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/daily-sales-live/:date', async (req, res) => {
    if (!isDay(req.params.date)) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
    try { res.json(await liveDay(req.params.date)); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
