# C:\BATHCO_TEMPLATE — agent entry point

READ FIRST: `AGENT_GUIDE\README.md` → 01 (file map) → 09 (golden core — NEVER edit those
files/regions) → 15 (pre-edit checklist). This file only carries the task queue; all rules
live in AGENT_GUIDE\.

Hard rules: never touch the live system (C:\BATHCO_PHASE1 / Railway project
`alert-cooperation` = bathco-production). Never start this repo's whatsapp-bridge on the
laptop (kills the live WhatsApp session's Chrome). Never ALTER golden-core financial tables.

## TASK QUEUE (updated 2026-07-11 EOD)

1. **Railway go-live (ON HOLD — owner trigger only).** Project name confirmed:
   `apex-platform`. Blocked by free-plan provision limit → owner upgrades plan OR approves
   deleting dead project `alert-happiness`, then: create project → add Postgres →
   schema-only dump load (--no-owner --no-privileges) → migrate_apex + seed_demo_tenant +
   seed_feature_flags → railway up → verify /health → `railway down` (park it, no billing).
   At deploy: create a non-superuser app role so the audit_log REVOKE actually binds.
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
6. **AI Studio watcher** — scheduled task AISTUDIO_Export_Watch wires new exports every 2h;
   dashboard/settings/themes exports still pending delivery.
