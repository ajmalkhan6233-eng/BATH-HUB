# URGENT 2 (chat 13:25): codes are back to the pre-fix state, but the typed codes (Metro 001.., Leo 0065..0101) are not in the item list. Find where Ajmal's typed codes live. READ ONLY, change nothing.
Run once from the app folder (it prints samples only, no keys), then paste the WHOLE output into AI_MEMORY/LIVE.md (one block, newest on top) and push it:
  git pull --ff-only ; node scripts/dev/code_sources_report.js
Then tell Ajmal in 3 lines: which source holds the typed codes (live GRN text, grn_bill_extra, data/grn_bills.json, or only the pre-fix backup). Do NOT run undo, restamp, fix or any button. Do not write code. Then STOP: chat builds the exact restore from your output.

# URGENT FIRST (Ajmal 5 Nov 12:30): ITEM CODES WERE CHANGED BY THE MORNING FIX AND ARE WRONG. RESTORE THEM. Do this BEFORE the steps below.
What he wants: the codes as they were when he switched the computer off on 4 Nov night: Metro items 001, 002, ... (first vendor), Leo items EXACTLY as he typed them (0065 to 0101), Fazaal as he typed. No OLD-xxx, no TBD-xxx unless that item truly never had a code. Do NOT wipe or clean any data.
Cause: the morning fix step item_codes ran routes/item_codes_fix.js: it kept Metro codes as they were (they were OLD-xxx, not 001), set Leo from GRN text by name, and turned every other item into TBD-<id>.
Do, in order (no code writing, only run):
 a) create the file local_ops\NO_MORNING_FIX (so it never runs again). Stop the app from changing codes again: do NOT press the Fix item codes button.
 b) READ ONLY first: in Postgres run: SELECT run_id, count(*), min(run_at), bool_and(undone) FROM item_code_renumber_log GROUP BY run_id ORDER BY min(run_at); and show 5 sample rows (old_code, new_code, item_name, vendor) of the newest run. Put the result (no keys) in AI_MEMORY/LIVE.md.
 c) The newest run is the morning fix. Backups exist: backups\pre_morning_fix_*.sql.gz (taken before it) and table products_bak_codefix. Check the backup file is there, then run: node scripts/renumber_item_codes.js --undo  (puts the previous codes back, then re-stamp GRN lines: POST /api/item-renumber/undo as owner does both; use that if the script alone does not re-stamp).
 d) CHECK: SELECT item_code, name FROM products ORDER BY id LIMIT 15; and Metro bill lines: Metro codes must start 001 with no OLD- and no TBD-. Leo 0065..0101. If Metro still shows OLD-, the codes before the fix were already OLD: then STOP, do not guess, write the exact rows in LIVE.md and tell Ajmal: NEEDS CHAT.
 e) Report to Ajmal in 5 lines with the real first 5 Metro codes you now see. Never say done without that check.

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
