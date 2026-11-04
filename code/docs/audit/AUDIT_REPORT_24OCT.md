Branch: claude/audit-machine | Commit: see git log | Changed: audit scripts, 5 bug fixes, daily live check
# Audit report, 24 Oct 2026
Proven on the cloud test copy: bill_chain 48/48 pass; fuzz 1,300 random bills (seeds 24, 7, 2026) all invariants pass.
Meaning: the numbers tie to each other. Not proof they are the right numbers.

## Real bugs found and FIXED (5, not 20)
1. Dashboard "owed to vendors" ignored cleared cheques (90,000 vs ledger 60,000).
2. Vendor payment above the amount owed was accepted (now refused, 409).
3. Vendor cheques above the bill were accepted (now refused, 409).
4. Duplicate cheque number on the same bank gave no warning (now CHEQUE_NUMBER_USED warning).
5. idempotency_keys table only existed if a layla migration ran, so keyed saves were not de-duplicated (now self-creates). Live DB state UNVERIFIED.

## Heads-ups NOT fixed
- Stock adjustments change stock_items, not products, so damage/loss does not reach POS stock.
- Database clock is UTC on the test copy; if live is the same, bills 00:00-05:30 land on the previous day.
- Double tap without an idempotency key makes 2 bills.
- vendorLedger "calendar, cash gap" test fails between 00:00 and 05:30 Sri Lanka (pre-existing).
- No customer-return route (void only).

## Not yet covered
Expense, loan, market purchase, day-close flows; backup restore test; live DB check (needs the PC): UNVERIFIED.

## Run on the PC
node scripts/audit/daily_check.js ; node scripts/audit/system_check.js
