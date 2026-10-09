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
