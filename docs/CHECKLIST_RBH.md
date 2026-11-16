# RBH check list (test copy only, never real data). Each step: do, then the expected result.
Run: bash scripts/dev/cloud_rig.sh, then bash scripts/qa/rbh_check.sh

## A. Pages and files (script does these)
1. Every .js in public/ passes node -c. Expect: 0 failures.
2. Settings page has only Bank accounts and Staff discount limit. Expect: no "Appearance", no "fixed costs", no "credit limits".
3. Customers page has a Credit limits card. Expect: text "Credit limits" present.
4. Daily Ledger loads ledger-fixed.js and bathhub-a11y.js. Expect: both script tags present.
5. POS loads pos-all.css only (not 4 files). Expect: pos-all.css linked, the four old ones not.

## B. API flows (script does these on the test copy)
6. Add fixed cost "Test rent" 30000 then list. Expect: 200, row shows 30000.
7. Add same name again with 45000. Expect: still one row, amount 45000 (update, not duplicate).
8. Set credit limit for "QA Customer" 50000, list. Expect: row present. Negative limit is refused (400).
9. Set staff discount 10. Expect: 200 and listed.

## C. Screen flows (Playwright, phone 390x844 then desktop 1366x768)
10. GRN: add vendor, 2 items, save. Expect: vendor bill created, stock up by the quantities, no console errors.
11. POS: sell 1 item with cash. Expect: stock down by 1, bill number shown.
12. POS back-dated sale (owner): Bill date 3 days ago. Expect: bill dated 3 days ago; a future date is refused.
13. Cheque entry: new cheque, vendor, amount, due date. Expect: appears in cheque register, total matches.
14. Daily Ledger: Fixed costs bar, tap "Take from till". Expect: one Payouts row "Fixed costs (rent etc.)", payout total up by that amount, second tap says already taken.
15. Enter key: in a form, press Enter in each box. Expect: focus moves to the next box, last box does nothing, search boxes unaffected.
16. Home: open, wait 5 s. Expect: numbers show at once and do not change by themselves.
