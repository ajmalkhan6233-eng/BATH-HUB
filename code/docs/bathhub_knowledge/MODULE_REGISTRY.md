---
title: ROYAL BATH HUB — Module/Domain Registry
purpose: Scope map for change requests. Read this FIRST, then touch ONLY the files listed under the named domain.
updated: 2026-07-04
status: built from live directory scan (no prior version existed) — verify a domain's file list before a large change if it's been a while
---

## M1–M10 cross-reference (owner's tagging scheme from ROYAL BATH HUB MODULAR CONTROL.md, merged here 2026-07-04)

This is now the **one master module map** — `ROYAL BATH HUB MODULAR CONTROL.md`'s M1–M10 scheme is not a separate registry, it's a shorthand layer over the domains below. When the owner says "M2 change," find M2 in this table, then read the matching domain section for the actual file list.

| M-tag | Name | Maps to domain(s) below | Code tag to use |
|---|---|---|---|
| M1 | DASHBOARD | §2 (Frontend Dashboard SPA) — main KPI view, `loadUnified*` functions | `/* ===== M1: DASHBOARD ===== */` |
| M2 | APPEARANCE | §2 — CSS variables block (`:root`, `[data-theme="light"]`) in `dashboard.html` | `/* ===== M2: APPEARANCE ===== */` |
| M3 | SALES | §1 (backend `/api/daily-summary*` routes) + §2 (sales views) | `/* ===== M3: SALES ===== */` |
| M4 | EXPENSES | §1 + §2 — expense entry, petty cash, construction draws | `/* ===== M4: EXPENSES ===== */` |
| M5 | CHEQUES | §1 (cheque routes) + §2 (cheque calendar UI) | `/* ===== M5: CHEQUES ===== */` |
| M6 | STOCK | §1 + §2 — inventory, stock value, low-stock alerts | `/* ===== M6: STOCK ===== */` |
| M7 | REPORTS | §2 (download buttons, print views) + §1 (export routes) | `/* ===== M7: REPORTS ===== */` |
| M8 | AI-ASSISTANT | **New domain §14 below** — dashboard chat bubble, separate from §5's LAYLA | `/* ===== M8: AI-ASSISTANT ===== */` |
| M9 | NAVIGATION | §2 — arrows, refresh, date selector, page routing | `/* ===== M9: NAVIGATION ===== */` |
| M10 | CORE-ENGINE | §1 — server, DB connection, xlsx parsers, financial rules. **Protected — line-by-line owner approval required for any change here** | `/* ===== M10: CORE-ENGINE ===== */` |

Actual tag markers have only been added to code touched during the 2026-07-04 session (the M8 block in `server.js` and `dashboard.html`). The rest of the codebase does not yet have inline tags — "add tags everywhere" is a large, invasive first-pass edit across nearly every file and was not done automatically; do it deliberately, one domain at a time, with review, not as a blanket sweep.

# How to use this file

When a request names a domain ("fix the credits tab", "GRN watcher is stuck", "accounting migration"),
find the matching domain below and edit only those files. Do not full-project grep-and-fix unless the
request is explicitly cross-cutting (e.g. "rotate DB password everywhere").

If a request doesn't map cleanly to one domain, say so and ask which domain(s) apply rather than guessing wide.

---

## 1. Core Dashboard Backend (LIVE — port 3000, pm2 `bathco-server`)
- `server.js` — main Express app, auth/session/2FA, most `/api/*` routes, PWA static serving
- `routes/audit.js` — reconciliation checker, aging/granularity reports
- `routes/purchasing_accounting.js` — accounting (P&L, balance sheet, trial balance), purchasing (PO/GRN/supplier pricing)
- `routes/staff_reports.js` — staff commission/attendance reports
- `config/active.branding.json`, `config/bathco.branding.json` — theme/branding config
- `openrouter.config.js` — OpenRouter model fallback config (OCR/vision)
- `.env` — all secrets (never touch schema of this file's *usage* without checking `2.1` in CLAUDE.md)

## 2. Frontend Dashboard — SPA (served by server.js, no separate build step)
- `public/dashboard.html` — main 8-page SPA (home/daily/weekly/monthly/staff/suppliers/credits/agents)
- `public/BATHCO_NATURE.html` + `public/nature-manifest.json` — newer financial/accounting-focused page (P&L, balance sheet, supplier aging, cheque calendar, VAT) — NOT yet linked into main dashboard nav
- `public/themes/*.js` — background-theme system for `BATHCO_NATURE.html`'s 3D canvas (M2/APPEARANCE, added 2026-07-05 per FINAL_BUILD.md Phase 1). `nature.js` (default, extracted from the old inline scene) and `kim_forest.js` (extracted from `Desktop\BATHCO_VERSION_1\kimcord.md`, visuals only) implement a shared `{build(canvas,THREE)}` interface; `_TEMPLATE.js` documents it for future themes (ocean/desert/city). Selected via Settings > Appearance, persisted in `localStorage['bathco_theme']`. Themes only ever touch the `#three-canvas` element — never data/pages/API calls. **Bug fixed same session**: `server.js` was missing a static route for `node_modules/three/build/three.core.min.js` (a peer chunk `three.module.min.js` imports internally in three 0.185) — this silently broke ALL 3D rendering (including the pre-existing default scene) since the failure was swallowed by the existing try/catch fallback to the CSS leaf/butterfly effect. Fixed by adding the mirrored route next to the existing `/vendor/three.module.min.js` one.
- `public/manifest.json`, `public/service-worker.js`, `public/icons/` — PWA shell
- `public/lib/` — shared frontend JS libs
- **FINAL OWNER DECISION 2026-07-04, overrides everything above in this section**: `public/BATHCO_NATURE.html` (served at `/nature`) is the ONE official live app. `/` and `/app` now 302-redirect to `/nature`. `public/dashboard.html` and `public/bathco_live.html` have been moved to `archive/` (not deleted). `public/bathco_complete.html` was not moved but should be treated as dead too — not served by any route. Do not build on or redesign any of the archived/dead files. Do not visually redesign `BATHCO_NATURE.html` either — the owner explicitly likes its current look; only functional/diff patches are approved there.

## 3. bathco-app (separate Vite/React project — status: dev-only, not wired into pm2/production)
- `bathco-app/src/`, `bathco-app/index.html`, `bathco-app/vite.config.js`, `bathco-app/tailwind.config.js`
- Runs standalone via `npm run dev` (ports 5173/5174 seen in practice) — confirm with Ajmal whether this supersedes `public/dashboard.html` before assuming it's the target of a UI request

## 4. bathco-backend-additions (staged accounting/purchasing backend work — confirm integration status before editing)
- `bathco-backend-additions/migrations/` — SQL migrations not yet confirmed merged into live `bathco` DB schema
- `bathco-backend-additions/src/` — corresponding backend source

## 5. Agents & AI Pipeline
- `layla.js` — LAYLA WhatsApp AI receptionist, Anthropic→OpenRouter→Ollama fallback chain
- `agents/BATHCO_ASSISTANT_MODE.md`, `agents/BATHCO_MASTER.md`, `agents/bathco-council.md`, `agents/llm-council.md` — agent persona/behavior specs
- `.claude/commands/*.md` (13 slash commands) — ROYAL BATH HUB-specific Claude Code commands
- External (not in this repo): `C:\Royal Bath Hub\AI-Data\run_agents.py`, `generate_reports.py`, `ocr_openrouter.py`, `seed_database.py` — the 5-agent (CHECKER/NOVA/QUINN/VERA/LAYLA) pipeline and OCR

## 6. GRN Watcher (LIVE — pm2 `grn-watcher`)
- `grn-watcher.js` — polls `C:\BATHCO_DROP\inbox\GRN` every 30s, Anthropic vision extraction, writes `grn_records`
- `scripts/migrate_grn.js` — GRN table migration (one-off, already applied)

## 7. WhatsApp Bridge (LIVE — pm2 `whatsapp-bridge`)
- `whatsapp-bridge.js` — WhatsApp Web session bridge (`.wwebjs_auth/`, `.wwebjs_cache/`, `whatsapp-qr.png`)

## 8. Mobile App (PAUSED — superseded by PWA, do not resume without asking)
- `bathco-mobile/` — Expo/React Native app, see `bathco-mobile/PAUSED.md`

## 9. Data Import Sources (read-heavy, historical — treat as source-of-truth for reconciliation, not code)
- `data/`, `DALI/`, `DAY SALE/`, `MASTER_LEDGER/`, `cheques/`, `uploads/` — raw Excel/PDF/photo sources
- `extracted_text/` — cached OCR/PDF text extraction (check here before re-parsing a PDF — see [[feedback_bathco_pdf_extraction_cache]])

## 10. One-off Scripts & Fixes
- `scripts/*.js` — historical one-off DB fix/verify scripts (each is a point-in-time patch, not a reusable tool — read the specific date/purpose in the filename before assuming it's still relevant)
- `backup_vault.py` — interactive AES-256-GCM full-project file backup to `F:\Backup\BATHCO_VAULT.enc`
- `import_dali_master.py`, `validate_data.js`, `check-system.js`, `end_session.py` — root-level maintenance scripts

## 11. Backups & DB Dumps
- `backups/` — manual point-in-time `pg_dump` + `.sql` pairs (see `MODULE_REGISTRY` note: no automated backup job exists yet)
- Root-level `bathco_backup*.sql`, `bathco_master_fix.sql` — data dumps, gitignored

## 12. Documentation / Reports (read for context, don't treat as code)
- `CLAUDE.md`, `GOLDEN_CORE.md`, `DECISIONS_LOG.md`, `HONESTY_AUDIT.md`, `RECONCILIATION_RULES.md`, `PHASE_ROADMAP.md`, `PHASE2_STATUS.md`, `HANDOVER.md`, `PENDING_FROM_AJMAL.md`, `SOURCE_INVENTORY.md`, `DATA_MAPPING_STATUS.md`, `PORTFOLIO_STATUS.md`, `CLOUD_DEPLOY_GUIDE.md`
- `reports/` — generated PDF/HTML/Excel reports (gitignored, regenerate don't hand-edit)

## 13. Deprecated / Unused (confirmed stale — do not build on these without asking)
- `software/app/` — standalone Python prototype (backend+frontend), not referenced by `server.js`/`ecosystem.config.js`/`package.json`. Its committed `.env` was untracked 2026-07-03 (leaked key found — see git log `43bb66d`).
- `BATHCO_COMPLETE.html`, `obisidian.html`, `New Text Document*.txt`, `earliyer files importent/` — untracked loose files at repo root, unclear purpose, not referenced by any code path checked so far

---

## 14. M8 — Dashboard AI-Assistant (NEW 2026-07-04, added this session)
- `server.js` — search for `/* ===== M8: AI-ASSISTANT ===== */` — own Anthropic client (`dashboardAssistantClient`), own system prompt (`M8_SYSTEM_PROMPT`), route `POST /api/dashboard-assistant/chat`, session-auth gated like every other `/api` route.
- `public/dashboard.html` — search for `/* ===== M8: AI-ASSISTANT ===== */` (HTML bubble + panel, CSS, and JS: `m8ToggleChat`, `m8SendMessage`, `m8RenderMessage`).
- **Explicitly a different system from LAYLA** (`layla.js`, §5) — does not import from or modify layla.js. Model: `claude-sonnet-4-6` (same string LAYLA already uses successfully in production, per `layla.js:276`).
- **Not yet verified end-to-end** — the route is new code in `server.js`, which requires a `pm2 restart bathco-server` to load; that restart was intentionally not performed this session (see SESSION_LOG.md). Frontend UI is confirmed rendering live (dashboard.html is a static file, served fresh with no restart needed); the actual chat round-trip is unverified until the restart happens.

---

## Known gaps in this registry (verify before relying on them)
- `bathco-app/` and `bathco-backend-additions/` integration status with the live `server.js`/DB is unconfirmed — this registry only reflects what exists on disk, not what's wired up live.
- Ecosystem/pm2 only manages 3 apps: `bathco-server`, `grn-watcher`, `whatsapp-bridge` (see `ecosystem.config.js`). Anything else (bathco-app dev server, software/app) is not production infrastructure.
