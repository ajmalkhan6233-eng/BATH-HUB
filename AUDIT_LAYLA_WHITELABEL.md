# AUDIT — LAYLA WHITE-LABEL HARDCODE SCAN

**Date:** 17 July 2026 | **Scope:** report only, no refactor (LAYLA Pro spec, implementation step 1)
**Method:** grep of all `*layla*` files + LAYLA delivery surface (server.js, whatsapp-bridge.js, index.js, frontend/src) for: "First Choice", "Bathco", tile wording, "Ayubowan", hardcoded prices, phone numbers.

## VERDICT

LAYLA's engine is **already close to white-label clean**. No "First Choice", no "Ayubowan", no hardcoded phone numbers, no hardcoded price lists anywhere in the sellable code. The remaining items below must move to per-client (costume) config.

## A. MUST FIX — engine files with client/vertical leakage

| # | File:Line | Content | Fix |
|---|-----------|---------|-----|
| 1 | `layla.js:82` | Prompt TONE example uses tile-vertical wording: `"hi how much tiles"` | Example phrases must come from per-client costume config (or use a neutral example: "hi how much is this") |
| 2 | `layla.js:165` | Amount parser comment/logic assumes rupees: `"Rs. 150000", "150000 rupees"` | Currency symbol + formats must be per-tenant config (LKR is Bathco's costume, not engine) |
| 3 | `layla.js:33` | DB default `process.env.DB_NAME \|\| 'bathco_template'` | Acceptable as dev fallback, but rename default to a neutral `layla_template` when convenient |

## B. PRODUCT BRANDING — "BATHCO COMMAND" name baked into shared surfaces

Not LAYLA identity, but visible to any client running the white-label product; should become a `PRODUCT_NAME` / branding config value:

| # | File:Line | Content |
|---|-----------|---------|
| 4 | `server.js:289` | session/display name `` `BATHCO COMMAND (${username})` `` |
| 5 | `server.js:3144` | M8 dashboard assistant system prompt: "You are the BATHCO COMMAND dashboard assistant" |
| 6 | `server.js:3206` | boot banner "BATHCO COMMAND — PHASE 1 ACTIVE" |
| 7 | `index.js:27` | status JSON `'BATHCO COMMAND ACTIVE'` |
| 8 | `index.js:222` | boot banner |
| 9 | `whatsapp-bridge.js:241` | QR page title "BATHCO WhatsApp — Scan QR" |
| 10 | `public/service-worker.js:1,15` | comment + cache name `'bathco-command-v2'` |
| 11 | `routes/staff_reports.js:2` | comment "BATHCO Nature ERP" (comment only, cosmetic) |
| 12 | `ecosystem.config.js:4` | pm2 app name `"bathco-server"` — ⚠ ALSO an operational hazard: the local pm2 daemon runs the LIVE system's `bathco-server`; a client copy must never ship this name |

## C. INTENTIONAL — do NOT change (safety guards / tests / mock)

| File:Line | Why it stays |
|-----------|--------------|
| `utils/dbGuard.js:9` | live-DB boot guard lists `bathco`, `bathco_production` — protects prod |
| `scripts/railway_harden_db.js:19` | refuses to run against live Railway URLs |
| `tests/setup.js:2` | test-only fake secret |
| `scripts/create_instance.js:2` | comment describing zero-Bathco-data cloning — correct |
| `frontend/src/components/PlatformAdmin.tsx:70` | 'Demo Tile Mart' is mock/demo tenant data |
| `frontend/src/themes/paper_light.ts:21` | `stitchTiles` is an SVG attribute (false positive) |

## CLEAN FILES (zero findings)

`scripts/layla_answer_engine.js`, `utils/laylaOutput.js`, `utils/laylaKnowledgePersistence.js`,
`apex_backend/utils/*` (both copies), `apex_backend/schema/05_layla_configs.sql`, `AGENT_GUIDE/12_layla_ai.md`.
No Sinhala hardcoded greetings, no phone numbers, no price constants anywhere in the scan scope.
