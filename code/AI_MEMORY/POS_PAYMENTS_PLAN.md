# POS_PAYMENTS_PLAN (2026-10-09): cash, card, online, cheque, credit, split
Today: pos_bills.payment_method is free text (default cash); the POS form offers cash/card/online. Old bills must read exactly as before.
STOP-RULE CHECK: nothing below alters a golden-core table, VAT, tax, fiscal close, daily_summary, cheques, credit_customers or aging. SAFE, so it is built.

NEW (isolated, additive): table pos_bill_payments (id, bill_id -> pos_bills, method, amount NUMERIC(12,2), reference TEXT). CREATE TABLE IF NOT EXISTS only. No ALTER on any table.
RULES (server, only when the request carries `payments`):
- methods: cash, card, online, cheque, credit. Each amount > 0 (2 decimals). Sum must equal the bill total to the cent, never over or under.
- cheque needs a reference (cheque no / bank / date). credit needs a customer name or phone on the bill (who owes).
- 1 payment: pos_bills.payment_method = that method; 2 or more: payment_method = 'split'. Rows go in the SAME transaction as the bill.
- No `payments`: exactly the old path (payment_method text only). Cash, card and online single bills still send no rows.
- Discount cap, void, numbering, stock rule (POS_DEDUCT_STOCK stays off): untouched.
- Editing: a bill WITH payment rows cannot be edited (409: void it and enter it again), so the rows can never disagree with the total.
READ SIDE (routes/daily_sales_live.js): bills with payment rows are counted from the rows (cash/card/online/credit/cheque); bills without rows from payment_method as before. Void bills left out. Credit is its own bucket, never in cash.
Files (5): routes/pos_bills.js, routes/pos_bill_corrections.js (edit guard), routes/daily_sales_live.js, public/pos_billing.html, tests (new).
NOT DONE ON PURPOSE (next step, needs Aj): cheque bills into the Cheques screen (cheques is golden core) and credit bills into Credit & Aging (changes credit totals, not read-side).
Question for Aj when ready: "Should a credit bill create a row in Credit & Aging, and a cheque bill a row in Cheques? Paste: YES credit and cheque, or YES credit only, or NO keep them on the bill only".
