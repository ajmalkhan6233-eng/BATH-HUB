# C:\BATHCO_TEMPLATE — agent entry point

> **Octopus memory:** at session start read `AI_MEMORY/HANDOFF.md` and `AI_MEMORY/OPEN_ITEMS.md`.
> Universal rules come from the global `~/.claude/CLAUDE.md`. No code changes until Aj says GO.

READ FIRST: `AGENT_GUIDE\README.md` → 01 (file map) → 09 (golden core — NEVER edit those
files/regions) → 15 (pre-edit checklist). This file only carries the task queue; all rules
live in AGENT_GUIDE\.

Hard rules: never touch the live system (C:\BATHCO_PHASE1 / Railway project
`alert-cooperation` = bathco-production). Never start this repo's whatsapp-bridge on the
laptop (kills the live WhatsApp session's Chrome). Never ALTER golden-core financial tables.

## TASK QUEUE (cleaned 2026-11-11; old items in AI_MEMORY/_archive/)

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
2c. **pm2 on this laptop (HARD RULE)** — the pm2 daemon also runs the LIVE system
   (bathco-server :3000 / grn-watcher / whatsapp-bridge are C:\BATHCO_PHASE1). Template
   apps are apex-server + apex-tunnel via local_ops\ecosystem.local.config.js, ALWAYS with
   --only. Never reuse the name bathco-server (2026-07-12 incident: it restarted the live
   server with the template's PORT). pm2-windows-startup resurrects everything at logon.
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
7. Done/reference items (AI Studio ports, Dedicated Fleet notes, frontend/ decision, watcher): AI_MEMORY/_archive/CLAUDE_queue_done_2026-11-11.md
   Keep: re-verify Railway GraphQL mutation names before first live RAILWAY_API_TOKEN use (details in archive).

LAYLA Pro master design = docs/LAYLA_PRO_SPEC.md — read before any LAYLA work.
BATH HUB rules, agent prompts and commands merged in: docs/bathhub_knowledge/README.md (read before touching alerts, reconciliation or tests).
