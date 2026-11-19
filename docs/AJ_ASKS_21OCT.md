# AJ'S ASKS, WED 21 OCT 2026 (numbered, with plan and status). Newest rules: AI_MEMORY/RULES.md top 3 lines.
Status words: DONE = built and a check ran. BUILT = written and tested in the cloud, not yet run on the PC. PLANNED = waits for Aj's go or inputs. UNVERIFIED = could not be checked here.

| # | Aj asked | What was done / planned | Status |
|---|----------|--------------------------|--------|
| 1 | 05:22 Install 5: Superpowers, frontend-design, Karpathy rules, webapp-testing, Document skills | scripts/pc/rbh_plugins.ps1 (Anthropic skills pack = document skills + examples; Superpowers; Karpathy rules). Which pack holds frontend-design and webapp-testing is UNVERIFIED (page did not say) | BUILT, UNVERIFIED |
| 2 | 05:22 Picture "Rules for my AI", for Bath Hub and all projects | The 13 rules written as ALWAYS / NEVER lines at the top of CLAUDE.md and AI_MEMORY/RULES.md | DONE |
| 3 | 05:22 What is missing critically | 8 gaps: restore test, one live-status page, real phone tests, monthly cost list, rollback, keys in one safe place, bank cheque rule, Sinhala/Tamil native check | PLANNED |
| 4 | 05:28 Proper marketing research | Research job: who buys in Thihariya, rival prices, what to post, cost, free tools first | PLANNED (needs go) |
| 5 | 05:28 App needs more research | Same research method on the app: read real code first, report on GitHub | PLANNED |
| 6 | 05:28 Reading GRN and bills needs polish | Test with 20 real photos, count how often each field reads right, fix the weak spots | PLANNED (needs 20 photos) |
| 7 | 05:28 Voice messages need attention | Real voice notes in English, Sinhala, Tamil; a price change never applies without Aj's yes | PLANNED |
| 8 | 05:28 "10 more points I missed" | Claude listed 10; Aj's own 10 are still to come | NEEDS AJ |
| 9 | 05:28 One master instruction for an AI | Rule 1 + video rules + ship check = the master (CLAUDE.md, RULES.md, docs/SHIP_CHECK.md) | DONE |
| 10 | 05:40 Ship-check list (20 items) | docs/SHIP_CHECK.md. The audit run itself waits for a browser on the PC | list DONE, audit PLANNED |
| 11 | 09:05 / 09:51 Ponytail | SKILL.md read in the cloud: plain writing guidance, no commands, no web links, sends no data. Installed as skill only (no hooks; the hooks page could not be read) | BUILT, UNVERIFIED |
| 12 | 09:51 Server stops when everything is closed; he must call Claude to restart | Plain-code watchdog every 5 minutes (no Claude usage) + desktop shortcut "Start Royal Bath Hub" | BUILT (13 tests pass); scheduling UNVERIFIED |
| 13 | 09:51 Diagnose why it stopped | Watchdog writes one plain line per outage to logs\watchdog.log (busy port, database off, wrong password, disk full ...). Aj says "read the watchdog log" | BUILT |
| 14 | 09:51 Make what we built stronger, not new | This whole pack is hardening only | DONE |
| 15 | 09:51 Clean Node start-up ("injected env", BATHCO template text) | Silenced the injected-env line (checked in the cloud); the old banner with "Your Business Name" replaced by one line; two placeholder names fixed (Layla fallback message, audit cover) | BUILT; PC start UNVERIFIED |
| 16 | 09:51 Lighter for the computer | Daily log tidy for apex-server only (keeps logs under 5 MB, 5 archives) | BUILT, UNVERIFIED |
| 17 | 09:51 / 09:53 Wipe the document inbox and ALL customer data, GRNs, everything; start fresh | utils/freshStart.js + scripts/wipe_fresh_start.js + scripts/pc/rbh_wipe.ps1. Needs a fresh backup first (also copied to E:), one all-or-nothing step, never the live DB. Checked on a REAL PostgreSQL in the cloud including the "put everything back on failure" case | BUILT; NOT RUN yet |
| 18 | 09:51 Same photo saved many times in the inbox | File fingerprint (sha256): the same photo is not saved twice; after Reject it may be sent again. Saving a paper never depends on it | BUILT (24 tests pass) |
| 19 | 09:51 Claude only overlooks; Aj goes through Claude; save usage | Heavy lifting is plain scripts. Claude is only called to read a log line or decide | DONE (design) |
| 20 | 09:53 Rule 1 in CLAUDE.md: least work for Aj | At the top of CLAUDE.md and RULES.md | DONE |
| 21 | 09:53 New repo or connection: do not make me remember | Rule 1 says Claude attaches it itself. Attached now: ajmalkhan6233-eng/bath-hub (branch claude/rbh-hardening-21oct) | DONE |
| 22 | 09:53 One thing for the app, one for Claude Code | App: inbox fingerprint, quiet start, wipe. Claude Code: AI_MEMORY/PC_RUN_21OCT.md (8 steps) | DONE |
| 23 | 09:55 Minimum paste | One line to Claude Code on the PC: it reads PC_RUN_21OCT.md | DONE |

## What the wipe clears and keeps (so nothing is a surprise)
CLEARS: customers and leads, credit customers, WhatsApp chats and drafts, bills and quotations (with items, payments, receipts), cheques (register, deposits, personal, alerts), vendor payables (bills, payments, credit notes), GRNs and purchase orders, stock movements, document inbox rows + photos, queued alerts. Stock quantities become 0.
KEEPS: logins, settings, products (names and prices), suppliers, staff and salary setup, loans and accounts, daily figures and expenses, schema.
Daily figures and expenses go only on Aj's word: `rbh_wipe.ps1 -Execute -Also daily,expenses`.
After the wipe the opening stock can be loaded again with scripts/import_opening_grn.js (not run yet; needs data/opening_grn.txt and Aj's go).
