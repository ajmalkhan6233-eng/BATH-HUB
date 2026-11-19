# AUDIT (Phase 2, from CODE only, read-only, 2026-11-03)
PROPOSED decisions. Real use since 22 Oct needs the shop database (PC step, query at bottom). Nothing was changed. Gate: Ajmal's YES before anything is hidden.
M1 GRN+payable  M2 Sales/POS  M3 Vendors+cheques  M4 Money  M5 Loans  M6 Stock

Counts (pages+routes+tables): KEEP 106 | HIDE 36 | ARCHIVE 2
## PAGES (48)
HIDE | accounting.html | full accounting: too heavy for simple app
HIDE | admin_audit.html | audit log viewer
HIDE | admin_corrections.html | corrections
KEEP | admin_settings.html | admin settings
HIDE | admin_system.html | system page
KEEP | admin_users.html | users (minimal)
KEEP | assistant.html | assistant chat (Layla side)
HIDE | audit_accounting.html | accounting audit
KEEP | bathco_complete.html | owner app shell /owner (menu lives here)
KEEP | bathhub.html | front door /
KEEP | cheque_clearing.html | M3 cheque clearing Fri->Mon rule
KEEP | cheque_register.html | M3 cheques
KEEP | credit_aging.html | M2 credit customers
KEEP | customers.html | M2 customers
KEEP | daily-breakdown.html | M4 daily breakdown
KEEP | daily-entry-v2.html | M2 daily entry
KEEP | documents.html | M1 uploads (add Download+Remove)
KEEP | home_simple.html | simple home
KEEP | investor-view.html | M5 investor read-only view
KEEP | investor_loans.html | M5 loans
KEEP | items_import.html | M6 item list import
KEEP | labels.html | M6 labels
KEEP | labels_a4.html | M6 labels A4
KEEP | layla-owner.html | Layla (stays)
KEEP | money-control.html | M4 money
KEEP | money-plan.html | M4 money plan
KEEP | morning-brief.html | morning brief (stays)
KEEP | pending_delivery.html | M1 awaiting-delivery checklist
KEEP | pos-ledger.html | M2 POS ledger
KEEP | pos_billing.html | M2 POS
KEEP | prices.html | M6 prices
KEEP | profit.html | M4 profit
KEEP | purchasing.html | M1 GRN / purchasing
HIDE | quotations.html | quotes: check DB use first
HIDE | reports_analytics.html | analytics: heavy
KEEP | reports_hub.html | M4 reports entry
KEEP | sale_commissions.html | M4 commission 5% weekly
KEEP | settings.html | settings
KEEP | setup.html | first-run setup
KEEP | staff.html | M4 salary / staff
HIDE | staff_logins.html | extra logins: not wanted
KEEP | stickers.html | M6 stickers
KEEP | stock_helper.html | M6 stock
HIDE | sync-review.html | sync review: reachable from settings if needed
KEEP | vendor-credit.html | M1 vendor payable
KEEP | vendor-ledger.html | M1/M3 vendor ledger
KEEP | vendor360.html | M3 vendor view
KEEP | vendors_overview.html | M3 vendors

## ROUTE FILES (mounted in server.js)
HIDE | routes/purchasing_accounting.js | pur_* imports/landed cost: not an accessories-shop need
KEEP | routes/staff_reports.js | M4
HIDE | routes/audit.js | audit
ARCHIVE | routes/apex_admin.js | platform admin, not shop UI
KEEP | routes/investor_loans.js | M5
KEEP | routes/sale_commissions.js | M4
KEEP | routes/shop_operations.js | core
KEEP | routes/pos_bill_corrections.js | M2
KEEP | routes/agent_outbox.js | Layla
KEEP | routes/pos_ledger_bridge.js | M2
KEEP | routes/attachments.js | M1 uploads
HIDE | routes/site_editor.js | website editor
HIDE | routes/corrections.js | corrections
KEEP | routes/admin_core.js | admin
KEEP | routes/backup_status.js | backups
KEEP | routes/app_settings.js | settings
KEEP | routes/pos_bills.js | M2
KEEP | routes/daily_sales_live.js | M2
KEEP | routes/cheque_register.js | M3
KEEP | routes/cheque_clearing.js | M3
KEEP | routes/payment_planner.js | M3/M4
KEEP | routes/items_import.js | M6
KEEP | routes/vendor360.js | M3
KEEP | routes/vendor_credit.js | M1
KEEP | routes/money_plan.js | M4
KEEP | routes/daily_entry_sync.js | M2 offline sync
HIDE | routes/business_intelligence.js | heavy
KEEP | routes/money_control.js | M4
KEEP | routes/daily_breakdown.js | M4
KEEP | routes/item_catalog.js | M6
KEEP | routes/qr_svg.js | labels
KEEP | routes/item_prices.js | M6
KEEP | routes/dashboard_pro.js | dashboard
KEEP | routes/dashboard_breakdown.js | dashboard
KEEP | routes/profit.js | M4
KEEP | routes/report_data.js | M4
HIDE | routes/staff_logins.js | extra logins
KEEP | routes/stock_helper.js | M6
KEEP | routes/cheque_plan.js | M3
KEEP | routes/attention.js | alerts
KEEP | routes/bill_watch.js | M1 bill checks
KEEP | routes/pending_delivery.js | M1
KEEP | routes/oversold.js | M2/M6 oversell warn
KEEP | routes/grn_manual.js | M1
KEEP | routes/grn_read.js | M1
HIDE | routes/test_mode.js | test switch
KEEP | routes/grn_barcodes.js | M6
KEEP | routes/invoice_receipts.js | M1
KEEP | routes/agent_rulebook.js | Layla
HIDE | routes/enquiries.js | online enquiries: check use
HIDE | routes/content_calendar.js | marketing
HIDE | routes/competitors.js | marketing
HIDE | routes/catalogue_feed.js | website feed
KEEP | routes/reply_drafts.js | Layla drafts
HIDE | routes/policy_notes.js | notes
HIDE | routes/branches.js | single shop
ARCHIVE | routes/tile_tools.js | tiles: accessories shop sells none
KEEP | routes/agent_brain.js | Layla
KEEP | routes/salary.js | M4 salary
KEEP | routes/document_inbox.js | M1 inbox
KEEP | routes/documents.js | M1
KEEP | routes/investor_contacts.js | M5
KEEP | routes/notifications.js | 06:00 notice

## TABLES (test schema, 33)
KEEP | products | M6
KEEP | grn_records | M1
KEEP | suppliers | M1/M3
KEEP | supplier_payments | M1/M3
KEEP | cheques | M3
KEEP | customers | M2
KEEP | credit_customers | M2
KEEP | daily_summary | M4 golden core
KEEP | daily_reports | M4
KEEP | expenses_detail | M4 golden core
KEEP | staff | M4
KEEP | staff_salary | M4 golden core
KEEP | staff_loans | M4 golden core
KEEP | users | login
KEEP | session | login
KEEP | feature_flags | modules on/off base
KEEP | alerts | alerts
KEEP | conversations | Layla
KEEP | whatsapp_draft_entries | Layla
HIDE | login_audit | audit
HIDE | acc_bank_transactions | full accounting
HIDE | acc_chart_of_accounts | full accounting
HIDE | acc_expense_categories | full accounting
HIDE | acc_journal_entries | full accounting
HIDE | acc_petty_cash_txns | check: petty cash may be useful in M4
HIDE | acc_year_end_closings | full accounting
HIDE | audit_invoice_items | audit
HIDE | pur_landed_costs | imports
HIDE | pur_purchase_orders | imports
HIDE | pur_shipments | imports
HIDE | pur_supplier_prices | imports
HIDE | quotation_items | quotes
HIDE | quotations | quotes

## PC STEP: what was really used since 22 Oct (read-only SQL, run in psql on the shop DB)
SELECT relname AS table, n_live_tup AS rows FROM pg_stat_user_tables ORDER BY n_live_tup DESC;
Tables with 0 rows = safe HIDE. Tell Claude Code to paste the result into AI_MEMORY/AUDIT_USAGE.txt.

## NEW 6-ITEM MENU (proposal, keeps top bar Home / File / Sales / Customers & Online and left Dashboard)
Dashboard | 1 GRN + Payable | 2 Sales (POS) | 3 Vendors + Cheques | 4 Money | 5 Loans | 6 Stock   (+ Super Dashboard shortcut, Layla, Morning brief)
