// Seeds the feature_flags registry: every module from final.md, CORE modules ON,
// dormant modules OFF. 'built' tracks whether real DB+API+UI exists yet (not just registered).
const { Pool, types: pgTypes } = require('pg');
pgTypes.setTypeParser(1082, val => val);
require('dotenv').config();
const pool = new Pool({
  host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME,
  user: process.env.DB_USER, password: process.env.DB_PASSWORD,
});

const CORE = [
  ['core_reports', 'CORE', 'Daily/Weekly/Monthly Reports', 'Carried-over report views'],
  ['core_customers', 'CORE', 'Customers', 'Customer list'],
  ['core_credit', 'CORE', 'Credit & Aging', 'Credit customer aging buckets'],
  ['core_suppliers', 'CORE', 'Suppliers', 'Supplier list + payments'],
  ['core_staff', 'CORE', 'Staff', 'Staff list, salary, commission'],
  ['core_cheques', 'CORE', 'Cheques', 'Cheque tracker'],
  ['core_grn', 'CORE', 'GRN/Inventory', 'GRN records with caveat flag'],
  ['core_quotations', 'CORE', 'Quotations', 'Quotation list'],
  ['core_export', 'CORE', 'PDF/Excel Export', 'Download button on every report'],
  ['core_whatsapp_share', 'CORE', 'Send to WhatsApp', 'Share a day report via LAYLA bridge'],
  ['core_drilldown', 'CORE', 'Click-to-Expand Breakdown', 'Net Profit -> GP - Expenses drilldown on every figure'],
  ['core_search', 'CORE', 'Global + Per-Table Search', 'Search across pages and within tables'],
  ['core_auth', 'CORE', 'Full Auth', 'Login/logout/change password/user management/RBAC'],
  ['core_3d', 'CORE', '3D Nature Visuals', 'Three.js on dashboard/login/transitions only'],
  ['core_pagination', 'CORE', 'Table Pagination', 'Pagination on all data tables'],
];

const DORMANT = [
  // SALES & CRM
  ['crm_quote_to_invoice', 'SALES_CRM', 'Quotation -> Invoice Conversion', ''],
  ['crm_sales_orders', 'SALES_CRM', 'Sales Orders', ''],
  ['crm_delivery_notes', 'SALES_CRM', 'Delivery Notes', ''],
  ['crm_customer_groups', 'SALES_CRM', 'Customer Groups/Tiers', ''],
  ['crm_loyalty_points', 'SALES_CRM', 'Loyalty Points', ''],
  ['crm_discount_rules', 'SALES_CRM', 'Discount Rules Engine', ''],
  ['crm_price_lists', 'SALES_CRM', 'Price Lists (retail/wholesale/contractor)', ''],
  ['crm_customer_statements', 'SALES_CRM', 'Customer Statements', ''],
  ['crm_followup_reminders', 'SALES_CRM', 'Follow-up Reminders', ''],
  ['crm_abandoned_quote_alerts', 'SALES_CRM', 'Abandoned Quote Alerts', ''],
  // INVENTORY
  ['inv_multi_location', 'INVENTORY', 'Multi-Location Stock', ''],
  ['inv_stock_transfer', 'INVENTORY', 'Stock Transfer Notes', ''],
  ['inv_reorder_alerts', 'INVENTORY', 'Reorder-Level Alerts', ''],
  ['inv_dead_stock', 'INVENTORY', 'Dead-Stock Report', ''],
  ['inv_valuation', 'INVENTORY', 'Stock Valuation (FIFO/weighted avg)', ''],
  ['inv_batch_tracking', 'INVENTORY', 'Batch Tracking', ''],
  ['inv_supplier_returns', 'INVENTORY', 'Supplier Returns (Debit Notes)', ''],
  ['inv_customer_returns', 'INVENTORY', 'Customer Returns (Credit Notes)', ''],
  ['inv_stock_take', 'INVENTORY', 'Stock Take Mode + Variance Report', ''],
  ['inv_item_images', 'INVENTORY', 'Item Images', ''],
  ['inv_barcode_autogen', 'INVENTORY', 'Barcode Auto-Generation on GRN', ''],
  // PURCHASING
  ['pur_purchase_orders', 'PURCHASING', 'Purchase Orders', ''],
  ['pur_po_grn_matching', 'PURCHASING', 'PO -> GRN Matching', ''],
  ['pur_price_comparison', 'PURCHASING', 'Supplier Price Comparison', ''],
  ['pur_aging_payables', 'PURCHASING', 'Supplier Aging/Payables', ''],
  ['pur_landed_cost', 'PURCHASING', 'Landed-Cost Calculation', ''],
  ['pur_shipment_tracker', 'PURCHASING', 'Import Shipment Tracker', ''],
  // ACCOUNTING
  ['acc_chart_of_accounts', 'ACCOUNTING', 'Chart of Accounts', ''],
  ['acc_journal_entries', 'ACCOUNTING', 'Journal Entries', ''],
  ['acc_ledger_view', 'ACCOUNTING', 'Ledger View', ''],
  ['acc_trial_balance', 'ACCOUNTING', 'Trial Balance', ''],
  ['acc_pnl', 'ACCOUNTING', 'P&L Statement', ''],
  ['acc_balance_sheet', 'ACCOUNTING', 'Balance Sheet', ''],
  ['acc_vat_report', 'ACCOUNTING', 'VAT/Tax Report (Sri Lanka)', ''],
  ['acc_bank_reconciliation', 'ACCOUNTING', 'Bank Reconciliation', ''],
  ['acc_cheque_calendar', 'ACCOUNTING', 'Post-Dated Cheque Calendar', ''],
  ['acc_petty_cash', 'ACCOUNTING', 'Petty Cash Module', ''],
  ['acc_expense_budgets', 'ACCOUNTING', 'Expense Categories with Budgets', ''],
  ['acc_year_end_closing', 'ACCOUNTING', 'Year-End Closing', ''],
  // STAFF
  ['staff_attendance', 'STAFF', 'Attendance', ''],
  ['staff_leave_tracker', 'STAFF', 'Leave Tracker', ''],
  ['staff_salary_advances', 'STAFF', 'Salary Advances Ledger', ''],
  ['staff_commission_autocalc', 'STAFF', 'Commission Auto-Calc (needs per-staff GP)', 'Blocked: no per-staff GP source exists yet'],
  ['staff_payroll_export', 'STAFF', 'Payroll Summary Export', ''],
  // REPORTS & ANALYTICS
  ['rep_top_slow_items', 'REPORTS', 'Top/Slow Items', ''],
  ['rep_heatmap', 'REPORTS', 'Sales by Category/Staff/Hour Heatmap', ''],
  ['rep_monthly_trends', 'REPORTS', 'Monthly Comparison Trends', ''],
  ['rep_margin_by_product', 'REPORTS', 'Profit Margin by Product', ''],
  ['rep_customer_ltv', 'REPORTS', 'Customer Lifetime Value', ''],
  ['rep_cashflow_forecast', 'REPORTS', 'Cash-Flow Forecast', ''],
  ['rep_daily_digest', 'REPORTS', "Owner's Daily Digest", ''],
  // COMMUNICATION
  ['com_email_facility', 'COMMUNICATION', 'Email Facility (SMTP)', ''],
  ['com_whatsapp_scheduling', 'COMMUNICATION', 'WhatsApp Report Scheduling', ''],
  ['com_sms_gateway', 'COMMUNICATION', 'SMS Gateway Stub', ''],
  ['com_birthday_greetings', 'COMMUNICATION', 'Birthday/Festival Greetings', ''],
  ['com_lowstock_autodraft', 'COMMUNICATION', 'Low-Stock Supplier Auto-Draft', ''],
  // SYSTEM
  ['sys_backup_scheduler', 'SYSTEM', 'DB Backup Scheduler + Restore', ''],
  ['sys_audit_log', 'SYSTEM', 'Audit Log Viewer', ''],
  ['sys_activity_dashboard', 'SYSTEM', 'Activity Dashboard per User', ''],
  ['sys_multilanguage', 'SYSTEM', 'Multi-Language (EN/Sinhala/Tamil)', ''],
  ['sys_theme_switcher', 'SYSTEM', 'Dark/Light/Nature Themes', ''],
  ['sys_keyboard_shortcuts', 'SYSTEM', 'Keyboard Shortcuts', ''],
  ['sys_printer_profiles', 'SYSTEM', 'Printer Profiles', ''],
  ['sys_import_wizard', 'SYSTEM', 'Data Import Wizard (Excel->DB)', ''],
  ['sys_api_keys', 'SYSTEM', 'API Keys Panel', ''],
  ['sys_session_timeout', 'SYSTEM', 'Session Timeout Policy', ''],
  ['sys_error_log', 'SYSTEM', 'Error-Log Viewer', ''],
  ['sys_health_page', 'SYSTEM', 'System Health Page', ''],
  // AI
  ['ai_anomaly_alerts', 'AI', 'Daily Anomaly Alerts (CHECKER)', ''],
  ['ai_nl_report_builder', 'AI', 'Natural-Language Report Builder', ''],
  ['ai_month_end_writer', 'AI', 'Month-End Summary Writer (VERA/NOVA)', ''],
  ['ai_demand_prediction', 'AI', 'Demand Prediction Stub (QUINN)', ''],
];

async function main() {
  const client = await pool.connect();
  try {
    for (const [key, cat, label, desc] of CORE) {
      await client.query(
        `INSERT INTO feature_flags (module_key,category,label,description,is_core,enabled,built)
         VALUES ($1,$2,$3,$4,true,true,true)
         ON CONFLICT (module_key) DO UPDATE SET category=$2,label=$3,description=$4,is_core=true`,
        [key, cat, label, desc]);
    }
    for (const [key, cat, label, desc] of DORMANT) {
      await client.query(
        `INSERT INTO feature_flags (module_key,category,label,description,is_core,enabled,built)
         VALUES ($1,$2,$3,$4,false,false,false)
         ON CONFLICT (module_key) DO NOTHING`,
        [key, cat, label, desc]);
    }
    const { rows } = await client.query(`SELECT category, COUNT(*), COUNT(*) FILTER (WHERE built) as built_count FROM feature_flags GROUP BY 1 ORDER BY 1`);
    console.table(rows);
  } finally {
    client.release(); await pool.end();
  }
}
main().catch(e => { console.error(e); process.exit(1); });
