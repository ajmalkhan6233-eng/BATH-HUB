# Standard ERP/POS control checklist: tile and bathroom-fittings shop (Sri Lanka)

A practical audit checklist for a small retail and wholesale business. It tests whether the ERP actually **controls** purchasing, stock, cash, suppliers, customers and accounting, not whether it has screens.

**How to use:** PASS = behaves correctly and produces the expected records. FAIL = allows a wrong transaction, loses information, or gives a wrong balance. NOT TESTED = not performed. Every FAIL becomes a development task. Test on a copy of the database or a test company, never live financial records.

---

## 1. MUST: essential ERP controls
An ERP is not financially reliable if these fail.

### A. Purchasing, PO, GRN and supplier bills
| No. | Rule | Pass/fail test |
|---|---|---|
| 1 | Purchase Order (PO) | Create a PO; supplier, items, quantities, prices and totals are saved. |
| 2 | GRN against PO | Receive goods against a PO; received quantities update correctly. |
| 3 | PO-GRN-Bill matching | Enter a supplier bill; check its quantities and prices against the PO and GRN. |
| 4 | Partial delivery | Order 100 taps, receive 60: 60 received, 40 outstanding. |
| 5 | Short delivery | Order 100, receive 90: the missing 10 are recorded, not silently accepted. |
| 6 | Over-delivery | Order 100, receive 110: the excess triggers an authorised exception. |
| 7 | Duplicate GRN prevention | Enter the same supplier delivery reference twice: warned or blocked. |
| 8 | Stock update | Post a GRN: stock increases exactly once. |
| 9 | Supplier bill posting | Post a supplier bill: accounts payable increases correctly. |
| 10 | Vendor purchase return | Return 5 items: stock decreases by 5 and supplier credit is recorded. |
| 11 | Return documentation | A return needs item, quantity, reason, supplier and the original GRN/bill reference. |
| 12 | Credit note | Enter a supplier credit note: payable decreases correctly. |
| 13 | Debit note | Enter a supplier debit note: the supplier account adjustment is recorded. |
| 14 | Purchase discount | Enter a supplier discount: inventory valuation and payable are both correct. |
| 15 | Editing posted GRNs | Try to edit a posted GRN: restricted, or recorded with an audit trail. |
| 16 | GRN reversal | Reverse a posted GRN: stock and accounting entries reverse exactly once. |
| 17 | Back-dated purchase | Enter a historical GRN: both transaction date and actual entry date are recorded. |
| 18 | Landed cost | Add freight and other direct costs: inventory cost is adjusted correctly. |

### B. Vendor ledger and accounts payable
| No. | Rule | Pass/fail test |
|---|---|---|
| 19 | Supplier bill ledger | Enter three supplier bills: all appear under the correct supplier. |
| 20 | Supplier payments | Make a partial payment: the outstanding bill balance decreases correctly. |
| 21 | Multiple bill settlement | Pay two bills with one payment: allocation is recorded against both. |
| 22 | Unallocated payments | Enter an advance payment: it shows as a supplier advance, not an unexplained expense. |
| 23 | Rounding differences | Settle with a small rounding difference: needs a reason and an authorised adjustment. |
| 24 | Supplier ageing | Unpaid bills fall in the right buckets: current, 30, 60, 90+ days. |
| 25 | Supplier statement | Statement shows opening balance, bills, payments, adjustments, closing balance. |
| 26 | Supplier reconciliation | Compare ERP balance with a supplier statement: differences can be identified. |
| 27 | Payment reference | Every payment records date, amount, method, reference and receiving account. |

### C. Cheque management
| No. | Rule | Pass/fail test |
|---|---|---|
| 28 | Cheques issued | Issue a cheque to a supplier: cheque register and supplier ledger update. |
| 29 | Post-dated cheques | A future-dated cheque is not treated as cleared cash or bank money. |
| 30 | Cheque presented | Mark presented: status changes without duplicating payment. |
| 31 | Cheque cleared | Mark cleared: bank ledger updates correctly. |
| 32 | Bounced cheque | Mark bounced: payment reverses and the liability is restored. |
| 33 | Cancelled cheque | Cancel an issued cheque: reason and reversal are recorded. |
| 34 | Stopped cheque | Record a stop-payment: the cheque cannot count as successfully paid. |
| 35 | Cheques received | Receive a customer cheque: it appears in the cheque register and customer ledger. |
| 36 | Received cheque bounce | Bounce a received cheque: the customer receivable is restored. |
| 37 | Cheque duplication | Enter an existing cheque number for the same bank/account: duplicate detected. |
| 38 | Bank reconciliation | Compare recorded bank transactions with a statement; find outstanding and unmatched items. |

### D. POS and sales
| No. | Rule | Pass/fail test |
|---|---|---|
| 39 | Cash sale | Sell for cash: stock, sales and cash balances update. |
| 40 | Credit sale | Credit sale: customer receivable increases. |
| 41 | Discount control | A discount cannot exceed the user's permission. |
| 42 | Price override | Manual price change needs authorisation and a reason. |
| 43 | Held bill | Hold a sale, close POS, reopen: the sale is retained. |
| 44 | Split payment | Pay Rs 10,000 as Rs 4,000 cash + Rs 6,000 card: both methods recorded. |
| 45 | Sales return | Return an item: stock and customer refund/credit are recorded. |
| 46 | Sales exchange | Exchange one item for another: both stock movements recorded. |
| 47 | Refund | Refund a customer: the correct cash/bank account is reduced. |
| 48 | Sale void | Void a posted sale: stock and accounting reverse, with an audit record. |
| 49 | Negative stock | Sell 5 when 3 exist: configured restriction or authorised exception. |
| 50 | Shift opening | Open a cashier shift and record the opening float. |
| 51 | Shift closing | Close the shift and compare expected with counted cash. |
| 52 | Cash variance | Record a shortage or excess with a reason and the responsible cashier. |
| 53 | Receipt | Receipt shows invoice number, date, items, quantities, discounts, payment, balance. |
| 54 | Duplicate invoice | Posting the same invoice twice is prevented. |

### E. Inventory management
| No. | Rule | Pass/fail test |
|---|---|---|
| 55 | Costing method | Configure FIFO or weighted average and verify the valuation calculation. |
| 56 | Stock movement history | Trace an item's opening stock, purchases, sales, returns and adjustments. |
| 57 | Physical stocktake | Count actual stock and compare with system stock. |
| 58 | Stock adjustment | Adjusting stock needs a reason, user and approval where appropriate. |
| 59 | Stock adjustment history | Every adjustment records before quantity, after quantity and difference. |
| 60 | Duplicate item codes | Creating an existing SKU/barcode again is blocked. |
| 61 | Item master | Unique item code, description, unit of measure and category are required. |
| 62 | Units of measure | Box, piece, set and other units convert correctly. |
| 63 | Barcode | Scanning a barcode shows the correct SKU and price. |
| 64 | Reorder level | Set minimum stock: low-stock alerts work. |
| 65 | Stock valuation | Inventory valuation matches the stock ledger and costing method. |

### F. Accounting and financial controls
| No. | Rule | Pass/fail test |
|---|---|---|
| 66 | Double-entry accounting | Post a transaction: total debits equal total credits. |
| 67 | Chart of accounts | Every transaction posts to the correct account category. |
| 68 | Sales accounting | A sale posts revenue, tax if any, cash/receivable and cost of goods sold correctly. |
| 69 | Purchase accounting | A purchase posts inventory and supplier payable correctly. |
| 70 | Journal entries | A journal must balance (debit = credit) before posting. |
| 71 | Trial balance | Total debit equals total credit. |
| 72 | Profit and loss | Revenue, discounts, cost of sales and expenses are classified correctly. |
| 73 | Balance sheet | Assets equal liabilities plus equity. |
| 74 | Day-end closing | Close a business day: all posted transactions are included. |
| 75 | Period lock | Lock a period: ordinary users cannot back-date or modify its transactions. |
| 76 | No permanent deletion | Deleting a posted transaction is not allowed; only an authorised reversal. |
| 77 | Reversal integrity | Reverse a transaction: original and reversal both stay visible. |
| 78 | Cash reconciliation | Physical cash, POS cash and accounting cash can be reconciled. |

### G. Customers and receivables
| No. | Rule | Pass/fail test |
|---|---|---|
| 79 | Customer credit limit | A sale above the credit limit needs approval. |
| 80 | Customer ledger | Invoices, payments, returns and adjustments appear under the right customer. |
| 81 | Customer ageing | Overdue customer balances by ageing period. |
| 82 | Customer payments | Partial and full payments update outstanding balances. |
| 83 | Cheques received | A customer cheque's status and amount are visible. |
| 84 | Customer statement | Statement with opening balance, invoices, receipts, closing balance. |

### H. Security, audit and backup
| No. | Rule | Pass/fail test |
|---|---|---|
| 85 | Individual login | Two employees have separate user identities. |
| 86 | Role-based access | A cashier cannot reach administrator functions. |
| 87 | Approval control | A restricted refund, discount or stock adjustment needs approval. |
| 88 | Audit log | Changing a posted transaction records old value, new value, user, date and reason. |
| 89 | Audit protection | Ordinary users cannot edit or delete an audit record. |
| 90 | Automatic backup | Backups are created on the configured schedule. |
| 91 | Backup integrity | A backup file exists and is readable. |
| 92 | Restore test | Restore into a separate test environment; transaction and stock balances match. |

---

## 2. SHOULD: strong operational and financial controls
Important for a professionally managed shop; on the roadmap if missing.

### A. Purchasing and supplier management
| No. | Rule | Pass/fail test |
|---|---|---|
| 93 | Purchase approval | A purchase above the limit needs manager approval. |
| 94 | Supplier price history | An item shows previous purchase prices and suppliers. |
| 95 | Purchase price variance | A bill price higher than the PO price shows a variance warning. |
| 96 | Purchase tolerance | Configure acceptable quantity and price differences; exceptions are flagged. |
| 97 | Supplier return tracking | Report of returned goods, pending supplier credits, completed refunds. |
| 98 | Supplier advance settlement | Apply an advance to a new bill: outstanding is correct. |
| 99 | Supplier balance confirmation | Compare supplier ledger at a date against external statements. |
| 100 | Purchase commitments | Report of ordered, received and outstanding quantities. |

### B. Cheques and banking
| No. | Rule | Pass/fail test |
|---|---|---|
| 101 | Cheque maturity alerts | A post-dated cheque raises an alert before its due date. |
| 102 | Cheque register | Filter issued and received cheques by status, date, bank, counterparty. |
| 103 | Bank charges | Bank charges post to the correct expense account. |
| 104 | Unpresented cheques | Report of issued cheques not yet cleared. |
| 105 | Deposit tracking | A customer cheque deposit can be tracked until clearance. |
| 106 | Bank reconciliation history | Reopen a past reconciliation: matched and unmatched items are there. |

### C. POS and cashier operations
| No. | Rule | Pass/fail test |
|---|---|---|
| 107 | Cashier permissions | A cashier price change follows the configured permission. |
| 108 | Refund approval | A refund above the threshold needs manager approval. |
| 109 | Suspended sales reporting | Report of held bills and the responsible cashier. |
| 110 | Cash drawer control | The drawer cannot be opened without a permitted transaction. |
| 111 | Cash movement | Cash paid out or added to the drawer needs a reason. |
| 112 | Daily cashier report | Cashier-wise sales, discounts, refunds, cash and variances. |
| 113 | Payment reconciliation | Card, transfer, cash and cheque payments agree with POS totals. |
| 114 | Offline operation | Disconnect, make a permitted test sale, reconnect: safe synchronisation. |

### D. Inventory and tile-shop-specific controls
| No. | Rule | Pass/fail test |
|---|---|---|
| 115 | Multiple warehouses | Transfer between showroom and warehouse: both balances update. |
| 116 | Transfer documentation | Each transfer has source, destination, quantity, reference. |
| 117 | In-transit stock | Transferred stock is not available at both places. |
| 118 | Stock reservation | Reserve 20 for a customer: available stock falls, physical stock does not. |
| 119 | Tile box conversion | 10 boxes of 1.44 sqm = 14.40 sqm. |
| 120 | Fractional quantities | Decimal quantities for tiles, lengths and measured goods. |
| 121 | Shade and calibre | Different shades or calibres can be told apart. |
| 122 | Batch traceability | Two batches of one tile stay traceable individually. |
| 123 | Damaged stock | Damaged goods are separate and excluded from sellable stock. |
| 124 | Slow-moving inventory | Report of items with no sales for a set period. |
| 125 | Dead stock | Old stock by last movement date, quantity and value. |
| 126 | Gross profit | Item-wise and invoice-wise gross profit uses actual inventory cost. |
| 127 | Reorder suggestions | Purchase suggestions from minimum stock and open POs. |
| 128 | Stock reservation release | Cancelling a reservation restores available stock. |

### E. Accounting and management reporting
| No. | Rule | Pass/fail test |
|---|---|---|
| 129 | Tax configuration | Configure applicable Sri Lankan tax rates; sample invoices calculate correctly. |
| 130 | Tax reporting | Tax summary by period reconciles with posted transactions. |
| 131 | Expense classification | Rent, electricity and other expenses post to their own accounts. |
| 132 | Owner drawings | An owner withdrawal is not treated as an operating expense. |
| 133 | Petty cash | Petty cash receipts and payments; the remaining balance is right. |
| 134 | Cash-flow reporting | Operating, investing and financing cash flow from accounting records. |
| 135 | Gross margin report | Item-wise, category-wise and invoice-wise gross margin. |
| 136 | Sales performance | Sales by cashier, day, month, customer and category. |
| 137 | Profit reconciliation | Gross profit in the sales report reconciles with the general ledger. |
| 138 | Historical reporting | A report for a past date reflects the balances at that date. |
| 139 | Opening balances | Opening stock, supplier, customer, cash and bank balances reconcile. |
| 140 | Financial export | Export ledger, trial balance and transactions to Excel/CSV; totals reconcile. |

### F. Security, reliability and data quality
| No. | Rule | Pass/fail test |
|---|---|---|
| 141 | Password security | Weak passwords are rejected; passwords are not stored readable. |
| 142 | Session timeout | An inactive account logs out after the set period. |
| 143 | Login history | Administrator can see login times and failed attempts. |
| 144 | Approval history | Each approval records who and when. |
| 145 | Concurrent transactions | Two users selling the same limited stock cannot oversell (race condition). |
| 146 | Transaction numbering | Concurrent invoice creation keeps numbers unique. |
| 147 | Database integrity | Every posted invoice, payment and stock movement has valid linked records. |
| 148 | Error recovery | An interrupted transaction completes fully or rolls back, no partial posting. |
| 149 | Backup retention | Daily and historical backups kept per policy. |
| 150 | Data export | Export essential records without the original application. |

---

## 3. NICE-TO-HAVE: advanced features
| No. | Feature | Pass/fail test |
|---|---|---|
| 151 | Supplier performance dashboard | Delivery and price-performance comparison. |
| 152 | Automatic purchase suggestions | Suggested quantities from sales velocity and lead times. |
| 153 | Barcode label printing | Print a label and scan it back to the right product. |
| 154 | QR-code receipts | Scan a receipt QR code to get the original invoice. |
| 155 | Customer WhatsApp receipts | Send an invoice by WhatsApp; the right document arrives. |
| 156 | WhatsApp payment reminders | Reminder for an overdue customer with the right balance. |
| 157 | Customer purchase history | Search a customer: past purchases and returns. |
| 158 | Sales forecasting | Forecast vs actual for a period. |
| 159 | AI anomaly detection | Flags unusual discounts, duplicate bills, odd stock changes and payments. |
| 160 | Management dashboard | Sales, gross profit, cash, bank, stock value, receivables from posted records. |
| 161 | Mobile stocktaking | Scan with a phone; compare counted with ERP stock. |
| 162 | Multi-branch support | Transfer between branches; branch stock and accounts reconcile. |
| 163 | Supplier portal | Suppliers view purchase orders and delivery requirements. |
| 164 | Customer quotations | Create a quotation and convert it to an invoice without re-entry. |
| 165 | Delivery management | Track pending, dispatched, completed deliveries. |
| 166 | Installation/service tracking | Track service requests and complaints. |
| 167 | Automated alerts | Notify on overdue payments, low stock, bounced cheques, suspicious transactions. |
| 168 | AI-assisted bill entry | Extract supplier invoice details and suggest items before human approval. |
| 169 | Multi-currency support | Foreign-currency purchases with exchange-rate differences. |
| 170 | Business audit export | Export a period's transactions, stock movements and audit logs for the accountant. |

---

## 4. Most common mistakes in small-shop ERPs
An app can look professional and still give unreliable numbers.

| No. | Common mistake | What should happen instead |
|---|---|---|
| 1 | Stock updated twice when posting a GRN and the supplier bill. | One controlled inventory posting event. |
| 2 | Supplier bills allowed without GRNs. | Require a GRN or an authorised exception. |
| 3 | Duplicate GRNs allowed. | Detect duplicate supplier references. |
| 4 | Old transactions edited without history. | Keep the original, record every change. |
| 5 | Posted invoices deleted. | Reversals and linked credit notes. |
| 6 | Post-dated cheque treated as cash. | Separate cheque status and bank-clearance process. |
| 7 | Bounced cheque treated as paid. | Reverse the settlement; restore the liability or receivable. |
| 8 | Owner withdrawals mixed with expenses. | Record drawings separately. |
| 9 | Every supplier payment treated as a purchase expense. | Allocate against bills, advances or other accounts. |
| 10 | Profit = selling price minus latest purchase price. | Use the configured costing method. |
| 11 | Discounts ignored in profit. | Net revenue after discounts. |
| 12 | Negative stock allowed without control. | Block or authorise; keep costing accurate. |
| 13 | Damaged or missing goods not recorded. | Controlled stock adjustments with reasons. |
| 14 | Showroom and warehouse stock mixed. | Location-wise balances. |
| 15 | Customer deposits counted as sales at once. | Liability until the sale is recognised. |
| 16 | Supplier advances treated as expenses. | Record separately until allocated. |
| 17 | Staff can override selling prices. | Permissions and approval limits. |
| 18 | Cashiers can delete or modify their own transactions. | Restrict; independent approval. |
| 19 | Physical cash not reconciled. | Expected vs counted cash. |
| 20 | Floating-point arithmetic for money. | Exact decimals and proper rounding. |
| 21 | Invoice date and entry date not distinguished. | Store transaction date and system posting timestamp. |
| 22 | Closed periods reopened without approval. | Controlled reopening with an audit record. |
| 23 | Reports from different data sources. | One set of posted transactions. |
| 24 | Backups never restored. | Scheduled test restores. |
| 25 | Everyone is administrator. | Role-based access, separation of duties. |
| 26 | Tile unit conversions ignored. | Box, piece, square-metre conversions. |
| 27 | Tile shades and batches mixed. | Track shade, calibre, batch. |
| 28 | Pending deliveries counted as completed sales. | Separate invoiced, delivered, pending. |
| 29 | Pending supplier credits counted as received money. | Keep expected credits apart from realised ones. |
| 30 | Gross profit without landed cost. | Include allocated inventory costs. |

---

## 5. Five rules the ERP must never violate
1. **Every transaction has a traceable identity.** Unique reference, user and timestamp on every sale, purchase, payment, return and adjustment.
2. **Stock and accounting agree.** Every stock-affecting transaction has its inventory and financial impact.
3. **Posted transactions do not disappear.** Corrections use traceable reversals, never permanent deletion.
4. **Every balance is reconcilable.** Cash, bank, suppliers, customers, inventory and ledger have supporting histories.
5. **Reports come from reliable posted data.** A dashboard never invents, separately recalculates or silently overrides financial truth.

---

## 6. Implementation priorities (small Sri Lankan tile and fittings retailer)
| Priority | Modules | Target |
|---|---|---|
| P0 | GRN, purchasing, stock, sales, payments, supplier/customer ledgers | Reliable before live use |
| P0 | Double-entry, audit trail, reversals, backups | Reliable before live use |
| P1 | Cheques, bank reconciliation, cash closing, credit control | Next |
| P1 | Stocktake, warehouse, tile conversions, landed cost | Next |
| P2 | Management reporting, alerts, WhatsApp, forecasting | After controls |
| P3 | AI automation, supplier portal, multi-branch | Later |

Sri Lankan considerations: LKR default, two decimals; Asia/Colombo for dates and timestamps; configure VAT, SSCL and other taxes per current rules and the accountant's advice; never hardcode tax rates; keep invoice date, delivery date, cheque date, clearance date and posting date apart.

## 7. Scorecard
170 individual tests above. Tracking aid only: it does not inspect the ERP. Keep results in AUDIT_ERP.md.

**First milestone, a fully reconcilable chain:** PO to GRN to Supplier Bill to Supplier Ledger to Payment to Bank Reconciliation.
**Sales side:** POS Invoice to Stock Reduction to Customer/Cash Ledger to Accounting to Day-End Closing.
If either chain breaks, the dashboard's profit, cash or stock cannot be trusted.
