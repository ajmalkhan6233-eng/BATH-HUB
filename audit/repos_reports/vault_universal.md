# Report: bathco-vault and Universal-project-

Read-only scan. Every file in both repos was read (the .obsidian JSON files are only Obsidian window/plugin settings; the 5 tiny stub notes are just links). No secret values were found or printed.

---------------------------------------------------------------------

## A) bathco-vault

### A1. What it is
- An Obsidian notes vault (1 commit, 43 files, written around 2026-06-20). It is documentation ONLY: no code, no data, no database rows.
- Almost every note is a short "summary card" (about 500 to 1200 characters) describing a file in the OLD live system C:\BATHCO_PHASE1 (server.js, layla.js, dashboard.html, scripts, etc.) with a "Path" and a "Related" link list. The real content (the full formulas, the real DECISIONS_LOG, the real BLUEPRINT) lives in C:\BATHCO_PHASE1 and is NOT in this vault. So the vault is a map and a rulebook, not the full knowledge.
- Machine paths in it: C:\BATHCO_PHASE1 and C:\Users\DELL\Documents\project 1 (an old laptop/user). These are only paths, not secrets.

### A2. Map of the notes (43 files)
- Vault root: bathco map.md (the real master rulebook, 6 KB, the most valuable note), noor.md (older copy of Noor rules), claude.md (anchor to the rules), Welcome.md, Untitled.md, create a link.md (empty Obsidian defaults, delete), .gitignore, .obsidian/ (4 config files).
- BATHCO/ (12 core docs): BATHCO_MASTER_INDEX (hub), BATHCO_BLUEPRINT, DAY-LIFECYCLE-FORMULA, GOLDEN_CORE, DATA_SOURCES, RECONCILIATION_RULES, DECISIONS_LOG, HANDOVER, PENDING_FROM_AJMAL, HONESTY_AUDIT, PHASE_ROADMAP, PHASE2_STATUS, CLOUD_DEPLOY_GUIDE. Each is only a 1-paragraph summary pointing at the real file.
- BATHCO/ code and data summaries (17): server.js (about 2,200 lines), layla.js, dashboard.html (about 3,300 lines), grn-watcher.js, shop_config.json, ecosystem.config.js, ocr_expense_photos.py, ocr_retry_loop.py, import_ocr_expenses.js, migrations, data-build-scripts, BATHCO_MASTER_DATA_REBUILD.xlsx, ocr_expense_results.json, uploads-folder, package-json, test-suite, env-security.
- NOOR_DIGITAL/ (2): NOOR_DIGITAL_MASTER_INDEX (empty scaffold, all sections "No files yet") and NOOR_DIGITAL_MASTER_RULES (10 rules).

### A3. Business knowledge captured

Day lifecycle formula (June 2026 spec, from DAY-LIFECYCLE-FORMULA / server.js notes):
- Two buckets: EXPENSES = left column of the handwritten A4 sheet (counts in profit); PAYMENTS = right column (cash flow only, NOT in profit).
- cash_out_total = expenses_total + payments_total
- cash_in_hand = cash_sale - cash_out_total
- net_profit = gross_profit - expenses_total (payments excluded from P&L)
- Fixed petty-cash float of Rs. 25,000.
- server.js constant: CASH_OUT_EXPR = total_expenses + payments + salary + cash_out - cash_received. A bug where cash_received inflated cash_out was fixed on 2026-06-20 by migrate_payments.js (0 rows changed).
- TIER_EXPR gives each day a data tier: FULL / CASHFLOW / FOUNDATION (how complete the data for that day is).
- day_status = ESTIMATED and expenses_source = 'ocr_photo' on OCR-imported days; net_profit is only recalculated when gp_status = 'ACTUAL' and gross_profit > 0.

Data authority hierarchy (DATA_SOURCES): Excel day sheet = sales truth; Lasersoft "Profit by Sales" = gross profit truth; Lasersoft "Rep Sales Analysis" = commission truth; handwritten A4 petty-cash sheet = expenses and payments truth. Per-day exports are valid, cumulative range exports are not.

Reconciliation rules (RECONCILIATION_RULES + bathco map):
- Excel vs Lasersoft invoice cross-check per receipt number; payments classified cash/card/online/cheque/credit.
- Date coverage differs before vs after 16 June.
- After-hours bills: entered in Excel next day, card settles same day.
- Manual (paper) bills exist only in Excel, not in Lasersoft, so a steady gap is EXPECTED. Manual bills are costed by item-code lookup, else by an average GP% estimate.
- If Excel and dashboard differ by more than LKR 10, put it in a "Conflict Review Ledger" instead of auto-overwriting.
- A blank Online/Card field must render as 0, never a fallback/offset (the old hardcoded 5,630 card value was an anomaly to remove).

Honesty rules (the philosophy of the whole system):
- Every number must trace to a verified source; otherwise show PENDING / NOT AVAILABLE. Net Profit shows PENDING when matching costs are missing.
- Handwriting: never guess; flag illegible values in red for manual check; verify that items add up to the sheet's handwritten grand total (the sheet is treated as 100 percent reliable).
- HONESTY_AUDIT: a per-field list of real vs OCR-estimated vs calculated vs pending (only the summary is in the vault).

Alert suppression rules (bathco map section 7): do NOT alert on Code 1676 pricing (fixed 31 May 2026), cheque #760329 duplicates, or tile gross profit at 18 percent (normal in Sri Lanka). DO alert (admin only) on: missing invoices, negative margins, unbalanced petty cash, credit terms over 30 to 45 days, cheques due within 7 days, manual-invoice gap spikes.

File pipeline: about 3 files a day (sales invoice images, handwritten report, master Excel). grn-watcher scans 4 folder levels, takes dates from cells or filenames (never today's date for history), rows before 2025-12-21 are quarantined permanently. "Time travel": date-range queries by voice/text/picker (e.g. "13th to 15th") producing a downloadable PDF. recalculateDate() is idempotent and run in the background.

Roles: Admin (everything), Owner (read-only, meant for a family investor), Staff (only own salary/petty cash/tasks); blockIfReadOnly() guards the UI.

UI rules: the 5 summary boxes (TOTAL SALE, CASH, CARD/ONLINE/CHEQUE, EXPENSES, NET PROFIT) each expand to the row-by-row invoice list (invoice_no, total_sale, payment_mode); PDF/CSV download on dashboard and daily entry; "empty day" fallback banner to nearest prior day; prev/next date; VIEW ONLY badge for owner.

Stock prep and audit: placeholder fields for incoming qty, breakage/damage, min-stock alerts; hidden audit log of who changed any Daily Entry number.

LAYLA (layla.js note): WhatsApp AI receptionist with 3-step AI fallback Anthropic Claude, then OpenRouter free tier, then local Ollama (llama3.2); extracts name/location/budget, creates leads, alerts the owner on high-value or flagged customers; config in shop_config.json (personality, escalation threshold, recipients). Agents named in the dashboard: LAYLA, VERA (alerts), CHECKER (flags), NOVA (weekly), QUINN (GP analysis).

OCR pipeline: free model nvidia/nemotron-nano-12b-v2-vl:free on OpenRouter reads handwritten expense photos, resumable checkpoint file, retry loop of 10 attempts with 31-minute waits (free-tier daily limit). Aggregation rule: use the sheet's printed summary when confidence is high/medium, else sum of items. Import never overwrites rows where total_expenses > 0 and has a --dry-run. As of 2026-06-20: 43 photos, 7 dates (12 to 19 May) done; May 13 = 53,820 (medium), May 19 = 44,500 (high).

Tests: 34 Jest tests (11 unit, 9 auth, 14 daily-summary), all green at commit fea266d (2026-06-19).

Decisions / pending (only summaries, details NOT in vault):
- Open question for Ajmal: commission accounting (already inside cost of goods, or deduct from net profit?).
- May 19 expense discrepancy: DB 50,400 vs OCR 44,500.
- Open flags for 2026-06-17: receipt 433, SL001950, handwritten total.
- Phase 2 plan: mobile app, multi-location, inventory control, supplier payment tracking, automated reconciliation. migrate_grn.js status "unknown".

### A4. What NOOR_DIGITAL is
- "Noor Digital (Pvt) Ltd", domain noordigital.lk: planned multi-tenant SaaS, a white-labelled copy of the BATHCO engine (GOLDEN_CORE). Status in June 2026: pre-launch scaffold, no files, no code.
- 10 rules: every table/query filtered by company_id (cross-tenant leak = critical bug); tenant onboarding generates company_id, seeds chart of accounts, creates admin, all through a logged provisioning script; halal billing (no interest/late-fee compounding, flat fees or grace-period suspension, fixed transparent tiers); per-tenant roles Owner/Manager/Staff; dev/staging/prod separate DBs; cloud only after Bathco proven; AES-256-GCM encrypted vault plus private GitHub backup per tenant; launch gate (Bathco stable, cross-tenant leak test passed, Ajmal approval).
- Relationship to BATH-HUB: this is the same idea BATH-HUB / "apex-platform" already grew into (multi-tenant, packages, setup wizard, demo tenant, dedicated fleet). The vault note is the early (June) idea; the template is the later realisation. Note the Noor rule "company_id on every table from day one" is the same principle as the existing tenant design.

### A5. Secrets
- env-security.md describes the live .env file: it lists only the NAMES of keys (database host/port/name/user/password, Anthropic API key, OpenRouter API key, session secret, port; the index also mentions WhatsApp/Twilio credentials) and the rules (never print, never commit, revoke at the provider console if leaked). NO values anywhere in the vault.
- The secret scan (leak_bathco-vault.json) found 0 findings, 0 emails, 0 phones. It only flagged "C:\BATHCO_PHASE1 path" mentions as live-system path references. Author email is masked.
- Privacy point (not a secret): notes name the owner (Ajmal) and hint at a family investor; a cheque number and a receipt number appear. Low sensitivity, but keep the repo private.

### A6. Value for BATH-HUB (ranked)

| # | File | Why | Effort |
|---|------|-----|--------|
| 1 | bathco map.md | Best single page: honesty/PENDING rule, handwriting checks, LKR 10 conflict ledger, alert suppression and alert list, audit log, stock placeholders. Compare with AGENT_GUIDE and golden core docs to make sure each rule is already enforced; any missing rule becomes a checklist item. | 30 min read plus compare |
| 2 | DAY-LIFECYCLE-FORMULA.md | Cross-check that BATH-HUB golden core uses the same two-bucket formula (net_profit = GP - expenses; payments excluded; cash_out = expenses + payments). Good as a test oracle. | 30 min |
| 3 | RECONCILIATION_RULES.md + DATA_SOURCES.md | Authority hierarchy and manual-bill gap rule: useful for any import/reconcile screen and as client-facing explanation. Only summaries here; real files are in C:\BATHCO_PHASE1. | 1 hr (fetch originals) |
| 4 | NOOR_DIGITAL_MASTER_RULES.md | Ready-made go-live gate checklist (cross-tenant leak test, provisioning log, no-interest billing) for the Railway/multi-tenant go-live and for the "client copy" work. A cross-tenant leak test is a concrete missing test to write. | 1 to 2 hr |
| 5 | ocr_*/import_ocr_expenses notes | Pattern for free-tier OCR with checkpoint resume, confidence levels and "never overwrite manual data". Reusable idea if BATH-HUB wants photo OCR of expense sheets. | 2 to 4 hr if built |
| 6 | layla.js / shop_config.json notes | 3-tier AI fallback (Claude, OpenRouter free, Ollama) and config-driven personality: a cheap resilience pattern for LAYLA. Already largely present per docs/LAYLA_PRO_SPEC.md. | low, check only |
| 7 | PENDING_FROM_AJMAL, HONESTY_AUDIT | Open business questions (commission treatment, 19 May gap). Dated June and may be solved; ask Ajmal. | 10 min |
| 8 | HANDOVER, DECISIONS_LOG, PHASE_ROADMAP, CLOUD_DEPLOY_GUIDE, other summary cards | Only one-paragraph summaries: nothing new. | none |
| - | Welcome, Untitled, create a link, .obsidian | Noise. | delete |

Note: the vault contains no actual data (no sales, no invoices, no customers). The "valuable data" hope is not met here; value is in rules and decisions only.

---------------------------------------------------------------------

## B) Universal-project- ("Ambient Companion")

### B1. Purpose and relation to the shop
- 2 commits, both 2026-07-20, generated in Google AI Studio (metadata.json capability "server-side Gemini API", the 'aistudio-build' User-Agent, DISABLE_HMR note).
- A personal reminder, log tracker and chat companion with three "skill packs": Study (study breaks, spaced repetition, study logs), Recitation (Quran recitation practice logging, with a "not a religious authority" stance) and Elder Care (medication check-ins, symptom logs, emergency SOS).
- It has NOTHING to do with the tile shop, sales, stock or accounting. Different domain, no shared code or data.

### B2. Features (18 files: server.ts plus React src/)
- Onboarding wizard (Onboarding.tsx, 4 steps): profile (name, date of birth, timezone, passcode of at least 4 characters), pick skill packs, emergency contact (name/phone/relationship), then opt-in consent per data category (medication, symptom, study_session, recitation).
- Passcode login screen (App.tsx), user cached in browser localStorage.
- Home (Home.tsx, about 30 KB): today's reminders with done/skip/snooze, add custom reminder, red EMERGENCY SOS button with confirmation, skill pack tiles, manual log entry.
- Chat (Chat.tsx): per-skill-pack chat with starter prompt suggestions, welcome message, typing/loading state, error display, shows tool calls.
- LogHistory.tsx: filter by category, sort by date, colour-coded cards per category, payload renderer.
- Settings.tsx: edit packs, consent toggles, emergency contact, passcode; export all data to a JSON file; delete the whole account.
- Tech: React 19, Vite 6, Tailwind 4, lucide-react icons, motion animations; Express 4 server with a single JSON file database (data/db.json). Scripts: dev (tsx), build, start, lint.

### B3. API (server.ts, about 520 lines)
GET /api/health; POST /api/auth/register, /api/auth/login, /api/user/update, /api/user/delete; GET /api/user/:userId; GET and POST /api/reminders; POST /api/reminders/:id/status; GET and POST /api/logs (refuses with 403 if the category consent is off); POST /api/sos (writes an audit log, only "dispatches" in the sense of returning a message, no real SMS/call is sent); POST /api/chat.

### B4. AI service
- Google Gemini via @google/genai, model name set in code as "gemini-3.5-flash", key GEMINI_API_KEY from environment (server side only; the browser never sees it).
- Chat does function calling in a loop (max 5 rounds): tools get_todays_reminders, log_entry (consent checked inside), mark_reminder. Careful system prompts per pack: "tool, not a friend", do not diagnose, send to SOS for crisis.
- Flaws noticed in the chat loop: only the first tool call of a response is handled; the model decides userId arguments but the server correctly uses the authenticated userId; "snoozed" has no timer.

### B5. Quality (honest)
- Clean, readable AI-Studio-generated demo/prototype. Not production grade:
  - Passcodes stored in PLAIN TEXT in db.json and returned to the browser in the user object; no hashing, no sessions/tokens; the API trusts any userId sent by the client (anyone who knows an ID can read or delete data); the passcode-only login finds a user by passcode alone.
  - No input validation, no rate limiting, no tests, whole JSON file rewritten on every change (race conditions), no real notifications or reminder scheduling, tsconfig/vite default.
  - Good ideas: consent-gated logging, explicit export and delete of user data, confirm-before-SOS, safety wording in prompts.
- Not safe to take code as-is for BATH-HUB; ideas only.

### B6. Secrets
- .env.example only contains placeholders (MY_GEMINI_API_KEY, MY_APP_URL). The scanner flagged "env file contents committed" for it, but this is a false positive (placeholder text, verified by reading). .gitignore correctly excludes .env* except the example. The git author email is masked in the scan. No real keys.

### B7. Reusable for BATH-HUB?
- Chat UI (Chat.tsx): small, tidy bubble/suggestion/loading layout. Could inspire the LAYLA or "ask the app" chat screen, but BATH-HUB already has its own React/HTML UI; copying would cost about as much as writing. Low value.
- Onboarding wizard: BATH-HUB already ported an AI Studio setup wizard (07-10). Nothing new.
- Gemini function-calling loop (tools bound to local data plus consent check): a good small reference pattern if LAYLA ever gets tools ("get today's summary", "log expense"). It would need switching to the app's existing AI provider and real auth. Medium idea value, 2 to 4 hr.
- Log history filter/sort cards, data export JSON and "delete my data" flow: nice pattern for a privacy/data-export feature for client tenants (GDPR-style). Low to medium, 1 to 2 hr.
- Voice: none. Reminders: only static seeded items, no scheduler. Nothing useful there.

### B8. Verdict
UNRELATED to the shop. A personal side project (study, Quran practice, elderly care companion). Only minor reusable ideas (consent-gated logging, tool-calling chat loop, data export/delete). Do not merge code.

---------------------------------------------------------------------

## C) Overall recommendations
1. bathco-vault: KEEP (private). Do not import wholesale. Spend about one hour: compare bathco map.md and DAY-LIFECYCLE-FORMULA.md against BATH-HUB's AGENT_GUIDE/golden core and tick off each rule; add anything missing (LKR 10 conflict ledger, hidden change audit log, alert suppression list, PENDING-not-guess rule) to AI_MEMORY/OPEN_ITEMS as candidate items (no code changes without GO).
2. Fetch the REAL originals (BATHCO_BLUEPRINT, DECISIONS_LOG, DATA_SOURCES, RECONCILIATION_RULES, HONESTY_AUDIT) from C:\BATHCO_PHASE1 if more detail is wanted; the vault only holds summaries. Read them, never touch the live system.
3. NOOR_DIGITAL rules: turn into a go-live checklist for the multi-tenant launch (especially a cross-tenant-leak test and the no-interest billing rule). Already conceptually covered by apex-platform.
4. Delete the 3 empty Obsidian default notes if tidying; they are harmless.
5. Universal-project-: UNRELATED; archive it (or leave private), do not merge. If ever used, never reuse its auth (plain-text passcode, no sessions). If the AI Studio watcher ever re-exports it, ignore.
6. Neither repo contains real secrets or sensitive customer data; no key revocation needed from this scan. Keep both repos private regardless.
7. Gaps to ask Ajmal: has the commission accounting question and the May 19 mismatch (50,400 vs 44,500) been settled? Is the "owner read-only" role still planned?
