# C:\BATHCO_TEMPLATE — agent entry point

> **READ FIRST: `START_HERE.md`** (one screen: owner, rules, status, next steps, links). Then the lines below.

> **Octopus memory:** at session start read `AI_MEMORY/HANDOFF.md` and `AI_MEMORY/OPEN_ITEMS.md`.
> Universal rules come from the global `~/.claude/CLAUDE.md`. No code changes until Aj says GO.

READ FIRST: `AGENT_GUIDE\README.md` → 01 (file map) → 09 (golden core — NEVER edit those
files/regions) → 15 (pre-edit checklist). This file only carries the task queue; all rules
live in AGENT_GUIDE\.

Hard rules: never touch the live system (C:\BATHCO_PHASE1 / Railway project
`alert-cooperation` = bathco-production). Never start this repo's whatsapp-bridge on the
laptop (kills the live WhatsApp session's Chrome). Never ALTER golden-core financial tables.

## TASK QUEUE (updated 2026-07-11 EOD)

1. **Railway go-live (PARKED — owner trigger only).** DEPLOYED + VERIFIED + PARKED
   2026-07-11: project `apex-platform` (ID 8f1fbc70-fc2a-4198-a6a2-47055eba309b), services
   apex-app + Postgres (54 tables, demo tenant, 4 packages, 87 flags on persistent volume).
   URL (dead while parked): https://[REDACTED-URL]
   UNPAUSE recipe (only on explicit owner go-live): from C:\BATHCO_TEMPLATE —
   `railway redeploy -s Postgres` (volume reattaches; if redeploy refuses, deploy from
   dashboard — NEVER `railway add -d postgres` again, that creates a second empty DB),
   then `railway up -s apex-app -d`, verify /health + /api/setup/status, run the setup
   wizard. Go-live hardening status (2026-07-11 security pass): ADMIN_PIN on apex-app is
   already a real random PIN (owner has it; 0000 refused at boot in production);
   non-superuser role = run `scripts/railway_harden_db.js` at unpause (DB must be online)
   and set the printed DB_USER/DB_PASSWORD on apex-app. Still open: real DASH_* creds.
2. **AI Studio exports — ALL PORTED (2026-07-12).** Wizard (07-10), PlatformAdmin
   (07-11), DashboardApp §2 + SettingsPage §3 + 4 themes §4 (07-12, browser-tested
   25/25). Remaining frontend/ decision is item 3.
2b. **Dedicated Fleet (2026-07-12)** — dedicated_clients table (scripts/migrate_fleet.js),
   /api/apex/fleet* routes, Platform Admin card. Railway control via utils/railwayControl.js:
   DISABLED until RAILWAY_API_TOKEN is set (501s safely, $0); apex-platform project id
   blocklisted in code. BEFORE first live use with a token: re-verify the GraphQL mutation
   names (deploymentRestart/deploymentRemove/serviceInstanceDeploy) against
   docs.railway.com/reference/public-api — written offline.
2c. **pm2 on this laptop (HARD RULE)** — the pm2 daemon also runs the LIVE system
   (bathco-server :3000 / grn-watcher / whatsapp-bridge are C:\BATHCO_PHASE1). Template
   apps are apex-server + apex-tunnel via local_ops\ecosystem.local.config.js, ALWAYS with
   --only. Never reuse the name bathco-server (2026-07-12 incident: it restarted the live
   server with the template's PORT). pm2-windows-startup resurrects everything at logon.
3. **Untracked `frontend/` folder** — identified: AI Studio Master UI Template export
   (source for item 2). Owner to decide: adopt src/ into git (never node_modules) or
   remove after all ports land. Do not delete without approval.
4. **Deferred scrub items** (LEFTOVER_TRACES §a/§b): rename `lasersoft_invoices` table +
   `lasersoft_total` column (needs ALTER migration + owner sign-off — golden core);
   BATH HUB product-name rebrand decision.
5. **Jest baseline** — 17 pre-existing integration-test failures (tests/integration);
   fix when touching those modules. Baseline must never grow.
6. **Client-copy distribution exclusions** — before shipping any client a copy of this
   folder/repo, EXCLUDE the vendor-internal docs: SESSION_LOG.md, AISTUDIO_HANDOFF\,
   CLAUDE.md, backups\, frontend\, local_ops\ — they reference the live system's
   paths/URLs, the vendor's Railway account, and the local tunnel setup. Code/config are
   clean; these docs are the only leak channel.
7. **AI Studio watcher** — scheduled task AISTUDIO_Export_Watch checks every 2h. The full
   Master UI Template delivery HAS arrived (frontend\ — see item 2); watcher stays for any
   future re-exports.


LAYLA Pro master design = docs/LAYLA_PRO_SPEC.md — read before any LAYLA work.
BATH HUB rules, agent prompts and commands merged in: docs/bathhub_knowledge/README.md (read before touching alerts, reconciliation or tests).

## AJMAL HARD RULES (2026-10-10, his own words)
- Reports: short, one phone screen, status word last. Easiest free method first. Never say done unless a check ran.
- Never push secrets. Never touch live First Choice Bathco data. Backup must pass before any delete.
- (7) Anything Ajmal must copy or paste (commands, links, answers, handoffs, summaries) goes in its own code block so it copies in one tap on his phone. Never put a paste inside a sentence.
- (8) Whenever chat cannot see something (code, PC, private repo, running app), it asks Claude Code to look; Claude Code reads the real code and reports on GitHub. Chat decides from that report, never from guesses.
- (9) Never ask Ajmal to open a new window. When context is about 70 percent full, or the system warns, run /compact yourself, keeping: current task and checks, bridge state, AJMAL HARD RULES, file paths, links, UNVERIFIED items. Continue in the same window. Write "compacted at <time>" to LIVE.md.

- (11) NOTIFICATIONS: every notification to Ajmal (WhatsApp, reminders, reports, health check, price/cheque alerts, morning brief) goes ONLY at 06:00 Sri Lanka time, once, as ONE combined message, through the notify module (utils/notify.js). Replies to a message he just typed are not notifications.
