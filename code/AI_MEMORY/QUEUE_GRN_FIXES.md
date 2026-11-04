# QUEUE_GRN_FIXES (Ajmal 04 Nov, for the CLOUD to build; PC only pulls, tests, restarts)
Files: public/grn_workbench.html, routes/grn_workbench.js, public/home_simple.html. Test on a throwaway Postgres. Free tools only. Push to work.
Screenshot facts (Cool Lanka bill ME2026/1757 part 2 of 2, Rs 527,000, credit 90 days):
1. GENERATE: on a NEW GRN draft Ajmal pressed Generate; nothing visible happened, the draft just appeared under Drafts. Opening that draft later showed ONLY the total (527000), not vendor/bill no/dates/lines. Status bar read "CANCELLED. Stock taken back for 0 lines." on a draft that was never cancelled by him. Reproduce with a real vendor_bill photo, make Generate show progress, fill ALL right-side fields + lines, open that draft; on 429 show a plain message + Retry. Find why a draft looks cancelled.
2. GRN NUMBER: vendors with no GRN numbers are named 001 (Cool Lanka is 001). On vendor pick or number typed, check grn_records for vendor+number; if present say "GRN 001 already exists for <vendor> (date, total)" with Open it / use next free number. Never allow silent duplicates. No data changes.
3. ENTER: Enter in price/qty moves to next cell, next line, adds a line at the end; the GRN enter button goes to the next step.
4. NEW LOOK (Ajmal asked 03 Nov): redesign outside look with ecc-web-motion-pro APP mode: tokens first, one module at a time, simple home + GRN workbench first, big tap targets, no wasted margins, fast on low-end phone, free local assets.
Done = tests pass, headless-browser check of 1-3, LATEST_REPORT.md 5 lines, pushed to work.
