# BATHCO knowledge, merged into BATH-HUB (2026-10-04)

Copied from the older BATHCO repo (8-9 months of rules, agent prompts and commands). New files only: no existing
BATH-HUB code was edited. Nothing here runs by itself.

## Where things are
- `.claude/commands/`: 105 slash commands (daily-close, checker-run, vera-alerts, credit-aging, quote-gen, stock-alert, ...).
  The 12 shop commands were adapted to this repo's /api routes. Others are for side projects (dubai-status, daraz-list, n8n-*, spin-*) and may need tidying.
- `.claude/skills/company-council`, `llm-council`: 8-department board and 5-advisor decision councils.
- `docs/bathco_knowledge/agents/`: MASTER session file, assistant-mode prompt, both council prompts.
- `BATHCO_CLAUDE_V3.md`: the full rule book (formulas, RBAC, data authority, OCR honesty, alerts, agent roles LAYLA/CHECKER/QUINN/VERA/NOVA, mistakes list). `clauderules.txt` = short rules.
- Same folder: BLUEPRINT, DECISIONS_LOG, GOLDEN_CORE, RECONCILIATION_RULES, HONESTY_AUDIT, DATA_SOURCES, MODULE_REGISTRY, BUG_HUNT_LOG, REFINEMENT_50, QA/STATUS reports, roadmap, cloud-deploy notes.
- `scripts/from_bathco/`: reference copies (not wired in) of the answer engine, reconciliation, conflict-date flagging, OCR retry, cost/item-sales importers, and the old layla.js.

## Rules that were NOT yet in BATH-HUB (read first)
1. Never re-flag: Code 1676 pricing (fixed 2026-05-31), cheque #760329 duplicate, tile gross profit about 18%.
2. Excel vs dashboard gap over LKR 10 goes to a Conflict Review list (OPEN/RESOLVED, admin closes it, never auto-override).
3. Tests must never touch today's real date. Use a fake date like 2099-01-01 (20 July 2026: a test wiped a real day of entries).
4. Dry-run and explicit "YES PROCEED" before any DELETE, DROP or financial UPDATE.
5. The AI may read dates from text but must never touch or estimate money figures. Unclear handwriting is flagged red, never guessed.
6. Alert triggers: missing invoice, negative margin, petty cash off Rs. 25,000, credit over 45 days, cheque due within 7 days.
7. Manual bills go in the next day's Excel, never backdated. Card settlement day-shifts are expected, not errors.

## To check later
- Commands that call endpoints which may not exist here (compare with server.js).
- Not copied: HANDOVER.md, SECURITY_LOG.md, scripts/ocr_expense_photos.py (hold credentials), big exports, spreadsheets, mobile app, old Python app.
- Not yet fetched: BATHCO branch ledger-fixes-2026-07-25 (unmerged daily-ledger work).

## Code ported from BATHCO (2026-10-04)
- PORTED: daily ledger (branch ledger-fixes-2026-07-25): `public/daily-entry-v2.html`, `routes/daily_entry_sync.js` (save/read/meta/range), vendored `public/lib/` (pdf.js, xlsx), test `tests/integration/daily_entry_sync.test.js`.
  Changes vs BATHCO: shared DB pool, impossible dates refused, sits behind the normal login (BATHCO left it open), backup folder configurable (DAILY_BACKUP_DIR).
  Open at `/daily-entry-v2.html`. NOT yet checked in a browser with real data.
- The page's Cheques tab is deliberately cut off from the server (URL points to a dead path, so it keeps cheques in the browser only). BATHCO's cheque route deletes and rewrites the whole table on every save and uses a different table shape; BATH-HUB's `routes/cheque_register.js` is better built (held/overdue/validation), so it was NOT replaced.
- NOT ported because BATH-HUB is already ahead or equal: staff loans maths (same flaw in both, still open), cheque tracking, audit, staff reports, purchasing, offline sync (BATH-HUB `routes/sync.js` is newer).
- Not found anywhere in the cloud repos: the cheque clearing calculator + bank-holiday list, Lasersoft PDF reader, stock-count and cross-tenant leak test. They are probably only on the laptop (C:\BATHCO_PHASE1).
