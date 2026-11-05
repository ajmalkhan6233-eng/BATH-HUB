# PC START (written by Claude chat, 5 Nov 2026). THIS FILE IS THE WHOLE JOB. Do not read other files first.
Who: Ajmal, owner, not a coder, phone + voice. Replies: max 5 short lines, plain words, status word last (GREEN, DONE, BLOCKED, NEEDS YOU, UNVERIFIED). Never the word "problems" (say "heads-up").
Why you exist: Claude chat writes ALL code in the cloud and tests it. You only RUN it: pull, restart, check, report. Do NOT write or change feature code. If a check fails, write the EXACT error in AI_MEMORY/LIVE.md and stop; chat fixes it.
Save usage: no wide searching, no re-reading, no long jobs. Do the steps below in order, nothing else.

## STEPS (all run on the PC, branch work, folder E:\AI Sttuf\BATHCO_TEMPLATE)
1. git checkout work ; git pull --ff-only   (never push main, never force). If the pull is refused, write the exact error in LIVE.md and stop.
2. pm2 restart apex-server --only apex-server   (never other pm2 apps, never start a second WhatsApp bridge). Then open http://localhost:3100/health : must be 200.
3. Read http://localhost:3100/api/pc-actions/morning-fix (needs the owner login, or read logs\morning_fix.json). Report each step: backup, item codes, Metro double-count, GitHub backup. If double_count says it used its 3 tries, tell Ajmal: GRN tab 2 > button "find and fix double-counted GRNs" (it now works with 0 stock, fixed 5 Nov, commit 433084e).
4. Check: Reports menu, Vendors menu, Inventory menu (GRN first). These arrive only after chat pushes branch claude/reports-menu; if the menu still says "Stock" and "Profit", write "menus not pushed yet" and carry on (not a failure).
5. Bridge task 143 (photo reader): ONLY if AI_BRIDGE/LIVE.md in C:\Users\Sony\ai-bridge has no "DONE 143". Then run it exactly as written in BRIDGE.md TASK 143 (git pull the bridge first). If DONE 143 is already there, skip.
6. Write ONE line at the top of AI_MEMORY/LIVE.md: HH:MM | PC | what you ran | result | next. Commit and push ONLY that file to work. Then give Ajmal the 5-line report and STOP.

## WHAT AJMAL HAS ASKED FOR (so you never ask again)
- Done in cloud, pushed: GRN duplicate stock fix (clamp). Done in cloud, NOT pushed yet (waiting for his word): Reports menu with every report + Profit column removed; Inventory menu (GRN first, "Stock" renamed Inventory, GRN removed from Vendors); fix for menu items that went missing on the PC (Stock & items, Stickers, Vendor 360).
- Rule: chat pushes only when Ajmal says "put it on the bridge". PC auto-update pulls work every 5 minutes by itself.
- Open for Ajmal (do not do for him): item codes for vendor 2+, "clean test data" word, delete branch rbh-backup on the public BATH-HUB repo, change DB password in git history, confirm bridge repo is PRIVATE, pick default theme, exact username of the "Royal Bath Hub" login.
- Full older state if truly needed: AI_MEMORY/NOW.md, AI_MEMORY/HANDOFF_2026-11-05.md. Not needed for the steps above.

## IF AJMAL SAYS ANYTHING ELSE in this window
Do what he says, small and cheap, and tell chat via LIVE.md. Code changes = tell him to ask chat (claude.ai), do not write them.
