# MORNING (overnight job, finished 2026-10-04)
Nothing pushed, nothing deployed, no pm2 restart, no real WhatsApp. Master has one LOCAL merge (job 0, 946a063). Backup taken first (backups\bathco_owner-2026-10-03_2321.sql).

## 1. Status per job
- Job 0 DONE: feature/tests-and-checks merged into master locally (tests only). Suite green.
- Job 1 READY (feature/bugcheck): `npm run bugcheck` = 67 named checks on a scratch copy; 12 new bugs in audit\BUGS2.md; 3 fixes with tests.
- Job 3 READY (feature/documents): 12 reports as PDF/CSV, documents page, allow-listed WhatsApp send (dry run), quarantine inbox. Details: audit\MORNING_job3.md
- Job 4 READY (feature/layla-v2): LAYLA for WhatsApp, rule-based, dry run, nothing mounted. 200/200 own test conversations (my own set, so optimistic): audit\LAYLA_REPORT.md
- Job 2 READY (feature/website-v4): sitemap, robots, share tags, manifest, catalogue PDF, print CSS. Screens: audit\screens\v4\
- Job 5 READY (feature/hardening): rate limits, CSP for /site, safe paths, log redaction. Review of new code: audit\HARDENING_REVIEW.md
- Job 6 DONE: all 5 branches merged together on a throwaway branch: 102 suites, 1207 passed, 0 failed; bugcheck on it: 64 pass, 0 fail, 1 known.

## 2. Branches (suite run on each alone: only failure = the old midnight clock test pos_discount_cap, fixed on feature/bugcheck)
| branch | last commit | tests alone |
| feature/bugcheck | a36242e | 86 suites, 795 pass, 0 fail |
| feature/hardening | 43fce3a | 87 suites, 819 pass, 1 clock fail |
| feature/website-v4 | 44a8663 | 84 suites, 768+ pass, 1 clock fail |
| feature/documents | f5cced7 | 84 suites, 859 pass, 1 clock fail |
| feature/layla-v2 | 12f3eda | 93 suites, 986+ pass, 1 clock fail |
- EASIEST: `git -C "E:/AI Sttuf/BATHCO_TEMPLATE" merge --no-ff feature/overnight-all-trial` (all five already merged + tested together, 988095f; server.js clash resolved by keeping both additive sides).
- Or one by one in this order: bugcheck, hardening, website-v4, documents, layla-v2 (the server.js mount lines clash: keep both sides).
- Rollback: `git -C "E:/AI Sttuf/BATHCO_TEMPLATE" revert -m 1 <merge commit>`; Layla DB tables: run layla_v2\migrations\001_layla_v2_down.sql; documents tables: scripts\documents_down.sql.
- After merging restart only: `pm2 restart apex-server --only apex-server`, then `npm run bugcheck`.

## 3. Needs your sign-off (golden-core, NOT touched)
- BUGS2 B01: server.js:1246 "Mark cheque cleared" (Cheques screen) always fails with 500: remove `, updated_at = CURRENT_TIMESTAMP`.
- BUGS2 B05-B08: validation and 4 dead legacy routes in server.js / audit.js / staff_reports.js (symptom already a 400).
- Every branch adds only mount lines to server.js (non-financial region); hardening also adds a console-redaction line. The 400-rewrite (utils/pgInputErrors.js) also covers golden routes without editing them.

## 4. Decisions and hand work for you
- Decide: negative stock allowed (B04)? A 25th-to-24th pay cycle (none in code, B10)? Is the P&L report built from stored daily profit acceptable?
- .env: SITE_URL (website links), PETTY_CASH_FLOAT=25000. Not set yet: WHATSAPP_LIVE (leave off), LAYLA_V2_ENABLED, WHATSAPP_APP_SECRET, LAYLA_V2_VERIFY_TOKEN.
- LAYLA: add owner/staff numbers to layla_contacts (list starts empty), Meta-approved message template, one mount line in server.js, wire the documents adapter after documents merges (notes in MORNING_job4.md), native Sinhala/Tamil speaker must review phrases.js and glossary.json.
- Documents: add allow-list recipients (empty now). Real WhatsApp sending was never run.

## 5. Known risks
- Layla webhook route needs the raw body for the signature check (see HARDENING_REVIEW.md before turning it on); rule brain fails safe to "let me check" plus a staff task.
- Layla pending quote offers live in memory (lost on restart). Console redaction may show long ids as ***123 in logs.
- npm audit: 10 high remain (puppeteer chain, whatsapp-web.js, xlsx): need breaking upgrades, skipped.
- Agents hit the usage limit once at 01:30 and were resumed; all reports are in audit\MORNING_job*.md. Branch feature/overnight-all-trial is only a convenience merge.
