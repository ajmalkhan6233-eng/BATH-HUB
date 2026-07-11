# C:\BATHCO_TEMPLATE — agent entry point

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
   URL (dead while parked): https://apex-app-production-4f8a.up.railway.app
   UNPAUSE recipe (only on explicit owner go-live): from C:\BATHCO_TEMPLATE —
   `railway redeploy -s Postgres` (volume reattaches; if redeploy refuses, deploy from
   dashboard — NEVER `railway add -d postgres` again, that creates a second empty DB),
   then `railway up -s apex-app -d`, verify /health + /api/setup/status, run the setup
   wizard. Go-live hardening status (2026-07-11 security pass): ADMIN_PIN on apex-app is
   already a real random PIN (owner has it; 0000 refused at boot in production);
   non-superuser role = run `scripts/railway_harden_db.js` at unpause (DB must be online)
   and set the printed DB_USER/DB_PASSWORD on apex-app. Still open: real DASH_* creds.
2. **Port remaining AI Studio exports** from frontend/src (the full Master UI Template
   delivery): DashboardApp.tsx (INTEGRATION_MAP §2), SettingsPage.tsx (§3), themes (§4).
   PlatformAdmin.tsx is DONE (2026-07-11) — page-apex in BATHCO_NATURE.html.
3. **Untracked `frontend/` folder** — identified: AI Studio Master UI Template export
   (source for item 2). Owner to decide: adopt src/ into git (never node_modules) or
   remove after all ports land. Do not delete without approval.
4. **Deferred scrub items** (LEFTOVER_TRACES §a/§b): rename `lasersoft_invoices` table +
   `lasersoft_total` column (needs ALTER migration + owner sign-off — golden core);
   BATHCO product-name rebrand decision.
5. **Jest baseline** — 17 pre-existing integration-test failures (tests/integration);
   fix when touching those modules. Baseline must never grow.
7. **Client-copy distribution exclusions** — before shipping any client a copy of this
   folder/repo, EXCLUDE the vendor-internal docs: SESSION_LOG.md, AISTUDIO_HANDOFF\,
   CLAUDE.md, backups\, frontend\ — they reference the live system's paths/URLs and the
   vendor's Railway account. Code/config are clean; these docs are the only leak channel.
6. **AI Studio watcher** — scheduled task AISTUDIO_Export_Watch wires new exports every 2h;
   dashboard/settings/themes exports still pending delivery.
