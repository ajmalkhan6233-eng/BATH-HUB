# QUEUE_SIMPLIFY (read at the start of every session until finished)
Do NOT run until Ajmal says "go". Run QUEUE_TOMORROW first. Update the status line below after each phase.
STATUS: Phase 2 audit written from code (AI_MEMORY/AUDIT.md). Waiting: PC steps, then Phase 3 gate (Ajmal YES). Commission = 5% weekly.

## GOAL
Royal Bath Hub becomes a simple, normal shop app. The 6 core modules are rebuilt from scratch in the GRN pattern. Everything else goes inactive and archived. Minimum usage.

## SHOP FACTS (the gap knowledge, keep in mind)
- Opened about 22 Oct. Accessories shop, walk-in customers, no Lasersoft. Owner on iPhone 13 Pro Max, staff on low-end Android. Works offline, syncs later. Free only: no paid AI, no paid WhatsApp API.
- Selling: may oversell. Allow it, warn only, next entry of that item asks how the gap was covered so cost and margin stay right.
- Vendor bills: check qty x rate and totals. A misread is fixed. If the vendor's math is wrong, enter the correct number, keep theirs, raise an alert. Unreadable line = tap suggestions. No payment entered = pending. Vendors may bill items not yet delivered: "awaiting delivery" checklist. Discounts, free items and returns update vendor total, stock and cost together.
- Vendor payable stays until the cheque clears. Cheque deposited Fri clears Mon; Sat/Sun clears Tue. Pop-up 3 days before due. Credit counts from the day the bill is received.
- Item codes: our own series 001, 002... plus a vendor code column, one photo per item.
- Market purchase (item we do not stock): never touches stock, only counts in net profit.
- Every sale updates stock, money, gross and net profit at once. Daily breakdown of sales: cost of goods, cheques, rent (70,000/month), salary and commission (5% of gross profit, weekly), other costs, net profit. Daily cost target 18,000.
- Vendor money never mixes with personal or friend loans. Loans module = investor/friend and personal loans, separate.
- Uploads and bills saved in flat date-based folders, easy to trace. Every Upload has Download + Remove.

## HARD RULES
- Branch work only. First tag the current state "pre-simplify" so everything can be reverted.
- Tests run on a COPY of the database, never the real shop data.
- Money and stock math: do not change without Ajmal's YES. If a rule looks wrong, report it.
- Keep the menu layout he likes (top Home / File / Sales / Customers & Online, left menu with Dashboard). Add only a Super Dashboard shortcut. No glassy rebuild, no repeated menus, no extra logins.
- Never hard delete. Archive. No cloud deploy until he says.

## GRN PATTERN (every core module)
1. Big Add button: photo, voice or type.
2. AI fills the form.
3. One tap to confirm. Alert if totals do not match.
4. Saved list by date, searchable, Download and Remove.

## CORE MODULES, build order
1 GRN + vendor payable, 2 Sales/POS, 3 Vendors + cheques, 4 Money, 5 Loans, 6 Stock. Layla and the morning brief stay.

## USAGE RULES
- Check /usage at start and after each phase. Stop at 70% and tell Ajmal.
- Build in the main session, one module per chat. After each module write a short handoff in AI_MEMORY/LIVE.md, then Ajmal starts a fresh chat.
- Subagents: only for read-only sweeps (audit, usage search, running tests), cheapest model, max 2 at once, never for building. Each agent restarts cold and costs usage.
- Grep before reading. Read only the files a module needs. Tests and curl first, screenshots only at gates.

## PHASES
0. Start: app runs, database present. Dell burned: find the latest backup (vault repo, backups folder, GitHub), restore, report what is missing. Tag pre-simplify.
1. Help Ajmal enter the sales and GRN that happened. Entry first, redesign second.
2. Audit: one cheap read-only agent lists every menu, page, route and table. From the database, what was actually used since 22 Oct. Output AUDIT.md, one line each: KEEP / HIDE / ARCHIVE. You read only AUDIT.md.
3. GATE: show the new 6-item menu and the AUDIT in one screen. Wait for his YES.
4. Build module 1 (GRN). GATE: screenshot at phone size. Wait for his YES before modules 2 to 6.
5. Modules 2 to 6, one at a time. Per module: spec in 5 lines, build, test alone on the copy DB, numbers agree, commit, handoff note.
6. Inactive: modules.json switches modules on/off. Move every HIDE and ARCHIVE item there, plus one "Inactive modules" page. Check: menu is clean, nothing breaks.
7. Proof run: stock, vendor payable, cash and net profit agree across screens. Offline save and sync works. Show the numbers.
8. Report DONE / NOT DONE, one line each, one status word. Commit + push after every module.

## WHERE WORK RUNS (Ajmal, 2026-11-03: build in the cloud, run on the PC)
- Cloud session (this kind) WRITES the code, tests it on a COPY database (bash scripts/dev/cloud_rig.sh), and pushes to branch work after every module.
- PC Claude Code only PULLS, runs the tests, restarts apex-server and reports. It does not write feature code. (Same as Rule 13 in CLAUDE.md.)
- If a PC run fails: put the exact error in LIVE.md, stop; the cloud session fixes it.
- Cloud cannot see the PC or the real shop database: anything needing them (Phase 0 backup restore, Phase 1 entry, Phase 7 proof run) is a PC step with ONE short paste line for Ajmal.

## ANSWERED
- Commission = 5% of gross profit, paid weekly (Ajmal, 2026-11-03). Replaces the older 2% default in DECISIONS.md. Code default changes only when module 4 (Money) is built and he sees the numbers.
