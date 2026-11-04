# PAPERS: cheques, bank slips, expense receipts (Aj, 21 Oct 2026)
Aj sends photos in Claude chat (weekly batch, or each one as it comes). Chat reads them, checks them, makes ONE file. One command loads it into the app. No typing by Aj.

## The file (JSON). Private: it lives in the PRIVATE bridge repo (Universal-project-/PAPERS/), never in this public repo.
{ "cheques":  [ { "cheque_no":"000123", "bank":"Commercial", "payee":"Metro Enterprises", "amount":150000, "due_date":"2026-11-05", "status":"pending", "notes":"" } ],
  "bank":     [ { "txn_date":"2026-10-20", "description":"Cash deposit", "amount":50000, "txn_type":"CREDIT", "bank_name":"Commercial", "notes":"" } ],
  "expenses": [ { "txn_date":"2026-10-21", "txn_type":"EXPENSE", "amount":1200, "description":"Tea and cleaning", "category":"Shop" } ] }
Rules (same as the app screens): amount > 0 (direction is txn_type CREDIT/DEBIT); cheque status pending/cleared/bounced; dates YYYY-MM-DD; expense txn_type EXPENSE or TOPUP.
Anything unreadable in a photo is NOT guessed: chat lists it back to Aj as "?" and leaves it out of the file.

## Load (PC, Claude Code runs it; cloud tests: tests/unit/paper_import.test.js and tests/integration/paper_import_realpg.test.js)
Rehearsal:  node scripts\import_papers.js <file>
Load:       node scripts\import_papers.js <file> --yes --db=bathco_owner --backup=<fresh .sql>
Safe: backup first, one transaction (all or nothing), the same row twice is skipped, refuses the live database or a wrong --db, plain INSERTs into cheque_register / acc_bank_transactions / acc_petty_cash_txns only.
Not covered yet (say if wanted): supplier bills (GRN route already exists), POS sales (barcode POS), salary slips.
