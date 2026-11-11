# Archived from CLAUDE.md task queue (2026-11-11)
Done or reference-only items. Nothing deleted.

2. **AI Studio exports — ALL PORTED (2026-07-12).** Wizard (07-10), PlatformAdmin
   (07-11), DashboardApp §2 + SettingsPage §3 + 4 themes §4 (07-12, browser-tested
   25/25). Remaining frontend/ decision is item 3.
2b. **Dedicated Fleet (2026-07-12)** — dedicated_clients table (scripts/migrate_fleet.js),
   /api/apex/fleet* routes, Platform Admin card. Railway control via utils/railwayControl.js:
   DISABLED until RAILWAY_API_TOKEN is set (501s safely, $0); apex-platform project id
   blocklisted in code. BEFORE first live use with a token: re-verify the GraphQL mutation
   names (deploymentRestart/deploymentRemove/serviceInstanceDeploy) against
   docs.railway.com/reference/public-api — written offline.
3. **Untracked `frontend/` folder** — identified: AI Studio Master UI Template export
   (source for item 2). Owner to decide: adopt src/ into git (never node_modules) or
   remove after all ports land. Do not delete without approval.
7. **AI Studio watcher** — scheduled task AISTUDIO_Export_Watch checks every 2h. The full
   Master UI Template delivery HAS arrived (frontend\ — see item 2); watcher stays for any
   future re-exports.

