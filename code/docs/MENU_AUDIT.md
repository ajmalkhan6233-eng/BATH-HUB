# Menu audit (4 Nov 2026): where the app repeats itself
Source: public/simple_mode.js (side groups), public/menubar.js (top bar), EXTRA_FRAMES in public/bathco_complete.html.
Nothing was deleted. "Merged" = hidden from the side list, now a tab inside another screen, still reachable from the top menu bar.

## Done in this build
| Group | Was in the side list | Now |
|---|---|---|
| GRN + Payable | GRN, Purchasing, Add by photo, Documents, Vendor Credit, Return/Discount, Vendor Ledger (7) | ONE item: GRN. Tab 5 "More" holds Purchasing, Vendor ledger, Vendor credit, Return/discount, Documents. Cheques = tab 3, Vendors = tab 2 |
| Sales | POS, Daily Sales, Daily Ledger, POS + Ledger, Customers, Credit & Aging (6) | POS Billing, Daily Sales, Sales tools (Daily ledger, POS + ledger, Customers, Credit, Quotations as tabs) |
| Side list (simple mode) | 8 screens | Dashboard, GRN, POS Billing, Sales tools, Pay vendors, Money Control, Loans, Stock |

## Still repeated (next round, needs your OK before anything is hidden)
1. Vendors: "Pay vendors", "Vendors" (overview), "Vendor 360" and GRN tab 2 all show vendors and what you owe. Keep GRN tab 2; fold the others in as tabs.
2. Cheques: "Cheques" (customer cheques), "Cheque Register" (old table cheque_register, separate from the vendor cheques now in GRN tab 3). Two different tables hold cheques. Needs a decision which one is the truth before merging.
3. Sales numbers: Dashboard cards, Daily Sales, Daily Breakdown, Daily Ledger and GRN tab 4 each total sales their own way. Tab 4 is the only one with a date and hour picker.
4. Money: Money Control, Money Plan, Accounting, Audit & Accounting, Salary & Costs, Expenses overlap.
5. Stock and prices: Stock, Item catalog, Prices and reorder, Stickers, Barcode Labels. The item search window (GRN screen) now edits name, price, picture.
6. Reports: Reports, Reports & Analytics, Download reports, Documents.
7. Settings: Settings, Shop details, Shop Tools, Users and roles, Staff logins.
8. Dead screens: Purchasing tabs say "Not built yet" (Purchase Orders, PO to GRN, Price Comparison, Landed Cost, Shipment Tracker). Nothing behind them. Candidates to remove.
9. Also seen on the Dashboard: "Customers owe us" and "Cheques pending" read 0 while vendors owed shows 1,400,245; the dashboard "we owe vendors" follows bills only, GRN tab 3 follows the cleared-cheque rule. Same money, two ways to count. Needs your decision.

## Real data
Your GRN entries are untouched. Cleaning the other (test) data on the live database was NOT done: it needs a backup first and your clear word.
