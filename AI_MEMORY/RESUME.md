# RESUME (read this first when a session restarts)

Updated 2026-10-04. Master = 833a318 (pushed). apex-server running on it. Memory files (BUILD_LOG.md, RESUME.md) are committed LOCALLY only; they mention where leaked values sit, so do not push them to the public repo.
Rules: never touch the live shop (C:\BATHCO_PHASE1, Railway bathco-production); pm2 only with --only apex-server; no npm ci in the main folder; no real WhatsApp (WHATSAPP_LIVE stays off); LAYLA v2 stays not mounted.

## Done in the last run (steps 1-4 of the owner's GO list)
- review-audit scanned, secret values removed, tested (105 suites green), merged into master, pushed, apex-server restarted, /health ok.
- overnight-all-trial was already in master. Nothing left to merge.

## BLOCKED: steps 5 and 6 need the build pack
- Missing: bathhub-build-pack*.zip (expected in C:\Users\Sony\Downloads). Not found anywhere on C: Desktop/Documents/Downloads or E:\AI Sttuf.
- To resume: put the zip in Downloads, then in the repo root run
  1. extract it to E:\AI Sttuf\bathhub-build-pack
  2. READ root\apply.ps1 first (it must not touch node_modules, .env, the live shop or pm2), then run it: powershell -ExecutionPolicy Bypass -File "E:\AI Sttuf\bathhub-build-pack\root\apply.ps1" -Pack "E:\AI Sttuf\bathhub-build-pack"
  3. .\scripts\backup_owner_db.ps1, then READ scripts/migrate_vendor_ledger.js (must be additive only) and run: node scripts/migrate_vendor_ledger.js
  4. Read BUILD.md in the repo root; follow Build 1 wiring W1-W3 then the builds in its order; skip what is already ported (daily ledger, knowledge files, cheque register).

## Still open for the owner (decisions)
- The GitHub repo BATH-HUB is PUBLIC. Three cloud branches on it (audit-fixes-2026-10-04, bathhub-merged-clean, claude/gallant-brahmagupta-g6tamb) still contain the owner's e-mail and a default-password line in docs/bathhub_knowledge/agents/BATHCO_MASTER.md and the old owner phone fallback in scripts/from_bathco/layla_bathco_old.js. Fix: make the repo private or delete those 3 remote branches.
- Rotate: the API key and postgres password found in the private BATHCO repo history (see audit/REPOS_SCAN.md).
- The 7 slash commands in .claude/commands that call localhost:3000 hit the LIVE shop port (3 of them write): change to 3100 + login before anyone runs them.
- shop_config.json: confirm hours (no closing time), delivery, brands, packages; remove the "either business" and "check with team" contradictions.
- Negative stock allowed (BUGS2 B04); 25th-to-24th pay cycle (B10); golden-core items B01 (fixed) and B05-B08 (see audit/BUGS2.md).
