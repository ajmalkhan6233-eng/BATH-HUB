# RBH AI Change Guard
The AI may make its changes. It may not judge them. This folder judges, and undoes what is wrong. Free, local, no AI inside.

| Part | File | What it does |
|---|---|---|
| Change log + delete lock | sql/001_ai_change_guard.sql, src/install.js | every row change by anyone is logged (append-only); the AI database users `ai_chat` / `ai_pc` can read, add, change, never delete or empty a table, never change table layouts, never touch logins |
| Numbers guard | src/snapshot.js, src/compare.js | items, stock pieces, stock value, each vendor owed, cheques, POS bills, cash: before vs after, must equal the task's expected change |
| Row guard | src/rowcheck.js | every AI row change must be on the list the task declared first (catches two offsetting changes) |
| Screen guard | src/screen_guard.js, golden/ | every page, menu entry and route of the known-good copy (claude/rbh-good-20nov) must still exist; optional Chrome check |
| Task wrapper | src/guarded_task.js | backup, stop writes, before, run as AI user, after, judge, undo (database restore + git revert of that task's commits) + alert |
| Nightly check | src/nightly_check.js | stock vs paper trail, duplicates, overpaid vendors, selling below cost; one short message |
| Report | src/report.js | today's AI changes |

Test (throwaway copy only): `bash guard/test/run_tests.sh <SHOP_LATEST csv folder> <app folder>`  (21 checks).
Rules: AI scripts never alter tables (the owner login does migrations). Settings only in `.env`. `guard/out/` stays on the PC (it holds shop numbers).
