# RENAME PLAN — NOTHING RENAMED YET. Waiting for Ajmal's "go".
Each row: current name -> proposed -> what can break. Do one row at a time, test, then next.
Text/labels in docs and comments were already fixed (2026-11-03). Only identifiers are left.

| # | Where | Now | Proposed | Risk |
|---|---|---|---|---|
| 1 | GitHub repo | BATH-HUB | rbh-app (or keep) | links, bridge repo, Claude chat access |
| 2 | PC folder | E:\AI Sttuf\BATHCO_TEMPLATE | E:\AI Sttuf\RBH_APP | pm2 paths, scheduled tasks, scripts with hard paths |
| 3 | pm2 | bathco-server (old name in docs/scripts) | rbh-server | live app uses apex-server: confirm which is real before touching |
| 4 | Railway | project bathco-production / alert-cooperation | NOT OURS (former workplace): never rename or touch | live old system |
| 5 | Railway (ours) | apex-platform | keep or rbh-platform | service URLs |
| 6 | DB names | bathco_test, bathco_owner, bathco_template(_app), bathco_restore_test | rbh_test, rbh_main, rbh_template... | .env, backup scripts, restore tests, existing dumps |
| 7 | Env vars | BATHCO_ASSISTANT_MODE, BATHCO_DROP, BATHCO_* in scripts | RBH_* with old name read as fallback for one release | .env on every machine |
| 8 | Table / column | lasersoft_invoices, lasersoft_total (golden core) | pos_import_invoices, import_total | ALTER = golden core: needs Ajmal's sign-off + migration + backup |
| 9 | Files | public/bathco_complete.html (= /owner app), public/BATHCO_NATURE.html (gone, redirect only) | rbh_owner_app.html | service worker cache list, redirects, menu links |
| 10 | Folders | reference/bathco/ (98 files), scripts/from_bathco/ | _archive/former-workplace/ | tests/scripts importing from them |
| 11 | Docs | docs/bathhub_knowledge/BATHCO_*.md, MD_MAP, AGENT_GUIDE/ (still says BATHCO_NATURE.html) | RBH_* / rewrite AGENT_GUIDE | none (docs) |
| 12 | Browser storage keys | bathco-daily-*, bathco-device-id, bathco-sync-queue, bathco-cheques, bathco-theme... (public/daily-entry-v2.html) | rbh-* + one-time copy of old values | unsynced offline data lost if not copied |
| 13 | Download file names | BATHCO_SALES_<date>.csv, BATHCO_DAY_<date>.json, BATHCO_REPORT_<date>.png | RBH_... | anything that watches for those names (n8n workflows in reference/) |
| 14 | Legacy login | username 'uncle' (role owner, read-only) | remove or rename after Ajmal confirms | tests/integration/auth.test.js, server.js seed |
| 15 | Slash command | /bathco-daily | /rbh-daily | AI_MEMORY/COMMANDS.md list |
| 16 | Backup file names | backups\bathco_owner-*.sql | rbh_main-*.sql | restore scripts, encrypted copies |
Order I suggest: 15, 11, 10, 9 (safe first) then 12, 13, 7, 3, 2, 6, 16, 1, then 8 and 14 last.
