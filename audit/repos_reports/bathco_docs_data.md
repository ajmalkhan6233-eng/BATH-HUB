# BATHCO repo: documents and data report

Scope: the BATHCO repo (190 commits, 339 files at the latest commit, 148 markdown files), documents and data side only.
Method: read-only. I read files, used git history, and read xlsx sheet names, headers and row counts only. I did not run any code from the repo. I did not read any .env.
Labels: VERIFIED means I saw it in the file. UNVERIFIED means I inferred it or did not check it.
Privacy: no secret values, no customer or staff personal names, no full phone numbers appear in this report.

---

## 1) What this repo is, and its history

**What it is.** This is the original live-shop repo for "1st Choice Bathco (Pvt) Ltd", a tile and bathroom-fittings showroom at Thihariya, Kandy Road. It is the project the AI notes call "BATHCO COMMAND". It is a Node/Express app on Postgres. It runs on the owner's Windows PC (folder `C:\BATHCO_PHASE1`, port 3000, pm2). It includes a WhatsApp bot called LAYLA, a WhatsApp bridge, a goods-received (GRN) watcher, and an OCR pipeline for handwritten expense-sheet photos. The shop uses "Lasersoft" POS, which has no API, so data only leaves it as exported files. VERIFIED.

**How it relates to BATH-HUB.** BATH-HUB (BATHCO_TEMPLATE) is the cleaned, sellable white-label copy of this repo. The SESSION_LOG of 2026-07-07 says so: the template was stripped of real-business strings and has its own schema-only database. BATH-HUB has since moved on with Layla v2, documents, POS item picker, the /owner app, and more. This repo is therefore the parent. It holds the real business history that the template was deliberately scrubbed of. BATH-HUB already has the engine code: audit.js, daily_summary, daily_reconciliation_check.js, layla_answer_engine.js, cheque_register.js, salary.js, sale_commissions.js. It has none of the historical data, and none of the import scripts for item-level sales, product costs or expense-photo OCR. VERIFIED by file presence only. I did not query the BATH-HUB database, so what rows it holds is UNVERIFIED. Per CLAUDE.md the template DB is schema-only plus a demo tenant.

**Timeline (git, 174 commits by one author; the other 16 are merge or duplicate refs):**
- 2026-06-01, 3 commits. Initial commit of an early Python/FastAPI app in `software/` (SQLite-style models: daily_sales, products, sales_transactions, cheques, suppliers). It has about 25 Excel analysis scripts (fast movers, category breakdown, stock count, cheques). 93 slash-command stubs were added the same day. This was the pre-Node prototype. It is superseded.
- 2026-06-16 to 2026-06-22, about 78 commits. "BATHCO COMMAND Phase 1 complete" arrives. The Node dashboard gets Daily Entry, Excel parsing, the tier system, the reconciliation check, a Jest suite (34 tests), and the "golden-core" tag (2026-06-19). OCR import of handwritten expense sheets. A QA audit (1 critical, 1 high, 2 medium and 2 low bugs, all fixed). The "master fix" SQL and its rollback. Big "for GLM" export documents for an outside AI audit. The "1122 folder" ingestion on 2026-06-22 (2,098 Lasersoft invoices, 76 PDFs, 734 files catalogued).
- 2026-06-23 to 2026-07-01, 13 commits. Railway cloud-deploy prep, health endpoint, and a Postgres session store. The `DALI/` data folder (34 MB) and the `data/` folder (74 Lasersoft exports) were removed from the tree on 2026-06-30. They remain in git history.
- 2026-07-02 to 2026-07-05, 56 commits. The new "Nature" frontend. DB-backed feature flags. White-label config. Audit and accounting page. LAYLA v1 (DB-backed answer engine, teach mode, document classification, Ollama-first AI chain). The FINAL_BUILD phases: theme system, security hardening, bug hunt, audit-firm-grade report engine, pending-data dry-runs, and FINAL_V1 lock.
- 2026-07-06 to 2026-07-17, 6 commits. LAYLA fixes (reasoning-token leak, date stamp, zombie Chrome). June 30 finalised. The AZMI ~Rs 8M variance resolved.
- 2026-07-18 to 2026-07-27, 31 commits. Bridge hardening. A major daily-entry.html redesign. The "ledger-fixes" programme (27 items: sticky totals, cheque register persistence, bank-holiday-aware cheque clearing, Lasersoft PDF upload with reconciliation, Range tab). The last commit is a cheque-register hotfix on 2026-07-27.
- This repo stops at 2026-07-27. The live system and BATH-HUB have continued since. So the data here is a frozen snapshot and the live Postgres `bathco` on the laptop is newer. I did not access it.

**Other businesses mentioned in CLAUDE.md** (Dubai Imports perfume app, NOOR Digital SaaS, NOOR Islamic app, Bathco Aromatic). These are separate projects. Only `shop_config.json` carries Aromatic perfume data, and that is only for the LAYLA bot.

---

## 2) Document inventory (148 markdown files)

Counts: 34 in the root, 93 in claude-commands/, 12 in .claude/commands/, 4 in agents/, 3 in MASTER_LEDGER/, 2 in bathco-mobile/. There is no DALI/, archive/ or reports/*.md at the latest commit. `archive/` holds 2 old HTML dashboards. `reports/` holds 3 HTML files. DALI/ exists only in git history.

### A. Rules and business knowledge (high value)
- `GOLDEN_CORE.md`: splits the reusable engine (auth, upload, daily form, PDF/Excel export, OCR, NL query, tiers) from the BATHCO-specific parts (brand, LKR, 50k default expense, Lasersoft GP, 21 Dec 2025 start date, thresholds). It also has an extraction checklist. BATH-HUB's own AGENT_GUIDE/09 is its descendant.
- `BATHCO_BLUEPRINT.md`: the standing rules and the day-lifecycle formula spec (source of truth, 2026-06-20). It covers expenses vs payments, field map, petty float, manual bill timing, the day-close checklist, and the 17-Jun bug write-up.
- `RECONCILIATION_RULES.md`: data-truth hierarchy, quarantine log (19 bad OCR rows), known discrepancies, checker suppression rules, `gp_status` logic, invoice-gap detection, and the data-tier SQL.
- `HONESTY_AUDIT.md`: every dashboard number traced to its source, marked HONEST or FIXED. It sets the rule that a missing number shows PENDING, never 0.
- `CLAUDE.md` (35 KB, the "v3.0 agent contract"): surgical-edit discipline, dry-run checkpoint, RBAC roles, locked formula chain, GP blending, commission rule, alert triggers, the agent roster (LAYLA, CHECKER, QUINN, VERA/NOVA, COMMAND), the white-label architecture, the **testing-safety incident of 2026-07-20**, and the plain-language progress-tracking rule.
- `DEFAULT_DAYS.md`: the 100 days still carrying the Rs 50,000 default expense.
- `SUPPLIER_CLEANUP.md`: 24-supplier KEEP/MERGE/CHECK classification and the "AZMI is a personal payable, never merge" rule.
- `DATA_SOURCES.md`: the 5 real input formats (daily Excel, RepSalesAnalysis, accountant Sales Accounts, handwritten sheet, staff notepad).
- `LAYLA_TAUGHT_FACTS.md`: the "teach" log. It contains only the header, no facts were ever stored (VERIFIED, 195 bytes; one commit).
- `MODULE_REGISTRY.md`: domain-to-file map plus the M1 to M10 tagging scheme (M10 CORE-ENGINE is protected).
- `PENDING_FROM_AJMAL.md`: 17 open questions to the owner (wage list, credit mismatch, cutover date, supplier doubts).

### B. Data reconciliation and audit trail (medium to high value)
- `SOURCE_INVENTORY.md`: where each day's figures came from (source tag counts) and which 30 days are unverified.
- `DATA_MAPPING_STATUS.md`: day-by-day COMPLETE/PARTIAL/MISSING table (15 Jun).
- `BATHCO_HISTORICAL_DATA.md`: expense defaulting methodology, held conflicts, BLENDED-day explanation, and passes 1 to 4 of the data recovery.
- `MASTER_DATA_TASKS.md`: the 15-task data-cleaning list (14 done).
- `SPOT_CHECK_APR19_MAY31.md`: the 43-day spot-check list.
- `BATHCO_CONSOLIDATED_REPORT.txt` (2026-07-01): the richest business-insight file. It covers the RANGE (AZMI) vendor gap, tile vs non-tile split, turnover cross-check, cheques and payables, stock valuation, top sellers, dead stock, monthly trend and GP% by category.
- `MASTER_LEDGER/master_ledger.md`, `JUNE_2026_REPORT.md`, `file_inventory.md`: the 192-day ledger, a June report with confidence flags, and an index of every folder scanned on the laptop.
- `DECISIONS_LOG.md` (37 KB): decisions per session, including the "premise check" investigation of 10 Jun and a reconciliation against Lasersoft.
- `BUG_HUNT_LOG.md`: 2 bugs fixed, plus a 32-request fuzz pass with 0 failures.
- `BATHCO_QA_REPORT.md`: QA audit of 2026-06-21 (BUG-001 to BUG-006).
- `SECURITY_LOG.md`: the hardening log (helmet, rate limit, least-privilege DB role, secret rotation).

### C. Status snapshots and handovers (medium or low value, mostly stale)
- `HANDOVER.md` (2026-06-17), `BATHCO_HANDOVER_FOR_REVIEW.md`, `BATHCO_FULL_CONTEXT_FOR_GLM.md` (99 KB), `BATHCO_MASTER_EXPORT_FOR_GLM.md` (52 KB), `BATHCO_STATUS_REPORT.md`, `PORTFOLIO_STATUS.md`, `PHASE2_STATUS.md`, `PHASE_ROADMAP.md`. They are point-in-time exports, largely duplicated across files, and contain full daily tables.
- `SESSION_LOG.md` (51 KB, 2026-07-07 to 2026-07-21): the LAYLA fixes, June 30 finalised, the AZMI resolution, the daily-entry redesign, the disk-space incident, and the restart-loop incident.
- `PROGRESS.md` (50 of 50 plain-language items, 27 ledger fixes), `REFINEMENT_50.md` (50 review findings), `ORGANIZE_PLAN.md` (Desktop/Downloads tidy dry-run), `CLOUD_DEPLOY_GUIDE.md` (Railway steps), `BATHCO_MOBILE_BRIEFING_V2.md` and `bathco-mobile/PAUSED.md` (a paused Expo app).

### D. Agent prompts (low to medium value)
- `agents/BATHCO_MASTER.md` (the session reference file dated 31 May, with resolved alerts), `agents/BATHCO_ASSISTANT_MODE.md` (plain-English answer style), `agents/bathco-council.md` (an 8-advisor "company council" skill), `agents/llm-council.md` (a generic 5-advisor council).
- `.claude/commands/` (12 files, about 8.7 KB): scripted flows such as daily-close, credit-aging, supplier-check, weekly and monthly report. They call the old localhost:3000 APIs and Python scripts under `C:\Bathco\AI-Data`, which is outside the repo.
- `claude-commands/` (93 files, about 11.8 KB in total): one or two line stubs ("/margin-check: analyse margins") with no real logic. Low value. Some are not Bathco-related, for example dubai-status and daraz-list.

---

## 3) Data assets

Note on location: most data is not in the latest tree. The 2026-06-30 commit a1ab8f7 removed `DALI/` and `data/`. Both can be read back with `git show a1ab8f7^:<path>`. They also hold some original filenames with spaces.

### 3a) Files present at the latest commit

| Asset | What | Size / rows | Columns | Date range | Quality and sensitivity |
|---|---|---|---|---|---|
| `MASTER_LEDGER/master_ledger.xlsx` and `.md` | One row per day, the reconciled history | 192 days | Date, Total Sale, Cash, Card, Online, Cheque, Credit, Gross Profit, Expenses, Net Profit, Source, Confidence | 2025-12-21 to 2026-06-30 | VERIFIED. Totals: sales Rs 160.69M, GP Rs 36.04M, expenses Rs 11.80M, NP Rs 24.24M. 55 COMPLETE and 137 PARTIAL. 100 rows rely on the Rs 50,000 default expense (92 + 5 + 3 by source tag). Months: Dec 8.4M, Jan 13.5M, Feb 15.7M, Mar 28.4M, Apr 39.7M, May 29.4M, Jun 25.7M. Sensitivity: **ledger** (the shop's real finances). |
| `MASTER_LEDGER/JUNE_2026_REPORT.xlsx` and `.md` | June summary and day-by-day | 30 days; 2 sheets | Payment method split plus the same day columns | 2026-06-01 to 06-30 | Sales Rs 25.70M, GP 5.77M, expenses 1.58M, NP 4.19M. 6 COMPLETE, 24 PARTIAL. |
| `scripts/BATHCO_MASTER_DATA_REBUILD.xlsx` | Date spine that records which source files exist per day | 180 rows plus a coverage sheet | Date, Day, Sales File, Cost/GP File, Expense Photo, Total Sale, Cash, Card, Online, Cheq, Credit, GP, Cost, NP, paths | Dec 2025 to Jun 2026 | An older rebuild attempt. Coverage: 41 COMPLETE, 115 MISSING SALES, 19 MISSING COST, 4 NO DATA of 179 days. Superseded by the ledger. |
| `DATA_INDEX.json` | File coverage per day (from validate_data.js) | 176 days | status per day | 2025-12-21 to 2026-06-14 | A misleading artefact: 0 complete, 14 partial, 162 missing only because the AI-Data folder naming did not match. It does not mean the days are unrecorded. |
| `scripts/ocr_expense_results.json` | OCR of 43 handwritten expense-sheet photos | 43 records | total_sale, total_expenses, expense_items, payments, salary, cash_in_hand, confidence, sheet_type | May 2026 | Confidence mixed (high/medium/low/unclear/error). Two free vision models were used. Handwriting data, **ledger** sensitivity. |
| `backups/backup_suppliers_2026-06-13.json` | Supplier master | 24 rows | name, phone, category, notes, active | snapshot 2026-06-13 | Categories: Tiles, Pipes, Sanitary, Fittings, Finance/Lease, General, Tile Adhesive/Mortar, Hardware, Logistics. Business contacts: **supplier**. |
| `backups/backup_supplier_payments_2026-06-13.json` | Supplier payment history | 47 rows (cheque and cash), total Rs 27.40M | supplier_id, pay_date, amount, payment_type, invoice_ref, notes | Apr 29 to Jun 5 2026 | VERIFIED. A small slice of the real total (the cheque ledger shows Rs 114M). **supplier, ledger**. |
| `backups/backup_staff_2026-06-13.json` | Staff master | 13 rows | name, phone (none present), role (Sales/Manager/Admin), base_salary, commission_pct | snapshot | Base salaries are tiny (Rs 0 to 5,000), so they are placeholders, not real pay. Names are **personal data**. |
| `backups/backup_staff_salary_2026-06-13.json` | Salary payouts | 24 rows | amount, commission, period | 2026-05-11 to 05-12 only | A one-off distribution, not payroll history (HONESTY_AUDIT says the same). **personal data**. |
| `backups/backup_credit_customers_2026-06-13.json`, root copy, and `credit_customers_pre_correction_20260612.csv` | Credit customer invoices | 8 rows (1 quarantined) and a 5-row pre-correction CSV | invoice_date, invoice_no, amount, paid, due_date, name, phone, quarantined | Jan to Jun 2026 | Outstanding total Rs 668,800. The CSV phone numbers are obviously fake patterns, and 4 of the 6 live entries are marked "UNVERIFIED, not found in any daily Excel" in the docs. So this is **probably seed or demo data, not real receivables**. **customers/credit**. |
| `shop_config.json` | LAYLA business config | 7 blocks | showroom packages (3), brands (5), perfume collections, layla_rules, ai_personality | n/a | Contains the escalation rules, strict reply rules and personality. It includes Aromatic perfume data (a separate business). |
| `schema.sql` | An old 10-table schema | 162 lines | users, customers, leads, conversations, products, packages, daily_reports, cheques, voice_notes, alerts | n/a | **Stale**. The docs state the live schema is cloned with pg_dump, not this file. |
| `software/*.py` and `software/app/` | The early FastAPI app and Excel analysers | about 40 files | n/a | n/a | Code, not data. Obsolete after Jun 16. |
| `software/WORKFLOW_1/2_*.json` | n8n workflows (file watcher, 8 AM summary) | 2 | n/a | n/a | They reference `C:\Users\1st Choice\Desktop\bathco-data` paths. Obsolete. |
| `reports/*.html`, `archive/*.html`, `11111.pdf` | Old HTML dashboards, a PDF cheque tracker, and an unlabelled PDF | 3 + 2 + 1 | n/a | n/a | Old UI, not data. I did not open the PDF (UNVERIFIED content). |

### 3b) Data only in git history (the bigger prize)

Pre-deletion commit: `a1ab8f7^`. All of this is real Lasersoft or accountant output.

| Asset (history path) | What | Rows | Columns | Date range | Sensitivity |
|---|---|---|---|---|---|
| `DALI/DAY SALE/**` plus `DALI/DAY SALE/05/*`, `04-26/*` and `data/DD-MM-2026.xlsx` | The owner's nightly daily sheets, one file per day, about 60 days | around 10 to 20 rows each | DATE, RECEPT NO, SALES, CASH PAYMENT, CARD PAYMENT, ONLINE PAYMENT, CHEQ PAYMENT, CREDIT | Apr 18 to Jun 7 2026 (plus Jan 31, Feb 1, Feb 5) | Per-receipt, no customer names. **ledger**. This is the "100% truth" source in the rules. |
| `data/DALY SALES REPORT.xlsx` | Cumulative daily sales | 536 rows | same as above | Jan to Apr 2026 | **ledger** |
| `data/T SALE.xlsx` (Lasersoft "Profit by Sales") | Invoice-level profit | about 3,200 rows | DT, DATE, NUMBER, CUSTOMER, AMOUNT, BALANCE, COST, GPA, GP% | 2025-10-01 to 2026-04-22 | Has a **customer name** column. **customers/ledger**. |
| `data/CFBDF.xlsx` (Sales Summary) | Invoices by day | about 3,900 rows | NUMBER, CUSTOMER NAME, NET AMOUNT, BALANCE | 2025-10-01 to 2026-04-29 | **customers** |
| `data/RepSalesAnalysis_*.xlsx` (6), `DVD.xlsx`, `SCS.xlsx` | Per-rep or per-item sales and profit | 25 to 912 rows | CODE, DESCRIPTION, SLSQTY, SLSAMO, NETSLS, NETPRO (DVD adds invoice, customer, unit cost and price) | May 12 to May 30 2026 | Used for staff commission. **customers, personal data** (rep names). |
| `data/Sales Accounts - Copy.xlsx` | The accountant's tab-per-day sheet: items sold, cost, profit, expenses, net profit | 31 sheets | CODE, UNIT, SELLING PRICE, TOTAL AMOUNT, COST, TOTAL COST, PROFIT | March 15 to Apr 30 2026 | Ground truth for NP where it exists. **ledger** |
| `data/GRN.xlsx` | Purchases by supplier, detail | about 3,250 rows | GRN NO, S.I NO, CODE, DESCRIPTION, QTY, UOM, UNIT COST, EXT AMOUNT | 2025-12-01 to 2026-04-22 | **supplier, prices**. Cost prices. |
| `data/FNGJN.xlsx` | Purchases by supplier item summary | about 2,800 rows | CODE, DESCRIPTION, BILLS, LP DATE, LP QTY, TOTAL QTY, TOTAL AMOUNT | 2025-10-30 to 2026 | **supplier, prices** |
| `data/QUANTITY AND PRICE.xlsx` | The product master with cost, price, UOM and stock qty | about 2,600 rows | CODE, DESCRIPTION, COST, PRICE, UOM, TOTALQTY | as of April 2026 | **prices**. The best seed for a product catalogue. |
| `data/PRICE LIST.xlsx`, `TOTAL Q.xlsx`, `BFNH.xlsx`, `data/STOCK FAST.xlsx`, `SLOW.xlsx`, `NON MOVING.xlsx` | Price list, stock on hand, fast and slow movers, non-moving items | 900 to 2,600 rows each | CODE, DESCRIPTION, PRICE, QTY, STOCK VAL, SOLD QTY, SOLD AMO | Apr 2026 | **prices**. Several are near duplicates. Files named with a trailing "_" are twins. |
| `data/STOCK_COUNT_REPORT_20_04_2026.xlsx` | Physical stock count vs system | 11 sheets, 1,260 SKUs; 378 variance lines, 793 not counted | CODE, SYSTEM QTY, PHYSICAL COUNT, VARIANCE, UNIT COST, UNIT SELL, VARIANCE VALUE, STATUS | 2026-04-20 | **prices, stock**. Gives a real shrinkage baseline. |
| `data/PHYSICAL INVERNTORY WORKSHEET.xlsx` | Count sheet | about 2,600 rows | SKU, DESCRIPTION, ON HAND, PHY. COUNT | Apr 2026 | stock |
| `data/AFDAS.xlsx`, `TOTAL.xlsx` | GP by item group, and a Profit & Loss statement | 87 and 28 rows | ITEM GROUP, SOLD QTY, COST, SALES, MARGIN, GP% | to 2026-04-29 | **ledger**. P&L shows retail sales of about Rs 97.3M for the period to 28 Apr. |
| `data/VGNGF.xlsx` | Vendor listing with phone and balance | about 130 rows | NAME, TELEPHONE, ENDING BALANCE | Apr 2026 | **supplier**, with phone numbers. |
| `cheques/OUTBOUND_CHEQ_CLEAN.xlsx` and `data/OUTBOUND_CHEQ_CLEAN_.xlsx` | The cleared outbound cheque ledger | 252 cleared cheques, Rs 114.49M (per CONSOLIDATED_REPORT); 17 duplicate-ish sheets | Clearing Date, Cheque Num, Amount, Issued To, Bank Name | about Feb to Jun 2026 | **supplier, ledger**. About 20 cheques have a blank payee. The workbook has many copies of the same table. |
| `DALI/1ST_CHOICE_BATHCO_COMPREHENSIVE_REPORT.xlsx` | Master summary, daily sales, P&L, stock on hand (about 1,030 items) and a tax estimate | 5 sheets | see sheets | 2025-12-21 to 2026-04-20 | Gross sales Rs 89.3M, GP margin 18.4%, 1,593 invoices, stock at selling price Rs 139.4M. The tax estimate assumes 40% of GP goes to opex, which is a placeholder, not a real tax figure. |
| `DALI/1st_Choice_Bathco_Pricing_Report.xlsx` | Cost vs price, with recommended prices (about 1,027 items, a 76-item "urgent issues" sheet and a 65-item "raise these prices" sheet) | 4 sheets | Item Code, Cost, Current Price, Recommended Price, In Stock, Sales Amount, notes | Apr 2026 | **prices**. Stale by months. |
| `DALI/ESKEMA_CERAMIC_Invoice_Items.xlsx` | Items on supplier invoices | one sheet | n/a (not opened beyond the name) | n/a | **supplier, prices**. UNVERIFIED content. |
| `DALI/1stChoiceBathco_Tile_Catalog_2025.html`, `*_Tile_Catalog.pdf`, `*_Tile_Reference.pdf`, one 24x24 tile PDF | Tile catalogues (8.7 MB html, 2.2 MB and 16.9 MB PDFs) | n/a | n/a | 2025 | Product and brand marketing material. Low sensitivity. Possible use for the public Bath Hub site. UNVERIFIED rights. |
| `DALI/DALI_SUMMARY.txt` (245 KB) | A text dump of all DALI workbooks (daily sales, P&L, stock) | long | n/a | to Apr 2026 | Same data as above, in text. Contains 2 phone-number hits per the leak scan. |
| `uploads/daily/2026-06-16`, `2026-06-17` (16 JPEG files) | WhatsApp photos of the handwritten daily expense sheets | 16 photos | n/a | Jun 16-17 2026 | **ledger and handwriting**. Raw images. UNVERIFIED content (not opened). |
| `bathco_master_fix.sql` (4.8 KB, 2026-06-22) | The six-step data-fix script and its rationale | n/a | n/a | n/a | No data. Useful as documentation of the cash-in-hand double-count bug. |
| `bathco_backup_20260622.sql` | A DB backup committed at a1112db | **0 bytes** (empty) | n/a | n/a | Nothing in it. No DB dump exists in the repo. |
| `DALI/DAY SALE/MASTER COPY - Copy - Copy.xlsx` | A master copy workbook | not opened | n/a | n/a | UNVERIFIED. |

### 3c) Does BATH-HUB already hold the equivalent?

- **Sales history by day:** No, per the docs the template DB is schema-only. The live `bathco` Postgres on the laptop, which holds newer data, is the better source. The repo ledger is a snapshot to 2026-06-30. UNVERIFIED for the live DB, which I did not read.
- **Products and prices:** The repo has an `import_product_costs.js` script and an `item_catalog` route in BATH-HUB, but no data. QUANTITY AND PRICE.xlsx (history) is a ready seed.
- **Suppliers, cheques and staff:** Not equivalent. The 24-row supplier list in the repo is incomplete. The cheque ledger shows payees such as JANATHA CERAMIC, METRO ENT., AR MARKETING and MACTILE MUBIT that are not in the 24, and the vendor listing shows about 120 vendors.
- **Business rules:** BATH-HUB has the engine and the `audit.js` and reconciliation script. Its AGENT_GUIDE/09 is derived from GOLDEN_CORE. The prose rules in BLUEPRINT and RECONCILIATION_RULES (section 4 below) are not copied into BATH-HUB's docs as far as I can see (UNVERIFIED, grepped file names only).

---

## 4) Business rules and knowledge worth carrying into BATH-HUB

**Data truth hierarchy** (`RECONCILIATION_RULES.md` section 1, `CLAUDE.md` section 4, `BLUEPRINT.md`). The Excel day sheet is the truth for revenue. The handwritten petty-cash sheet is the truth for expenses (left column) and payments (right column). Lasersoft is only a price master and the gross-profit source (GPA column). It is never primary. When Lasersoft total is below Excel, the gap is expected and it is explained by named manual bills.

**Day lifecycle and formulas** (`BATHCO_BLUEPRINT.md`):
- `expenses_total` is the left column, with salary as one line.
- `payments_total` is the right column, meaning broker fees, advances and transfers.
- `cash_out = expenses + payments`.
- `cash_in_hand = cash_sale - cash_out`.
- `net_profit = gross_profit - expenses`. Payments are excluded from profit.
- `staff_payments_total` is display-only. It never goes into cash-out or profit.
- The petty float is a fixed Rs 25,000 each day. A "cash in hand" version that added the float was tried on 2026-06-22 and rolled back the same day.
- The legacy `salary` and `cash_out` columns must stay 0, or the cash-out gets triple-counted (the 17 June bug: 30,080 vs 56,580 vs 113,160).
- Day-close checklist: Excel total equals cash+card+online+cheque; Excel-vs-Lasersoft gap explained by named invoices; calculated cash-out equals the paper bottom line; calculated cash in hand equals the paper figure.

**After-hours and manual bills.** Bills written after about 6 pm are entered as a new sale in the next day's Excel and never back-dated. Card or online payments settle on the original day, which creates an expected day-shift that is not an error. Manual bills with item codes use exact cost. Lump-total manual bills use that day's average GP% and are flagged "estimated". A receipt that is in Excel but not in Lasersoft is PENDING_RECONCILIATION. It is named, kept in totals, and not treated as an error.

**Honesty rules** (`HONESTY_AUDIT.md`, `CLAUDE.md` 3.4). A number without a real source shows PENDING or "-", never 0. A total built from partial data says "PARTIAL: x of y days". Net profit is shown only on FULL days. The audit found and fixed real distortions: for example an all-time net profit that was understated by Rs 1.47M because days with expenses but no GP were counted as losses. Variance over LKR 10 between Excel and dashboard goes to a Conflict Review Ledger and is never auto-resolved.

**Data tiers** (`RECONCILIATION_RULES.md` section 8): FULL = real GP plus real expenses; CASHFLOW = payment split only; FOUNDATION = total sale only. Zero-sale days such as the Eid closure (21 Mar 2026) and 28 May are real closed days, not missing data.

**Default days** (`DEFAULT_DAYS.md`). 100 of the 192 days carry the placeholder Rs 50,000 expense (`expenses_source = DEFAULT_50000`). The placeholder poisons cash-in-hand (for example 30 June showed -44,000 where the real figure was +249,250 in the dry-run). 85 of the 100 are in Dec to Mar. The most recent 8 days (21 to 30 June) are the most likely to still have a paper sheet. 30 June was fixed by the owner on 2026-07-07 (expenses 33,650, GP 84,778). One day (2026-01-20) shows an implausible cash-in-hand of about Rs 5.75M.

**Quarantine of bad OCR rows.** Any row dated before the shop opened (21 Dec 2025) is impossible. 19 such rows were moved to `daily_summary_quarantine` (nothing was deleted). Causes: OCR misreads of supplier invoices, bank slips, printer error dialogs and duplicate supplier invoices. The lesson: bound all dates by the business start date.

**Checker suppression rules.** Do not re-flag item 1676 (priced fixed 31 May), cheque #760329 (resolved duplicate), or about 18% tile GP (normal for the Sri Lankan market). Still flag missing invoices, negative margins, an unbalanced petty float, credit older than 30 or 45 days, cheques due within 7 or 2 days, and an incomplete day by 8 pm. One known issue: the CHECKER inserts duplicate alerts on every run (no de-dup). Fix before scheduling it.

**The 10 daily checks** (`scripts/daily_reconciliation_check.js`, a header comment). Sales arithmetic; net profit arithmetic; GP-status gaps after T+2; expense ratio over 60%; negative net profit; cash shortfall under -10,000; missing expense entry; pending reconciliation; unresolved sales conflict; invoice sequence jump over 20. BATH-HUB already has this script.

**Supplier cleanup.** 24 suppliers: 13 KEEP, 1 MERGE? (MACKTILE vs MACKSONS TILES LANKA, not merged), 7 brand names with zero payments (AMERICAN STANDARD, GROHE, IDEAL STANDARD, KOHLER, LANWA, ROCA, ROYAL CERAMICS) that look like product brands that leaked into the suppliers table, plus the AZMI rule. **AZMI is a personal payable and is never merged.** On 2026-07-10 the owner confirmed the Rs 8M gap on the vendor "RANGE (AZMI)" is Azmi's personal tile investment held in the business, not a loss. A display bug showed "-1d ago" for never-paid suppliers because `COALESCE(...,-1)` was used as a sentinel.

**Bank-holiday cheque clearing** (`PROGRESS.md` item 20). Cheque clearing dates are computed from the date written on the cheque, skipping weekends and Sri Lankan bank holidays. The 2026 holiday list is loaded, with a marked slot for 2027 and 2028, and an amber flag if a year has no list. Cheque alert rule: 7 days before clearing.

**Commission.** 1% of each person's NETPRO from the Lasersoft Rep Sales Analysis report. Pay period 25th to 24th. The docs disagree on what the base is (section 7).

**LAYLA** (WhatsApp receptionist, in `shop_config.json` and `SESSION_LOG.md`).
- Languages: Sinhala first, Tamil, English.
- Quote price ranges only, never exact prices.
- Never promise stock.
- Replies under 150 words, flowing paragraphs, at most one emoji.
- Never mix bathroom and perfume topics.
- Never say "I'll check with the team". Escalate directly.
- Hard escalation keywords run before any AI call.
- Escalate on voice notes, a ready-to-buy customer, a complaint, 5 or more turns, or a request for a human.
- Fixes learned on 2026-07-07: a guard against reasoning tokens leaking to customers, stamping today's date into the prompt, killing orphaned Chrome before the WhatsApp bridge restarts, and setting the PC never to sleep.
- Taught facts: none stored.

**Insights from real data** (`BATHCO_CONSOLIDATED_REPORT.txt`). Tiles are about 57% of sales but run the lowest margin (about 12.5%). Taps, valves and accessories run 45 to 65%. The top six sellers are tiles (600x600 VIVID, 2X2 MACTILE, tile mortar). 53 item codes have over 20 units in stock and zero sales in the window (about 1,536 units of one skating tile is the largest). Stock at cost is about Rs 126M (retail Rs 190.7M), though the cost column comes from a report Lasersoft itself labels "Back-dated". Vendor payables per Lasersoft are Rs 34.4M. 7 customer cheques worth Rs 381,800 were pending clearance on 2026-07-01. Rs 22.3M (14.9%) of sales sit in items no longer in the stock list and could not be classified.

**Bug hunt lessons** (`BUG_HUNT_LOG.md`, `BATHCO_QA_REPORT.md`):
- A script hard-coded the `postgres` user, and broke when the DB account was rotated.
- A WebGL shader precision mismatch broke a theme.
- `JSON.parse` on a JSONB column that `pg` had already parsed crashed the checker on every call.
- An invalid date returned 500 instead of 400.
- Parameterised queries held against SQL-injection-shaped input in the 32-request fuzz.
- A reversed date range returns an empty 200 rather than a 400.

**Testing-safety incident (2026-07-20)** (`CLAUDE.md` section 17). Automated tests of daily-entry.html ran against today's real date. Test rows merged into the live row and a cleanup `DELETE ... CURRENT_DATE` wiped the whole real day, with no server backup to recover from. Rule: never run tests against a real date. Use a fake date such as 2099-01-01 or a disposable database. This is directly relevant to BATH-HUB, which has the same daily-entry page and the same test setup.

**Ops lessons** (`SESSION_LOG.md`). A restart loop of two servers sharing a port. pm2 on Windows orphans Chrome and locks the WhatsApp session. A disk-full incident (C: dropped to 87 MB) from a 5 GB repo-clone task. Don't use `sleep` commands. Take a backup before any destructive change.

---

## 5) VALUABLE FOR BATH-HUB: ranked top 15

| # | Item (file) | Why valuable | What it would add to BATH-HUB | Effort | Risk |
|---|---|---|---|---|---|
| 1 | Day-lifecycle and data-truth rules (`BATHCO_BLUEPRINT.md`, `RECONCILIATION_RULES.md` section 1 and 8, `HONESTY_AUDIT.md`) | They are the hard-won rules that stopped real money errors (triple-counted cash-out, fake losses). | One plain-English BUSINESS_RULES doc for owner and agents, plus a check that BATH-HUB code follows the formulas and PENDING rule. | Small | Low. Needs the owner to confirm the open questions (commission base, float). |
| 2 | Testing-safety rule and incident (`CLAUDE.md` section 17) and the dry-run checkpoint (section 1.3) | The incident destroyed a real day of data. BATH-HUB has the same daily-entry page and local DB. | Add to AI_MEMORY/LESSONS and AGENT_GUIDE/15. Prevents repeat data loss. | Small | None. |
| 3 | Reconciled daily ledger (`MASTER_LEDGER/master_ledger.xlsx`, `JUNE_2026_REPORT.xlsx`) | A 192-day history with a per-day confidence flag. | Seed for trend charts and demos for the owner's own shop, plus a backtest set for the audit page. Prefer the live DB export if it is newer. | Medium | Medium. Data is a snapshot to Jun 30, 100 days use a default expense, and it is real finance, so keep it out of the white-label copy. |
| 4 | Product master with cost, price and stock (history: `data/QUANTITY AND PRICE.xlsx`, `PRICE LIST.xlsx`, `TOTAL Q.xlsx`) | About 2,600 real items with cost and price. | Seed for `item_catalog` and the POS item picker, and for margin checks. | Medium | Medium. Prices are as of April 2026 and costs are backdated. Needs the owner's review before use. |
| 5 | Item-level sales and profit history (history: `data/T SALE.xlsx`, `CFBDF.xlsx`, `RepSalesAnalysis_*`, plus `scripts/import_item_level_sales.js`) | About 3,200 invoices with cost and GP. | Top-seller and dead-stock reports, per-category margin, and the base for LAYLA's DB-backed answers. | Large | Medium. Customer names in the export. Strip or hash them. |
| 6 | Outbound cheque ledger (history: `cheques/OUTBOUND_CHEQ_CLEAN.xlsx`, plus `backups/*supplier_payments*.json`) | 252 cleared cheques, Rs 114M, with payee and bank. | Backfill for the cheque register, supplier payment history and payables ageing. | Medium | Medium. About 20 blank payees, many duplicate sheets, and it needs cleaning first. |
| 7 | Supplier master and vendor listing (`SUPPLIER_CLEANUP.md`, `backups/backup_suppliers*.json`, history `data/VGNGF.xlsx`) | The current 24 suppliers are incomplete. The listing has about 120 vendors with balances. | A fuller supplier list. The AZMI-never-merge rule and the brand-names-are-not-suppliers rule. | Small to medium | Low. Phone numbers are business contacts. |
| 8 | Stock count of 2026-04-20 (history: `data/STOCK_COUNT_REPORT_20_04_2026.xlsx`) | A real count with 378 variance lines and 793 uncounted items. | Baseline for a stock-take and shrinkage feature. | Medium | Low. It is a one-time snapshot. |
| 9 | Business insight report (`BATHCO_CONSOLIDATED_REPORT.txt`) | Category margins, top sellers, dead stock, payables, cheques. | A ready spec for BATH-HUB's intelligence and "what should I buy" screens, and for LAYLA price-range logic. | Small | Low. Some figures use today's cost as a proxy (flagged in the file). |
| 10 | Pricing report (history: `DALI/1st_Choice_Bathco_Pricing_Report.xlsx`) | A 76-item urgent list and a 65-item "raise price" list. | An idea for a margin-check and price-suggestion tool. | Medium | Medium. Stale since April. Use as a design example, not live advice. |
| 11 | LAYLA rules and fixes (`shop_config.json` layla_rules and ai_personality, `SESSION_LOG.md` 2026-07-07) | Escalation list, tone rules, leak guard, zombie-Chrome fix. | Cross-check Layla v2 and the bridge for the same guards. | Small | Low. Check against current Layla first to avoid regressions. |
| 12 | Defaulted-expense list (`DEFAULT_DAYS.md`) and the "never default" principle | Explains why a default expense corrupts cash-in-hand. | A data-completion backlog screen, and a rule that new days never get a silent default. | Small | Low. |
| 13 | OCR pipeline for handwritten expense sheets (`scripts/ocr_expense_photos.py`, `ocr_retry_loop.py`, `ocr_expense_results.json`, OCR honesty rules in `CLAUDE.md` 5.1) | Turns a WhatsApp photo of the daily sheet into expense rows, with "sum must match the printed total" validation. | A photo-to-expense feature for BATH-HUB's document inbox. | Medium | Medium. Free vision models were unreliable and kept disappearing. Needs a paid or local model. |
| 14 | Cheque clearing and bank-holiday logic (`PROGRESS.md` item 20, `routes/cheque_register.js` in history) | The 2026 Sri Lankan bank-holiday list and weekend rules. | Verify BATH-HUB's cheque register has it. Add the 2027 list. | Small | Low. |
| 15 | Commission and pay-period rules (`CLAUDE.md` 3.6, BLUEPRINT, Rep Sales Analysis format) | The Lasersoft per-rep report is the only source for per-person profit. | Settle the base (GP vs NP vs NETPRO) and the 25th to 24th cycle for `sale_commissions.js`. | Small to medium | Medium. The docs conflict and the owner has not confirmed. |

Lower-priority: the 12 `.claude/commands` as templates (daily-close, credit-aging, supplier-check); `agents/bathco-council.md` as a decision aid; the tile catalogue PDFs/HTML for the public Bath Hub site (check rights). Skip: the 93 `claude-commands` stubs, the old `software/` FastAPI app, `bathco-mobile`, `schema.sql`, the GLM export documents (duplicated and stale), and the n8n workflows.

---

## 6) Secrets, credentials and personal data noticed (no values)

Credentials and secrets:
- **`HANDOVER.md`** (added 2026-06-17, commit 5906a14, still in the latest tree). A table of login usernames and plain-text passwords for the admin and the read-only investor accounts. It also holds an ngrok basic-auth credential, the public ngrok tunnel URL, and a pointer to a TEMP_PASSWORDS.txt for staff. The most serious item. These should be treated as burned and rotated.
- **`SECURITY_LOG.md`** (commit 50e240b, 2026-07-05). States the old weak dashboard password and admin PIN values in plain text. The log says they were rotated afterwards. The old values are in history, and the new ones were saved to a Desktop file (not in the repo).
- **`agents/BATHCO_MASTER.md`** (commit c002c49, 2026-06-01). The local Postgres host, user and (default, weak) password in plain text, plus the owner's email address.
- **`software/app/.env`** (commits fe3f7a8 to c002c49, untracked on 2026-07-03 in 43bb66d). An env file committed to history. The leak scan found an API key of the OpenRouter/Anthropic/OpenAI shape ("looks real", 2 hits), 12 env lines and a DB URL with a password. It is out of the tree but still in history. Assume those keys are exposed. Revoke them if not already.
- **`DALI/import_may_2026.py`, `DALI/insert_dali_expenses.js`** (commit ddfa796, now deleted) and **`end_session.py`, `import_dali_master.py`** (still in the tree): hard-coded DB passwords classed "looks real" by the scan.
- `tests/setup.js` and `tests/integration/*.test.js`: placeholder test passwords, a session secret and an admin PIN (low risk).
- `software/database.py`, `software/app/backend/database.py`: placeholder-like DB URLs (low risk).
- Network details: ngrok tunnel URLs and a private LAN IP in `SESSION_LOG.md`, `CLAUDE.md`, `DECISIONS_LOG.md`, `HANDOVER.md` and `bathco-mobile/src/api.ts`, and a Railway URL in `SESSION_LOG.md`.

Personal and business-sensitive data:
- Staff: 13 names with roles and salary or commission settings (`backups/*staff*.json`, `HANDOVER.md`, `PENDING_FROM_AJMAL.md`, `MASTER_DATA_TASKS.md`). Two staff-salary payout records.
- Customers: customer name columns in the Profit-by-Sales and Sales Summary exports (thousands of invoices, history only). Credit customers with phone numbers (`backups/*credit*.json`, root copy, the CSV), though those look like fake seed data.
- Suppliers: about 130 vendor names with telephone numbers and balances (history `data/VGNGF.xlsx`). Payee names across the cheque ledger.
- Phone numbers also appear in `layla.js`, `whatsapp-bridge.js` and `DALI_SUMMARY.txt` (per the leak scan, the whitelist and owner numbers).
- Financial: the full daily ledger, the P&L, the tax estimate, stock cost and Rs 190M stock value, supplier payables of Rs 34M, and the cheque ledger. The two "for GLM" files and `BATHCO_HISTORICAL_DATA.md` repeat all of it.
- The investor's (uncle's) personal tile investment of about Rs 8M (SESSION_LOG, CONSOLIDATED_REPORT, SUPPLIER_CLEANUP).
- 16 WhatsApp photos of handwritten expense sheets (history, `uploads/daily/`).
- Owner email in `agents/BATHCO_MASTER.md`.
- The `.gitignore` and the leak scan show the repo is private. Do not copy any of the above into the white-label BATH-HUB template.

---

## 7) Things that are outdated or contradict BATH-HUB (or each other)

1. **Shop start date.** `RECONCILIATION_RULES.md`, `GOLDEN_CORE.md` and `BATHCO_MASTER.md` say it opened on 21 Dec 2025. `BATHCO_BLUEPRINT.md`, `HANDOVER_FOR_REVIEW.md` and the GLM exports say the first receipt was SL000441 on 31 Jan 2026 and that earlier dates are "pre-opening". The Lasersoft exports contradict the second claim: there are invoices on 2025-11-27 and 2025-12-21. Treat 21 Dec 2025 as the tracked start (and note a stray 27 Nov 2025 invoice).
2. **Commission base.** `CLAUDE.md` 3.6 says 1% of the GP each person generated. `HANDOVER_FOR_REVIEW.md` says 1% of net profit ("corrected June 2026"). `BATHCO_BLUEPRINT.md` says 1% of NETPRO per person. The owner has not confirmed (PENDING #6).
3. **Staff count.** 13 in the DB and the backup, 12 in the review doc, 11 in an older v2.0 doc. The spellings of at least two names also differ between sources. The daily-entry task list used names that do not exist in the staff table.
4. **Tier counts drift.** FULL days: 32 (12 Jun), 36 (17 Jun), 35 (DATA_MAPPING), 55 COMPLETE (master ledger). The definitions changed, so do not compare them.
5. **Total sales drift.** Rs 144.49M (172 days, 12 Jun), Rs 148.23M (178 days, 17 Jun), Rs 159.18M (189 days, 1 Jul), Rs 160.69M (192 days, 2 Jul ledger). The Lasersoft item sum for the same window is Rs 149.18M, a Rs 10.0M gap explained as manual sales.
6. **Cash in hand.** The Rs 25,000 float is "always" in CLAUDE.md, but the rule was applied and then rolled back on 2026-06-22. `DEFAULT_DAYS.md` shows placeholder-derived cash-in-hand is wrong.
7. **Salary and cash-out columns.** `GOLDEN_CORE.md` lists the formula with the legacy `salary` column. `BLUEPRINT.md` says salary belongs in `total_expenses` and the column should be 0.
8. **AI provider.** `CLAUDE.md` 5.2 says the LLM may only parse date ranges and never touch figures, using local Ollama. A later commit set an "Ollama-first chain" with Anthropic removed until top-up, and the OCR model chain changed several times. BATH-HUB's Layla v2 and Agent Review may differ. Check before copying.
9. **Credit data.** Docs treat Rs 668,800 outstanding and the largest-customer mismatch (542,300 vs 385,380 vs 668,800) as real. The phone patterns and the "UNVERIFIED" notes suggest much of it is seed data. Do not import it.
10. **Supplier list.** 24 suppliers vs about 120 vendors in Lasersoft and many cheque payees that are not in the list. The 7 brand-name rows are probably not suppliers.
11. **Naming and branding.** "1st Choice Bathco (Pvt) Ltd", "BATHCO COMMAND", "LAYLA" and a gold/black PWA vs BATH-HUB / Bath Hub, the /owner app and its own theme. The rebrand decision is still open in BATH-HUB's CLAUDE.md. CLAUDE.md here calls the Nature page "the official app" (2026-07-04). BATH-HUB's ONE_APP_INVENTORY now calls BATHCO_NATURE the OLD owner app.
12. **Paths and ports.** `C:\BATHCO_PHASE1`, `C:\Bathco\AI-Data`, `C:\Users\DELL`, `C:\Users\1st Choice`, port 3000, a LAN IP, ngrok. BATH-HUB uses its own folders and ports 3010 and 3100. `.claude/commands`, the n8n JSONs and `GOLDEN_CORE.md` all point at the old paths. `CLAUDE.md` also says to read a BATHCO_MASTER_INDEX.md that is not in the repo.
13. **Obsolete tech.** The `software/` FastAPI app, `bathco-mobile` (paused 2026-06-15), `schema.sql` (10 tables vs the live schema), the n8n workflows, ngrok access, 2FA "currently disabled", and the Railway guide (BATH-HUB has its own parked Railway project).
14. **Open items that may have been closed.** `PENDING_FROM_AJMAL.md` (17 items), the CHECKER duplicate-alert bug, the OCR re-run for May 13 and 19, and the staff and wage list. The repo stops at 2026-07-27, so some are probably answered in the live system. UNVERIFIED.
15. **Mixed content.** CLAUDE.md contains Dubai Imports, NOOR Digital and NOOR Islamic app material, and `shop_config.json` has perfume data. None of it belongs in BATH-HUB.
16. **Process claims.** `PROGRESS.md` says 50 of 50 items DONE, but item 23 (Lasersoft PDF upload) itself says it needs a test on a real file. Some "VERIFIED" statements in the session logs rely on browser tests against localhost only. I could not confirm any of them.
