'use strict';
// Profit report (read only, owner or admin only). Maths lives in utils/profit.js. Mounted at /api/profit in server.js.
//   GET /api/profit?group=day|week|month|year&from=&to=   gross and net profit per period + TOTAL
//   GET /api/profit/items?from=&to=&by=item|category      profit per item or per category
// Cost of goods = quantity x the item's average cost TODAY (products.avg_cost): an estimate, shown as such. Voided bills are left out.
const express = require('express');
const pool = require('../utils/pool');
const P = require('../utils/profit');
const router = express.Router();
const roleOf = req => (req.session && req.session.user && req.session.user.role) || 'staff';
const ownerOnly = (req, res, next) => (['admin', 'owner'].includes(roleOf(req)) ? next() : res.status(403).json({ error: 'Owner only' }));
const iso = s => (/^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) ? s : null);
const colombo = d => new Date(new Date(d).getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
const inRange = (day, from, to) => !((from && day < from) || (to && day > to));
// a table that does not exist yet means "nothing recorded", not an error
const safe = async (sql, args) => { try { return (await pool.query(sql, args || [])).rows; } catch (e) { if (e && (e.code === '42P01' || /does not exist/i.test(e.message || ''))) return []; throw e; } };

router.use(ownerOnly);

router.get('/', async (req, res) => {
  const group = ['day', 'week', 'month', 'year'].includes(req.query.group) ? req.query.group : 'day';
  const from = iso(req.query.from), to = iso(req.query.to);
  try {
    const bills = (await safe(`SELECT b.id, b.created_at, b.total, b.discount_amount,
              COALESCE(SUM(i.qty * COALESCE(p.avg_cost, 0)), 0) AS cost, COUNT(i.id) FILTER (WHERE p.id IS NULL OR COALESCE(p.avg_cost,0) = 0) AS no_cost
         FROM pos_bills b LEFT JOIN pos_bill_items i ON i.bill_id = b.id LEFT JOIN products p ON p.item_code = i.item_code
        WHERE NOT EXISTS (SELECT 1 FROM pos_bill_voids v WHERE v.bill_id = b.id) GROUP BY b.id`))
      .map(b => ({ day: colombo(b.created_at), total: b.total, discount: b.discount_amount, cost: b.cost, no_cost: b.no_cost })).filter(b => inRange(b.day, from, to));
    const expenses = (await safe(`SELECT report_date::text AS day, amount FROM expenses_detail`)).filter(r => r.day && inRange(r.day.slice(0, 10), from, to)).map(r => ({ day: r.day.slice(0, 10), amount: r.amount }));
    const salaries = (await safe(`SELECT pay_date::text AS day, amount FROM staff_salary`)).filter(r => r.day && inRange(r.day.slice(0, 10), from, to)).map(r => ({ day: r.day.slice(0, 10), amount: r.amount }));
    const commissions = (await safe(`SELECT sale_date::text AS day, commission_amount AS amount FROM sale_commissions`)).filter(r => r.day && inRange(r.day.slice(0, 10), from, to)).map(r => ({ day: r.day.slice(0, 10), amount: r.amount }));
    res.json(Object.assign({ group, estimate: true, note: 'Cost of goods uses each item\'s average cost today. No interest is counted.' }, P.aggregate({ bills, expenses, salaries, commissions, cogsAdjust: (await require('../utils/oversold').costAdjustments(pool).catch(() => [])).filter(r => r.day && inRange(r.day.slice(0, 10), from, to)) }, group)));
  } catch (e) { res.status(500).json({ error: 'could not build the profit report' }); }
});

router.get('/items', async (req, res) => {
  const by = req.query.by === 'category' ? 'category' : 'item';
  const from = iso(req.query.from), to = iso(req.query.to);
  try {
    const rows = (await safe(`SELECT b.created_at, i.item_code, i.item_name, i.qty,
              i.line_total * CASE WHEN b.subtotal > 0 THEN b.total / b.subtotal ELSE 1 END AS revenue,
              i.qty * COALESCE(p.avg_cost, 0) AS cost, p.category
         FROM pos_bill_items i JOIN pos_bills b ON b.id = i.bill_id LEFT JOIN products p ON p.item_code = i.item_code
        WHERE NOT EXISTS (SELECT 1 FROM pos_bill_voids v WHERE v.bill_id = b.id)`)).filter(r => inRange(colombo(r.created_at), from, to));
    res.json({ by, estimate: true, rows: P.rollup(rows, by === 'category' ? 'category' : 'item') });
  } catch (e) { res.status(500).json({ error: 'could not build the item profit report' }); }
});
module.exports = router;
