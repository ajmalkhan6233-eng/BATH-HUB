Standard ERP/POS control checklist for a tile & bathroom-fittings shop

This is a practical conventional ERP/POS audit checklist for a small retail and wholesale business in Sri Lanka.

It is designed to test whether your ERP actually controls purchasing, stock, cash, suppliers, customers and accounting — not merely whether it has screens and buttons for those functions.

How to use it

* PASS — The app behaves correctly and produces the expected records.
* FAIL — The app allows an incorrect transaction, loses information, or produces an incorrect balance.
* NOT TESTED — You have not performed the test.
* Every failed test should become a development task.
* Test using a copy of your database or a test company, not live financial records.

1. MUST — Essential ERP controls

These are fundamental controls. An ERP should not be considered financially reliable if these fail.

A. Purchasing, PO, GRN and supplier bills

No.	Required rule	Pass/fail test
1	Purchase Order (PO)	Create a PO and verify supplier, items, quantities, prices and totals are saved.
2	GRN against PO	Receive goods against a PO and verify received quantities update correctly.
3	PO–GRN–Bill matching	Enter a supplier bill and verify its quantities and prices against the PO and GRN.
4	Partial delivery	Order 100 taps, receive 60; verify 60 received and 40 outstanding.
5	Short delivery	Order 100, receive 90; verify the missing 10 are recorded, not silently accepted.
6	Over-delivery	Order 100, receive 110; verify excess quantity triggers an authorised exception.
7	Duplicate GRN prevention	Enter the same supplier delivery reference twice; verify duplicate warnings or blocking.
8	Stock update	Post a GRN and verify stock increases exactly once.
9	Supplier bill posting	Post a supplier bill and verify accounts payable increases correctly.
10	Vendor purchase return	Return 5 items and verify stock decreases by 5 and supplier credit is recorded.
11	Return documentation	Verify a return requires item, quantity, reason, supplier and original GRN/bill reference where applicable.
12	Credit note	Enter a supplier credit note and verify the supplier payable decreases correctly.
13	Debit note	Enter a supplier debit note and verify the corresponding supplier account adjustment is recorded.
14	Purchase discount	Enter a supplier discount and verify both inventory valuation and payable are correct.
15	Editing posted GRNs	Attempt to edit a posted GRN; verify changes are restricted or recorded with an audit trail.
16	GRN reversal	Reverse a posted GRN and verify stock and accounting entries are reversed exactly once.
17	Back-dated purchase	Enter a historical GRN and verify the system records both transaction date and actual entry date.
18	Landed cost	Add freight and other directly attributable purchase costs and verify the inventory cost is adjusted correctly.

B. Vendor ledger and accounts payable

No.	Required rule	Pass/fail test
19	Supplier bill ledger	Enter three supplier bills and verify all appear under the correct supplier.
20	Supplier payments	Make a partial payment and verify the outstanding bill balance decreases correctly.
21	Multiple bill settlement	Pay two bills with one payment and verify the allocation is recorded against both.
22	Unallocated payments	Enter an advance payment and verify it appears as a supplier advance, not an unexplained expense.
23	Rounding differences	Settle a bill with a small rounding difference and require a reason and authorised adjustment.
24	Supplier ageing	Verify unpaid bills appear in the correct ageing buckets: current, 30, 60, 90 days and above.
25	Supplier statement	Generate a statement and verify opening balance, bills, payments, adjustments and closing balance.
26	Supplier reconciliation	Compare ERP balances with a supplier statement and verify differences can be identified.
27	Payment reference	Verify every payment records date, amount, payment method, reference and receiving account.

C. Cheque management

No.	Required rule	Pass/fail test
28	Cheques issued	Issue a cheque to a supplier and verify the cheque register and supplier ledger update.
29	Post-dated cheques	Record a future-dated cheque and verify it is not treated as cleared cash or bank money.
30	Cheque presented	Mark a cheque as presented and verify its status changes without duplicating payment.
31	Cheque cleared	Mark a cheque cleared and verify the bank ledger is updated correctly.
32	Bounced cheque	Mark a cheque bounced and verify the payment is reversed and the liability restored.
33	Cancelled cheque	Cancel an issued cheque and verify the reason and reversal are recorded.
34	Stopped cheque	Record a stop-payment instruction and verify the cheque cannot be treated as successfully paid.
35	Cheques received	Receive a customer cheque and verify it appears in the cheque register and customer ledger.
36	Received cheque bounce	Bounce a received cheque and verify the customer receivable is restored.
37	Cheque duplication	Enter an existing cheque number for the same bank/account and verify duplicate detection.
38	Bank reconciliation	Compare recorded bank transactions with a bank statement and identify outstanding and unmatched items.

D. POS and sales

No.	Required rule	Pass/fail test
39	Cash sale	Sell an item for cash and verify stock, sales and cash balances update.
40	Credit sale	Make a credit sale and verify customer receivables increase.
41	Discount control	Apply a discount and verify it does not exceed the user’s permission.
42	Price override	Change the selling price manually and verify authorisation and reason are required.
43	Held bill	Hold a sale, close the POS and reopen it; verify the sale is retained.
44	Split payment	Pay a Rs. 10,000 bill using Rs. 4,000 cash and Rs. 6,000 card; verify both payment methods.
45	Sales return	Return an item and verify the stock and customer refund/credit are recorded correctly.
46	Sales exchange	Exchange one item for another and verify both outgoing and incoming stock movements.
47	Refund	Refund a customer and verify the correct cash/bank account is reduced.
48	Sale void	Void a posted sale and verify stock and accounting reversal with an audit record.
49	Negative stock	Attempt to sell 5 when only 3 are available; verify the configured restriction or authorised exception.
50	Shift opening	Open a cashier shift and record the opening cash float.
51	Shift closing	Close the shift and compare expected cash against physically counted cash.
52	Cash variance	Record a cash shortage or excess with a reason and responsible cashier.
53	Receipt	Print a receipt showing invoice number, date, items, quantities, discounts, payment and balance.
54	Duplicate invoice	Attempt to post the same invoice twice and verify duplication is prevented.

E. Inventory management

No.	Required rule	Pass/fail test
55	Costing method	Configure FIFO or weighted-average costing and verify the valuation calculation.
56	Stock movement history	Open an item and trace its opening stock, purchases, sales, returns and adjustments.
57	Physical stocktake	Count actual stock and compare it with system stock.
58	Stock adjustment	Adjust stock and require a reason, user and approval where appropriate.
59	Stock adjustment history	Verify every adjustment records before quantity, after quantity and difference.
60	Duplicate item codes	Create an existing SKU/barcode again and verify duplication is blocked.
61	Item master	Require a unique item code, description, unit of measure and appropriate category.
62	Units of measure	Verify box, piece, set and other supported units convert correctly.
63	Barcode	Scan an item’s barcode and verify the correct SKU and price appear.
64	Reorder level	Set minimum stock and verify low-stock alerts work.
65	Stock valuation	Generate inventory valuation and verify it matches the stock ledger and costing method.

F. Accounting and financial controls

No.	Required rule	Pass/fail test
66	Double-entry accounting	Post a transaction and verify total debits equal total credits.
67	Chart of accounts	Verify every transaction posts to the correct account category.
68	Sales accounting	Post a sale and verify sales revenue, tax if applicable, cash/receivable and cost of goods sold are correct.
69	Purchase accounting	Post a purchase and verify inventory and supplier payable are recorded correctly.
70	Journal entries	Create a journal and verify debit and credit totals must balance before posting.
71	Trial balance	Generate a trial balance and verify total debit equals total credit.
72	Profit and loss	Generate P&L and verify revenue, discounts, cost of sales and expenses are correctly classified.
73	Balance sheet	Verify assets equal liabilities plus equity.
74	Day-end closing	Close a business day and verify all posted transactions are included.
75	Period lock	Lock a financial period and verify ordinary users cannot back-date or modify its transactions.
76	No permanent deletion	Attempt to delete a posted transaction and verify only an authorised reversal is permitted.
77	Reversal integrity	Reverse a transaction and verify the original and reversal remain visible.
78	Cash reconciliation	Verify physical cash, POS cash and accounting cash can be reconciled.

G. Customers and receivables

No.	Required rule	Pass/fail test
79	Customer credit limit	Attempt a sale above the customer’s credit limit and verify approval is required.
80	Customer ledger	Verify all invoices, payments, returns and adjustments appear under the correct customer.
81	Customer ageing	Generate overdue customer balances by ageing period.
82	Customer payments	Record partial and full payments and verify outstanding balances update.
83	Cheques received	Record a customer cheque and verify its status and amount are visible.
84	Customer statement	Generate a statement with opening balance, invoices, receipts and closing balance.

H. Security, audit and backup

No.	Required rule	Pass/fail test
85	Individual login	Log in as two employees and verify each has a separate user identity.
86	Role-based access	Log in as cashier and attempt to access administrator functions; verify restrictions.
87	Approval control	Attempt a restricted refund, discount or stock adjustment and verify approval is required.
88	Audit log	Change a posted transaction and verify old value, new value, user, date and reason are recorded.
89	Audit protection	Attempt to edit or delete an audit record and verify ordinary users cannot.
90	Automatic backup	Verify the system creates backups on the configured schedule.
91	Backup integrity	Verify a backup file exists and is readable.
92	Restore test	Restore a backup into a separate test environment and verify transaction and stock balances.

2. SHOULD — Strong operational and financial controls

These are important for a professionally managed shop. A small ERP may initially lack some of them, but they should be on the development roadmap.

A. Purchasing and supplier management

No.	Recommended rule	Pass/fail test
93	Purchase approval	Attempt a purchase above the configured limit and verify manager approval is required.
94	Supplier price history	Open an item and verify previous purchase prices and suppliers are visible.
95	Purchase price variance	Enter a bill price higher than the PO price and verify a variance warning appears.
96	Purchase tolerance	Configure acceptable quantity and price differences and verify exceptions are flagged.
97	Supplier return tracking	Generate a report showing returned goods, pending supplier credits and completed refunds.
98	Supplier advance settlement	Apply an advance to a new bill and verify the outstanding amount is correct.
99	Supplier balance confirmation	Compare supplier ledger balances at a selected date against external statements.
100	Purchase commitments	Generate a report showing ordered, received and outstanding quantities.

B. Cheques and banking

No.	Recommended rule	Pass/fail test
101	Cheque maturity alerts	Create a post-dated cheque and verify an alert appears before its due date.
102	Cheque register	Filter issued and received cheques by status, date, bank and counterparty.
103	Bank charges	Record bank charges and verify they appear in the correct expense account.
104	Unpresented cheques	Generate a report of issued cheques not yet cleared.
105	Deposit tracking	Record a customer cheque deposit and verify it can be tracked until clearance.
106	Bank reconciliation history	Reopen a previous reconciliation and verify its matched and unmatched transactions.

C. POS and cashier operations

No.	Recommended rule	Pass/fail test
107	Cashier permissions	Attempt a price change as a cashier and verify the configured permission is enforced.
108	Refund approval	Attempt a refund above the authorised threshold and verify manager approval.
109	Suspended sales reporting	Generate a report of held bills and identify the responsible cashier.
110	Cash drawer control	Attempt to open the cash drawer without a permitted transaction and verify access restrictions.
111	Cash movement	Record cash paid out or added to the drawer and verify a reason is mandatory.
112	Daily cashier report	Generate cashier-wise sales, discounts, refunds, cash and variances.
113	Payment reconciliation	Compare card, bank transfer, cash and cheque payments with POS totals.
114	Offline operation	Disconnect the internet, make a permitted test transaction and verify safe synchronisation after reconnection.

D. Inventory and tile-shop-specific controls

No.	Recommended rule	Pass/fail test
115	Multiple warehouses	Transfer stock between showroom and warehouse and verify both balances update.
116	Transfer documentation	Verify every stock transfer has a source, destination, quantity and reference.
117	In-transit stock	Transfer stock and verify it is not simultaneously available at both locations.
118	Stock reservation	Reserve 20 items for a customer and verify available stock decreases without reducing physical stock.
119	Tile box conversion	Sell 10 boxes containing 1.44 sqm each and verify the total is 14.40 sqm.
120	Fractional quantities	Verify the system supports appropriate decimal quantities for tiles, lengths and other measured goods.
121	Shade and calibre	Record different tile shades or calibres and verify they can be distinguished.
122	Batch traceability	Receive two batches of the same tile and verify their individual batch quantities remain traceable.
123	Damaged stock	Mark damaged goods separately and verify they are excluded from sellable stock.
124	Slow-moving inventory	Generate a report identifying items with no sales for a configured period.
125	Dead stock	Identify old stock based on last movement date and quantity/value.
126	Gross profit	Verify item-wise and invoice-wise gross profit is calculated using the actual inventory cost.
127	Reorder suggestions	Generate purchase suggestions based on minimum stock and outstanding purchase orders.
128	Stock reservation release	Cancel a customer reservation and verify available stock is restored.

E. Accounting and management reporting

No.	Recommended rule	Pass/fail test
129	Tax configuration	Configure applicable Sri Lankan tax rates and verify tax calculations on sample invoices.
130	Tax reporting	Generate a tax summary by period and reconcile it with posted transactions.
131	Expense classification	Enter rent, electricity and other expenses and verify each posts to its correct account.
132	Owner drawings	Record an owner’s withdrawal and verify it is not incorrectly treated as an operating expense.
133	Petty cash	Record petty cash receipts and payments and verify the remaining balance.
134	Cash-flow reporting	Generate operating, investing and financing cash-flow information from accounting records.
135	Gross margin report	Generate item-wise, category-wise and invoice-wise gross margin reports.
136	Sales performance	Generate sales by cashier, day, month, customer and product category.
137	Profit reconciliation	Verify gross profit in the sales report reconciles with the general ledger.
138	Historical reporting	Generate a report for a past date and verify it reflects the transactions and balances at that date.
139	Opening balances	Enter opening stock, supplier balances, customer balances and cash/bank balances and verify they reconcile.
140	Financial export	Export ledger, trial balance and transaction data to Excel or CSV and reconcile totals.

F. Security, reliability and data quality

No.	Recommended rule	Pass/fail test
141	Password security	Verify weak passwords are rejected and passwords are not stored in readable form.
142	Session timeout	Leave an account inactive and verify it logs out after the configured period.
143	Login history	Verify the administrator can view login times and failed login attempts.
144	Approval history	Verify each approval records who approved it and when.
145	Concurrent transactions	Have two users sell the same limited stock and verify stock cannot be oversold through a race condition.
146	Transaction numbering	Attempt concurrent invoice creation and verify invoice numbers remain unique.
147	Database integrity	Verify every posted invoice, payment and stock movement has valid linked records.
148	Error recovery	Interrupt a transaction midway and verify it either completes fully or rolls back without partial posting.
149	Backup retention	Verify daily and historical backups are retained according to the configured policy.
150	Data export	Export essential business records without depending on the original application.

3. NICE-TO-HAVE — Advanced ERP features

These are useful as the business grows, but they should not take priority over financial accuracy and stock control.

No.	Feature	Pass/fail test
151	Supplier performance dashboard	Generate supplier delivery and price-performance comparisons.
152	Automatic purchase suggestions	Generate suggested purchase quantities from sales velocity and lead times.
153	Barcode label printing	Print a label and scan it back to retrieve the correct product.
154	QR-code receipts	Scan a receipt QR code and retrieve the original invoice.
155	Customer WhatsApp receipts	Send an invoice through WhatsApp and verify the correct document is delivered.
156	WhatsApp payment reminders	Generate a reminder for an overdue customer with the correct outstanding balance.
157	Customer purchase history	Search a customer and retrieve previous purchases and returns.
158	Sales forecasting	Compare forecast sales with actual sales for a selected period.
159	AI anomaly detection	Flag unusual discounts, duplicate bills, suspicious stock changes and unusual payments.
160	Management dashboard	Display sales, gross profit, cash, bank, stock value and receivables from posted records.
161	Mobile stocktaking	Scan products using a mobile device and compare counted stock against ERP stock.
162	Multi-branch support	Transfer goods between branches and reconcile branch-wise stock and accounts.
163	Supplier portal	Allow suppliers to view purchase orders and delivery requirements.
164	Customer quotations	Create a quotation and convert it into an invoice without re-entering items.
165	Delivery management	Track pending, dispatched and completed customer deliveries.
166	Installation/service tracking	Track customer service requests and product-related complaints.
167	Automated alerts	Send notifications for overdue payments, low stock, bounced cheques and suspicious transactions.
168	AI-assisted bill entry	Extract supplier invoice details and suggest matching items before human approval.
169	Multi-currency support	Enter foreign-currency purchases and verify exchange-rate differences.
170	Business audit export	Export a complete period’s financial transactions, stock movements and audit logs for an external accountant.

4. Most common mistakes small-shop ERPs make

These are particularly important to check. An application can look professional and still produce financially unreliable numbers.

No.	Common mistake	What should happen instead
1	Updating stock twice when posting a GRN and supplier bill.	Stock should move according to one controlled inventory posting event.
2	Allowing supplier bills without GRNs.	Require a GRN or an authorised exception for direct purchases.
3	Allowing duplicate GRNs.	Detect duplicate supplier references and delivery records.
4	Editing old transactions without history.	Preserve the original and record every change.
5	Deleting posted invoices.	Use reversals and linked credit notes.
6	Treating a post-dated cheque as available cash.	Maintain a separate cheque status and bank-clearance process.
7	Treating bounced cheques as successful payments.	Reverse the settlement and restore the outstanding liability or receivable.
8	Mixing owner withdrawals with business expenses.	Record owner drawings separately from operating expenses.
9	Treating every supplier payment as a purchase expense.	Allocate payments against bills, advances or other appropriate accounts.
10	Calculating profit using selling price minus the latest purchase price.	Use the configured inventory costing method.
11	Ignoring discounts when calculating profit.	Account for sales discounts in net revenue.
12	Allowing negative stock without control.	Block or authorise exceptions and preserve accurate costing.
13	Not recording damaged or missing goods.	Use controlled stock adjustments with reasons.
14	Mixing showroom and warehouse stock.	Maintain location-wise stock balances.
15	Treating customer deposits as sales revenue immediately.	Record deposits as liabilities until the sale is recognised.
16	Treating supplier advances as expenses.	Record advances separately until allocated.
17	Allowing staff to override selling prices.	Apply permissions and approval limits.
18	Allowing cashiers to delete or modify their own transactions.	Restrict permissions and maintain independent approval.
19	Not reconciling physical cash.	Compare expected cash against actual counted cash.
20	Using floating-point arithmetic for money.	Use exact decimal arithmetic and appropriate currency rounding.
21	Not distinguishing invoice date from entry date.	Store both transaction date and system posting timestamp.
22	Reopening closed financial periods without approval.	Require controlled period reopening and an audit record.
23	Generating reports from different data sources.	Use consistent posted transactions and accounting records.
24	Backups that have never been restored.	Perform scheduled test restorations.
25	Giving every employee administrator access.	Apply role-based access and separation of duties.
26	Ignoring unit conversions for tiles.	Maintain accurate box, piece and square-metre conversions.
27	Mixing tile shades and batches.	Track shade, calibre and batch where applicable.
28	Including pending deliveries as completed sales.	Distinguish invoiced, delivered and pending quantities.
29	Counting pending supplier credits as received money.	Keep disputed and expected credits separate from realised credits.
30	Showing gross profit without including landed cost.	Include properly allocated inventory costs.

5. Five fundamental rules your ERP must never violate

Rule 1

Every transaction must have a traceable identity.

Every sale, purchase, payment, return and adjustment needs a unique reference, user and timestamp.

Rule 2

Stock and accounting must agree.

Every stock-affecting transaction must have the corresponding inventory and financial impact.

Rule 3

Posted transactions must not disappear.

Corrections must use traceable reversals, not permanent deletion.

Rule 4

Every balance must be reconcilable.

Cash, bank, suppliers, customers, inventory and general ledger must have supporting transaction histories.

Rule 5

Reports must come from reliable posted data.

A dashboard must never invent, independently recalculate or silently override financial truth.

6. My recommended implementation priorities

For a small Sri Lankan tile and bathroom-fittings retailer, I would implement in this order:

Priority	Modules	Target
P0	GRN, purchasing, stock, sales, payments, supplier/customer ledgers	Must be reliable before live use
P0	Double-entry, audit trail, reversals, backups	Must be reliable before live use
P1	Cheques, bank reconciliation, cash closing, credit control	Next
P1	Stocktake, warehouse, tile conversions, landed cost	Next
P2	Management reporting, alerts, WhatsApp, forecasting	After controls
P3	AI automation, supplier portal, multi-branch	Later

Important Sri Lankan considerations:

* Use LKR as the default currency and two decimal places for financial values.
* Use Asia/Colombo for transaction dates and timestamps.
* Configure VAT, SSCL and other applicable tax treatments according to current Sri Lankan requirements and your accountant’s advice.
* Do not hardcode tax rates into the application.
* Maintain a distinction between invoice date, delivery date, cheque date, clearance date and posting date.

7. Final ERP acceptance scorecard

You have 170 individual tests above. Use this scorecard to evaluate the application.

ERP audit results

0

Passed

0

Failed

170

Not tested

Update your test results

Passed

+1−1

Failed

+1−1

Not tested

Move from passed

Reset scorecardTracking aid only. It does not automatically inspect your ERP or save results to its database.

My recommendation: Do not judge an ERP by the number of features it has. Judge it by whether it prevents incorrect transactions, maintains accurate stock, protects money and produces accounts that an independent accountant can verify.

For your custom ERP/POS, the most important first milestone is a fully reconcilable chain:

PO → GRN → Supplier Bill → Supplier Ledger → Payment → Bank Reconciliation

And on the sales side:

POS Invoice → Stock Reduction → Customer/Cash Ledger → Accounting → Day-End Closing

If either chain breaks, the dashboard’s profit, cash or stock figures cannot be trusted.

I can also turn these 170 tests into a developer-ready ERP acceptance-testing specification, with test data, expected accounting entries, expected stock balances and exact pass/fail procedures for each module.