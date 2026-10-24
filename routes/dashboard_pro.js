'use strict';
// Owner dashboard "command centre": one READ-ONLY endpoint, GET /api/dashboard-pro (owner or admin only).
// Reads pos_bills (+voids, items, payments), products, vendor_bills (+payments, credit notes), cheque_register, credit_customers,
// expenses_detail, app_settings. Writes nothing, alters nothing. Each block is separate: if one table is missing, only that block is empty.
const express = require('express');
const pool = require('../utils/pool');
const router = express.Router();
const roleOf = req => (req.session && req.session.user && req.session.user.role) || 'staff';
const ownerOnly = (req, res, next) => (['admin', 'owner'].includes(roleOf(req)) ? next() : res.status(403).json({ error: 'Owner only' }));
const num = v => (v === null || v === undefined ? 0 : Number(v));
const NV = `LEFT JOIN pos_bill_voids v ON v.bill_id = b.id WHERE v.bill_id IS NULL`; // live (not voided) bills

async function safe(label, fn) { try { return await fn(); } catch (e) { console.error(`[dashboard_pro] ${label}:`, e.message); return null; } }
const q = (sql, p) => pool.query(sql, p).then(r => r.rows);

router.get('/dashboard-pro', ownerOnly, async (req, res) => {
  const [totals, daily, hourly, pays, profit, top, stock, lowList, cats, vendors, vendorList, cheques, chequeList, credit, exp, settings, grn, grnList, cash, banks, loans, comm, overheads, quotes, enq, weekday, dead, voids, catSales, billStats] = await Promise.all([
    safe('totals', () => q(`SELECT
        COALESCE(SUM(total) FILTER (WHERE d = CURRENT_DATE),0) AS today, COUNT(*) FILTER (WHERE d = CURRENT_DATE) AS bills_today,
        COALESCE(SUM(disc) FILTER (WHERE d = CURRENT_DATE),0) AS discount_today,
        COALESCE(SUM(total) FILTER (WHERE d = CURRENT_DATE - 1),0) AS yesterday, COUNT(*) FILTER (WHERE d = CURRENT_DATE - 1) AS bills_yesterday,
        COALESCE(SUM(total) FILTER (WHERE d = CURRENT_DATE - 7),0) AS same_day_last_week,
        COALESCE(SUM(total) FILTER (WHERE d >= date_trunc('week', CURRENT_DATE)::date),0) AS week, COUNT(*) FILTER (WHERE d >= date_trunc('week', CURRENT_DATE)::date) AS bills_week,
        COALESCE(SUM(total) FILTER (WHERE d >= (date_trunc('week', CURRENT_DATE) - interval '7 days')::date AND d <= CURRENT_DATE - 7),0) AS last_week_same_point,
        COALESCE(SUM(total) FILTER (WHERE d >= date_trunc('month', CURRENT_DATE)::date),0) AS month, COUNT(*) FILTER (WHERE d >= date_trunc('month', CURRENT_DATE)::date) AS bills_month,
        COALESCE(SUM(total) FILTER (WHERE d >= (date_trunc('month', CURRENT_DATE) - interval '1 month')::date AND d <= (CURRENT_DATE - interval '1 month')::date),0) AS last_month_same_point,
        COALESCE(SUM(total),0) AS two_months
      FROM (SELECT b.created_at::date AS d, b.total, b.discount_amount AS disc FROM pos_bills b ${NV}
            AND b.created_at::date >= (date_trunc('month', CURRENT_DATE) - interval '1 month')::date) x`)),
    safe('daily', () => q(`SELECT g::date AS d, COALESCE(s.total,0) AS total, COALESCE(s.n,0) AS bills FROM generate_series(CURRENT_DATE - 13, CURRENT_DATE, '1 day') g
        LEFT JOIN (SELECT b.created_at::date AS d, SUM(b.total) AS total, COUNT(*) AS n FROM pos_bills b ${NV} AND b.created_at::date >= CURRENT_DATE - 13 GROUP BY 1) s ON s.d = g::date ORDER BY 1`)),
    safe('hourly', () => q(`SELECT EXTRACT(hour FROM b.created_at)::int AS h, SUM(b.total) AS total, COUNT(*) AS n FROM pos_bills b ${NV}
        AND b.created_at::date >= CURRENT_DATE - 6 GROUP BY 1 ORDER BY 1`)),
    safe('pays', () => q(`SELECT method, SUM(amount) AS amount FROM (
          SELECT p.method, p.amount FROM pos_bill_payments p JOIN pos_bills b ON b.id = p.bill_id ${NV} AND b.created_at::date = CURRENT_DATE
          UNION ALL SELECT COALESCE(b.payment_method,'cash'), b.total FROM pos_bills b ${NV} AND b.created_at::date = CURRENT_DATE
            AND NOT EXISTS (SELECT 1 FROM pos_bill_payments p WHERE p.bill_id = b.id)) z GROUP BY method ORDER BY 2 DESC`)),
    safe('profit', () => q(`SELECT
        COALESCE(SUM(i.line_total * CASE WHEN b.subtotal > 0 THEN b.total / b.subtotal ELSE 1 END) FILTER (WHERE b.created_at::date = CURRENT_DATE),0) AS rev_today,
        COALESCE(SUM(i.line_total * CASE WHEN b.subtotal > 0 THEN b.total / b.subtotal ELSE 1 END) FILTER (WHERE b.created_at::date = CURRENT_DATE AND p.avg_cost > 0),0) AS rev_cost_today,
        COALESCE(SUM(i.qty * p.avg_cost) FILTER (WHERE b.created_at::date = CURRENT_DATE AND p.avg_cost > 0),0) AS cost_today,
        COALESCE(SUM(i.line_total * CASE WHEN b.subtotal > 0 THEN b.total / b.subtotal ELSE 1 END) FILTER (WHERE b.created_at::date >= date_trunc('month', CURRENT_DATE)::date),0) AS rev_month,
        COALESCE(SUM(i.line_total * CASE WHEN b.subtotal > 0 THEN b.total / b.subtotal ELSE 1 END) FILTER (WHERE b.created_at::date >= date_trunc('month', CURRENT_DATE)::date AND p.avg_cost > 0),0) AS rev_cost_month,
        COALESCE(SUM(i.qty * p.avg_cost) FILTER (WHERE b.created_at::date >= date_trunc('month', CURRENT_DATE)::date AND p.avg_cost > 0),0) AS cost_month
      FROM pos_bill_items i LEFT JOIN products p ON p.item_code = i.item_code
      JOIN pos_bills b ON b.id = i.bill_id ${NV} AND b.created_at::date >= date_trunc('month', CURRENT_DATE)::date`)),
    safe('top', () => q(`SELECT i.item_name AS name, SUM(i.qty) AS qty, SUM(i.line_total) AS revenue FROM pos_bill_items i JOIN pos_bills b ON b.id = i.bill_id ${NV}
        AND b.created_at::date >= date_trunc('month', CURRENT_DATE)::date GROUP BY 1 ORDER BY 3 DESC LIMIT 8`)),
    safe('stock', () => q(`SELECT COUNT(*) AS items, COALESCE(SUM(GREATEST(stock_level,0)),0) AS units,
        COALESCE(SUM(GREATEST(stock_level,0) * avg_cost),0) AS cost_value,
        COALESCE(SUM(GREATEST(stock_level,0) * selling_price) FILTER (WHERE selling_price > 0),0) AS retail_value,
        COUNT(*) FILTER (WHERE stock_level <= 0) AS out_of_stock,
        COUNT(*) FILTER (WHERE stock_level > 0 AND reorder_threshold > 0 AND stock_level <= reorder_threshold) AS low_stock,
        COUNT(*) FILTER (WHERE selling_price IS NULL OR selling_price <= 0) AS no_price
      FROM products WHERE active = true`)),
    safe('lowList', () => q(`SELECT item_code, name, stock_level, reorder_threshold FROM products WHERE active = true
        AND (stock_level <= 0 OR (reorder_threshold > 0 AND stock_level <= reorder_threshold)) ORDER BY stock_level ASC, name LIMIT 8`)),
    safe('cats', () => q(`SELECT COALESCE(NULLIF(category,''),'No category') AS category, COUNT(*) AS items, COALESCE(SUM(GREATEST(stock_level,0) * avg_cost),0) AS cost_value
        FROM products WHERE active = true GROUP BY 1 ORDER BY 3 DESC LIMIT 6`)),
    safe('vendors', () => q(`WITH x AS (SELECT b.vendor_name, b.due_date, b.total - COALESCE(p.paid,0) - COALESCE(n.cn,0) AS owed FROM vendor_bills b
          LEFT JOIN (SELECT bill_id, SUM(amount) AS paid FROM vendor_payments GROUP BY bill_id) p ON p.bill_id = b.id
          LEFT JOIN (SELECT bill_id, SUM(amount) AS cn FROM vendor_credit_notes GROUP BY bill_id) n ON n.bill_id = b.id WHERE b.voided = false)
        SELECT COALESCE(SUM(owed) FILTER (WHERE owed > 0),0) AS owed, COUNT(*) FILTER (WHERE owed > 0) AS bills,
          COALESCE(SUM(owed) FILTER (WHERE owed > 0 AND due_date < CURRENT_DATE),0) AS overdue,
          COALESCE(SUM(owed) FILTER (WHERE owed > 0 AND due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7),0) AS due7,
          COALESCE(SUM(owed) FILTER (WHERE owed > 0 AND due_date IS NULL),0) AS no_due_date FROM x`)),
    safe('vendorList', () => q(`WITH x AS (SELECT b.vendor_name, b.due_date, b.total - COALESCE(p.paid,0) - COALESCE(n.cn,0) AS owed FROM vendor_bills b
          LEFT JOIN (SELECT bill_id, SUM(amount) AS paid FROM vendor_payments GROUP BY bill_id) p ON p.bill_id = b.id
          LEFT JOIN (SELECT bill_id, SUM(amount) AS cn FROM vendor_credit_notes GROUP BY bill_id) n ON n.bill_id = b.id WHERE b.voided = false)
        SELECT vendor_name, SUM(owed) AS owed, MIN(due_date) FILTER (WHERE owed > 0) AS next_due FROM x GROUP BY 1 HAVING SUM(owed) > 0 ORDER BY 2 DESC LIMIT 6`)),
    safe('cheques', () => q(`SELECT COALESCE(SUM(amount),0) AS pending, COUNT(*) AS n,
        COALESCE(SUM(amount) FILTER (WHERE due_date < CURRENT_DATE),0) AS overdue,
        COALESCE(SUM(amount) FILTER (WHERE due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7),0) AS due7,
        COUNT(*) FILTER (WHERE due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7) AS n7 FROM cheque_register WHERE status = 'pending'`)),
    safe('chequeList', () => q(`SELECT payee, amount, due_date, bank FROM cheque_register WHERE status = 'pending' ORDER BY due_date LIMIT 5`)),
    safe('credit', () => q(`SELECT COALESCE(SUM(amount - paid) FILTER (WHERE amount > paid),0) AS owed_to_us, COUNT(*) FILTER (WHERE amount > paid) AS n,
        COALESCE(SUM(amount - paid) FILTER (WHERE amount > paid AND due_date < CURRENT_DATE),0) AS overdue FROM credit_customers WHERE COALESCE(quarantined,false) = false`)),
    safe('exp', () => q(`SELECT COALESCE(SUM(amount) FILTER (WHERE report_date = CURRENT_DATE),0) AS today,
        COALESCE(SUM(amount) FILTER (WHERE report_date >= date_trunc('month', CURRENT_DATE)::date),0) AS month FROM expenses_detail`)),
    safe('settings', () => q(`SELECT key, value #>> '{}' AS v FROM app_settings WHERE key IN ('dashboard_sales_target','dashboard_sales_target_week','dashboard_sales_target_month')`)),
    safe('grn', () => q(`SELECT COALESCE(SUM(total_amount) FILTER (WHERE grn_date = CURRENT_DATE),0) AS today,
        COALESCE(SUM(total_amount) FILTER (WHERE grn_date >= date_trunc('week', CURRENT_DATE)::date),0) AS week,
        COALESCE(SUM(total_amount) FILTER (WHERE grn_date >= date_trunc('month', CURRENT_DATE)::date),0) AS month,
        COALESCE(SUM(total_amount),0) AS all_time, COUNT(DISTINCT grn_number) AS grns, COALESCE(SUM(quantity),0) AS units,
        COUNT(DISTINCT grn_number) FILTER (WHERE grn_date >= date_trunc('month', CURRENT_DATE)::date) AS grns_month FROM grn_records`)),
    safe('grnList', () => q(`SELECT grn_number, MAX(supplier_name) AS supplier, MAX(grn_date) AS grn_date, SUM(total_amount) AS total, COUNT(*) AS lines
        FROM grn_records GROUP BY grn_number ORDER BY MAX(grn_date) DESC, MAX(id) DESC LIMIT 6`)),
    safe('cash', () => q(`SELECT p.method,
        COALESCE(SUM(p.amount) FILTER (WHERE b.created_at::date = CURRENT_DATE),0) AS today,
        COALESCE(SUM(p.amount) FILTER (WHERE b.created_at::date >= date_trunc('month', CURRENT_DATE)::date),0) AS month,
        COALESCE(SUM(p.amount),0) AS all_time
        FROM (SELECT bill_id, method, amount FROM pos_bill_payments UNION ALL
              SELECT b.id, COALESCE(b.payment_method,'cash'), b.total FROM pos_bills b WHERE NOT EXISTS (SELECT 1 FROM pos_bill_payments x WHERE x.bill_id = b.id)) p
        JOIN pos_bills b ON b.id = p.bill_id ${NV} GROUP BY p.method`)),
    safe('banks', () => q(`SELECT account_label, bank, current_balance FROM bank_accounts WHERE active = true ORDER BY current_balance DESC`)),
    safe('loans', () => q(`SELECT COALESCE(SUM(l.amount - COALESCE(p.paid,0)),0) AS outstanding, COUNT(*) AS n,
        COALESCE(SUM(l.amount - COALESCE(p.paid,0)) FILTER (WHERE l.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 30),0) AS due30
        FROM investor_loans l LEFT JOIN (SELECT loan_id, SUM(amount) AS paid FROM investor_loan_payments GROUP BY loan_id) p ON p.loan_id = l.id
        WHERE COALESCE(l.status,'active') <> 'repaid' AND l.amount > COALESCE(p.paid,0)`)),
    safe('comm', () => q(`SELECT COALESCE(SUM(commission_amount) FILTER (WHERE sale_date >= date_trunc('month', CURRENT_DATE)::date),0) AS month FROM sale_commissions`)),
    safe('overheads', () => q(`SELECT COALESCE(SUM(monthly_amount),0) AS monthly, COUNT(*) AS n FROM fixed_overheads WHERE active = true`)),
    safe('quotes', () => q(`SELECT COUNT(*) AS n, COALESCE(SUM(total),0) AS value FROM quotations WHERE status IN ('draft','sent','pending','open')`)),
    safe('enq', () => q(`SELECT COUNT(*) FILTER (WHERE date >= CURRENT_DATE - 6) AS week, COUNT(*) FILTER (WHERE status = 'new') AS new_n FROM enquiries`)),
    safe('weekday', () => q(`SELECT EXTRACT(dow FROM d)::int AS dow, ROUND(AVG(total)) AS avg_sales FROM (SELECT b.created_at::date AS d, SUM(b.total) AS total FROM pos_bills b ${NV}
        AND b.created_at::date >= CURRENT_DATE - 55 GROUP BY 1) x GROUP BY 1 ORDER BY 1`)),
    safe('dead', () => q(`SELECT COUNT(*) AS n, COALESCE(SUM(stock_level * avg_cost),0) AS cost_value FROM products p WHERE active = true AND stock_level > 0
        AND NOT EXISTS (SELECT 1 FROM pos_bill_items i JOIN pos_bills b ON b.id = i.bill_id WHERE i.item_code = p.item_code AND b.created_at::date >= CURRENT_DATE - 30)`)),
    safe('voids', () => q(`SELECT COUNT(*) FILTER (WHERE b.created_at::date = CURRENT_DATE) AS today_n, COALESCE(SUM(b.total) FILTER (WHERE b.created_at::date = CURRENT_DATE),0) AS today_value,
        COUNT(*) FILTER (WHERE b.created_at::date >= date_trunc('month', CURRENT_DATE)::date) AS month_n,
        COALESCE(SUM(b.total) FILTER (WHERE b.created_at::date >= date_trunc('month', CURRENT_DATE)::date),0) AS month_value
        FROM pos_bills b JOIN pos_bill_voids v ON v.bill_id = b.id`)),
    safe('catSales', () => q(`SELECT COALESCE(NULLIF(p.category,''),'No category') AS category, SUM(i.line_total) AS revenue, SUM(i.qty) AS qty
        FROM pos_bill_items i LEFT JOIN products p ON p.item_code = i.item_code JOIN pos_bills b ON b.id = i.bill_id ${NV}
        AND b.created_at::date >= date_trunc('month', CURRENT_DATE)::date GROUP BY 1 ORDER BY 2 DESC LIMIT 6`)),
    safe('billStats', () => q(`SELECT COALESCE(SUM(i.qty),0) AS pieces_month, COUNT(DISTINCT i.bill_id) AS bills FROM pos_bill_items i JOIN pos_bills b ON b.id = i.bill_id ${NV}
        AND b.created_at::date >= date_trunc('month', CURRENT_DATE)::date`)),
  ]);
  const s = {}; (settings || []).forEach(r => { s[r.key] = Number(r.v); });
  const daily_t = s.dashboard_sales_target > 0 ? s.dashboard_sales_target : 100000;
  const now = new Date(); const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const t = (totals && totals[0]) || {}; const p = (profit && profit[0]) || {};
  const gp = (rc, c) => ({ gross_profit: num(rc) - num(c), margin_pct: num(rc) > 0 ? ((num(rc) - num(c)) / num(rc)) * 100 : null });
  res.json({
    generated_at: new Date().toISOString(),
    sales: {
      today: num(t.today), bills_today: num(t.bills_today), avg_bill_today: num(t.bills_today) ? num(t.today) / num(t.bills_today) : 0, discount_today: num(t.discount_today),
      yesterday: num(t.yesterday), same_day_last_week: num(t.same_day_last_week),
      week: num(t.week), bills_week: num(t.bills_week), last_week_same_point: num(t.last_week_same_point),
      month: num(t.month), bills_month: num(t.bills_month), last_month_same_point: num(t.last_month_same_point),
    },
    targets: { day: daily_t, week: s.dashboard_sales_target_week > 0 ? s.dashboard_sales_target_week : daily_t * 7,
      month: s.dashboard_sales_target_month > 0 ? s.dashboard_sales_target_month : daily_t * dim, days_in_month: dim, day_of_month: now.getDate() },
    profit: {
      today: { ...gp(p.rev_cost_today, p.cost_today), coverage_pct: num(p.rev_today) > 0 ? (num(p.rev_cost_today) / num(p.rev_today)) * 100 : null },
      month: { ...gp(p.rev_cost_month, p.cost_month), coverage_pct: num(p.rev_month) > 0 ? (num(p.rev_cost_month) / num(p.rev_month)) * 100 : null },
    },
    daily: (daily || []).map(r => ({ d: r.d, total: num(r.total), bills: num(r.bills) })),
    hourly: (hourly || []).map(r => ({ h: r.h, total: num(r.total), n: num(r.n) })),
    payments_today: (pays || []).map(r => ({ method: r.method, amount: num(r.amount) })),
    top_items_month: (top || []).map(r => ({ name: r.name, qty: num(r.qty), revenue: num(r.revenue) })),
    stock: { ...((stock && stock[0]) || {}), low_list: lowList || [], categories: cats || [] },
    vendors: { ...((vendors && vendors[0]) || {}), list: vendorList || [] },
    cheques: { ...((cheques && cheques[0]) || {}), list: chequeList || [] },
    customers_owe: (credit && credit[0]) || {},
    expenses: (exp && exp[0]) || {},
    grn: { ...((grn && grn[0]) || {}), list: grnList || [] },
    cash: (cash || []).reduce((o, r) => { o[String(r.method).toLowerCase()] = { today: num(r.today), month: num(r.month), all_time: num(r.all_time) }; return o; }, {}),
    banks: { total: (banks || []).reduce((a, r) => a + num(r.current_balance), 0), list: banks || [] },
    investor_loans: (loans && loans[0]) || {},
    commissions_month: num(comm && comm[0] && comm[0].month),
    overheads: (overheads && overheads[0]) || {},
    quotes_open: (quotes && quotes[0]) || {},
    enquiries: (enq && enq[0]) || {},
    weekday: weekday || [],
    dead_stock: (dead && dead[0]) || {},
    voids: (voids && voids[0]) || {},
    category_sales_month: (catSales || []).map(r => ({ category: r.category, revenue: num(r.revenue), qty: num(r.qty) })),
    bill_stats: (billStats && billStats[0]) || {},
    missing: Object.entries({ totals, daily, hourly, pays, profit, top, stock, vendors, cheques, credit, exp, grn, cash, banks, loans, overheads }).filter(([, v]) => v === null).map(([k]) => k),
  });
});
module.exports = router;
