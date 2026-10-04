# RESUME (2026-10-04, cloud session stopped after step 2, tests green)

Stopped because steps 3 (restart/health), 4, 5, 6 need the LAPTOP: apex-server and pm2, the overnight-all-trial branch, E:\AI Sttuf, Downloads\bathhub-build-pack*.zip, scripts\backup_owner_db.ps1, BUILD.md. None of these exist in the cloud. Usage meter (/usage) not available to the cloud session.

## Do next, on the laptop, in this order (defaults, no questions)
1. git fetch origin; git checkout review-audit (or origin/audit-fixes-2026-10-04). Pull the last commit (redactions + AI_MEMORY logs).
2. npx jest (expect 104 suites; documents.test.js can flake under load, re-run it alone).
3. git checkout master; git merge --no-ff review-audit; npx jest; git push origin master; pm2 restart apex-server (--only apex-server, NEVER bathco-server); curl localhost:<port>/health.
4. If overnight-all-trial is not merged: merge it, keep review-audit's version of the BATHCO knowledge files (docs/bathhub_knowledge/, .claude/commands, shop_config.json) and the daily ledger (public/daily-entry-v2.html, routes/daily_entry_sync.js, utils/pool.js start-up order); overnight's version for everything else. Tests, push, restart apex-server only. Big conflicts or failures: stop and write them here.
5. Install the pack (extract to E:\AI Sttuf\bathhub-build-pack, run apply.ps1), run scripts\backup_owner_db.ps1, then node scripts/migrate_vendor_ledger.js.
6. Read BUILD.md, do W1-W3 then the builds in its order; skip the daily ledger and knowledge files (already ported), use its VERIFIED HARVEST MAP.

## Still held in the cloud working copy (never committed)
reference/bathco/ and a jest.config.js line. Needs Bath Hub set to PRIVATE on GitHub first.
