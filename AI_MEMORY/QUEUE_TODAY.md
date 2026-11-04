# QUEUE TODAY (2026-11-04). PRE-APPROVED by Ajmal: start at the first message, no go, no questions. Save usage: grep first, tail not cat, no screenshots, no subagents.
Order of everything built so far (all pushed on branch work): rules (CORE_RULES + start-up hook) > efficiency (ecc-task-loop, CLOUD_PLAYBOOK) > 22 ecc- skills incl. ecc-web-motion-pro > simple menu + module switch + vendor return/discount > readiness + pop-ups.

## PART A: PC PREP (about 20 minutes, Claude Code on the PC runs it; stop at the first failure and write the exact error in LIVE.md)
1. git pull origin work; node scripts/pc/rbh_setup_laptop.js (skills + global rules; old files archived).
2. Backup first: find the newest backup, restore it on a COPY database, write AI_MEMORY/RESTORE_CHECK.md ending DONE. Never touch the real shop DB before this passes.
3. pm2 restart --only apex-server (loads the new menu and routes). Check http://localhost:3100/health.
4. powershell scripts\pc\rbh_health_check.ps1 > AI_MEMORY\PC_HEALTH.txt (read-only). Safe clean-up only: user temp + npm/browser caches. Never close apex-server, whatsapp-bridge, pm2 live.
5. node scripts/pc/rbh_readiness.js --brief. Pop-up shows by itself.

## PART B: TODAY'S REAL WORK with Ajmal: enter stock, GRNs and money vouchers (Phase 1 of QUEUE_SIMPLIFY)
Cheapest route, already built (no new code needed):
- BILLS / GRN / VOUCHERS / CHEQUES / BANK SLIPS: Ajmal opens "Add by photo" (Document Inbox) in the app, photographs or uploads each paper. The app reads it free, shows the fields, Claude Code checks totals (qty x rate) and flags mismatches; Ajmal taps confirm; it files into GRN, vendor payable, cheques or credit. Batch: upload many, confirm in one sitting.
- STOCK in bulk: "Item catalog" (prices page) -> paste CSV: name,category,selling_price,avg_cost,stock_level (code series 001, 002 is automatic; vendor code optional).
- A GRN with no photo: GRN screen, type it (big Add button). Vendor returns/discounts: GRN > Return / Discount.
- Money: daily entry in "Daily Ledger"; market purchases in Daily Breakdown.
Claude Code's job in Part B: after each batch, check stock, vendor payable and cash agree (SQL read-only on the real DB, writes only through the app screens), fix wrong lines, write one LIVE.md line per batch. Never edit money tables by hand.

## PART C: ERP INTERFACE (heavy, only after Part B is flowing)
Simple menu is already the default (Dashboard + 6 modules + Add by photo). Next in the cloud: SPEC_COVERAGE.md GAP rows (vendor code shown in item screens, uniform Download/Remove on uploads, on-screen cheque pop-up), then the visual redesign with ecc-web-motion-pro APP mode (tokens first, one module at a time). Cloud builds, PC pulls and restarts.

## DEFAULTS CHOSEN (no questions asked, all reversible)
Daily cost target = 18,000 (as you said). "Super Dashboard" = the Dashboard page; no new page. Old-shop files (reference/bathco, from_bathco): left as they are, nothing renamed or deleted until you say. Rename plan stays parked. The leaked password line in .claude/commands/dubai-status.md: remove the line in the next commit (value not shown anywhere), you change that password when you can.
