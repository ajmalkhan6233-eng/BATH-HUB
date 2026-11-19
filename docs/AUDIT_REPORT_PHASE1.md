# AUDIT REPORT, PHASE 1 (Opus, 19 Nov 2026). Read only. Nothing was changed in the app.
Format: # | colour | where | what is wrong | proof | fix size

## A. NUMBERS THAT DO NOT MATCH
1 | RED | routes/profit.js, routes/daily_breakdown.js:108, routes/dashboard_breakdown.js:22 | Three different profit answers for the same day. Profit page uses the cost saved on the bill line; daily breakdown uses TODAY's average cost; dashboard breakdown skips items with no cost. | read the 3 queries | HARD (one shared cost function)
2 | RED | everywhere that joins `products p ON p.item_code = i.item_code` | item_code is not unique in products. If two items share a code, that bill line is counted twice (sale and cost double) and a sale takes stock from both items. | test_schema.sql has no UNIQUE on item_code; item_dupe_merge tests show dupes happened | HARD (check dupes on PC, then a unique rule)
3 | RED | routes/home_solid.js vs utils/pocketSnapshot.js | Two cheque lists: Home reads vendor_bill_cheques (ISSUED), Pocket and 17 other routes read cheque_register (pending/held). Phone and PC can show different cheques owed. | grep: 18 files use cheque_register, 8 use vendor_bill_cheques | HARD (pick one, the other becomes a view)
4 | AMBER | utils/pocketSnapshot.js "due"/"vendors" | Phone still calls bills "overdue" from vendor_bills.due_date and shows a red pill. Home no longer assumes overdue (your 19 Nov rule). Phone and PC disagree. | rHome in pocket/app.js | EASY
5 | AMBER | routes/home_solid.js:43 vs routes/dashboard_breakdown.js:58 | Stock value: Home adds minus stock (lowers the value), breakdown counts minus as 0. Two stock values. | read both | EASY
6 | AMBER | routes/home_solid.js:46 | "stock all" counts inactive items too; the line above does not. | read | EASY

## B. STOCK GOES MINUS
7 | AMBER | routes/pos_bills.js:288 | A sale always takes stock out, even below 0 (by design: oversold). Minus stock then lowers stock value (item 5) and the low-stock list hides it (it only lists stock > 0). | read | EASY (show minus items in their own calm list)
8 | AMBER | utils/oversold.js record() | Oversold check reads stock without locking. Two sales at the same second can both pass. | no FOR UPDATE | EASY
9 | AMBER | routes/pos_bill_corrections.js | Voiding a bill gives the stock back, but its "owed to customer" (oversold) line may stay open. Needs a check on the PC. | void code does not clear oversold_owed rows found | EASY

## C. ZERO-PROFIT AND LOW-PRICE SALES
10 | RED | routes/profit.js, Pocket, Home | An item with no cost counts as cost 0, so the WHOLE sale shows as profit. Profit looks too high when GRN cost is missing. Only a small "no cost" count warns. | COALESCE(..., 0) | EASY (show "cost missing" loudly, leave it out of profit)
11 | AMBER | routes/pos_bills.js:272 | Line cost is copied from avg_cost at sale time. If the GRN comes later (oversold), the bill keeps cost 0 for ever, unless the oversold "how covered" step is done. | read | HARD
12 | GREEN | price guard | Selling below the floor is refused unless you approve as owner. Works, also from the phone (tested). | cloud test | none

## D. SCREENS NOT SYNCING
13 | RED | public/service-worker.js:66 | If the PC is slow for 8 seconds, the screen quietly shows an OLD saved copy of the numbers (Home waits 30 s). This is a main reason the PC screen and the phone show different numbers. | read | EASY (show "old copy" in red, or retry)
14 | AMBER | Pocket | Phone numbers come from a copy made every 10 min or after a change (max 500 a day). Phone can be behind the PC by minutes. | utils/pocketSnapshot.js | EASY (show the time clearly; already says "Updated x min ago")
15 | AMBER | public/*.html | 68 screens; one giant screen file of 197 KB. Two copies of a screen (old Home / home_solid) already caused "old dashboard" once. | ls public | HARD (list old screens, remove after your OK)

## E. CODE FIGHTING
16 | AMBER | 43 route files | 43 files change the database tables when the app starts (CREATE/ALTER). They can race each other and slow startup. | grep | HARD (one setup step)
17 | AMBER | routes/* | Same route paths in more than one file ('/', '/items', '/modules') under different prefixes; safe today, easy to clash later. | grep | EASY
18 | AMBER | stock writers | 9 different places change stock_level (POS, void, edit, 4 GRN screens, returns, pending delivery). Only some write the stock ledger, so the ledger cannot fully explain the stock. | grep | HARD (one stock function)

## F. MONEY RULES
19 | GREEN | GRN double invoice, cheque number twice | Both are checked and refused. | grn_workbench.js:81, cheque_register.js:100 | none
20 | AMBER | vendors | No rule stops two vendor names that mean the same vendor ("Cool Lanka" / "Cool Lanka Impex"). | no unique check found | EASY

## G. SECURITY
21 | GREEN | server.js | Login cannot be switched off in production mode; .env, data, dumps are kept out of git. New phone gate only allows 3 routes, from this PC, with the secret (tested: 4 attacks refused). | cloud test | none
22 | AMBER | routes/invoice_receipts.js:98 | A receipt can be made for a VOIDED bill. | no void check | EASY

## H. SPEED
23 | AMBER | routes/profit.js | The Profit page reads EVERY bill and expense ever, then filters. Fine now, slow in a year. | 7 full-table reads | EASY (filter in the query)
24 | AMBER | database | No index found in the code for pos_bill_items(bill_id) or products(item_code). May exist on the PC; must be checked. | grep | EASY

## I/J. EASE AND RELIABILITY
25 | AMBER | POS receipt picture | Needs puppeteer (a hidden Chrome). If it fails, the phone gets no receipt picture. Not testable in the cloud. | test result | check on PC

## TOP 5 TO DO FIRST
1. #2 duplicate item codes (counts double).  2. #1 one profit formula everywhere.  3. #10 no-cost items shown as full profit.  4. #13 old saved numbers shown quietly.  5. #3 one cheque list.

Not covered here: Noor app (separate folder, separate chat). Old money data on the PC (needs a read on the real DB copy).
NEXT: SWITCH TO SONNET 5.5 for the EASY items, Opus for the HARD ones.
