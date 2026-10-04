# BUILD_LOG (one line per step; newest at the bottom)

- 2026-10-04 STEP 0: /usage cannot be run from inside this session (it is a terminal command). Budget watched through the session token counter instead; stop point = 5% of the budget left.
- 2026-10-04 STEP 1 FACTS (master 22f2fb1 = origin/master):
  1. Merged into master: audit-high-fixes, auto-send, bugcheck, cheque-clear-fix, documents, hardening, layla-v2, overnight-all-trial, tests-and-checks, website-editor, website-v3, website-v4, whatsapp-send, fix/bugcheck-audit-env.
  2. NOT merged: review-audit (local), feature/website-preview (old), and the three cloud branches on origin.
  3. review-audit: 7 commits master lacks (tip 6428d05), 0 behind master. origin/audit-fixes-2026-10-04: 6 ahead, 0 behind (tip fee0af0).
  4. origin/bathhub-merged-clean: 5 ahead, 0 behind (tip 4c615ac). origin/claude/gallant-brahmagupta-g6tamb: 4 ahead, 0 behind (tip 7cf168b).
  5. feature/overnight-all-trial (bugcheck, documents, layla-v2, website-v4, hardening) is ALREADY merged into master (89880cf): step 4 is not needed.
- 2026-10-04 STEP 2 SECRET SCAN (patterns: password/passwd/secret/api key/token/PIN/@gmail/@yahoo/Password:/Sri Lankan phones; scanned every file CHANGED vs master on each branch, no values printed; word-only mentions such as DB_PASSWORD env names are normal code and were left):
  1. review-audit: 4 files had real values, FIXED and committed (94c92fc): CLAUDE.md (parked Railway URL), docs/bathhub_knowledge/agents/BATHCO_MASTER.md (owner e-mail + a default "Password:" value), scripts/from_bathco/layla_bathco_old.js (owner phone fallback). public/bathhub.html holds the shop's PUBLIC WhatsApp number on purpose (website), left as is.
  2. origin/bathhub-merged-clean, origin/audit-fixes-2026-10-04, origin/claude/gallant-brahmagupta-g6tamb: same hits, NOT rewritten (no history rewrite): CLAUDE.md, docs/bathhub_knowledge/agents/BATHCO_MASTER.md, scripts/from_bathco/layla_bathco_old.js (+ public/bathhub.html public number on audit-fixes only). These three branches are on the PUBLIC GitHub repo.
  3. The default-password line and e-mail therefore still exist in those 3 public branches; deleting the remote branches or making the repo private is the only fix (owner decision).
- 2026-10-04 STEP 3 MERGE review-audit: full tests on review-audit 105 suites / 1221 passed / 0 failed. Merged into master with --no-ff (833a318). Tests on master: first run 1 failure (site_page "public feed needs no login", a load-timing flake: passes alone, 16/16), second full run 105 suites / 1221 passed / 0 failed. Pushed master (22f2fb1..833a318). apex-server restarted with --only apex-server: /health ok, /site 200, /owner shows login, /api/customers and ledger API 401 when signed out, /daily-entry-v2.html 200, no new error lines in the log.
- 2026-10-04 STEP 4 SKIPPED (nothing to do): feature/overnight-all-trial was already merged into master earlier (89880cf), so bugcheck, documents, layla-v2, website-v4 and hardening are all in master already.
- 2026-10-04 STEP 5 BLOCKED: no file named bathhub-build-pack*.zip exists in C:\Users\Sony\Downloads (only bath-hub---tile-&-sanitaryware-pos zips and old noor_*.zip) or anywhere under Desktop, Documents or E:\AI Sttuf (searched 3 levels deep). Nothing extracted, apply.ps1 not run, backup script and scripts/migrate_vendor_ledger.js NOT run (the script is not in the repo either). BUILD.md does not exist in the repo root.
- 2026-10-04 STEP 6 BLOCKED (depends on step 5): no BUILD.md, so the builds W1-W3 and later were not started.
- 2026-10-04 12:46 STEP 5 RETRY: still no bathhub-build-pack zip. Downloads newest file is dated 2026-10-02; searched C:\Users\Sony (incl. OneDrive), E:\ and D:\ to depth 4 for *build-pack*: nothing. Nothing run. Waiting for the zip.
- 2026-10-04 Build 1 (pack): extracted bathhub-pack.md (18 files), apply.ps1 ran (45 new tests green), DB backed up (backups\bathco_owner-2026-10-04_1258.sql + encrypted copy D:\BathHubBackups), migrate_vendor_ledger.js OK. W1 route mounted /api/vendor-ledger, W2 menu "Vendor Ledger" added. W3 (GRN "Create vendor bill" button), W4-W6 NOT done.
- 2026-10-04 Logo lockup (BH box + "Bath Hub" + small "Thihariya") on login, sidebar, strip on every page via public/bathhub-logo.js; SW cache v11. Merge 7e0852f pushed to master. apex-server restarted, /health ok (port 3100, not 3010). Rollback: git revert -m 1 7e0852f. Full Jest: 2 old-guard tests updated; rest green.
# BUILD_LOG (one line per step)

Run by the CLOUD session on 2026-10-04 (no E: drive, no Downloads, no pm2, no live shop here). /usage cannot be run by a tool, so the 5% stop was not measurable.

## Step 1: facts (no changes)
- Local branches merged into master: only master itself. NOT merged: audit-fixes-2026-10-04, bathhub-merged-clean, claude/gallant-brahmagupta-g6tamb.
- Commits each has that origin/master lacks: origin/claude/gallant-brahmagupta-g6tamb = 4, origin/bathhub-merged-clean = 5, origin/audit-fixes-2026-10-04 = 6 (it contains the other two), master is ahead of none of them.
- review-audit does NOT exist in the cloud copy (laptop-local branch: a checkout of origin/audit-fixes-2026-10-04, so treat that one as the same thing).
- origin/overnight-all-trial does NOT exist on GitHub (laptop-local only, or never pushed): step 4 cannot run here.
- origin has only 4 branches: master, claude/gallant-brahmagupta-g6tamb, bathhub-merged-clean, audit-fixes-2026-10-04.

## Step 2: secret scan (word patterns, all files, three remote branches)
- Broad word scan (password|secret|token|PIN|emails|phones...) hits: bathhub-merged-clean 167 files, audit-fixes 167, gallant 168. Most are code that handles passwords/tokens or test fixtures, not secrets.
- Likely real VALUES (literal secret, email or phone) in 44 files per branch; checked by hand: almost all are placeholders or test examples (07712xxxxx style, UI spec examples, .env.example).
- REAL hits found: owner WhatsApp number as a default in scripts/from_bathco/layla_bathco_old.js (default removed, now needs WHATSAPP_TEST_WHITELIST); owner email in docs/bathhub_knowledge/agents/BATHCO_MASTER.md and SESSION_LOG.md (both [REDACTED]). Fixed on audit-fixes-2026-10-04 (the review-audit equivalent).
- NOT redacted on purpose: the shop's public WhatsApp number on the website (public/bathhub.html, public/website/index.html, routes/site_editor.js, bathco_complete.html): it is the published contact number, replacing it would break the site.
- Remote branches bathhub-merged-clean and claude/gallant-brahmagupta-g6tamb still contain the owner email and number (history not rewritten, as ordered). File lists: broad = /tmp/claude-0/-home-user-BATH-HUB/070b0cd0-5ec3-5446-aad9-a5224fb17c75/scratchpad/broad_*.txt (scratch, not kept); likely-value files = AISTUDIO_HANDOFF/UI_SPEC_SETUP_WIZARD.md, SESSION_LOG.md, agents/BATHCO_MASTER.md, frontend/.env.example, layla_v2/*.js (comments), public/*.html, routes/invoice_receipts.js, routes/site_editor.js, scripts/bugcheck*.js, scripts/dev/seed_test_data.js, scripts/from_bathco/layla_bathco_old.js, utils/*, 22 test files.

## Step 3: tests and merge
- Full tests on audit-fixes-2026-10-04: 104 suites, 1203 tests pass (one timing flake in documents.test.js on the first run, passes alone 104/104 and on re-run).
- Merge to master, push, restart apex-server, /health: NOT DONE in the cloud (no apex-server here, and the laptop's master may differ; merging in two places would collide). Do it on the laptop.

## Steps 4 to 6: NOT RUN (laptop only), see RESUME.md
- 2026-10-04 Builds 6+7: routes/money_plan.js, public/money-plan.html + morning-brief.html, menu entries, 3 tests. Merge bec9907 pushed, apex-server restarted, /health ok. Rollback: git revert -m 1 bec9907. Not done: Task Scheduler 05:25 morning job, festivals table, auto-pricing on GRN, item_prices, below-cost weekly report.
