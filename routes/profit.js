'use strict';
// Profit report (read only, owner or admin only). Maths lives in utils/profit.js. Mounted at /api/profit in server.js.
//   GET /api/profit?group=day|week|month|year&from=&to=   gross and net profit per period + TOTAL
//   GET /api/profit/items?from=&to=&by=item|category      profit per item or per category
// Cost of goods = quantity x the item's average cost AT THE TIME OF SALE (stored on the bill line; older bills fall back to today's products.avg_cost): an estimate, shown as such. Voided bills are left out.
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
              COALESCE(SUM(i.qty * COALESCE(NULLIF(i.unit_cost,0), p.avg_cost, 0)), 0) AS cost, COUNT(i.id) FILTER (WHERE COALESCE(NULLIF(i.unit_cost,0), p.avg_cost, 0) = 0) AS no_cost
         FROM pos_bills b LEFT JOIN pos_bill_items i ON i.bill_id = b.id LEFT JOIN products p ON p.item_code = i.item_code
        WHERE NOT EXISTS (SELECT 1 FROM pos_bill_voids v WHERE v.bill_id = b.id) GROUP BY b.id`))
      .map(b => ({ day: colombo(b.created_at), total: b.total, discount: b.discount_amount, cost: b.cost, no_cost: b.no_cost })).filter(b => inRange(b.day, from, to));
    const expenses = (await safe(`SELECT report_date::text AS day, amount FROM expenses_detail`)).filter(r => r.day && inRange(r.day.slice(0, 10), from, to)).map(r => ({ day: r.day.slice(0, 10), amount: r.amount }));
    const salaries = (await safe(`SELECT pay_date::text AS day, amount FROM staff_salary`)).filter(r => r.day && inRange(r.day.slice(0, 10), from, to)).map(r => ({ day: r.day.slice(0, 10), amount: r.amount }));
    const commissions = (await safe(`SELECT sale_date::text AS day, commission_amount AS amount FROM sale_commissions`)).filter(r => r.day && inRange(r.day.slice(0, 10), from, to)).map(r => ({ day: r.day.slice(0, 10), amount: r.amount }));
    res.json(Object.assign({ group, estimate: true, note: 'Cost of goods uses each item\'s average cost when it was sold (older bills: today\'s cost). No interest is counted.' }, P.aggregate({ bills, expenses, salaries, commissions, cogsAdjust: (await require('../utils/oversold').costAdjustments(pool).catch(() => [])).filter(r => r.day && inRange(r.day.slice(0, 10), from, to)) }, group)));
  } catch (e) { res.status(500).json({ error: 'could not build the profit report' }); }
});

router.get('/items', async (req, res) => {
  const by = req.query.by === 'category' ? 'category' : 'item';
  const from = iso(req.query.from), to = iso(req.query.to);
  try {
    const rows = (await safe(`SELECT b.created_at, i.item_code, i.item_name, i.qty,
              i.line_total * CASE WHEN b.subtotal > 0 THEN b.total / b.subtotal ELSE 1 END AS revenue,
              i.qty * COALESCE(NULLIF(i.unit_cost,0), p.avg_cost, 0) AS cost, p.category
         FROM pos_bill_items i JOIN pos_bills b ON b.id = i.bill_id LEFT JOIN products p ON p.item_code = i.item_code
        WHERE NOT EXISTS (SELECT 1 FROM pos_bill_voids v WHERE v.bill_id = b.id)`)).filter(r => inRange(colombo(r.created_at), from, to));
    res.json({ by, estimate: true, rows: P.rollup(rows, by === 'category' ? 'category' : 'item') });
  } catch (e) { res.status(500).json({ error: 'could not build the item profit report' }); }
});

// 21 Nov (AJ): "real profit" = gross profit minus a small stock holding cost (2% of cost per month in stock by default, AJ let chat pick the rate). Estimate, read only, no interest.
router.get('/real', async (req, res) => {
  const from = iso(req.query.from), to = iso(req.query.to);
  const rate = Number(req.query.rate) > 0 && Number(req.query.rate) <= 20 ? Number(req.query.rate) : 2;
  try {
    const sold = (await safe(`SELECT b.created_at, i.item_code, i.item_name, i.qty,
              i.line_total * CASE WHEN b.subtotal > 0 THEN b.total / b.subtotal ELSE 1 END AS revenue,
              i.qty * COALESCE(NULLIF(i.unit_cost,0), p.avg_cost, 0) AS cost
         FROM pos_bill_items i JOIN pos_bills b ON b.id = i.bill_id LEFT JOIN products p ON p.item_code = i.item_code
        WHERE NOT EXISTS (SELECT 1 FROM pos_bill_voids v WHERE v.bill_id = b.id)`)).map(r => ({ day: colombo(r.created_at), item_code: r.item_code, name: r.item_name, qty: r.qty, revenue: r.revenue, cost: r.cost })).filter(r => inRange(r.day, from, to));
    const receipts = {};
    for (const g of await safe(`SELECT split_part(item_description, ' - ', 1) AS code, grn_date::text AS d FROM grn_records WHERE grn_date IS NOT NULL`)) (receipts[String(g.code).trim()] = receipts[String(g.code).trim()] || []).push(g.d);
    res.json(Object.assign({ estimate: true, note: 'Holding cost is an estimate (money tied up, space, damage), not interest: ' + rate + '% of cost per month the item sat in stock, counted from its latest GRN date. Items with no GRN date are not charged.' }, require('../utils/holding_cost').compute(sold, receipts, rate)));
  } catch (e) { res.status(500).json({ error: 'could not build the real profit report' }); }
});

// 18 Nov (AJ): invoice profit for the phone Profit page. One row per bill: sale, cost, profit. Same cost rule as above. Read only.
router.get('/bills', async (req, res) => {
  const from = iso(req.query.from), to = iso(req.query.to);
  try {
    const rows = (await safe(`SELECT b.id, b.bill_number, b.created_at, b.total, b.customer_name, b.salesman,
              COALESCE(SUM(i.qty * COALESCE(NULLIF(i.unit_cost,0), p.avg_cost, 0)), 0) AS cost,
              COUNT(i.id) FILTER (WHERE COALESCE(NULLIF(i.unit_cost,0), p.avg_cost, 0) = 0) AS no_cost
         FROM pos_bills b LEFT JOIN pos_bill_items i ON i.bill_id = b.id LEFT JOIN products p ON p.item_code = i.item_code
        WHERE NOT EXISTS (SELECT 1 FROM pos_bill_voids v WHERE v.bill_id = b.id) GROUP BY b.id ORDER BY b.created_at DESC LIMIT 500`))
      .map(b => ({ id: b.id, no: b.bill_number, day: colombo(b.created_at), time: new Date(new Date(b.created_at).getTime() + 5.5 * 3600 * 1000).toISOString().slice(11, 16), customer: b.customer_name || '', salesman: b.salesman || '', sale: P.round2(b.total), cost: P.round2(b.cost), profit: P.round2(Number(b.total) - Number(b.cost)), no_cost: Number(b.no_cost) }))
      .filter(b => inRange(b.day, from, to));
    res.json({ estimate: true, rows });
  } catch (e) { res.status(500).json({ error: 'could not build the invoice profit list' }); }
});
router.get('/bill/:id', async (req, res) => {
  try {
    const rows = (await safe(`SELECT i.item_code, i.item_name, i.qty, i.line_total AS revenue, i.qty * COALESCE(NULLIF(i.unit_cost,0), p.avg_cost, 0) AS cost
         FROM pos_bill_items i LEFT JOIN products p ON p.item_code = i.item_code WHERE i.bill_id = $1 ORDER BY i.id`, [parseInt(req.params.id, 10) || 0]))
      .map(r => ({ code: r.item_code, name: r.item_name, qty: Number(r.qty), revenue: P.round2(r.revenue), cost: P.round2(r.cost), profit: P.round2(Number(r.revenue) - Number(r.cost)), no_cost: Number(r.cost) === 0 }));
    res.json({ estimate: true, rows });
  } catch (e) { res.status(500).json({ error: 'could not build the bill lines' }); }
});
module.exports = router;
