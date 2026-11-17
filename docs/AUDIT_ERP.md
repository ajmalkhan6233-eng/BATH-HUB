# AUDIT_ERP: control audit of the real app (17 Nov 2026)

Method: **code read + database SCHEMA read only**. Checked against docs/ERP_CONTROL_CHECKLIST.md (170 tests). For this audit no shop data row was read or changed, and nothing was fixed. A separate test copy of the database could not be created (the database user has no CREATEDB right), so no transaction was run: every status below means "the code does / does not do this", with the file that proves it. Items marked PARTLY or BUILT are **not yet proven by a run**.

## Result
| | BUILT | PARTLY | NOT BUILT |
|---|---|---|---|
| MUST (1-92) | 34 | 40 | 18 |
| SHOULD (93-150) | 14 | 21 | 23 |
| NICE-TO-HAVE (151-170) | 7 | 7 | 6 |
| **TOTAL 170** | **55** | **68** | **47** |

## The five things you asked me to check first
| Claim | Verdict | Proof |
|---|---|---|
| Journal entries are manual only; nothing posts from GRN or POS | **CONFIRMED** | the only INSERT into acc_journal_entries is POST /api/journal-entries, routes/purchasing_accounting.js:318-340. routes/grn_workbench.js and routes/pos_bills.js never write a journal. P&L (:388) reads daily_summary, not the journals. |
| No day or period lock | **CONFIRMED** | no lock check anywhere. acc_year_end_closings (purchasing_accounting.js:571-595) only stores a record and blocks nothing. daily_summary.day_status is a label. |
| GRN bill edit has no audit line | **CONFIRMED** | routes/grn_workbench.js:414 (PUT /grn-workbench/bill/:id) deletes and rewrites lines and changes stock with no audit write. Only the new routes/grn_invoice.js (17 Nov) writes grn_audit, so the old edit path is still open. |
| VAT 18% is a placeholder | **CONFIRMED** | routes/purchasing_accounting.js:438 `const VAT_RATE = 0.18; // 18% placeholder`. Not configurable, not per item, no SSCL. |
| Vendor 360 does not show return item lists | **CONFIRMED** | routes/vendor360.js and public/vendor360.js never read vendor_return_lines; a return shows only as a credit-note row. The route routes/vendor_returns.js does not save lines either (table filled only by scripts/cool_return_lines.js). |

## The two chains
**Purchasing: PO -> GRN -> Bill -> Vendor ledger -> Payment -> Cheque -> Bank**
- PO (header only) -> GRN: linked by hand (PARTLY). GRN -> Bill -> Vendor ledger: BUILT, stock moves once, duplicates blocked, discount and return work (routes/grn_workbench.js, vendor_returns.js, vendorLedger.js). Payment -> Cheque: BUILT for one bill per payment; no advances, no multi-bill settlement. Cheque CLEARED -> bank ledger: **BROKEN LINK**, nothing posts to acc_bank_transactions; bank reconciliation is a manual tick.
- Nothing in this chain posts to the general ledger (see journal check), so the chain is reconcilable in the vendor ledger but **not** in the accounts.

**Sales: POS invoice -> Stock -> Customer/Cash ledger -> Accounting -> Day-end**
- POS invoice -> Stock (+ stock_movements): BUILT, one transaction, UNIQUE bill number, void restores stock. Customer ledger: PARTLY (credit_customers is a separate list, credit limits stored but never checked at sale). Accounting: **NOT BUILT** (no posting). Day-end: PARTLY (day sheet and cash proof exist, no close or lock). Sales return, refund, exchange: **NOT BUILT**.

## All 170 items
Status: BUILT / PARTLY / NOT BUILT. Proof = the file (and line) or table that shows it.

### MUST
| No. | Item | Status | Proof |
|---|---|---|---|
| 1 | Purchase Order (PO) | PARTLY | routes/purchasing_accounting.js:47 (PO header only: supplier, date, total; no item lines) |
| 2 | GRN against PO | PARTLY | routes/purchasing_accounting.js:65,90 (GRN is linked by hand or by a date/supplier guess, not received against PO lines) |
| 3 | PO-GRN-Bill matching | NOT BUILT | routes/purchasing_accounting.js:90 (match is supplier + date within 7 days; no quantity or price comparison) |
| 4 | Partial delivery | NOT BUILT | no ordered quantity anywhere, so nothing can be outstanding |
| 5 | Short delivery | PARTLY | routes/grn_workbench.js:90 (a GRN line can be short / not arrived; not compared with a PO) |
| 6 | Over-delivery | NOT BUILT | no over-delivery check |
| 7 | Duplicate GRN prevention | BUILT | routes/grn_workbench.js:82 billExists, routes/grn_dupes.js |
| 8 | Stock update | BUILT | routes/grn_workbench.js:300 applyLines under advisory lock + utils/stock_ledger.js |
| 9 | Supplier bill posting | BUILT | routes/grn_workbench.js:327, utils/vendorLedger.js billStatus |
| 10 | Vendor purchase return | BUILT | routes/vendor_returns.js (stock, average cost and payable move in one transaction) |
| 11 | Return documentation | PARTLY | routes/vendor_returns.js:20 (reason + bill required) but item lines are not saved by the route; table vendor_return_lines is filled only by scripts/cool_return_lines.js |
| 12 | Credit note | BUILT | routes/vendor_ledger.js:132 |
| 13 | Debit note | NOT BUILT | no debit note code anywhere |
| 14 | Purchase discount | BUILT | routes/vendor_returns.js (DISCOUNT kind), routes/grn_invoice.js (discount % / amount) |
| 15 | Editing posted GRNs | PARTLY | routes/grn_workbench.js:414 edits a posted bill with NO audit line (confirmed); only routes/grn_invoice.js writes grn_audit, so the old path is still open |
| 16 | GRN reversal | PARTLY | routes/grn_workbench.js:452 cancel voids the bill and takes stock back, but DELETEs the grn_records lines (history lost) |
| 17 | Back-dated purchase | BUILT | grn_records.grn_date vs created_at; vendor_bills.created_at |
| 18 | Landed cost | PARTLY | routes/purchasing_accounting.js:196 stores freight/duty per PO; nothing adds it to products.avg_cost |
| 19 | Supplier bill ledger | BUILT | routes/vendor_ledger.js:46,51; public/vendor360.js |
| 20 | Supplier payments | BUILT | routes/vendor_ledger.js:105 |
| 21 | Multiple bill settlement | NOT BUILT | payments attach to one bill only (vendor_ledger.js:105) |
| 22 | Unallocated payments | NOT BUILT | no supplier advance concept |
| 23 | Rounding differences | NOT BUILT | no rounding-difference adjustment with reason |
| 24 | Supplier ageing | BUILT | routes/purchasing_accounting.js:147 /supplier-aging; routes/vendor360.js overdue (code read, not run) |
| 25 | Supplier statement | PARTLY | routes/vendor360.js:70 statement with running balance, but no opening-balance line |
| 26 | Supplier reconciliation | PARTLY | statement + print (public/vendor360.js, routes/vendor_voucher.js); no compare-to-supplier-statement feature |
| 27 | Payment reference | PARTLY | vendor_payments has method, paid_at, note; no reference number or receiving account |
| 28 | Cheques issued | BUILT | routes/vendor_ledger.js:71; routes/cheque_register.js |
| 29 | Post-dated cheques | BUILT | utils/vendorLedger.js billStatus: only CLEARED cheques settle a bill, ISSUED only covers |
| 30 | Cheque presented | NOT BUILT | statuses are ISSUED / CLEARED / BOUNCED / CANCELLED only (vendor_ledger.js:15); no PRESENTED |
| 31 | Cheque cleared | PARTLY | vendor_ledger.js:101 sets CLEARED but posts nothing to acc_bank_transactions |
| 32 | Bounced cheque | BUILT | vendor_ledger.js:102; the bill balance returns because only CLEARED counts |
| 33 | Cancelled cheque | PARTLY | vendor_ledger.js:103 cancel exists; reason not mandatory |
| 34 | Stopped cheque | NOT BUILT | no stopped-cheque state |
| 35 | Cheques received | PARTLY | routes/cheque_register.js, routes/cheque_clearing.js; no automatic customer-ledger line |
| 36 | Received cheque bounce | PARTLY | cheque_register statuses; receivable restore not proven |
| 37 | Cheque duplication | BUILT | routes/cheque_register.js:99; routes/grn_workbench.js:190 |
| 38 | Bank reconciliation | PARTLY | routes/purchasing_accounting.js:459-492 manual match flag; no statement import or auto-match |
| 39 | Cash sale | BUILT | routes/pos_bills.js:157 (stock, items, payments, movements in one transaction) |
| 40 | Credit sale | PARTLY | routes/pos_ledger_bridge.js (credit part of bills is read-only; credit_customers is a separate list, server.js:2875) |
| 41 | Discount control | BUILT | routes/pos_bills.js:136-151, routes/shop_operations.js:131 discount_rules |
| 42 | Price override | PARTLY | pos_bills.discount_override flag only; no mandatory reason or approval |
| 43 | Held bill | BUILT | public/pos-draft.js, table bill_drafts (held bills kept per device) |
| 44 | Split payment | BUILT | table pos_bill_payments |
| 45 | Sales return | NOT BUILT | no customer sales-return module (only commission clawback, routes/sale_commissions.js:13) |
| 46 | Sales exchange | NOT BUILT | no exchange module |
| 47 | Refund | NOT BUILT | no customer refund posting |
| 48 | Sale void | BUILT | routes/pos_bill_corrections.js:103; table pos_bill_voids (stock_restored) |
| 49 | Negative stock | PARTLY | routes/pos_bills.js:281 sale allowed and logged in oversold (utils/oversold.js); not blocked, no approval |
| 50 | Shift opening | NOT BUILT | no shift open / float record (fixed env float, routes/audit.js:19) |
| 51 | Shift closing | PARTLY | day sheet has cash counted (public/daily-entry-v2.html); no shift close |
| 52 | Cash variance | NOT BUILT | no variance reason or responsible cashier |
| 53 | Receipt | BUILT | routes/pos_bills.js:420 receipt PDF, utils/receiptImage.js |
| 54 | Duplicate invoice | BUILT | pos_bills.bill_number UNIQUE (pos_bills.js:42) + idempotency (server.js:614) |
| 55 | Costing method | BUILT | utils/grn_math.js:9 weighted average |
| 56 | Stock movement history | PARTLY | routes/stock_ledger.js; stock_movements covers POS, GRN, voids; shop_operations stock-items adjust writes a different table (stock_adjustments) |
| 57 | Physical stocktake | PARTLY | routes/item_catalog.js:171 stock-take sheet export only; no count-vs-system compare |
| 58 | Stock adjustment | PARTLY | routes/shop_operations.js:224 reason from a fixed list; no approval |
| 59 | Stock adjustment history | PARTLY | stock_adjustments stores delta + reason only; no before/after |
| 60 | Duplicate item codes | BUILT | routes/item_catalog.js:104, routes/item_dupe_merge.js |
| 61 | Item master | PARTLY | products has code, name, category; no unit of measure column |
| 62 | Units of measure | PARTLY | utils/tileMath.js, routes/tile_tools.js (tiles only) |
| 63 | Barcode | BUILT | utils/barcode128.js, routes/grn_barcodes.js, public/pos-camera-scan.js |
| 64 | Reorder level | BUILT | products.reorder_threshold; routes/shop_operations.js:187 low-stock; utils/reorder.js |
| 65 | Stock valuation | PARTLY | routes/dashboard_breakdown.js:57 stock value by category; not reconciled to the ledger |
| 66 | Double-entry accounting | PARTLY | routes/purchasing_accounting.js:318 each entry is one debit + one credit (always balanced) but entered by hand only (confirmed) |
| 67 | Chart of accounts | PARTLY | routes/purchasing_accounting.js:265 chart exists; nothing posts to it automatically |
| 68 | Sales accounting | NOT BUILT | a POS sale posts no journal (confirmed) |
| 69 | Purchase accounting | NOT BUILT | a GRN / bill posts no journal (confirmed) |
| 70 | Journal entries | BUILT | routes/purchasing_accounting.js:318 balanced by construction |
| 71 | Trial balance | BUILT | routes/purchasing_accounting.js:365 (only sees manual journals) |
| 72 | Profit and loss | PARTLY | routes/purchasing_accounting.js:388 reads daily_summary, not the journals |
| 73 | Balance sheet | PARTLY | routes/purchasing_accounting.js:410 from journals; equation not enforced |
| 74 | Day-end closing | PARTLY | daily_summary.day_status + routes/daily_entry_sync.js; no close action that locks the day |
| 75 | Period lock | NOT BUILT | no period or day lock (confirmed); acc_year_end_closings (purchasing_accounting.js:571-595) is only a record and blocks nothing |
| 76 | No permanent deletion | PARTLY | bills are voided not deleted (vendor_ledger.js:143, pos_bill_voids); but GRN cancel deletes lines (grn_workbench.js:461) |
| 77 | Reversal integrity | BUILT | routes/pos_bill_corrections.js:103,206; routes/vendor_ledger.js:143 (original stays visible) |
| 78 | Cash reconciliation | PARTLY | routes/audit.js:234 cash proof with a fixed float; no drawer count link |
| 79 | Customer credit limit | PARTLY | routes/shop_operations.js:94 limits stored; routes/pos_bills.js never checks them |
| 80 | Customer ledger | PARTLY | server.js:2875 credit_customers; not linked to bills automatically |
| 81 | Customer ageing | BUILT | public/credit_aging.html; routes/dashboard_pro.js:83 |
| 82 | Customer payments | PARTLY | credit_customers paid column; no payment allocation record |
| 83 | Cheques received | BUILT | routes/cheque_register.js |
| 84 | Customer statement | NOT BUILT | no customer statement |
| 85 | Individual login | BUILT | routes/admin_core.js (users, staff_logins) |
| 86 | Role-based access | BUILT | server.js:279-300, utils/cashierGate.js |
| 87 | Approval control | PARTLY | owner-only void / return (pos_bill_corrections.js, vendor_returns.js:19); no approval workflow |
| 88 | Audit log | PARTLY | money_audit_log (vendor_ledger, vendor_returns, attachments), record_history, pos_bill_history, admin_audit; GRN workbench edit logs nothing |
| 89 | Audit protection | PARTLY | no edit route for audit tables, but no database trigger or protection |
| 90 | Automatic backup | BUILT | scripts/backup_owner_db.ps1 (every 30 min, files in backups/) |
| 91 | Backup integrity | BUILT | scripts/audit/backup_check.js |
| 92 | Restore test | PARTLY | scripts/restore_test.ps1, scripts/restore_encrypted_backup.js exist; no evidence of a scheduled restore test |

### SHOULD
| No. | Item | Status | Proof |
|---|---|---|---|
| 93 | Purchase approval | NOT BUILT | no purchase approval limit |
| 94 | Supplier price history | PARTLY | table price_history, routes/purchasing_accounting.js:109 supplier prices |
| 95 | Purchase price variance | PARTLY | utils/supplierPriceAlerts.js (alerts on a price change, not against PO) |
| 96 | Purchase tolerance | NOT BUILT | no tolerance settings |
| 97 | Supplier return tracking | PARTLY | routes/vendor_credit.js; vendor_pending_items; no returns report with pending credits |
| 98 | Supplier advance settlement | NOT BUILT | no advances |
| 99 | Supplier balance confirmation | NOT BUILT | no balance-confirmation feature |
| 100 | Purchase commitments | NOT BUILT | no PO quantities, so no commitments report |
| 101 | Cheque maturity alerts | BUILT | utils/chequeAlerts.js |
| 102 | Cheque register | PARTLY | routes/cheque_register.js (filters not proven) |
| 103 | Bank charges | PARTLY | acc_bank_transactions.txn_type is free text; acc_expense_categories exists |
| 104 | Unpresented cheques | BUILT | routes/vendor_ledger.js:174, routes/cheque_clearing.js |
| 105 | Deposit tracking | PARTLY | table cheque_deposits |
| 106 | Bank reconciliation history | NOT BUILT | no reconciliation sessions kept |
| 107 | Cashier permissions | PARTLY | utils/cashierGate.js allow-list; no per-cashier price permission |
| 108 | Refund approval | NOT BUILT | no refunds |
| 109 | Suspended sales reporting | NOT BUILT | held bills live in the browser; no report |
| 110 | Cash drawer control | NOT BUILT | no drawer control |
| 111 | Cash movement | PARTLY | day sheet cash in / out lines (daily_summary.cash_in, cash_out) |
| 112 | Daily cashier report | PARTLY | routes/staff_reports.js |
| 113 | Payment reconciliation | PARTLY | routes/daily_breakdown.js, table daily_payment_breakdown |
| 114 | Offline operation | BUILT | public/offline-queue.js, server.js:614 idempotency |
| 115 | Multiple warehouses | NOT BUILT | one stock_level per product; branches table has no stock |
| 116 | Transfer documentation | NOT BUILT | no transfers |
| 117 | In-transit stock | NOT BUILT | no in-transit |
| 118 | Stock reservation | NOT BUILT | no reservations |
| 119 | Tile box conversion | BUILT | utils/tileMath.js |
| 120 | Fractional quantities | BUILT | quantity numeric(12,3) |
| 121 | Shade and calibre | NOT BUILT | no shade or calibre |
| 122 | Batch traceability | NOT BUILT | no batch tracking |
| 123 | Damaged stock | PARTLY | GRN line can be marked damaged (grn_workbench.js:90) but no separate damaged-stock bucket |
| 124 | Slow-moving inventory | NOT BUILT | no slow-moving report found |
| 125 | Dead stock | NOT BUILT | no dead-stock report found |
| 126 | Gross profit | BUILT | routes/profit.js, routes/sale_profit.js, utils/margin.js use stored cost |
| 127 | Reorder suggestions | BUILT | utils/reorder.js, utils/reorder_forecast.js |
| 128 | Stock reservation release | NOT BUILT | no reservations |
| 129 | Tax configuration | NOT BUILT | routes/purchasing_accounting.js:438 VAT_RATE = 0.18 hard-coded placeholder (confirmed) |
| 130 | Tax reporting | PARTLY | routes/purchasing_accounting.js:439 VAT report from daily_summary and GRN totals at that placeholder rate |
| 131 | Expense classification | PARTLY | acc_expense_categories, expenses_detail |
| 132 | Owner drawings | NOT BUILT | no owner-drawings concept |
| 133 | Petty cash | BUILT | routes/purchasing_accounting.js:511 acc_petty_cash_txns |
| 134 | Cash-flow reporting | NOT BUILT | no cash-flow statement |
| 135 | Gross margin report | PARTLY | routes/profit.js, utils/margin.js (item and invoice level; category not proven) |
| 136 | Sales performance | PARTLY | routes/pos_bills.js:334,371; routes/staff_reports.js |
| 137 | Profit reconciliation | NOT BUILT | no reconciliation of sales-report profit to a ledger (no ledger postings exist) |
| 138 | Historical reporting | PARTLY | trial balance as-of date works; stock and other reports are current-state only |
| 139 | Opening balances | PARTLY | utils/freshStart.js, scripts/import_opening_grn.js; no single opening-balance screen |
| 140 | Financial export | PARTLY | routes/vendor_ledger.js:180 export.csv, routes/admin_core.js:192; no trial-balance export |
| 141 | Password security | BUILT | routes/admin_core.js:68 (12+ characters, bcrypt 12) |
| 142 | Session timeout | PARTLY | server.js:186 fixed 12 h cookie, not idle timeout |
| 143 | Login history | BUILT | table login_audit; routes/admin_core.js:55 |
| 144 | Approval history | NOT BUILT | no approval workflow, so no approval history |
| 145 | Concurrent transactions | PARTLY | advisory locks in GRN code; POS sale is not blocked on low stock (see 49) |
| 146 | Transaction numbering | BUILT | bill_number UNIQUE (pos_bills.js:42) |
| 147 | Database integrity | BUILT | scripts/audit/invariants.js (read-only rules) |
| 148 | Error recovery | BUILT | BEGIN / ROLLBACK in routes/pos_bills.js, routes/grn_workbench.js, routes/grn_invoice.js |
| 149 | Backup retention | BUILT | scripts/backup_rotate.js (14 local) + encrypted copy to D:\BathHubBackups |
| 150 | Data export | PARTLY | pg_dump SQL backups and CSV exports; no full record export |

### NICE-TO-HAVE
| No. | Item | Status | Proof |
|---|---|---|---|
| 151 | Supplier performance dashboard | NOT BUILT | no supplier performance dashboard |
| 152 | Automatic purchase suggestions | PARTLY | utils/reorder_forecast.js |
| 153 | Barcode label printing | BUILT | utils/barcode128.js, routes/grn_barcodes.js |
| 154 | QR-code receipts | PARTLY | routes/qr_svg.js (QR present; receipt lookup not proven) |
| 155 | Customer WhatsApp receipts | BUILT | utils/whatsappReceiptSender.js, utils/autoReceipt.js |
| 156 | WhatsApp payment reminders | NOT BUILT | no customer payment reminder found |
| 157 | Customer purchase history | PARTLY | customers table, pos-bills search |
| 158 | Sales forecasting | PARTLY | routes/business_intelligence.js (forecast not proven) |
| 159 | AI anomaly detection | PARTLY | utils/auditInvariants.js, table agent_checks (rule based, not AI) |
| 160 | Management dashboard | BUILT | routes/dashboard_pro.js (but mixes sources, see mistake 23) |
| 161 | Mobile stocktaking | NOT BUILT | no mobile stocktake |
| 162 | Multi-branch support | PARTLY | routes/branches.js; no branch stock or transfers |
| 163 | Supplier portal | NOT BUILT | no supplier portal |
| 164 | Customer quotations | BUILT | table quotations, public/pos-quote.js, pos_quotation_billed |
| 165 | Delivery management | BUILT | routes/pending_delivery.js |
| 166 | Installation/service tracking | NOT BUILT | only enquiries / leads (routes/enquiries.js) |
| 167 | Automated alerts | BUILT | utils/notify.js, routes/notifications.js (one 06:00 message) |
| 168 | AI-assisted bill entry | BUILT | routes/grn_read.js, routes/grn_match.js |
| 169 | Multi-currency support | NOT BUILT | no multi-currency |
| 170 | Business audit export | PARTLY | separate exports only; no single period audit export |

## The 30 common mistakes: present in this app?
| No. | Mistake | Here | Proof |
|---|---|---|---|
| 1 | Stock updated twice (GRN + bill) | PARTLY | GRN is the one posting (grn_workbench.js:300), but a second stock table stock_items exists (shop_operations.js:177) |
| 2 | Supplier bills without GRN | PRESENT | BILL_ONLY mode, grn_workbench.js validatePackage; POST /vendor-ledger/bills |
| 3 | Duplicate GRNs | AVOIDED | grn_workbench.js:82, routes/grn_dupes.js |
| 4 | Old transactions edited without history | PRESENT | grn_workbench.js:414 (fixed only inside grn_invoice.js) |
| 5 | Posted invoices deleted | PARTLY | POS and bills are voided; GRN cancel deletes grn_records (grn_workbench.js:461) |
| 6 | Post-dated cheque treated as cash | AVOIDED | utils/vendorLedger.js billStatus |
| 7 | Bounced cheque treated as paid | AVOIDED | vendor_ledger.js:102 |
| 8 | Owner withdrawals mixed with expenses | PRESENT | no drawings concept |
| 9 | Every payment treated as an expense | PARTLY | payments are tied to bills; salary/expenses on the day sheet are separate |
| 10 | Profit = price minus latest cost | AVOIDED | average cost, utils/grn_math.js |
| 11 | Discounts ignored in profit | AVOIDED | pos_bills.total is after discount |
| 12 | Negative stock without control | PARTLY | allowed and logged in oversold, pos_bills.js:281 |
| 13 | Damaged or missing goods not recorded | PARTLY | GRN line damaged/short flags; adjustment reasons limited to restock/sale/correction |
| 14 | Showroom and warehouse mixed | PRESENT | one stock_level per product |
| 15 | Customer deposits counted as sales | NOT CHECKED | no deposit code found |
| 16 | Supplier advances treated as expenses | PRESENT | no advance concept |
| 17 | Staff can override selling prices | PARTLY | discount cap exists; price override has no reason or approval |
| 18 | Cashiers can delete or edit own transactions | AVOIDED | utils/cashierGate.js allow-list |
| 19 | Physical cash not reconciled | PARTLY | audit.js:234 cash proof; no shift counts |
| 20 | Floating-point money | PARTLY | database columns are numeric; JavaScript round2 maths in utils/grn_math.js |
| 21 | Invoice date vs entry date | AVOIDED | grn_date / bill_date plus created_at |
| 22 | Closed periods reopened | N/A | there are no locked periods |
| 23 | Reports from different sources | PRESENT | P&L from daily_summary, trial balance from manual journals, profit from POS bills |
| 24 | Backups never restored | PARTLY | restore_test.ps1 exists, no schedule seen |
| 25 | Everyone is administrator | AVOIDED | server.js:279-300 roles |
| 26 | Tile unit conversions ignored | AVOIDED | utils/tileMath.js |
| 27 | Tile shades and batches mixed | PRESENT | no shade or batch fields |
| 28 | Pending deliveries counted as sales | PARTLY | routes/pending_delivery.js exists; link to sale status not proven |
| 29 | Pending supplier credits counted as money | PARTLY | vendor_pending_items; credits only counted once saved as credit notes |
| 30 | Gross profit without landed cost | PRESENT | landed cost never reaches avg_cost |

## Top 10 NOT BUILT (by risk to money and stock)
1. **Automatic accounting postings from GRN, bills, payments and POS sales (68, 69, 66-67)**: the accounts and the shop can never agree; trial balance only sees hand-typed journals
2. **Day / period lock (75, 74)**: any old day or bill can still be changed
3. **Customer sales return, refund and exchange (45, 46, 47)**: a returned tile has no stock or cash record
4. **PO lines with ordered vs received vs billed quantity (3, 4, 6, 100)**: no 3-way match, no outstanding or over-delivery
5. **Configurable tax: VAT / SSCL (129)**: the 18% placeholder is hard-coded
6. **Multi-bill payments and supplier advances (21, 22)**: one payment cannot settle two bills; advances have nowhere to go
7. **Cashier shift open / close and cash variance with reason (50, 52)**: cash shortages have no owner or reason
8. **Cheque PRESENTED and STOPPED states, and bank posting on clear (30, 34, 31)**: the bank ledger does not follow cheques
9. **Debit note (13)**: no way to record an extra charge by a supplier
10. **Approval workflow and approval history (93, 144, 108)**: no limits that need a second person

Counts: BUILT 55, PARTLY 68, NOT BUILT 47 (of 170).
