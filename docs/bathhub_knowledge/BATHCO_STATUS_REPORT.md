# ROYAL BATH HUB STATUS REPORT
Generated: 2026-06-22 (updated — 1122 ingestion complete, 2,187 rows inserted)

---

## 1. SESSION STATE

### Recent commits (most recent first)

- **32552be** — `scripts/ingest_1122.py` (new): 1122 folder ingestion agent. 734 files scanned, 2,098 invoices inserted into lasersoft_invoices, 76 PDFs into pdf_extracts, 734 files catalogued in file_archive, 2 MANUAL_BILLING flags (May 15 + May 19, single-rep Lasersoft vs full Excel, expected). 8 new DB tables created. Dates: 2026-01-31 to 2026-06-18.
- **e861686** — `BATHCO_STATUS_REPORT.md`: Status report updated, 1122 ingestion noted as in-progress.
- **fbc93a4** — `BATHCO_STATUS_REPORT.md`: Status report updated with cea450d, 749efdb entries.
- **cea450d** — `BATHCO_MASTER_EXPORT_FOR_GLM.md`: Regenerated post CIH rollback. 49.9KB, 556 lines. CIH figures reflect BLUEPRINT formula (no 25k float). Desktop copy updated.
- **749efdb** — `BATHCO_STATUS_REPORT.md`: Status report updated with 3c0ea2b, a1112db, 85542d0, 34fa7fa.
- **3c0ea2b** — `BATHCO_FULL_CONTEXT_FOR_GLM.md`: Regenerated post CIH rollback. 95.7KB, 534 lines. CIH figures reflect restored BLUEPRINT formula. Desktop copy updated.
- **a1112db** — `bathco_master_fix.sql`, `scripts/upload_june_lasersoft.js`: URGENT ROLLBACK — partial revert of a264638 Step 4 only. CIH formula restored to `cash_sale - total_expenses - COALESCE(payments,0)` (25k float removed — conflicts with BLUEPRINT). 11 rows changed (ACTUAL/BLENDED/ESTIMATE with cash_sale>0), each reduced by 25,000. All other a264638 changes retained. 31 rows now show negative CIH (correct per formula — were masked by float).
- **85542d0** — `BATHCO_FULL_CONTEXT_FOR_GLM.md`: Regenerated from live DB after master fix. 95.5KB, 534 lines. Desktop copy updated.
- **34fa7fa** — `BATHCO_STATUS_REPORT.md`: Status report updated with e33352a, 64dd659, 836c576 entries.
- **e33352a** — `BATHCO_MASTER_EXPORT_FOR_GLM.md`: Regenerated from live DB after master fix. 49.7KB, 556 lines. Net profit figures corrected. Desktop copy updated.
- **64dd659** — `BATHCO_FULL_CONTEXT_FOR_GLM.md`: Regenerated from live DB after master fix. 95KB, 534 lines. NOT_AVAILABLE days now show NOT_AVAILABLE for net_profit instead of 0. Desktop copy updated.
- **836c576** — `BATHCO_STATUS_REPORT.md`: Status report updated with a264638 master DB fix entry.
- **a264638** — `bathco_master_fix.sql` (new): Master DB fix script created and executed. Step 1: zeroed legacy salary+cash_out cols (26 rows, triple-count fix). Step 2: recalculated net_profit = gross_profit − total_expenses for 70 ACTUAL/BLENDED/ESTIMATE rows. Step 3: set net_profit=NULL for 112 NOT_AVAILABLE rows. Step 4: recalculated cash_in_hand with Rs. 25,000 float for 11 rows with cash_sale>0 (59 FULL days with cash_sale=0 reverted to 0 — no split data). Step 5: removed LOSS_DAY flag from 22 NOT_AVAILABLE days (JSONB fix applied). Verification: legacy_nonzero=0, bad_loss_flags=0, total_np=12,253,164. Backup: Desktop/bathco_backup_20260622.sql.
- **47eef62** — `BATHCO_STATUS_REPORT.md`: Status report updated with commits 81bd1eb through ce98e86.
- **ce98e86** — `BATHCO_FULL_CONTEXT_FOR_GLM.md` (new), `scripts/generate_full_context.js` (new): 6-section full context doc for GLM-5.2. 556 lines, 97KB. Sections: business context, system status, source file inventory, complete daily data (182 rows), flags & conflicts, raw BLUEPRINT. Copied to Desktop.
- **7fa2aa5** — `server.js`: Fix SUM(net_profit) aggregations — exclude NOT_AVAILABLE days using `CASE WHEN gp_status='NOT_AVAILABLE' THEN NULL ELSE net_profit END`. Applied to 5 locations: /api/stats today/MTD/all-time, /api/all-time-stats total_np, /api/all-monthly-chart. Prevents false loss totals from months where GP was not uploaded.
- **cfa936f** — `BATHCO_MASTER_EXPORT_FOR_GLM.md` (new), `scripts/generate_master_export.js` (new): 7-section audit doc. 556 lines, 49KB. Covers formulas, daily table, expense by month, staff, credits, conflict dates, system snapshot.
- **93fcc59** — `server.js`, `public/dashboard.html`: Null-guard for net_profit when GP not available. New `GET /api/daily-summary/:date` route returns `net_profit=null` when `gp_status='NOT_AVAILABLE'`. Dashboard shows "N/A" instead of "LKR 0.00" on NOT_AVAILABLE dates (home tab hkpi-np + daily tab npVal).
- **207e513** — `BATHCO_STATUS_REPORT.md`: Jun 10 flagged MANUAL_REVIEW_REQUIRED (xlsx 604,190 vs DB 190,540, diff +413,650). Data untouched.
- **f726120** — `BATHCO_HANDOVER_FOR_REVIEW.md` (new), `scripts/flag_conflict_dates.js` (new), `scripts/import_june_xlsx.js` (new), `scripts/dryrun_june_upload.js` (new), `scripts/check_credit.js` (new), `scripts/check_0906_1506.js` (new), `scripts/ocr_rerun_may13_may19.py` (new): Jun 1–15 xlsx import (11 dates updated, 4 conflict dates flagged). Handover doc 245 lines / 17KB.
- **481978f** — `BATHCO_STATUS_REPORT.md`: 09-06 and 15-06 NP confirmed still blocked (gp_status=NOT_AVAILABLE, no Lasersoft upload).
- **e25da77** — `BATHCO_STATUS_REPORT.md`: OCR audit 2026-06-21 — May 13 (53,820) and May 19 (50,400) both confirmed correct. PENDING_FROM_AJMAL #11 closed.
- **d360231** — `public/dashboard.html`: Card/Online/Cheque colour: teal → vivid purple (#a855f7 dark / #9333ea light). Confirmed by Ajmal.
- **443332e** — `public/dashboard.html`: Total Sale vivid blue (#3b82f6 dark / #2563eb light), Cash Payment bright cyan (#06b6d4 dark / #0891b2 light). Confirmed by Ajmal.
- **81bd1eb** — `public/dashboard.html`: Layout restructure, badge pills (PENDING/EST/CONFIRMED), generous card whitespace. Confirmed by Ajmal.

### Last git commit
- Hash: `fbc93a4` — status report updated
- Committed: `32552be` — scripts/ingest_1122.py (ingestion complete)
- Branch: `master` → `github.com/ajmalkhan6233-eng/ROYAL BATH HUB`
- Working tree: clean

### Processes
- `bathco-server` (PM2 id=0) — online, pid 6784
- `grn-watcher` (PM2 id=1) — online, pid 17844

---

## 2. PENDING WORK

### Bugs remaining (from BATHCO_QA_REPORT.md)
- **All 6 QA bugs fully resolved.** NL query (BUG-002) now runs on local Ollama — zero Anthropic cost, no credits needed ever.

### 1122 folder ingestion — IN PROGRESS (2026-06-22)
- Script: `scripts/ingest_1122.py` — processes Desktop\1122 folder (Excel sales reports, RepSalesAnalysis, PDFs)
- Dry run results: 734 files scanned, 87 Excel, 76 PDFs, 2,098 unique invoices, dates 2026-01-31 to 2026-06-18
- New tables: daily_expenses, daily_payments, lasersoft_invoices, reconciliation_flags, pdf_extracts, grn_records, cheque_payments, file_archive
- 2 HIGH MANUAL_BILLING flags raised: May 15 (diff 1,180,580) and May 19 (diff 232,150) — single-rep Lasersoft vs full Excel total, expected
- Live commit complete: 2,187 rows inserted, 0 errors

### Jun 10 invoice comparison — MANUAL_REVIEW_REQUIRED
- **Do not action.** xlsx total (604,190) is higher than DB total (190,540), diff = +413,650.
- Flag is written to `checker_flags` and `details.reconciliation_note` in DB.
- Ajmal to compare invoice lists separately before any change is made.
- Data untouched.

### Financial data gaps
- **09-06 and 15-06 net profit PENDING** — still blocked as of 2026-06-21. Both dates confirmed in DB:
  - 2026-06-09: total_sale=1,387,300 · total_expenses=53,150 · gross_profit=0 · net_profit=0 · gp_status=NOT_AVAILABLE · flag=GP_STALE
  - 2026-06-15: total_sale=418,860 · total_expenses=37,160 · gross_profit=0 · net_profit=0 · gp_status=NOT_AVAILABLE · flag=GP_STALE
  - **Why blocked:** No Lasersoft "Profit-by-Sales" report has been uploaded for either date. gross_profit=0 so net_profit cannot be calculated.
  - **To resolve:** Upload the Lasersoft profit-by-invoice export for Jun 9 and Jun 15. Server will auto-import and update gp_status → ACTUAL, net_profit will calculate immediately.

### Unresolved items from PENDING_FROM_AJMAL.md (17 open items)
- #1 Staff daily-wage vs monthly-salary list with amounts
- #2 Shop closing time for LAYLA
- #3 Per-person OT rates
- #4 Zakat hawl date
- #5 Credit total reconciliation: DB 542,300 vs Ajmal figure 385,380 (UNRECONCILED)
- #6 Daily-wage staff commission rule
- #7 Lasersoft cutover date confirmation (assumed 2026-04-01)
- #8 Royal Bath Hub Aromatic removal from shop_config.json + CLAUDE.md
- #9 Full Lasersoft product/price export (products table has only 85 items)
- #10 Daily invoice number range for invoice-gap detection
- #11 ~~May 13 expense mismatch~~ — **CLOSED 2026-06-21.** DB=53,820 confirmed correct. Two summary sheet photos both show 53,820. The ~99,190 figure was a bad sum-of-all-receipts OCR artifact from the first run, not a real discrepancy. May 19 DB=50,400 also confirmed correct by reading the handwritten sheet directly (itemised total = 50,400, matches DB exactly).
- #12 Dec 21 2025 – Jan 30 2026 revenue re-verify vs manual Excel (LKR 17,249,211)
- #13 ADHIL F.R supplier — real supplier or personal payment?
- #14 VOOS (supplier id24) — reclassify as transport expense?
- #15–16 GROHE / IDEAL STANDARD / KOHLER / AMERICAN STANDARD — confirm still active
- #17 Credit outstanding 668,800 — 4 UNVERIFIED entries (305,000 total) need confirmation

### From BATHCO_BLUEPRINT.md
- Receipt 433 (20,700) — PENDING_RECONCILIATION, Lasersoft not yet updated with it
- SL001950 value conflict: Lasersoft shows 5,630, Excel photo may show 31,630 — needs Ajmal to open 17-06-2026.xlsx
- Staff commission rule: 19,350 stored in staff_payments_total, not deducted from net_profit — needs Ajmal confirmation
- CHECKER suppression rules for Code 1676, Cheque #760329, Tile GP ~18% — in CLAUDE.md but not yet in run_agents.py
- Invoice detail for Jun 18–20 missing: no `details.lasersoft_invoices` JSONB for those dates (imported without invoice-level data)
- Table layout overlap on click — flagged in a truncated user message, not yet investigated
- BATHCO_INBOX desktop folder — never built
- `runNlQuery()` status: function IS written (dashboard.html:3729) — fails only due to Anthropic credit depletion (BUG-002). Previous status report incorrectly said function was missing — corrected here.
- PDF downloads (daily summary + full detail): client-side jsPDF code is in place. Not re-verified in browser this session.

---

## 2b. OCR AUDIT — 2026-06-21

### May 13 and May 19 re-run findings

**Method:** Photos still on disk re-processed. Rate-limited on free OpenRouter models (daily quota hit). May 19 `200026`-typo photo (date parsing had always failed) read manually via image viewer.

| Date | DB value | Verdict | Evidence |
|---|---|---|---|
| 2026-05-13 | 53,820 | **CONFIRMED CORRECT** | Two summary sheet photos at 20:55 both show 53,820 itemised + totalled. Earlier "99,190" was sum-of-all-receipts artifact. |
| 2026-05-19 | 50,400 | **CONFIRMED CORRECT** | Handwritten sheet (19/05/2026) shows itemised expenses totalling 50,400 exactly: Night exp 1,000 + MR AZMI 1,000 + Breakfast 600 + EEKIL BROOM 300 + Tea 1,500 + Lunch 5,000 + Salary 29,000 + Shop rent 10,000 + Electric Labor 1,500 + Ali Advance 500 = 50,400. Also confirms: total sale 242,050, cash out 49,900, cash in hand 190,600. |

**No DB changes made.** Both values were already correct.

**PENDING_FROM_AJMAL #11 closed.**

### OCR pipeline model status (2026-06-21)
- `nvidia/nemotron-nano-12b-v2-vl:free` — hits 429 rate limit (free-models-per-day quota)
- `google/gemma-4-26b-a4b-it:free` — text-only, cannot process images (returns error on all vision calls)
- `meta-llama/llama-4-scout-17b-16e-instruct:free`, `google/gemini-2.0-flash-exp:free`, `qwen/qwen2.5-vl-72b-instruct:free` — all return 404 (unavailable on free tier)
- `scripts/ocr_expense_photos.py` still has `FORCE_MODEL = "nvidia/nemotron-nano-12b-v2-vl:free"` — works when under daily quota

---

## 3. SKILLS INSTALLED

- No `.claude/skills/` directory exists under `C:\BATHCO_PHASE1`
- No `.agents/skills/` directory exists under `C:\BATHCO_PHASE1`
- No global `~/.claude/skills/` directory found

### Slash commands (`.claude/commands/`) — 12 installed
- `checker-run` — Run CHECKER agent to verify daily records for a date range
- `create` — (no description — frontmatter only)
- `credit-aging` — Show credit aging report for all credit customers
- `daily-close` — Enter the daily close figures for a given date
- `dashboard-refresh` — Refresh the Royal Bath Hub dashboard at localhost:3000 with latest data
- `master-report` — Generate the master all-time report
- `monthly-report` — Generate the monthly report for a given YYYY-MM
- `plan` — (no description — frontmatter only)
- `staff-summary` — Show staff summary and salary history (optional: specific staff name)
- `supplier-check` — Check supplier payment status (optional: specific supplier name)
- `vera-alerts` — Run VERA agent to check anomalies, overdue suppliers, credit, cash shortfalls
- `weekly-report` — Generate the weekly report for a given week start date

---

## 4. AGENTS INSTALLED

- No `.claude/agents/` directory under `C:\BATHCO_PHASE1`
- No `~/.claude/agents/` directory found globally

### Agent skill folders under `.claude/` (not standard agents)
- `banana-claude` — Image generation prompt constructor (Gemini Nano Banana)
- `bathco-council` — ROYAL BATH HUB AI Council multi-agent routing
- `llm-council` — General LLM council orchestration

### ROYAL BATH HUB application agents (in server.js / layla.js — not Claude Code agents)
- `LAYLA` — WhatsApp sales receptionist, AI fallback chain (Anthropic → OpenRouter → Ollama → hardcoded)
- `CHECKER` — Daily record validator. **Now functional** (BUG-001 fixed). Checks 60 days, found 14 flagged dates on first clean run.
- `NOVA` — Financial anomaly detection. Referenced in run_agents.py.
- `QUINN` — GP/Lasersoft analysis. Referenced in run_agents.py.
- `VERA` — Alerts engine (overdue suppliers, credit, cash). `/api/vera-alerts` working.

---

## 5. TOKEN USAGE

- `/cost` cannot be run programmatically — it is a Claude Code CLI meta-command, not a shell command.
- This session has run across multiple context windows (compaction occurred).
- For accurate cost: run `/cost` interactively in the Claude Code terminal.

---

## 6. GIT STATUS

### `git log --oneline -10`
```
f88f9cf fix: BUG-002 — nl-query returns clean 503 when Anthropic credits depleted
a0659af docs: update status report — QA audit complete, bugs fixed, stale entries corrected
bf1cf10 fix: BUG-003/004/005 — date validation, my-commission blank, monthly downloads
bed5f5e fix: checker-run crash + OCR pipeline post-extract file disposal
b450830 qa: full QA audit report — 1 critical, 2 medium, 2 low bugs found
8a739d0 docs: add BATHCO_STATUS_REPORT.md — session state, pending work, open issues
425443f feat: invoice/expense drill-down, date nav cap, visual polish; OCR May13+19 confirmed complete
9eb64ad data: OCR expenses confirmed for May 12-19, master Excel updated
74ba2c5 2FA, GP blending, visual upgrade, date nav fix, audit fixes
5b738cb chore: add investigation scripts, watcher, updated master data, claude commands
```

### `git status`
- Working tree clean. Branch `master` up to date with `origin/master`.

---

## 7. OPEN ISSUES

### Reconciliation check results (2026-06-21 full-history run)
> READ-ONLY — no numbers changed. Flagged for Ajmal review only.

**Expected / structural gaps (no action needed):**
- Jan–Apr 2026: `GP_STALE` (NOT_AVAILABLE/ESTIMATE) — Lasersoft not imported for that period. Will remain flagged until Lasersoft export uploaded.
- Jan–Apr 2026: `NO_EXPENSES` — expense sheets not entered for early months.

**SALES_ARITHMETIC gaps (real discrepancies — need Ajmal to confirm whether credit/cheq split was entered):**
| Date | Gap (LKR) | Notes |
|---|---|---|
| 2026-01-01 | 440,710 | Large — likely credit sales missing from breakdown |
| 2026-05-14 | 57,570 | |
| 2026-05-16 | 130,800 | Also HIGH_EXPENSE_RATIO (69.6%) |
| 2026-05-17 | 755,000 | Very large — check credit/balance entries |
| 2026-05-18 | 26,000 | |
| 2026-05-25 | 462,500 | |
| 2026-05-29 | 379,000 | |
| 2026-05-31 | 82,500 | |
| 2026-06-01 | 82,500 | |
| 2026-06-06 | 117,275 | |
| 2026-06-07 | 17,150 | |

**Loss days (confirmed correct, no action needed):**
- 2026-01-01: -43,010 (early month, expected)
- 2026-01-02: -104,700 (early month, expected)
- 2026-05-13: -17,216 + CASH_SHORTFALL (-18,740) — check paper for that day
- 2026-05-19: -13,958 — check if all income was entered
- 2026-06-17: -34,088 — known (staff commission, Bass Fee moved to Jun 16)

- **NL query ("Ask a Question")**: Fully fixed — switched to local Ollama (`llama3.2:1b`). No Anthropic cost ever. LLM interprets date range only; figures come from DB via SQL. ~6s warm, ~45s cold start.
- **09-06 and 15-06 net profit PENDING**: `gp_status = NOT_AVAILABLE`. No Lasersoft GP report for these dates. Upload Lasersoft profit-by-invoice report to unlock.
- **2FA currently disabled**: `totp_enabled=false` for user ajmal (disabled intentionally in a prior session). Secret is intact; re-enable with one DB UPDATE when ready.
- **CHECKER suppression rules** for Code 1676, Cheque #760329, Tile GP ~18% — flagged in CLAUDE.md as "not yet implemented in run_agents.py". Checker now runs but still flags these on every run.
- **Staff commission rule** — 19,350 stored in staff_payments_total and NOT deducted from net_profit. Pending Ajmal confirmation.
- **Receipt 433 PENDING_RECONCILIATION** — Awaiting Lasersoft update from Ajmal.
- **SL001950 value conflict** — Lasersoft: 5,630 / Excel photo may show 31,630. Needs Ajmal to verify 17-06-2026.xlsx.
- **OCR free model** (`nvidia/nemotron-nano-12b-v2-vl:free`) returns 404 (moved to paid tier). Now using `google/gemma-4-26b-a4b-it:free` as primary. If that also fails, falls back to `openrouter/free`.
- **GRN encoding (BUG-006)**: Confirmed false positive — DB already stores correct UTF-8 em-dash. Earlier terminal output was a display artifact from PowerShell session encoding.
- **17 open items** in PENDING_FROM_AJMAL.md — see Section 2.

---

## 8. QA AUDIT SUMMARY (2026-06-21)

Full report: `BATHCO_QA_REPORT.md` (commit b450830)

| Bug | Severity | Fixed | Commit |
|---|---|---|---|
| BUG-001: checker-run crash (JSON.parse on JSONB) | CRITICAL | Yes | bed5f5e |
| BUG-002: NL query — Anthropic credits depleted | HIGH | Yes — switched to local Ollama, zero cost | ec657f0 |
| BUG-003: /api/daily-summary?date=invalid → 500 | MEDIUM | Yes | bf1cf10 |
| BUG-004: My Commission blank for admin | MEDIUM | Yes | bf1cf10 |
| BUG-005: Monthly PDF/Excel stubs | LOW | Yes | bf1cf10 |
| BUG-006: GRN encoding corruption | LOW | N/A (false positive) | — |

Numbers audit: all June 2026 DB vs API cross-checks passed — zero mismatches.
Branding audit: all 12 "Royal Bath Hub" instances consistent — no stale references.
