# BUG_LIST (2026-10-09, audit only, nothing fixed). Dev server 390px, throwaway DB. Status: NEEDS YOU (approve fixes)
Checked: Jest, bugcheck --static, 28 /owner screens + 20 standalone pages (console, 4xx/5xx, sideways scroll, "null/undefined" text).

## BREAKS MONEY
1. Staff loans: /api/staff `outstanding`/`total_loans` count repayments as loans. server.js:2376-2377 (golden core: needs Aj rule + sign-off). Repeat: add a loan, add a repayment, open Staff list in /api/staff. Size M. (known item; Staff screen's Advances tab is right, per OPEN_ITEMS)
2. Offline edits/voids wait in "needs review" and nothing shows them. API /api/sync/review exists, no screen (public/offline-queue.js only). Repeat: save a bill offline, go online. Money stays out of totals until reviewed. Size M.

## BREAKS SCREEN
3. /pos-ledger.html ledger half and /daily-entry-v2.html: /js/hyperspace-theme.js is missing (404), so `window.HyperspaceTheme.mount()` throws (public/daily-entry-v2.html:3181) and the rest of that script's setup never runs. Very likely the cause of "ledger not editable" (earlier could not reproduce). Fix idea: copy reference/bathco/public_extras/hyperspace-theme.js to public/js/. Size S.
4. Vendors > History button breaks for any vendor name with an apostrophe (D'Silva): public/bathco_complete.html:2430 puts the name raw inside onclick (also unescaped HTML). Repeat: add vendor `O'Neil`, click History. Size S.
5. Barcode screen has no menu entry and `navigate('barcode')` throws "classList of null" (public/bathco_complete.html:1514; page-barcode is at :623). Repeat: open /owner#/barcode. Size S.
6. vendor-ledger.html (5 calls) and morning-brief.html return 500 on the dev DB: tables vendor_bills, vendor_bill_cheques, owner_tasks do not exist. scripts/dev/test_schema.sql is missing them (schema drift). Live DB status UNVERIFIED. Size M.
7. tests/brain.test.js:26 fails: expects "tomorrow Rs. 213,200" but the test cheque date is now past (date-dependent test). Size S.

## LOOKS BAD
8. Vendors list shows the word "null" in several cells (public/bathco_complete.html near :2430, vendor render). Size S.

## OTHER
9. npm audit (bugcheck --static): 1 critical + 10 high in production packages (puppeteer chain: @puppeteer/browsers, basic-ftp, extract-zip, get-uri, proxy-agent). package.json. Size M.
10. Jest now: 1 failure of 1382 (brain.test.js). Integration failures: 0 (CLAUDE.md still says 17: stale).

## NOT CHECKED (UNVERIFIED)
- Dead buttons (no reliable automatic test); 1280px layouts; logged-in vendor-ledger with real tables; the 45 live bugcheck checks (they need `npm run bugcheck`, which restores the newest LIVE backup into a scratch DB: not run, to keep shop data out).
- GRN `/api/suppliers` "Failed to fetch" seen once during a page reload only; 200 when called alone (not a bug).
