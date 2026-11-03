# QUEUE TOMORROW
PRE-APPROVED by Ajmal (2026-11-03): start at the FIRST message of the first window tomorrow. No "go" needed. Run silently in the background, push as you go, report once at the end (5 lines).
STOPS THAT STILL APPLY: usage 40% weekly; money/stock math changes; gates in QUEUE_SIMPLIFY (phase 3 and 4 need his YES); no cloud deploy; never touch the old shop; never close apex-server, whatsapp-bridge or anything live; archive instead of delete; no system or security settings; no secrets.

0. OPTIMIZATION FIRST (PC): run scripts/pc/rbh_health_check.ps1 (read-only). Then, safe subset only: clear user temp + npm/browser caches, stop idle emulator/extra node/browser processes (never apex-server, pm2 live, whatsapp-bridge), trim startup programs by DISABLING (not removing). Log sizes freed in LIVE.md. Check: free RAM and disk before/after.
1. Clean CLAUDE.md and Octopus: remove duplicates, archive old rules. Check: shorter, nothing lost.
2. Read github.com/affaan-m/ECC (read only). Install useful skills globally in ~/.claude/skills/ with prefix ecc-. Text SKILL.md only. No hooks, scripts, MCP, network or auto-memory. One-line descriptions. Keep MIT notice. Check: new session lists them.
3. Permissions: allow read, edit, test, build, git add/commit/push, web search. Keep blocked: force-push, deleting outside the project, reading .env or secrets. Check: a test task runs without stopping.
4. Log model and effort in LIVE.md. Check: does it change during the session?
5. Small test on Noor: 2 tasks, each with a check step.
6. Report DONE / NOT DONE, one status word. Commit + push.

Note (2026-11-03): item 2 is already done on the cloud box (19 ecc-* skills in octopus_skills/global/); on the laptop it is only a copy into %USERPROFILE%\.claude\skills\.
