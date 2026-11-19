// Customer bills (sales) for ONE chosen day or range, by hour or by day. Read only. Voided bills are left out of totals.
const express = require('express');
const pool = require('../utils/pool');
const router = express.Router();
const isDay = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v)) && !isNaN(Date.parse(v));
const n2 = x => Math.round(Number(x || 0) * 100) / 100;

// GET /sales-view?from=YYYY-MM-DD&to=YYYY-MM-DD&by=hour|day   (to defaults to from)
router.get('/sales-view', async (req, res) => {
    try {
        const from = String(req.query.from || ''), to = String(req.query.to || from);
        if (!isDay(from) || !isDay(to)) return res.status(400).json({ error: 'Pick a date' });
        if (to < from) return res.status(400).json({ error: 'The end date is before the start date' });
        if ((Date.parse(to) - Date.parse(from)) / 864e5 > 400) return res.status(400).json({ error: 'Pick 400 days or less' });
        const by = req.query.by === 'hour' ? 'hour' : 'day';
        const base = `FROM pos_bills b LEFT JOIN pos_bill_voids v ON v.bill_id = b.id WHERE v.bill_id IS NULL AND b.created_at::date BETWEEN $1::date AND $2::date`;
        const g = by === 'hour' ? `EXTRACT(HOUR FROM b.created_at)::int` : `to_char(b.created_at::date,'YYYY-MM-DD')`;
        const rows = (await pool.query(`SELECT ${g} AS k, COUNT(*) AS bills, SUM(b.total) AS total, SUM(b.discount_amount) AS discount ${base} GROUP BY 1 ORDER BY 1`, [from, to])).rows
            .map(r => ({ key: r.k, bills: Number(r.bills), total: n2(r.total), discount: n2(r.discount) }));
        const pay = (await pool.query(`SELECT COALESCE(b.payment_method,'cash') AS m, COUNT(*) AS bills, SUM(b.total) AS total ${base} GROUP BY 1 ORDER BY 1`, [from, to])).rows
            .map(r => ({ method: r.m, bills: Number(r.bills), total: n2(r.total) }));
        const bills = (await pool.query(`SELECT b.id, b.bill_number, b.customer_name, b.total, b.payment_method, to_char(b.created_at,'YYYY-MM-DD HH24:MI') AS at, (v.bill_id IS NOT NULL) AS voided
            FROM pos_bills b LEFT JOIN pos_bill_voids v ON v.bill_id = b.id WHERE b.created_at::date BETWEEN $1::date AND $2::date ORDER BY b.created_at DESC, b.id DESC LIMIT 300`, [from, to])).rows
            .map(r => ({ ...r, total: n2(r.total) }));
        res.json({ from, to, by, bills: rows.reduce((a, r) => a + r.bills, 0), total: n2(rows.reduce((a, r) => a + r.total, 0)), discount: n2(rows.reduce((a, r) => a + r.discount, 0)), rows, by_payment: pay, list: bills });
    } catch (e) { res.status(500).json({ error: 'Could not load sales: ' + e.message }); }
});
module.exports = router;
