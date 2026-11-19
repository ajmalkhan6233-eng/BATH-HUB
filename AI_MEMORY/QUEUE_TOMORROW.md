# QUEUE TOMORROW
PRE-APPROVED by Ajmal (2026-11-03): start at the FIRST message of the first window tomorrow. No "go" needed. Run silently in the background, push as you go, report once at the end (5 lines).
STOPS THAT STILL APPLY: usage 70% weekly; money/stock math changes; gates in QUEUE_SIMPLIFY (phase 3 and 4 need his YES); no cloud deploy; never touch the old shop; never close apex-server, whatsapp-bridge or anything live; archive instead of delete; no system or security settings; no secrets.

DONE IN CLOUD TONIGHT (2026-11-03): items 1 (CLAUDE.md trimmed, original archived), 2 (ecc skills built), 3 (project permissions in .claude/settings.json), readiness score, colour pop-ups, laptop setup script, AUDIT.md.
PC STEPS FOR TOMORROW, in this order (Claude Code on the PC runs them; all are read-only or copy-only unless stated):
  a. git pull origin work
  b. node scripts/pc/rbh_setup_laptop.js   (copies ecc- skills + global CLAUDE.md into ~/.claude; old files moved to ~/.claude/_archive, never deleted)
  c. item 0 below, save the health output to AI_MEMORY/PC_HEALTH.txt
  d. Phase 0 of QUEUE_SIMPLIFY: find latest backup, restore on a COPY database, write AI_MEMORY/RESTORE_CHECK.md ending with the word DONE
  e. run the SQL at the bottom of AI_MEMORY/AUDIT.md, save to AI_MEMORY/AUDIT_USAGE.txt
  f. node scripts/pc/rbh_readiness.js ; if under 95%, fix what TODO lines say; the Stop hook shows the colour pop-up (green good, red needs you, amber heads-up, blue info)
  f2. AFTER the backup restore passes: git pull done -> restart apex-server (pm2 --only apex-server) so the new routes load (/api/modules, /api/vendor-returns); open /owner on the phone and check the menu; record in LIVE.md
  g. Phase 3 gate already APPROVED by Ajmal ("yes menu"). Next: read AI_MEMORY/SPEC_COVERAGE.md, build the GAP/PARTIAL rows in the cloud; then: show Ajmal the menu + AUDIT in one screen, wait for his YES
00. FIRST OF ALL, CLAUDE CODE ITSELF AT 95%+ (Ajmal's order): read CORE_RULES + CLOUD_PLAYBOOK, follow ecc-task-loop on every task, log EFFICIENCY_LOG.md; run bash scripts/dev/cloud_test.sh --rig-only as a smoke test. Only then the computer and the build.
0. OPTIMIZATION (PC): run scripts/pc/rbh_health_check.ps1 (read-only). Then, safe subset only: clear user temp + npm/browser caches, stop idle emulator/extra node/browser processes (never apex-server, pm2 live, whatsapp-bridge), trim startup programs by DISABLING (not removing). Log sizes freed in LIVE.md. Check: free RAM and disk before/after.
1. Clean CLAUDE.md and Octopus: remove duplicates, archive old rules. Check: shorter, nothing lost.
2. Read github.com/affaan-m/ECC (read only). Install useful skills globally in ~/.claude/skills/ with prefix ecc-. Text SKILL.md only. No hooks, scripts, MCP, network or auto-memory. One-line descriptions. Keep MIT notice. Check: new session lists them.
3. Permissions: allow read, edit, test, build, git add/commit/push, web search. Keep blocked: force-push, deleting outside the project, reading .env or secrets. Check: a test task runs without stopping.
4. Log model and effort in LIVE.md. Check: does it change during the session?
5. Small test on Noor: 2 tasks, each with a check step.
6. Report DONE / NOT DONE, one status word. Commit + push.

Note (2026-11-03): item 2 is already done on the cloud box (19 ecc-* skills in octopus_skills/global/); on the laptop it is only a copy into %USERPROFILE%\.claude\skills\.
