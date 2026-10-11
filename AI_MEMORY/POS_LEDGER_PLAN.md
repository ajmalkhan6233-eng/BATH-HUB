# POS_LEDGER_PLAN (2026-10-10, queue 4 part 3 + 4). Read side first. No ALTER, no golden-core edit.
FINDINGS: Owner-app "Cheques" page = golden-core `cheques` (money owed TO the shop, needs a customer) via existing POST /api/cheques.
 `cheque_register` (money the shop pays OUT) is a different thing: POS customer cheques must NOT go there.
 Credit & Aging = `credit_customers` via /api/credit-customers. POS credit bills never write there.
STOP-RULE CHECK: nothing here changes cheques/credit_customers columns, credit totals, aging buckets, VAT, fiscal close or daily_summary. SAFE.
NEW tables (CREATE IF NOT EXISTS only, in routes/pos_bills.js start-up chain):
 pos_cheque_registered(payment_id PK -> pos_bill_payments, cheque_id, registered_at) = the "already registered" link.
 pos_quotation_billed(bill_id PK -> pos_bills, quotation_id) = the "already billed" marker.
NEW route file routes/pos_ledger_bridge.js (read-only except the claim link), mounted in server.js:
 GET  /api/pos-ledger/cheques        unregistered cheque parts of non-void bills (split = cheque part only)
 POST /api/pos-ledger/cheques/:id/claim   409 if already claimed (never twice); /done stores cheque_id; /release if create failed
 GET  /api/pos-ledger/credit         credit parts of non-void bills + per-customer totals, kept apart from aging
 GET  /api/pos-ledger/quotation-billed   quotation id -> BHT number (non-void bills only)
SCREENS: bathco_complete.html (Cheques page: section + "Register this cheque" -> existing POST /api/cheques), credit_aging.html (read-only section),
 pos_billing.html (sends quotation_id on save; "Already billed (BHT-...)" + confirm in the Load quotation list).
FILES (5): routes/pos_ledger_bridge.js, routes/pos_bills.js (2 tables + marker insert), server.js (1 mount line), public/{bathco_complete,credit_aging,pos_billing}.html (+ new test).
MERGE into customer credit totals: NOT done. Needs Aj: "MERGE POS CREDIT" or "KEEP SEPARATE" (default stays separate).
