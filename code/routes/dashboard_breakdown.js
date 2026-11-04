'use strict';
// Command centre "click a number, see what is inside it". READ-ONLY. GET /api/dashboard-pro/breakdown/:key (owner or admin only).
// One block per key in DEFS: title, columns, one fixed SQL (no user input goes into SQL: the key only picks a block). Writes nothing.
const express = require('express');
const pool = require('../utils/pool');
const router = express.Router();
const roleOf = req => (req.session && req.session.user && req.session.user.role) || 'staff';
const ownerOnly = (req, res, next) => (['admin', 'owner'].includes(roleOf(req)) ? next() : res.status(403).json({ error: 'Owner only' }));

const LIVE = 'LEFT JOIN pos_bill_voids v ON v.bill_id = b.id WHERE v.bill_id IS NULL';
const P = {
  today: "b.created_at::date = CURRENT_DATE",
  yesterday: "b.created_at::date = CURRENT_DATE - 1",
  week: "b.created_at::date >= date_trunc('week', CURRENT_DATE)::date",
  month: "b.created_at::date >= date_trunc('month', CURRENT_DATE)::date",
};
const money = 'money', text = 'text', num = 'num';
const bills = (title, p) => ({ title, sum: 5, cols: [['Bill', text], ['Time', text], ['Customer', text], ['Paid by', text], ['Discount', money], ['Total', money]],
  sql: `SELECT b.bill_number, to_char(b.created_at,'DD Mon HH24:MI'), COALESCE(NULLIF(b.customer_name,''),'Walk-in'), COALESCE(b.payment_method,'cash'), b.discount_amount, b.total
        FROM pos_bills b ${LIVE} AND ${p} ORDER BY b.created_at DESC LIMIT 200` });
const profit = (title, p) => ({ title, sum: 4, note: 'Profit only for items that have a cost. Blank = cost not known yet.', cols: [['Item', text], ['Sold', num], ['Sales', money], ['Cost', money], ['Profit', money]],
  sql: `SELECT i.item_name, SUM(i.qty), SUM(i.line_total), SUM(CASE WHEN pr.avg_cost > 0 THEN i.qty * pr.avg_cost END),
        SUM(CASE WHEN pr.avg_cost > 0 THEN i.line_total - i.qty * pr.avg_cost END) AS profit
        FROM pos_bill_items i LEFT JOIN products pr ON pr.item_code = i.item_code JOIN pos_bills b ON b.id = i.bill_id ${LIVE} AND ${p}
        GROUP BY i.item_name ORDER BY profit DESC NULLS LAST LIMIT 200` });
const expenses = (title, where) => ({ title, sum: 3, cols: [['Date', text], ['Category', text], ['What for', text], ['Amount', money]],
  sql: `SELECT to_char(report_date,'DD Mon'), category, description, amount FROM expenses_detail WHERE ${where} ORDER BY report_date DESC, id DESC LIMIT 200` });
const grn = (title, where) => ({ title, sum: 4, cols: [['GRN', text], ['Supplier', text], ['Date', text], ['Lines', num], ['Total', money]],
  sql: `SELECT grn_number, MAX(supplier_name), to_char(MAX(grn_date),'DD Mon'), COUNT(*), SUM(total_amount) FROM grn_records WHERE ${where}
        GROUP BY grn_number ORDER BY MAX(grn_date) DESC, MAX(id) DESC LIMIT 200` });
const stockList = (title, where, order) => ({ title, cols: [['Code', text], ['Item', text], ['Category', text], ['In stock', num], ['Reorder at', num]],
  sql: `SELECT item_code, name, COALESCE(NULLIF(category,''),'No category'), stock_level, reorder_threshold FROM products WHERE active = true AND ${where} ORDER BY ${order} LIMIT 300` });
const voids = (title, p) => ({ title, sum: 4, cols: [['Bill', text], ['Time', text], ['Reason', text], ['By', text], ['Total', money]],
  sql: `SELECT b.bill_number, to_char(b.created_at,'DD Mon HH24:MI'), v.reason, v.voided_by, b.total FROM pos_bills b JOIN pos_bill_voids v ON v.bill_id = b.id
        WHERE ${p} ORDER BY b.created_at DESC LIMIT 200` });
const VB = `WITH x AS (SELECT b.vendor_name, b.due_date, b.total, b.total - COALESCE(p.paid,0) - COALESCE(n.cn,0) AS owed FROM vendor_bills b
  LEFT JOIN (SELECT bill_id, SUM(amount) AS paid FROM vendor_payments GROUP BY bill_id) p ON p.bill_id = b.id
  LEFT JOIN (SELECT bill_id, SUM(amount) AS cn FROM vendor_credit_notes GROUP BY bill_id) n ON n.bill_id = b.id WHERE b.voided = false)`;

const DEFS = {
  sales_today: bills('Bills today', P.today), sales_yesterday: bills('Bills yesterday', P.yesterday),
  sales_week: bills('Bills this week', P.week), sales_month: bills('Bills this month', P.month),
  profit_today: profit('Profit today by item', P.today), profit_month: profit('Profit this month by item', P.month),
  expenses_today: expenses('Expenses today', 'report_date = CURRENT_DATE'),
  expenses_month: expenses('Expenses this month', "report_date >= date_trunc('month', CURRENT_DATE)::date"),
  grn_today: grn('Stock bought today', 'grn_date = CURRENT_DATE'),
  grn_week: grn('Stock bought this week', "grn_date >= date_trunc('week', CURRENT_DATE)::date"),
  grn_month: grn('Stock bought this month', "grn_date >= date_trunc('month', CURRENT_DATE)::date"),
  stock_out: stockList('Out of stock', 'stock_level <= 0', 'name'),
  stock_low: stockList('Running low', '(stock_level <= 0 OR (reorder_threshold > 0 AND stock_level <= reorder_threshold))', 'stock_level ASC, name'),
  stock_noprice: { title: 'Items without a selling price', cols: [['Code', text], ['Item', text], ['Category', text], ['Cost', money], ['In stock', num]],
    sql: "SELECT item_code, name, COALESCE(NULLIF(category,''),'No category'), avg_cost, stock_level FROM products WHERE active = true AND (selling_price IS NULL OR selling_price <= 0) ORDER BY stock_level DESC, name LIMIT 300" },
  stock_dead: { title: 'Not sold in 30 days', sum: 3, cols: [['Code', text], ['Item', text], ['In stock', num], ['Cost tied up', money]],
    sql: `SELECT item_code, name, stock_level, stock_level * avg_cost AS tied FROM products p WHERE active = true AND stock_level > 0
          AND NOT EXISTS (SELECT 1 FROM pos_bill_items i JOIN pos_bills b ON b.id = i.bill_id WHERE i.item_code = p.item_code AND b.created_at::date >= CURRENT_DATE - 30)
          ORDER BY tied DESC NULLS LAST LIMIT 300` },
  stock_value: { title: 'Stock value by category', sum: 3, cols: [['Category', text], ['Items', num], ['Pieces', num], ['Cost value', money], ['Selling value', money]],
    sql: `SELECT COALESCE(NULLIF(category,''),'No category'), COUNT(*), SUM(GREATEST(stock_level,0)), SUM(GREATEST(stock_level,0) * avg_cost),
          SUM(GREATEST(stock_level,0) * selling_price) FILTER (WHERE selling_price > 0) FROM products WHERE active = true GROUP BY 1 ORDER BY 4 DESC NULLS LAST` },
  vendors_owed: { title: 'What we owe vendors', sum: 3, cols: [['Vendor', text], ['Due', text], ['Bill total', money], ['Still owed', money]],
    sql: `${VB} SELECT vendor_name, COALESCE(to_char(due_date,'DD Mon YYYY'),'no date'), total, owed FROM x WHERE owed > 0 ORDER BY due_date NULLS LAST LIMIT 200` },
  cheques_pending: { title: 'Pending cheques', sum: 4, cols: [['Cheque', text], ['Payee', text], ['Bank', text], ['Due', text], ['Amount', money]],
    sql: "SELECT cheque_no, payee, bank, to_char(due_date,'DD Mon YYYY'), amount FROM cheque_register WHERE status = 'pending' ORDER BY due_date LIMIT 200" },
  customers_owe: { title: 'Customers who owe us', sum: 3, cols: [['Customer', text], ['Invoice', text], ['Due', text], ['Owed', money]],
    sql: `SELECT name, invoice_no, COALESCE(to_char(due_date,'DD Mon YYYY'),'no date'), amount - paid FROM credit_customers
          WHERE amount > paid AND COALESCE(quarantined,false) = false ORDER BY due_date NULLS LAST LIMIT 200` },
  voids_today: voids('Cancelled bills today', P.today), voids_month: voids('Cancelled bills this month', P.month),
  top_month: { title: 'Top sellers this month', sum: 2, cols: [['Item', text], ['Sold', num], ['Sales', money]],
    sql: `SELECT i.item_name, SUM(i.qty), SUM(i.line_total) FROM pos_bill_items i JOIN pos_bills b ON b.id = i.bill_id ${LIVE} AND ${P.month} GROUP BY 1 ORDER BY 3 DESC LIMIT 100` },
  cat_month: { title: 'Sales by category this month', sum: 2, cols: [['Category', text], ['Pieces', num], ['Sales', money]],
    sql: `SELECT COALESCE(NULLIF(pr.category,''),'No category'), SUM(i.qty), SUM(i.line_total) FROM pos_bill_items i LEFT JOIN products pr ON pr.item_code = i.item_code
          JOIN pos_bills b ON b.id = i.bill_id ${LIVE} AND ${P.month} GROUP BY 1 ORDER BY 3 DESC` },
  pay_today: { title: 'How customers paid today', sum: 2, cols: [['Method', text], ['Bills', num], ['Amount', money]],
    sql: `SELECT upper(method), COUNT(*), SUM(amount) FROM (SELECT p.bill_id, p.method, p.amount FROM pos_bill_payments p JOIN pos_bills b ON b.id = p.bill_id ${LIVE} AND ${P.today}
          UNION ALL SELECT b.id, COALESCE(b.payment_method,'cash'), b.total FROM pos_bills b ${LIVE} AND ${P.today}
            AND NOT EXISTS (SELECT 1 FROM pos_bill_payments p WHERE p.bill_id = b.id)) z GROUP BY 1 ORDER BY 3 DESC` },
};

router.get('/dashboard-pro/breakdown/:key', ownerOnly, async (req, res) => {
  const def = Object.prototype.hasOwnProperty.call(DEFS, req.params.key) ? DEFS[req.params.key] : null;
  if (!def) return res.status(404).json({ error: 'No breakdown for this number' });
  try {
    const r = await pool.query({ text: def.sql, rowMode: 'array' });
    const total = def.sum == null ? null : r.rows.reduce((a, row) => a + (Number(row[def.sum]) || 0), 0);
    res.json({ key: req.params.key, title: def.title, note: def.note || '', columns: def.cols.map(c => ({ label: c[0], type: c[1] })), rows: r.rows, total, sum_col: def.sum == null ? null : def.sum });
  } catch (e) {
    console.error('[dashboard_breakdown]', req.params.key, e.message);
    res.status(200).json({ key: req.params.key, title: def.title, note: 'Nothing to show yet.', columns: def.cols.map(c => ({ label: c[0], type: c[1] })), rows: [], total: null, sum_col: null });
  }
});
router.DEFS = DEFS;
module.exports = router;
