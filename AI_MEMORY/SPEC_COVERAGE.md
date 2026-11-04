# SPEC COVERAGE (QUEUE_SIMPLIFY shop facts vs the code), 2026-11-03 night, cloud copy DB
OK = exists and tested here | NEW = built tonight | CHECK = exists, needs Ajmal's eyes on real numbers | GAP = not built
| Fact | Where | Status |
|---|---|---|
| Menu: 6 modules + Dashboard, rest inactive | public/simple_mode.js (groups), config/modules.json, routes/modules.js, public/js/simple-modules.js, public/inactive_modules.html | NEW. Checked in a headless browser on the test copy: simple menu = Dashboard, GRN, POS, Pay vendors, Money Control, Loans, Stock. Real phone look still UNVERIFIED |
| Module on/off, nothing deleted | utils/modulesConfig.js + tests (5) | NEW, OK |
| Oversell allowed, warn only, next entry asks how gap was covered | utils/oversold.js, routes/oversold.js, tests | OK (existing) |
| Vendor bill math (qty x rate, totals), mismatch alert | utils/billChecks.js, tests | OK (existing) |
| Awaiting-delivery checklist | routes/pending_delivery.js | OK (existing) |
| Free items from vendor add stock at cost 0 | commit a5393f5 "Free stock module" | OK (existing) |
| Vendor RETURN updates payable + stock + cost together | utils/vendorAdjust.js, routes/vendor_returns.js, 6 unit tests, run on real Postgres copy | NEW, CHECK. Screen built: public/vendor_returns.html (menu: GRN > Return / Discount), checked at phone width in a headless browser |
| Vendor DISCOUNT updates payable + cost of items in stock | same | NEW, CHECK. Known edge: units returned earlier count as "no longer in stock" in the sold-share figure |
| Payable stays until cheque clears; Fri->Mon, Sat/Sun->Tue | utils/bankDays.js, tests | OK (existing) |
| Pop-up 3 days before cheque due | utils/chequeAlerts.js (WhatsApp, 06:00 rule) | OK; on-screen pop-up GAP |
| Credit counts from the day the bill is received | utils/grnBill.js readTerms (due = GRN date + credit days) | OK |
| Item code series 001, 002 + vendor code column | routes/item_catalog.js, routes/grn_manual.js, 3 tests | NEW: stored + accepted by API; not yet shown in item screens |
| One photo per item | item_catalog photo_url | OK (existing) |
| Market purchase never touches stock, only net profit | routes/daily_breakdown.js, utils/daily_breakdown_math.js | OK (existing) |
| Daily breakdown: COGS, cheques, rent 70,000, salary, commission, other, net | same | OK; commission default now 5 on NEW databases only |
| Commission 5% of gross profit, weekly | utils/commissionWeekly.js (default 5), tests | OK |
| Daily cost target 18,000 | utils/salaryMath.js cost_ceiling 18000 (normal 15000) | CHECK which number you mean |
| Loans separate from vendor money | routes/investor_loans.js (own tables) | OK (design) |
| Uploads in flat date folders, Download + Remove on every upload | document_inbox (reject = remove), /photo = download | PARTIAL: buttons not uniform on every upload screen |
| AI fills the form from photo / voice / type (free only) | routes/grn_read.js (free OCR), grn_manual, voice via geminiVoice | PARTIAL: photo OK; voice for GRN not checked |
| Works offline, syncs later | public/offline-queue.js (vendor ledger, daily entry) | CHECK on a real phone |
| "Super Dashboard" shortcut | no page with that name found | QUESTION for Ajmal: which page? |
## Tests: 
Whole suite: 14 failures before AND after tonight's changes (same 11 suites, all older than tonight). New tests added: 14, all pass. Real-Postgres copy run: GRN -> return -> discount -> refusals (too many, too big, no reason) all behaved.
## Needs the PC / real data (not done): backup restore, usage-since-22-Oct SQL, phone look of the new menu, restart apex-server to load new routes (after a passing backup).
