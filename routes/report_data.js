'use strict';
// Data for the owner Reports screen (read only, owner or admin only).
//   GET /api/report-data/sales?group=day|week|month&from=YYYY-MM-DD&to=YYYY-MM-DD
//        -> rows { period, bills, sales, discount, profit_est, lines_without_cost }. Voided bills are left out.
//        profit_est = sales - what the items cost today (products.avg_cost). Lines without an item code count as cost 0 (see lines_without_cost).
//   GET /api/report-data/grn  -> every GRN line, newest first (max 5000)
const express = require('express');
const pool = require('../utils/pool');
const router = express.Router();
const roleOf = req => (req.session && req.session.user && req.session.user.role) || 'staff';
const ownerOnly = (req, res, next) => (['admin', 'owner'].includes(roleOf(req)) ? next() : res.status(403).json({ error: 'Owner only' }));
const iso = s => (/^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) ? s : null);
const colombo = d => new Date(new Date(d).getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
function periodOf(day, group) {
  if (group === 'month') return day.slice(0, 7);
  if (group === 'week') { const d = new Date(day + 'T00:00:00Z'); const back = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - back); return d.toISOString().slice(0, 10); }
  return day;
}
router.get('/report-data/sales', ownerOnly, async (req, res) => {
  const group = ['day', 'week', 'month'].includes(req.query.group) ? req.query.group : 'day';
  const from = iso(req.query.from), to = iso(req.query.to);
  try {
    const r = await pool.query(
      `SELECT b.id, b.created_at, b.total, b.discount_amount,
              COALESCE(SUM(i.qty * COALESCE(p.avg_cost, 0)), 0) AS cost,
              COUNT(i.id) FILTER (WHERE p.id IS NULL) AS no_cost
         FROM pos_bills b
         LEFT JOIN pos_bill_items i ON i.bill_id = b.id
         LEFT JOIN products p ON p.item_code = i.item_code
        WHERE NOT EXISTS (SELECT 1 FROM pos_bill_voids v WHERE v.bill_id = b.id)
        GROUP BY b.id ORDER BY b.created_at`);
    const by = new Map();
    for (const b of r.rows) {
      const day = colombo(b.created_at);
      if ((from && day < from) || (to && day > to)) continue;
      const k = periodOf(day, group);
      const o = by.get(k) || { period: k, bills: 0, sales: 0, discount: 0, profit_est: 0, lines_without_cost: 0 };
      o.bills += 1; o.sales += Number(b.total); o.discount += Number(b.discount_amount);
      o.profit_est += Number(b.total) - Number(b.cost); o.lines_without_cost += Number(b.no_cost);
      by.set(k, o);
    }
    const rows = [...by.values()].sort((a, b) => (a.period < b.period ? 1 : -1)).map(o => ({ ...o, sales: Math.round(o.sales * 100) / 100, discount: Math.round(o.discount * 100) / 100, profit_est: Math.round(o.profit_est * 100) / 100 }));
    res.json({ group, rows });
  } catch (e) { res.status(500).json({ error: 'could not build the sales report' }); }
});
router.get('/report-data/grn', ownerOnly, async (req, res) => {
  try {
    const r = await pool.query(`SELECT grn_number, grn_date, supplier_name, item_description, quantity, unit_cost, total_amount, status FROM grn_records ORDER BY grn_date DESC, id DESC LIMIT 5000`);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: 'could not load GRN history' }); }
});
module.exports = router;
