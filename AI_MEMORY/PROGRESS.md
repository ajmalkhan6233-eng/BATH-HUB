# PROGRESS: Design 2 reskin (black, ash, gold). 390px screenshots only. Rollback: git checkout design3-backup
App screens (token layer public/design2_tokens.css, imported by bathhub-design.css; SW cache v21):
- Dashboard: DONE: audit/design/before_dashboard_390.png -> audit/design/after_dashboard_390.png
- Daily Sales: DONE: audit/design/before_dailysales_390.png -> audit/design/after_dailysales_390.png
- POS Billing: DONE: audit/design/before_pos_390.png -> audit/design/after_pos_390.png; bill saved through the POS form after the reskin (200, total 2500): audit/design/after_pos_saved_390.png
- Stock: DONE: audit/design/before_stock_390.png -> audit/design/after_stock_390.png
- Reports: DONE: audit/design/before_reports_390.png -> audit/design/after_reports_390.png
Other screens:
- All other owner screens + standalone pages that use the design layer (44 scanned): DONE (auto contrast scan, 0 low-contrast text; 5 eyeballed: audit/design/other_*_390.png)
- (the six navy pages: see the list below, DONE)
- Jest for the reskin: DONE: before 1 failed (brain.test.js, old); after 1 failed (same). One full run under load had 3 timeouts (pass alone) + 1 real: SW version test wanted v20, now accepts v20+
Website (Netlify): NOT DONE (starts after the app screens)
Approved by Aj: the 5 app screens = YES.
Step 1, six legacy pages wired to Design 2 (public/design2_legacy.css, one <link> added per page, SW cache v22):
- vendor-ledger.html: DONE: audit/design/other_vendor-ledger_html_390.png
- money-plan.html: DONE: audit/design/other_money-plan_html_390.png
- morning-brief.html: DONE: audit/design/other_morning-brief_html_390.png
- layla-owner.html: DONE: audit/design/other_layla-owner_html_390.png
- pos-ledger.html: DONE: audit/design/other_pos-ledger_html_390.png
- daily-entry-v2.html: DONE (black/gold; cash figures stay green on purpose; its swatch themes are now locked to Design 2): audit/design/other_daily-entry-v2_html_390.png
Step 2 Jest + POS: DONE: Jest before 1 failed/1379 passed (127 suites), after 1 failed/1379 passed (same: tests/brain.test.js, old date). POS re-check at 390px with a dev test bill saved through the POS form: BHT-20261009-0007 total 2500: audit/design/after_pos_saved_v22_390.png
Step 3 WEBSITE (Netlify site = E:\AI Sttuf\bathhub-website, its own repo github.com/ajmalkhan6233-eng/bathhub-website branch work; NOT public/website/index.html, which is the shop app's /site page):
- Netlify site restyled black/ash/gold, orange removed (orange elements 37 -> 0), Sinhala + Tamil checked: DONE: audit/design/site/before_home_390.png -> after_home_390.png, after_shop_390.png, after_planner_390.png, after_quote_390.png, after_sinhala_390.png, after_tamil_390.png (commit eaffcd4 on bathhub-website branch work)
- App /site page (public/website/index.html, navy -> black/gold): DONE: audit/design/site/appsite_after_390.png
Step 4 Netlify PREVIEW deploy: NOT DONE (needs Aj: Netlify login). Step 5 publish to main link: NOT DONE (waits for "publish site").
Re-check (continue request): six navy pages already DONE and pushed (b3fa11d), nothing left to do there.
Website PREVIEW: NOT DONE: still no Netlify login or token on this PC (checked NETLIFY_AUTH_TOKEN, %APPDATA%\netlify, ~\.netlify). Not published. Aj steps: 1) npx netlify-cli login  2) "E:\AI Sttuf\bathhub-website\preview-site.cmd" (prints the draft link; main link untouched)
POS BUILD QUEUE (Aj said GO). 390px only. Screenshots in audit/pos/. Backup branch: backup-before-pos-build.
- Part A1 barcode scan box: DONE (scan adds qty 1, again +1, unknown code = message, nothing added): audit/pos/scan_unknown_390.png
- Part A2 hold / resume (browser storage, max 10, never a bill in the database): DONE: audit/pos/held_list_390.png
- Part A3 reprint (Last bill, Find bill, read only): DONE: audit/pos/reprint_last_390.png
- Part A4 qty +/- buttons, 44px targets, no sideways scroll: DONE: audit/pos/cart_390.png ; dev test bill saved from the POS form (BHT-20261009-0008): audit/pos/saved_bill_390.png
- Part B payment types: DONE (new table pos_bill_payments, no golden-core change): cheque, credit, split + cash unchanged; daily sales counts them per method; edit of such bills blocked (void and re-enter). Plan: AI_MEMORY/POS_PAYMENTS_PLAN.md. Screens: audit/pos/pay_cheque_390.png, pay_credit_390.png, pay_split_390.png, pay_split_mismatch_390.png, pay_split_receipt_390.png, pay_dailysales_390.png
- Part B NEXT STEP (needs Aj): cheque bills into the Cheques screen and credit bills into Credit & Aging (golden core / changes credit totals): not done on purpose.
- Part C quotation to bill ("Load quotation", read only): DONE: audit/pos/quote_list_390.png, quote_loaded_390.png, quote_billed_390.png (bill saved by the normal button at the quote total; quotation unchanged; the quotation is NOT marked as billed, so it can be loaded twice)
- Part D record: DONE (this file, HANDOFF, OPEN_ITEMS, LATEST_REPORT). Nothing published or deployed. Website not touched.
