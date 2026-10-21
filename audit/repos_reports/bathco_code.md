# BATHCO repo (original live-shop app) - CODE report

Scope: code side only. Read-only research. No code was run. No secret values, full phone numbers or customer names are in this report.
Repo: 190 commits, 339 tracked files, branches: master (tip 390c647, 2026-07-27) and origin/ledger-fixes-2026-07-25 (16 commits NOT merged into master).
Compared against: BATH-HUB at E:\AI Sttuf\BATHCO_TEMPLATE (routes/, public/, scripts/, utils/).

---------------------------------------------------------------------
## 1) Architecture of the old app (10 lines) and how it differs from BATH-HUB
---------------------------------------------------------------------
1. One Node/Express 5 server (server.js, 3,152 lines) holds almost everything: login (bcrypt + session cookie + optional TOTP), roles admin/owner/staff, about 100 endpoints, file upload, OCR calls, reports.
2. Postgres database "bathco" (about 49 tables). Almost all money data lives in one table, daily_summary (one row per shop day), plus cheques, credit_customers, grn_records, staff/salary, suppliers, chart-of-accounts/journal tables.
3. Six extra route files (routes/): audit, cheque_register, cheque_tracking, daily_entry_sync, purchasing_accounting, staff_reports. Each opens its OWN database pool.
4. LAYLA = WhatsApp sales receptionist (layla.js + whatsapp-bridge.js using whatsapp-web.js + Claude/OpenRouter). Money questions are answered by a no-AI lookup engine (scripts/layla_answer_engine.js).
5. grn-watcher.js watches a folder for supplier goods-received files and OCRs them into grn_records for review.
6. Front end = giant single-file HTML pages (public/BATHCO_NATURE.html 144 KB, archive/dashboard.html 275 KB, and on the unmerged branch public/daily-entry-v2.html 273 KB). No build step, inline scripts, helmet CSP switched off.
7. Data came from Lasersoft (the POS) Excel/PDF exports + handwritten expense-sheet photos. Python/Node scripts rebuilt history, OCR'd photos, reconciled and loaded it.
8. pm2 (ecosystem.config.js) runs bathco-server :3000, grn-watcher, whatsapp-bridge. Railway config exists (railway.toml, health check /health).
9. Side projects: software/ (Python FastAPI prototype + stock analysis scripts + Docker "AI empire" stack) and bathco-mobile/ (Expo app, paused).
10. A lot of the repo is notes for AI agents (claude-commands/ 93 files, agents/, many *.md status/handover files) - not code.

How it differs from BATH-HUB (hard facts from file/endpoint comparison):
- BATH-HUB is a SUPERSET of the old app's server. I extracted every route path from both: old = 172 unique method+path pairs, BATH-HUB = about 390. Only 6 old paths do not exist in BATH-HUB: GET /api/audit/day-invoices, GET+POST /api/cheque-tracking, GET+POST /api/daily-entry/sync (+ /sync/:date, /meta/:date). Everything else (attendance, leave, advances, payroll-export, heatmap, journal entries, trial balance, P&L, VAT, bank transactions, landed costs, year-end closing, quotations, nl-query, daily-close, checker-run, recon-check, alerts, TOTP etc.) already exists in BATH-HUB.
- BATH-HUB's layla.js, grn-watcher.js, check-system.js, whatsapp-bridge.js, index.js, validate_data.js, ecosystem.config.js and the 5 shared route files exist but have been edited (diffs of 10-230 lines): they are the evolved versions. BATH-HUB's 5 shared scripts (daily_reconciliation_check, layla_answer_engine, ocr_photo, seed_feature_flags, create_instance) differ only slightly (4-41 diff lines).
- BATH-HUB adds many things the old app never had: 37 route files (documents, document inbox, POS bills, sale commissions, investor loans, money control, site editor, catalogue, competitors, content calendar, enquiries, notifications, backups, branches, apex/fleet admin, agent brain...), utils/ (backup encryption, DB guard, startup checks, hardening), layla_v2/, public website, POS screens, offline queue, a11y and design system.
- What the OLD repo has that BATH-HUB does not (the real gap, see section 6): the unmerged daily-ledger page (daily-entry-v2.html) and its sync/cheque routes, the Python OCR/reconciliation/ingest tools, product-cost/item-level import scripts, an AES vault backup script, the old mobile app, the Python FastAPI prototype with stock-analysis scripts, and n8n workflow JSONs.
- The old app is single-shop (shop name "Bathco", Sri Lanka, hard-wired business facts in shop_config.json); BATH-HUB is multi-tenant/white-label.

---------------------------------------------------------------------
## 2) Module inventory (state = working / prototype / abandoned / one-off)
---------------------------------------------------------------------
| Group | What it does | State |
|---|---|---|
| server.js | Core API: login/session/TOTP, role guards (staff see own data only), daily_summary CRUD and field patches, alerts, customers/leads, cheques, credit customers, suppliers/GRN, staff/salary/loans, quotations, uploads with file-type sniffing, OCR upload, WhatsApp webhook (+photo webhook), NL query, daily-close, recon-check, "agent" endpoints (Vera alerts, Nova weekly, Quinn GP), reports download, feature flags | WORKING (was live). Superseded by BATH-HUB server.js (3,437 lines) |
| layla.js | LAYLA prompt builder (from shop_config.json), lead capture, escalation rules, "TEACH:" owner command stored in LAYLA_TAUGHT_FACTS.md, price/promise ban rules | WORKING; BATH-HUB has evolved copy (+layla_v2) |
| scripts/layla_answer_engine.js | Deterministic answers for net profit/sales/stock/cheques by day/week/month with shorthand (np, gp, cheq) and honesty labels for ESTIMATE/BLENDED GP | WORKING; already in BATH-HUB (4-line diff) |
| whatsapp-bridge.js | whatsapp-web.js QR bridge, whitelist test mode, photo download to a drop folder, POST /send | WORKING (fragile: unofficial); BATH-HUB has newer copy and a Business-API util |
| grn-watcher.js, scripts/migrate_grn.js | Folder watcher + OCR of GRN/supplier bills into grn_records (status PENDING_REVIEW) | WORKING; in BATH-HUB |
| index.js | Older small entry file (health + WhatsApp webhook) | LEGACY, superseded by server.js |
| check-system.js | Health check of ports, Postgres, pm2 | WORKING; in BATH-HUB |
| validate_data.js | Scans data folder per date, flags missing sales Excel / expense photo / Lasersoft report, writes DATA_INDEX.json | ONE-OFF (June 2026), in BATH-HUB |
| routes/audit.js | Audit module: daily detail, summary rollups, flags, Excel audit workbook, full report + PDF (pdfkit), NEW day-invoices endpoint (per-invoice Lasersoft list with GP) | WORKING; BATH-HUB version is newer except day-invoices |
| routes/purchasing_accounting.js | Purchase orders, PO-vs-GRN matching, supplier price list + best price, supplier aging, landed costs, shipments, chart of accounts, journal entries, ledger, trial balance, P&L, balance sheet, VAT report, bank txns + matching, cheque calendar, petty cash, expense budgets, year-end close | WORKING (backend); BATH-HUB has it plus accounting.html |
| routes/staff_reports.js | Attendance, leave, advances, payroll export, commission autocalc, monthly trends, daily digest, cashflow forecast, customer LTV, heatmap, margin by product, top/slow items | WORKING; in BATH-HUB |
| routes/cheque_register.js | Cheque register (own table, due-soon/overdue) | WORKING; BATH-HUB version is richer (hold, money_control) |
| routes/cheque_tracking.js | Whole-list replace API for the daily ledger's cheque tab (table cheque_tracking) | SUPERSEDED inside the old repo by cheque_register; NOT in BATH-HUB |
| routes/daily_entry_sync.js | Live sync for the offline daily-ledger page: table daily_entry_live (JSON per day), device id, polling meta endpoint, host-laptop file backup. On the unmerged branch adds a /range endpoint | WORKING (branch); NOT in BATH-HUB |
| public/ | BATHCO_NATURE.html (old owner app), progress.html, DATA_INDEX.json, PWA manifest + service-worker, themes (kim_forest, nature, _TEMPLATE), hyperspace-theme.js (three.js theme), xlsx lib | BATHCO_NATURE already in BATH-HUB as legacy; rest duplicates |
| public/daily-entry-v2.html (branch only) | Offline-first daily ledger: Sales / Expenses & Payouts / Cheques / Range tabs (details in section 6) | WORKING, newest work (July 25-27), NOT merged |
| archive/ | bathco_live.html, dashboard.html (old dashboards) | ABANDONED (kept for reference) |
| reports/ | index.html, PDC_CHEQUE_TRACKER.html, Installation_Instructions.html (static) | one-off |
| config/ | bathco.branding.json, active.branding.json (name/colours, 677 bytes each) | WORKING, small |
| schema.sql | First schema (users, customers, leads, conversations, products, packages, daily_reports, cheques, voice_notes, alerts) with 3 default packages and 3 integrity constraints added 2026-07-03. Out of date vs the real 49-table DB (the real tables were created ad hoc by CREATE TABLE IF NOT EXISTS at boot) | OUTDATED |
| tests/ | 4 files: auth + daily-summary integration (mocked DB), aggregate unit test for OCR import aggregation. On branch: cheque-register unit test | small but real; BATH-HUB has own tests |
| ecosystem.config.js, railway.toml, .nvmrc | pm2 apps (server, grn-watcher, bridge) and Railway nixpacks start/health | WORKING; same name "bathco-server" clashes with the hard rule in BATH-HUB CLAUDE.md - do not copy |
| backup_vault.py | Zips the whole project folder and encrypts with AES-256-GCM, key from password via PBKDF2-SHA256 (480k iterations), random salt+nonce, manifest; lock and unlock modes. Paths hard-coded (C:\BATHCO_PHASE1 -> F:\Backup) | WORKING; good simple tool |
| import_dali_master.py | Loads the big DALY SALES REPORT Excel rollup into daily_summary | ONE-OFF (history load), has hard-coded DB password |
| end_session.py | Prints headline stats and appends to a log | ONE-OFF, has hard-coded DB password |
| openrouter.config.js | OpenRouter client (free Nemotron model), key from env | WORKING |
| whatsapp / agents | agents/*.md, claude-commands/*, .clauderules, CLAUDE.md: AI instructions (out of my scope) | docs |
| DALI/ (history only) | import_may_2026.py, insert_dali_expenses.js, read_dali.py + 100+ day-sales Excel files + tile catalog PDFs/HTML. Removed from tracking 2026-06-30 (still in git history) | ONE-OFF, ABANDONED |
| backups/, root *.json/*.csv | 5 JSON table dumps of 2026-06-13 (credit customers, staff, staff salary, supplier payments, suppliers) + a credit customers CSV of 2026-06-12 | DATA, contains personal data (section 7) |
| MASTER_LEDGER/ | master_ledger.md/.xlsx, JUNE_2026_REPORT (generated reports of real daily figures) | DATA (business figures) |

---------------------------------------------------------------------
## 3) The mobile app (bathco-mobile)
---------------------------------------------------------------------
- Tech: Expo SDK 54 / React Native 0.81 / React 19, TypeScript, react-navigation bottom tabs, expo-linear-gradient, react-native-svg, reanimated. 25 files, 1 commit only (2026-06-16). Its own PAUSED.md says: paused 15 June 2026, replaced by "make the dashboard a PWA".
- Screens (4): Login (username + password), Home (today and month-to-date Sales/GP/NP/Expenses, pulse cards, animated counters, donut chart, date carousel), Reports (pick a day, calendar month view, day figures Sales/GP/NP/Expenses/Cash in hand, data tier badge FULL/CASHFLOW/FOUNDATION), Staff (leaderboard ranked by commission, tier badges, "net profit so far" for the pay period).
- Components: AnimatedCounter, CalendarMonth, DateCarousel, DonutChart, GradientCard, Leaderboard, PulseCard, TierBadge. Theme: dark navy/teal/gold.
- API calls (6, all read-only, session cookie): POST /api/login, GET /api/me, GET /api/home-stats, GET /api/daily-summary (limit or date), GET /api/staff, GET /api/pay-period-summary, plus GET /DATA_INDEX.json. All of these endpoints EXIST in BATH-HUB (home-stats, daily-summary, staff, pay-period-summary, login, me), so the app would talk to BATH-HUB with a one-line change.
- Completeness: about 60-70% of a read-only viewer. No write actions, no POS, no push notifications, no offline mode, no logout screen test, never built or tested on a phone per its own notes. Base URL is a hard-coded home LAN address (192.168.1.9:3000) - a private IP, not a secret.
- Reuse for BATH-HUB: do NOT port as-is (BATH-HUB already is a PWA with offline queue). Reusable ideas: the cookie login state machine (AuthContext), the owner "pulse" home layout and the staff commission leaderboard, calendar month view with per-day status colours. If a native owner-only app is ever wanted: change BASE_URL to the BATH-HUB domain (https), add push, and treat the code as a 1-2 day starting point. Needs `npm install` (package-lock is 342 KB; node_modules is ignored).

---------------------------------------------------------------------
## 4) software/ folder (56 files)
---------------------------------------------------------------------
Dated 2026-06-01 (the very first commit). It is the owner's FIRST attempt before the Node app, built with a different stack:
- software/app/ = "1st Choice Bathco - Business Management": Python FastAPI + SQLAlchemy + PostgreSQL, a single frontend/index.html (32 KB, same as reports/index.html), routers: sales, cheques, inventory, cashflow, assistant (Claude), importer (Excel import). models.py/schemas.py/seed_data.py (26 KB seed of products/stock). START_BATHCO.bat starts it. requirements pin fastapi, sqlalchemy, pandas, openpyxl, reportlab, anthropic.
- software/ root contains duplicate copies of the same backend files (main.py, models.py, cheques.py ...) plus 17 stand-alone stock-analysis scripts that read the shop's Lasersoft Excel exports by unzipping the xlsx XML (no openpyxl): fast_movers, non_moving_and_sales, analyze_movement, analyze_qty_price, category_breakdown, zero_below_cost (items sold below cost), full_stock_count / stock_count_detail / stock_detail2 / read_stock_*, analyse_cheques, full_report, build_master (consolidated master workbook), check_phys, process_new_file.
- docker-compose.yml + START_EMPIRE/STOP/STATUS .bat + 2 n8n workflow JSONs: a local "AI empire" stack (Postgres, Open WebUI + Ollama, n8n, Portainer, Metabase). WORKFLOW_1 = watch a data folder for new .xlsx and analyse; WORKFLOW_2 = daily 8 AM report.
- State: PROTOTYPE, superseded and explicitly "an unused prototype, not referenced by server.js/pm2/package.json" (commit 43bb66d). Never ran in production.
- Still of value: the stock-analysis ideas (fast/non-moving, below-cost items, category breakdown, physical count vs system count) as report logic; the n8n workflow idea (folder watcher, 8 AM daily digest). Hard-coded passwords in docker-compose.yml (section 7).

---------------------------------------------------------------------
## 5) scripts/ (47 files): purpose + usefulness for BATH-HUB
---------------------------------------------------------------------
Legend: USEFUL = worth porting/keeping idea; MAYBE; NO = one-off/dead.

Data import / history rebuild
- build_master_data.js (739 L): offline read-only audit of a source folder, classifies every Excel/photo/Lasersoft file per day, writes BATHCO_MASTER_DATA_REBUILD.xlsx. MAYBE (good pattern for onboarding a new client's messy history; paths hard-coded to a C:\Users\DELL desktop).
- _investigation/* (8 files): peek/coverage/diagnose helpers for the above (check_lasersoft, coverage_check, diagnose_gp double-count detection, peek_headers, scan_rollup_dates ...). NO (one-off).
- ingest_1122.py (482 L): agent that ingests a folder (daily sales report, day files, RepSalesAnalysis, PDFs) with dry-run default and --apply. MAYBE (dry-run-first pattern is good).
- import_june_xlsx.js, upload_june_lasersoft.js, dryrun_june_upload.js: load June 2026 daily Excel files (payment splits) / upload Lasersoft files through the API with a dry run. NO (one-off) but dry-run pattern is good.
- import_item_level_sales.js: parse Lasersoft "Sales By Item Detail" into audit_invoice_items and estimate line cost from today's avg cost (flagged as ESTIMATE). USEFUL if item-level margin is wanted (BATH-HUB audit.js already references audit_invoice_items).
- import_product_costs.js: import Lasersoft "Item Price List" (2,634 rows: code, description, cost, price, UOM, qty) into products, upsert avg_cost/selling_price/stock. USEFUL for importing a client's price list / stock opening balance (BATH-HUB has item_catalog.js - check it covers this Excel import).
- load_master_ledger_pass3.js / pass4.js: load reconciled expenses and real GP into daily_summary, fill missing GP using month average GP% with --dry-run. MAYBE (the "blend GP by monthly average and label it BLENDED/ESTIMATE" rule is the valuable idea; BATH-HUB already has BLENDED labels).
- create_whatsapp_draft_table.js: staging table so WhatsApp photo -> OCR -> reply YES -> only then written to the ledger. USEFUL idea (already in BATH-HUB scripts).

OCR of expense photos
- ocr_photo.js (61 L): shared helper, photo of handwritten sheet -> JSON through OpenRouter free vision model. USEFUL; BATH-HUB has newer copy.
- ocr_expense_photos.py (559 L): batch OCR of hundreds of photos with resume file, per-date aggregation rule (if any photo is the summary sheet, use its total; else sum unique items), low-confidence photos held 48h in _pending_review, never touches days with missing sales. USEFUL (the aggregation rule + resume + confidence gating are the real intellectual property).
- ocr_rerun_may13_may19.py, ocr_retry_loop.py: targeted re-run and automatic retry wrapper for the rate-limited free model. NO (one-off), the retry loop idea is MAYBE.
- ocr_expense_results.json (17 KB): saved OCR results (contains real daily amounts; no personal names seen). DATA.
- import_ocr_expenses.js (241 L): re-runs the aggregation and writes expenses and net profit into daily_summary; exports aggregateByDate; covered by tests/unit/aggregate.test.js. USEFUL (the only OCR module with a unit test).

Reconciliation / ledger rules
- reconcile_bathco.py (709 L): for each date reads sales Excel + Lasersoft profit report (invoice or item level, or a screenshot via OCR) + expense photo, compares receipt by receipt, flags mismatches, caches photo OCR. USEFUL (best candidate for a "daily reconciliation" feature; BATH-HUB only has daily_reconciliation_check.js).
- daily_reconciliation_check.js (222 L): runs in the daily pipeline, reports only flagged days. In BATH-HUB already.
- fix_cash_in_hand.js: applies the confirmed formula (cash_sale != 0 -> cash in hand = cash_sale - expenses - payments; no cash sale -> NULL). USEFUL as documented business rule (BATH-HUB has its own cash in hand logic - compare before trusting).
- flag_conflict_dates.js, fix_17jun_expenses.js, fix_gp_status.js, update_daily_17jun.js, verify_17jun.js, check_0906_1506.js, check_credit.js, check_daily_17jun.js: hand fixes for specific dates (hard-coded values, some customer names inside invoice lists). NO (one-off, personal data inside update_daily_17jun.js).
- seed_accounts.js: creates the 10 staff/owner logins with random 12-character temp passwords written to a local ignored file (never printed). USEFUL pattern (good practice).
- seed_feature_flags.js: seeds the feature_flags registry (core on / dormant off, "built" flag). In BATH-HUB.
- create_instance.js: clone live schema (structure only) into a new database and generate branding config = local "instance factory". In BATH-HUB (and replaced by tenant tooling).
- migrate_grn.js, migrate_payments.js: table creation. In BATH-HUB.

Exports / reports / docs generators
- build_june_2026_report.js (reads a path inside another user's temp job folder - broken), build_master_ledger_export.js (daily_summary -> master_ledger.xlsx/md), generate_master_export.js (393 L), generate_full_context.js (272 L, writes an AI context file from the DB; mentions where secrets live, no values), consolidate_project.js (dumps all source into one text file for AI review). MAYBE for the Excel/MD export of the whole ledger (accountant hand-over); others NO.
- layla_answer_engine.js: see section 2. In BATH-HUB.
- BATHCO_MASTER_DATA_REBUILD.xlsx (19 KB): generated workbook. DATA.

Quick summary of the five things you asked about:
- Data import: import_product_costs.js, import_item_level_sales.js, ingest_1122.py (dry-run pattern), build_master_data.js.
- OCR of expense photos: ocr_expense_photos.py + import_ocr_expenses.js (+ ocr_photo.js).
- Reconciliation: reconcile_bathco.py (best), daily_reconciliation_check.js, flag_conflict_dates.js.
- Backups: backup_vault.py in repo root (AES-256-GCM). BATH-HUB already has backup_encrypt.js + backupCrypto.js + restore script, so only the idea of one-file vault with manifest is extra.
- Ledger rebuild: load_master_ledger_pass3/4.js + fix_cash_in_hand.js + build_master_ledger_export.js. All have --dry-run or read-only habits; the rules are in RECONCILIATION_RULES.md / GOLDEN_CORE.md (docs, not code).

---------------------------------------------------------------------
## 6) Features / algorithms here but MISSING or weaker in BATH-HUB - ranked top 15
---------------------------------------------------------------------
Checked: BATH-HUB has no daily-entry page, no daily_entry_live table, no holiday list, no pdf.js, no mobile app, no n8n flows (grep on server.js, routes/, utils/, public/*.html).

| # | Item | File (where) | Why valuable | Effort | Risk |
|---|---|---|---|---|---|
| 1 | Offline-first daily ledger page (Sales rows with invoice series, Expenses & Payouts, Cheques, Range tab; keyboard arrow-key navigation, pinned totals bar, undo toast, print layout, local-folder backup, install as app) | origin/ledger-fixes-2026-07-25: public/daily-entry-v2.html (273 KB, 4,629 lines) | This is the shop's real daily routine and the newest work in the repo (27 fixes, July 25-27). BATH-HUB's POS/money-control do not replace a fast cashier-style day sheet | Medium-High (rewrite to BATH-HUB design system and tenant/auth; page itself is a monolith) | Medium: it was built with NO LOGIN by design (auth bypass in server.js for sync/meta/cheque paths). Must be put behind login first |
| 2 | Live multi-device sync with conflict handling (device id, update stamp, light polling endpoint, unsynced banner, retry with backoff, save-error banner, conflict banner) | routes/daily_entry_sync.js + the sync functions in daily-entry-v2.html | Works on shop Wi-Fi with several PCs and flaky internet; BATH-HUB has an offline queue (public/offline-queue.js) but not the per-day payload merge/poll design | Medium | Low-Medium (routes use their own pool and no auth) |
| 3 | Cheque clearing-date calculator with Sri Lanka bank holidays (same bank = cheque date rolled to business day; other bank = next business day; never recompute cleared cheques; warns when a year's holiday list is missing; 2026 list included) | computeClearingDate + SL_BANK_HOLIDAYS in daily-entry-v2.html (branch) | Directly cuts cheque-due mistakes; BATH-HUB money_control has clearing/hold but no holiday-aware date maths | Low (pure functions, easy to move into utils/ and test) | Low. Holiday list must be maintained yearly and verified against the Central Bank list |
| 4 | Lasersoft PDF upload -> in-browser parse (pdf.js) of invoice list and gross profit with reconciliation vs typed sales; Net Profit = Lasersoft GP - expenses; GP shown PENDING instead of guessed | lasersoft* functions in daily-entry-v2.html + public/lib/pdf.min.mjs (branch) | Removes manual GP typing; strong "never fabricate a number" rule | Medium | Medium: depends on Lasersoft PDF layout; needs sample files and tests |
| 5 | Photo-OCR day-sheet pipeline rules: aggregation per date (summary sheet wins, else sum unique items), confidence gating, 48h pending-review quarantine, resume file, free-model-only lock | scripts/ocr_expense_photos.py, import_ocr_expenses.js, tests/unit/aggregate.test.js | Turns hundreds of WhatsApp expense photos into numbers with an audit trail; BATH-HUB document inbox does single docs, not per-day aggregation | Medium (port the JS aggregation + test; Python optional) | Low if kept as draft-then-confirm |
| 6 | Historical reconciliation engine: Excel sales vs Lasersoft profit report vs expense photo, receipt-by-receipt, mismatch flags, cached OCR | scripts/reconcile_bathco.py (709 L) | A proper "does the day add up" report; BATH-HUB's daily_reconciliation_check is lighter | Medium | Low (read-only) |
| 7 | Per-invoice day audit list (invoice, customer, amount, GP + source flags) for the printable Daily Audit report | routes/audit.js GET /api/audit/day-invoices | Only 1 SQL query; fills a gap in the printed audit; needs the lasersoft_invoices table (rename is a pending decision in BATH-HUB queue item 4) | Low (1-2 hours) | Low; touches the golden-core table name so read only |
| 8 | Product cost and stock import from Lasersoft price-list Excel (upsert avg_cost/selling price/qty by item code, creates new items) | scripts/import_product_costs.js | Fast onboarding of a client's stock list; fixes "no cost coverage" problem | Low | Low-Medium: overwrites costs, so add dry-run and approval |
| 9 | Item-level margin import + estimated COGS with honest cost_source flag | scripts/import_item_level_sales.js | Margin by item without waiting for a real costing system; label ESTIMATE | Low-Medium | Low |
| 10 | Stock analytics from Excel: fast movers, non-moving, items sold below cost, category breakdown, physical vs system count | software/fast_movers.py, non_moving_and_sales.py, zero_below_cost.py, category_breakdown.py, stock_count_detail.py | Direct profit levers for a tile shop (dead stock money, below-cost sales). BATH-HUB has top/slow items endpoint but not below-cost or count variance | Low-Medium (port logic to SQL/JS) | Low |
| 11 | GP-blend and honesty-label system for incomplete days (ACTUAL / BLENDED month-average / ESTIMATE, day tier FULL/CASHFLOW/FOUNDATION) | scripts/load_master_ledger_pass3.js, pass4.js, server.js tier CASE | Already partly in BATH-HUB (BLENDED labels exist) - check it also has the "tier" concept shown in mobile app and the retro-blend admin action | Low | Low |
| 12 | Encrypted single-file vault backup with manifest (AES-256-GCM, PBKDF2 480k) | backup_vault.py | Simple, offline, password-based; BATH-HUB already has backup_encrypt.js, so this is a "nice alternative" only | Low | Low |
| 13 | n8n automation flows: folder watcher for new Excel, 8 AM daily digest | software/WORKFLOW_1/2 json | Ready-made flow ideas (BATH-HUB has notify_due_soon + notifications) | Low | Low (needs n8n/Docker) |
| 14 | Owner mobile viewer (Expo app) with pulse home, calendar, staff leaderboard | bathco-mobile/ | Native feel and possible push; BATH-HUB is a PWA already | Medium | Medium (store/maintenance cost) |
| 15 | Instance/tenant factory and branding file (clone schema without data + branding json) | scripts/create_instance.js, config/*.branding.json | Already in BATH-HUB and replaced by apex tenant tools - listed only to confirm nothing is lost | none | none |

Honorable mentions (ideas, not code): the "TEACH:" owner command with a facts file for LAYLA (BATH-HUB utils/agentWhatsapp.js already has it); the rule file RECONCILIATION_RULES.md / GOLDEN_CORE.md.

---------------------------------------------------------------------
## 7) Credentials or personal data in code (NO values)
---------------------------------------------------------------------
Important: a dedicated secret scan file (leak_BATHCO.json) did not exist in the folder when I looked, so this section is my own grep of current tree + history. A proper scanner run is still recommended.

A) Real-looking credentials (still in the CURRENT master tip, so anyone with repo read access sees them)
1. end_session.py line 12 - literal Postgres password for user "postgres" on localhost, database bathco (since the first Node commit ddfa796, 2026-06-16).
2. import_dali_master.py line 68 - same kind (literal password in psycopg2.connect), since ddfa796.
3. CLOUD_DEPLOY_GUIDE.md line 61 - a PGPASSWORD=... example that starts like the real password family (looks like a real value, not a placeholder).
4. SECURITY_LOG.md line 13 (commit 50e240b, 2026-07-05) - writes the old dashboard login password in clear text (a weak name+year pattern). The log says it was rotated later the same day, but it is still readable in git history and the same pattern may be used elsewhere. The ADMIN_PIN is mentioned in the same paragraph but redacted.
5. software/docker-compose.yml lines 11, 45, 48 (commit c002c49, 2026-06-01) - literal Postgres password and n8n basic-auth user + password in the compose file.
6. software/app/database.py line 9 and software/database.py line 9 - default DATABASE_URL string with embedded credentials as fallback.
7. layla.js line 13 and whatsapp-bridge.js line 23 - the owner's full WhatsApp phone number (ends ...219) hard-coded as fallback whitelist (personal data, and it decides who may teach LAYLA).

B) Committed .env file
- software/app/.env was tracked in commits c002c49 (2026-06-01, initial) and fe3f7a8 (2026-06-01, "update API key in .env"). It held: DATABASE_URL, POSTGRES_PASSWORD, ANTHROPIC_API_KEY, host/port/app settings. Untracked in 43bb66d (2026-07-03), BUT it remains in history. The author's own commit message says the Anthropic key "still needs rotation" - nothing in the repo proves it was rotated. ACTION for owner: rotate that Anthropic key if not yet done.
- No other .env-like file was ever committed (checked all history for .env, .pem, .key, session files). .gitignore covers .env, .wwebjs_auth (WhatsApp session), TEMP_PASSWORDS.txt, backups/*.sql, uploads/, DALI/, data/.

C) Hard-coded DB password fallbacks in scripts (history only)
- `DB_PASSWORD || '<literal>'` fallback in grn-watcher.js, scripts/check_daily_17jun.js, daily_reconciliation_check.js, fix_17jun_expenses.js, fix_gp_status.js, migrate_grn.js, update_daily_17jun.js, verify_17jun.js: added 5b738cb (2026-06-20), daily_reconciliation_check.js also a8de351 (2026-06-21) and 117f85d (2026-06-30); removed 43bb66d (2026-07-03).
- DALI/import_may_2026.py and DALI/insert_dali_expenses.js: literal password; present ddfa796 (2026-06-16) through a1ab8f7 (2026-06-30, removed from tracking).
- Current scripts mostly read DB_PASSWORD from the environment, but 8+ scripts still hard-code host/db/user ("localhost", bathco, postgres) - not secrets but they run as the superuser.

D) Is the committed password still live?
- SECURITY_LOG.md (2026-07-05, Item 6) says the app was moved to a least-privilege role (bathco_app) and "old postgres role/password left untouched". So the literal password in items A1-A2 most likely STILL WORKS against the local Postgres on the shop laptop (localhost only, so risk is local unless the DB port is exposed or the same password was reused on Railway). The same password family appears in docker-compose and the deploy guide. Treat as live until the owner changes the postgres superuser password.
- Same file style can still hold a live credential: any `psycopg2.connect(... password='...')`, `new Pool({... password: '...'})`, `PGPASSWORD=...` in docs, and the committed docker-compose.yml. The newer scripts use `process.env.*`, which is the safe style.

E) Personal and business data committed (not code, but in the code repo)
- backups/ (5 JSON, commit a1ab8f7 and earlier): credit customers (names + phones + balances), staff, staff salary, suppliers, supplier payments (large amounts).
- backup_credit_customers_2026-06-13.json (root), credit_customers_pre_correction_20260612.csv (customer id, name, phone, invoice, amounts).
- scripts/update_daily_17jun.js: invoice list with customer names and a phone-like number; MASTER_LEDGER/*, HONESTY_AUDIT.md etc. (business figures).
- History only: bathco_backup_20260622.sql and bathco_master_fix.sql (full database dump, commit a264638 2026-06-22; removed from tracking later via .gitignore, still recoverable), uploads/daily/2026-06-16 and 2026-06-17 photos (WhatsApp images of expense sheets, commit around 2026-06-16/17), 100+ DALI/DAY SALE/data Excel files (daily sales exports with customer names), 11111.pdf (unknown content, commit c002c49), staff salary data. These are the most sensitive items: the SQL dump alone contains the whole business database at that date (password hashes, customers, salaries).
- server.err is tracked (empty / small).

---------------------------------------------------------------------
## 8) Code quality and security issues to know before reusing anything
---------------------------------------------------------------------
1. Auth bypass by design: server.js lets /api/daily-entry/sync, /meta, /api/cheque-tracking and /api/cheque-register through with NO login ("same no-login design"). Anyone on the network can read or overwrite day entries and the cheque register. Never copy these bypass lines; add login first. (Last commits are literally "hotfix: auth bypass".)
2. Every route file builds its own database Pool (audit, cheque_register, cheque_tracking, daily_entry_sync, purchasing_accounting, staff_reports, layla, grn-watcher, index.js) -> many connections, inconsistent SSL handling; BATH-HUB has utils/pool.js - use that.
3. Silent migrations: boot-time `ALTER TABLE ... .catch(()=>{})` swallows failures (its own SECURITY_LOG says all 49 tables stayed owned by postgres and every migration silently failed after the role change). No migration versioning; schema.sql is out of date.
4. Weak CSP: helmet contentSecurityPolicy is off because pages are giant inline-script files. Inline scripts + XSS risk if any user text is rendered with innerHTML (not audited in depth).
5. Rate limit is global 100 requests per 15 min per IP; the ledger page's background polling loops tripped it (commit bd50e9e). Multi-device polling needs a separate allowance.
6. Whole-list "delete then insert" saves (cheque_tracking POST, cheque register) - a bad or empty client payload wipes the table; no versioning/undo server-side.
7. Money handled partly as strings/floats in JS; GOLDEN rules live in docs, not in tests. Test coverage is tiny (4 files, mocked DB). 17 integration failures are noted in BATH-HUB baseline.
8. Hard-coded Windows paths everywhere (C:\BATHCO_PHASE1, C:\Users\DELL\Desktop..., F:\Backup, C:\BATHCO_DROP) - scripts will not run elsewhere; build_june_2026_report.js reads from another user's temp folder (broken).
9. whatsapp-web.js is unofficial (can get the number banned, kills sessions when two Chromes run); hard-coded fallback owner phone as whitelist; any reuse must go through BATH-HUB's whatsappBusinessApi util.
10. OCR relies on a free OpenRouter model (nvidia nemotron free) with rate limits and variable accuracy; results must stay draft-then-confirm (the repo already follows this rule - keep it).
11. Python side (software/) pins old versions (anthropic 0.40, fastapi 0.115) and enables CORS "*"; do not deploy. Docker compose exposes Portainer/Postgres/n8n ports with the committed passwords.
12. Express 5, pg 8, multer 2 etc. are current in package.json; xlsx 0.18.5 (SheetJS community build) is a known vulnerable version family (prototype pollution / ReDoS) - only parse trusted files or upgrade; `public/lib/xlsx.full.min.js` (880 KB) is bundled copy.
13. The 16 unmerged commits on origin/ledger-fixes-2026-07-25 also removed CLAUDE.md, PROGRESS.md and progress.html relative to master (that branch was cut earlier). Merging it blindly would delete those; cherry-pick the 12 changed code files instead.
14. Git history carries sensitive data (section 7E). If the repo is ever made public, shared with a client or a contractor, or cloned to another machine, scrub history first (git filter-repo) and rotate the Anthropic key and the postgres password. Per BATH-HUB CLAUDE.md item 6, vendor-internal docs from this lineage must never go into a client copy.

Overall verdict: for BATH-HUB, the old code side is mostly already absorbed. The real harvest is (1) the unmerged daily-ledger page + sync (rebuilt behind login), (2) the cheque clearing/holiday calculator, (3) the Lasersoft PDF parser with reconcile-or-show-PENDING rule, (4) the OCR aggregation + reconcile_bathco.py logic, (5) stock analytics (below-cost, non-moving, count variance), (6) day-invoices audit endpoint. Everything else is history, one-off, or duplicated.
