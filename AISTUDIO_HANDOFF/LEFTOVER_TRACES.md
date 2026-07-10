# LEFTOVER_TRACES — real-business data found in C:\BATHCO_TEMPLATE

> **SCRUBBED 2026-07-10 (same day, later session):** every trace below has been fixed except:
> (a) DB schema identifiers `lasersoft_invoices` (table) and `lasersoft_total` (column) + the JS
> variables/JSON keys that mirror them — renaming needs an ALTER TABLE migration, deferred;
> (b) the deliberate product-name "BATHCO" usage in §7 (file names, pm2 names, banners) —
> wholesale rebrand is a separate decision. Fixes applied: Lasersoft→"POS" in all comments and
> user-visible strings; HSL/SL→generic; Rs 25,000 float → `PETTY_CASH_FLOAT` env var (default 0);
> 1%→"a fixed percentage"; live-DB row counts removed; `C:\BATHCO_DROP`→`DROP_ROOT` env (default
> `<install>\data\drop`); `C:\Bathco\AI-Data\process_inbox.py`→`LOCAL_INGEST_SCRIPT` env;
> validate_data.js fully parameterized (AI_DATA_ROOT + CLI date range, writes locally);
> migrate_grn.js loads the LOCAL .env; all `'bathco'` fallbacks→`'bathco_template'`;
> check-system.js now uses PORT/DB_NAME (Dubai Imports/PWA/Ollama checks removed); package name
> →`bathco_template`; dead doc references (CLAUDE.md/FINAL_BUILD/SECURITY_LOG/kimcord/
> MODULE_REGISTRY/RECONCILIATION_RULES/[[memory-links]]) removed; legacy dashboard's hardcoded
> LKR 25,000 and 250,000 target genericized; audit sign-off →"System (automated)".
> Verified: node --check clean on all edited files, server boots with HTTP 200 /health,
> test results identical before/after (17 pre-existing failures, unrelated).
> Line numbers below refer to the PRE-scrub files.
>
> **SCRUB COMPLETED 2026-07-10 (final pass):** the earlier scrub session was interrupted before
> the 1%-commission items landed. Now done: "GP-by-staff 1% (commission) auto-calc" strings
> genericized (routes/audit.js Excel + PDF labels, comment; BATHCO_NATURE.html audit note) and the
> hardcoded `commission_pct||1.00` default in POST /api/staff replaced by new env var
> `COMMISSION_RATE_PCT` (default 0 = unconfigured), documented in .env and AGENT_GUIDE\14_env_vars.md.
> With this, everything below is scrubbed except the two deliberate deferrals (a) and (b) above.

Date: 2026-07-10 · Read-only scan. Line numbers are as of the original audit.
Scan coverage: full tree; node_modules scanned separately for the distinctive terms
(only hit: `node_modules/.package-lock.json` → package name `bathco_phase1`).

## 1. Identity terms — CLEAN
- "1st Choice" / "First Choice" / "1stChoice": **0 hits**.
- Staff names (Imran, Gimhani, Nilshard, Ali, Jazeel, Fahim, Zaheem, Ansaf, Azmi, Nushra):
  **0 hits** in code/config/UI. Only meta-mention: `SESSION_LOG.md:12` (sentence describing the
  grep gate itself — not data).
- Real phone numbers (+94 / 07xxxxxxxx / 011-xxxxxxx): **0 hits**.
- Email addresses: **0 hits** (only a third-party deprecation notice in package-lock.json).
- Addresses (Colombo/Kandy/Mawatha etc. as real address): **0 hits** — "Colombo" appears only as
  `Asia/Colombo` timezone (layla.js:136,139) and a placeholder example (setup.html:42). Harmless.

## 2. HSL/SL invoice series (real invoice numbering of the actual shop)
- `server.js:1056` — comment: "invoice_gap alerts (HSL/SL invoice sequence gaps)"
- `public/BATHCO_NATURE.html:410` — **user-visible**: "HSL/SL invoice series are always summed as
  one system. Manual bills written after 6pm must be entered as tomorrow's fresh sale…" (also a
  real internal process rule of the shop)

## 3. Lasersoft — the real shop's POS/accounting software, named throughout
User-visible UI text:
- `public/BATHCO_NATURE.html:451` — commission locked-rule note (also names CLAUDE.md §3.6)
- `public/BATHCO_NATURE.html:500` — "DAILY DETAIL is real Lasersoft sales data…"
- `public/BATHCO_NATURE.html:504` — "Reconciliation — flagged days (Excel vs Lasersoft vs expense-sheet)"
Backend code/comments/strings:
- `server.js:214, 821, 1503, 1506, 1571, 1573, 1632, 1635, 1666, 1759, 1760, 1762, 1801-1803,
  1831, 1843, 1853, 1875, 2256, 2264, 2292-2293, 2650, 2689, 2970, 2976-2984, 3153`
  (821 and 2256/2264 are user-facing strings/report labels)
- `routes/audit.js:285` — API "reason" string names Lasersoft + CLAUDE.md 3.6
- `routes/staff_reports.js:222-224, 240-241, 367, 392, 401-402` — comments + API strings;
  240/241 also leak **live-DB row counts** ("only 13 of 2111 rows", "2111 rows" at 223-224)
- `validate_data.js:5, 55, 57, 109`
- `AGENT_GUIDE\10_database.md:5` — `lasersoft_invoices` table (table name also in DB schema)

## 4. Real figures / business rules hardcoded
Rs 25,000 petty-cash / opening float (the actual shop's float):
- `routes/audit.js:19` (`const OPENING_FLOAT = 25000`), `:238, :240, :380`
- `routes/purchasing_accounting.js:22, 24` (`PETTY_CASH_FLOAT = 25000`), `:460`
- `server.js:3153` — M8 assistant system prompt: "Petty cash float is fixed at LKR 25,000"
- `public/BATHCO_NATURE.html:507` (user-visible Cash Proof formula), `:1490` (tab label)
- `public/bathco_complete.html:439` — "LKR 25,000" hardcoded KPI value
1% staff commission rule (real pay rule):
- `public/BATHCO_NATURE.html:451`; `routes/staff_reports.js:222, 240`; `routes/audit.js:285`;
  `routes/staff_reports.js:12`
VAT:
- `routes/purchasing_accounting.js:392` — "VAT_RATE = 0.18 … adjust to the rate BATHCO is
  actually registered for" (names the real business's tax registration)
After-6pm manual-bill rule (real process rule):
- `public/BATHCO_NATURE.html:410`

## 5. Live-system paths & live-DB fallbacks (template can touch the live shop machine)
`C:\BATHCO_DROP` (live drop folder shared with the real shop):
- `server.js:490, 494`; `whatsapp-bridge.js:16`; `grn-watcher.js:18, 19`
`C:\Bathco\AI-Data` (live data folder):
- `server.js:1086` (executes `C:\Bathco\AI-Data\process_inbox.py`); `validate_data.js:2, 11`
`C:\BATHCO_PHASE1` (live repo):
- `validate_data.js:114` (writes DATA_INDEX.json into the live repo!); `scripts/migrate_grn.js:1`
  (loads the **live .env**)
Live DB name `bathco` as default/fallback:
- `layla.js:27`; `grn-watcher.js:11`; `scripts/create_instance.js:22`;
  `scripts/migrate_payments.js:6`; `scripts/migrate_grn.js:3` (hardcoded);
  `scripts/daily_reconciliation_check.js:30` (hardcoded, ignores env)
Live ports/DB in health check:
- `check-system.js:62, 65, 66` — checks ports 3000/5173 and DB `bathco` (live), not 3010/`bathco_template`

## 6. References to live-repo documents that do not exist in this template
(Not business data, but they will confuse an external AI and hint at the source system.)
- CLAUDE.md §3 / 3.5 / 3.6 / 5.1: `routes/purchasing_accounting.js:18, 22, 341`;
  `routes/staff_reports.js:12, 222, 240`; `routes/audit.js:285`; `scripts/ocr_photo.js:2, 35`;
  `public/BATHCO_NATURE.html:451`
- FINAL_BUILD.md / FINAL_BUILD_2.md: `server.js:135, 145, 158, 613`; `routes/audit.js:19, 184`;
  `public/BATHCO_NATURE.html:16, 58, 1815`; `public/themes/kim_forest.js:7, 18`
- SECURITY_LOG.md: `server.js:26, 142, 613`
- MODULE_REGISTRY.md: `public/BATHCO_NATURE.html:1773`
- `Desktop\BATHCO_VERSION_1\kimcord.md`: `public/BATHCO_NATURE.html:18, 144`;
  `public/themes/kim_forest.js:3, 5, 9, 14, 17, 155`
- Personal memory-link syntax: `public/BATHCO_NATURE.html:20` — "[[feedback_bathco_kpi_colours]]"
- `server.js:22-26` — comment describes the **live** system's credential rotation / `bathco_app` role

## 7. "BATHCO" as product name — decision needed, not identity leakage
The product brand "BATHCO COMMAND / Bathco Nature" is kept deliberately (file names
BATHCO_NATURE.html, bathco_complete.html; banners in index.js:27,222, server.js:283,3197;
service-worker.js; manifest.json / nature-manifest.json; ecosystem.config.js pm2 names;
`package.json:2` name `bathco_phase1`; localStorage key `bathco_theme`; export filenames
`BATHCO_Report_*` server.js:2319,2387). Flagged only because a sold copy arguably should carry
the client's brand from `/api/branding` instead. Notable individual items:
- `package.json:2` — name is `bathco_phase1` (the live repo's name, not even "template")
- `public/bathco_complete.html:287` — "Live data from Bathco database"; `:1045` — "Generated by
  Bathco System" (legacy UI; consider deleting the file instead of scrubbing)
- `routes/audit.js:290` — sign-off "prepared_by: 'BATHCO COMMAND (automated)'" appears in reports

## 8. .env (checked, acceptable)
Placeholder API keys (`sk-ant-REPLACE…`, `sk-or-REPLACE…`), CHANGE_ME dash/ngrok passwords.
`DB_PASSWORD` and `SESSION_SECRET` are real generated values for the template instance —
`create_instance.js` / per-client step 2 must regenerate them (already documented in SESSION_LOG).
