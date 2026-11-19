---
name: Royal Bath Hub map
description: One-screen map of the Royal Bath Hub app. Read this first, then open only the one folder the job needs.
---
# Royal Bath Hub: where things are (map, built 24 Oct 2026 with icm-architect)
Rules and AJ's orders: [CLAUDE.md](CLAUDE.md) and [docs/AJ_RULES.md](docs/AJ_RULES.md). Open items: [START_HERE.md](START_HERE.md), [docs/REQUEST_LEDGER.md](docs/REQUEST_LEDGER.md). What is installed: [docs/INSTALLED.md](docs/INSTALLED.md).

## Go here for the job (load only that row)
| Job | Open first | Code lives in | Check with |
|---|---|---|---|
| POS bill, discount, credit, receipt | .claude/skills/rbh-pos/SKILL.md | routes/pos_*.js, utils/posCredit.js, public/pos_billing.html, public/pos-picker.js | tests/ for that file |
| Stock-in, vendor bill, awaiting delivery, oversold | .claude/skills/rbh-erp/SKILL.md | routes/grn*.js, routes/pending_delivery.js, routes/oversold.js, utils/pendingDelivery.js, utils/oversold.js | jest for the file |
| Cheques, bank days | .claude/skills/rbh-erp/SKILL.md | utils/bankDays.js, utils/chequePlan.js, routes/cheque_plan.js | tests/chequePlan.test.js |
| Prices, reorder, item codes | .claude/skills/rbh-price-learner/SKILL.md | utils/priceHelper.js, utils/reorder.js, routes/stock_helper.js, scripts/list_item_codes.js | tests/stockHelper.test.js |
| Morning reminders, commission, 06:00 notice | docs/AJ_RULES.md (Rule 11) | utils/dailyChecklist.js, utils/commissionWeekly.js, utils/notify.js, layla_owner/boot.js | tests/dailyChecklist.test.js |
| Staff logins (cashier PIN) | server.js auth gate | utils/cashierGate.js, routes/staff_logins.js, public/cashier_mode.js | tests/cashierGate.test.js |
| Audit, backup, links check | .claude/skills/rbh-audit/SKILL.md | scripts/audit/ , utils/auditInvariants.js | node scripts/audit/run_audit.js |
| Layla (WhatsApp customers and owner) | docs/LAYLA_PRO_SPEC.md | layla_v2/, layla_owner/, whatsapp-bridge.js, knowledge/ | UNVERIFIED on live |
| Screens, menus, look | .claude/skills/rbh-ux/SKILL.md | public/*.html, public/menubar.js, public/rbh_polish.css | docs/SHIP_CHECK.md |
| Website | docs/BATHHUB_WEBSITE.md | separate repo bathhub-website | never publish without AJ |
| Papers (cheques, slips, bills) | docs/PAPERS.md | scripts/import_papers.js | papers skill |

## Folders in one line each
- routes/ one file per API area. utils/ one file per business rule. public/ screens and scripts. scripts/ jobs and checks. tests/ jest.
- knowledge/ plain-language shop facts (accounting, checklists, ethics, shop rules, troubleshooting) for Layla and helpers.
- data/ and .env are private: never read, print or commit.
- migrations/ database changes. docs/ everything written down. AGENT_GUIDE/ older file map.

## Always
- Block by block: grep the block, read only it, edit only it ([.claude/skills/rbh-blocks/SKILL.md](.claude/skills/rbh-blocks/SKILL.md)).
- Chat writes code, Claude Code runs it. Every task ends with a check, then commit and push.
