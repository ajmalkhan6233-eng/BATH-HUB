# SESSION_LOG — 2026-07-07 (Fable 5 white-label session)

## What this folder is
C:\BATHCO_TEMPLATE — the sellable white-label copy of BATHCO COMMAND.
It is a separate git repo, a separate database, a separate port. It never touches
the live shop system in C:\BATHCO_PHASE1.

## What shipped today
1. **Clean template copy** — app code only (server, frontend, LAYLA, bridge, 9 needed
   scripts, tests). No business data, photos, ledgers, OCR output, session files, or
   old secrets came across. Verified by grep gates over the whole tree:
   **zero matches** for the shop name, address, all staff names, AZMI/Azmin, Ajmal,
   real phone numbers, old API keys/passwords/PIN.
2. **Own database** — `bathco_template` (Postgres, 49 tables, schema-only from live,
   zero data rows) with its own login role `bathco_template_app` (password in `.env`).
   Live `bathco` DB was only read (pg_dump --schema-only), never written.
3. **Config-driven branding** — `config/active.branding.json` (name, logo, colors,
   currency, support contact). `config/default.branding.json` is the pristine copy.
   LAYLA's business knowledge is generic in `shop_config.json`.
4. **First-run setup wizard** — `public/setup.html` + `/api/setup/*` in server.js.
   Empty DB → `/` redirects to the wizard → business name, logo, currency, admin +
   staff accounts → writes branding config, creates users, locks itself forever.
   Tested end-to-end (demo run, then wiped back to pristine).
5. **SUPPORT_POLICY.md** + Settings → "Report a Problem" card (same tiers, contact
   auto-fills from branding config). Free-period and subscription amounts left as
   fillable blanks as decided.
6. **AGENT_GUIDE\** — 19 reference cards for Aider/qwen2.5-coder offline edits.
   Standing rule in its README: read file map + golden core first, never touch
   golden-core files, verify build after every change.
7. LAYLA hardening (same fixes as live): reasoning-leak guard, current-date context,
   bridge fast-restart on disconnect.

## How to launch the template
```
cd C:\BATHCO_TEMPLATE
node server.js        # PORT 3010 from .env  → http://localhost:3010
```
First open shows the setup wizard (because the DB has no admin). Live shop on :3000
is unaffected. To demo repeatedly: after a demo run, reset on bathco_template with
`TRUNCATE users, staff, login_audit CASCADE` then
`SELECT setval('users_id_seq',1,false), setval('staff_id_seq',1,false);`
(NOT `RESTART IDENTITY` — the bathco_template_app role doesn't own the sequences and the
whole TRUNCATE aborts), copy `config\default.branding.json` over
`config\active.branding.json`, and delete `public\vendor\logo.*` if a demo logo was uploaded.
Restart the server too — SETUP_DONE is a sticky in-process cache (server.js:374).

## New client = 3 steps
1. `node scripts/create_instance.js "Client Name" client_slug` (creates empty DB + branding file)
2. Edit `.env`: DB_NAME=client_slug, fresh SESSION_SECRET, own PORT
3. Start server — wizard appears, client fills in their business. Done.

## Open / deferred
- NOOR template extraction — deferred to its own session.
- Inventory catalog + staff permissions — deferred.
- Theme expansion — deferred.
- public/vendor/default-logo.png does not exist yet — logo 404s until a client uploads
  one in the wizard (harmless). Drop any placeholder PNG there to tidy this.
- WHATSAPP_NUMBER env var for owner alerts (alertOwner) — set per client when enabling WhatsApp.
- tests/ still assume the live-era seed users; run against a seeded dev DB, not a fresh client DB.

## 2026-07-10 — AI Studio handoff audit (read-only)
Created AISTUDIO_HANDOFF\ (EXTRACTION_STATUS, LEFTOVER_TRACES, 4 UI specs, INTEGRATION_MAP).
Blockers hit and worked around:
- CLAUDE.md does not exist in C:\BATHCO_TEMPLATE (code comments reference the live repo's
  CLAUDE.md §3/3.5/3.6/5.1). Audit proceeded from SESSION_LOG + file verification.
- No DB access per audit rules — DB claims (49 tables, zero rows) not re-verified.
Key finding: name/phone scrub is clean, but Lasersoft / HSL-SL / Rs 25,000 float / 1% commission
/ live paths (C:\BATHCO_DROP, C:\Bathco\AI-Data, C:\BATHCO_PHASE1) and `'bathco'` DB fallbacks
remain — see AISTUDIO_HANDOFF\LEFTOVER_TRACES.md. Nothing was fixed (read-only audit).

## 2026-07-10 (later) — Trace scrub executed
All LEFTOVER_TRACES items fixed except DB schema identifiers (lasersoft_invoices table /
lasersoft_total column — rename needs an ALTER TABLE migration, deferred) and the deliberate
BATHCO product-name usage (§7, separate rebrand decision). Highlights:
- Lasersoft→"POS" in all comments/UI/API strings; HSL/SL→generic; live-DB row counts removed.
- NEW ENV VARS: PETTY_CASH_FLOAT (replaces hardcoded 25,000; default 0 = unconfigured),
  DROP_ROOT (replaces C:\BATHCO_DROP; default <install>\data\drop),
  LOCAL_INGEST_SCRIPT (replaces C:\Bathco\AI-Data\process_inbox.py path). Documented in
  AGENT_GUIDE\14_env_vars.md and .env.
- All 'bathco' DB fallbacks → 'bathco_template'; migrate_grn.js now loads the LOCAL .env;
  whatsapp-bridge MAIN_SERVER_URL default now follows PORT (3010, was 3000).
- validate_data.js parameterized (AI_DATA_ROOT env + CLI date range, output written locally).
- check-system.js checks own PORT/DB_NAME; Dubai Imports / PWA / Ollama checks removed.
- package.json/package-lock name → bathco_template.
Verified: node --check clean ×14 files, server boots (HTTP 200 /health, generic banner),
npm test identical before/after the scrub (17 pre-existing failures — seeded-DB assumption,
already logged as an open item). BEHAVIOR NOTE: petty-cash float and cash-proof opening float
now read PETTY_CASH_FLOAT and default to 0 until configured per client.

## 2026-07-10 (later still) — Scrub completed + setup wizard rewired
The trace-scrub session above was interrupted before its 1%-commission items landed.
Finished now:
- "GP-by-staff 1% (commission) auto-calc" strings genericized in routes/audit.js
  (Excel label :161, comment :272, PDF label :399) and BATHCO_NATURE.html audit note (:1662).
- NEW ENV VAR: COMMISSION_RATE_PCT — default commission % for newly created staff
  (POST /api/staff previously hardcoded `commission_pct||1.00`, the live shop's real rate).
  Default 0 = unconfigured. Documented in .env and AGENT_GUIDE\14_env_vars.md.
- Re-verified by grep: zero Lasersoft/HSL/25,000/1%/live-path/'bathco' traces left in code.
  Only remaining deferrals (unchanged): lasersoft_invoices/lasersoft_total DB schema rename
  (needs ALTER TABLE migration) and the deliberate BATHCO product-name usage (§7 rebrand decision).
- BEHAVIOR NOTE: new staff created without an explicit commission_pct now get
  COMMISSION_RATE_PCT (0 unless configured) instead of the old hardcoded 1.00.

**AI Studio export wired (INTEGRATION_MAP §1 — Setup Wizard).** Desktop\AISTUDIO_HANDOFF\zip.zip
extracted to Desktop\AISTUDIO_HANDOFF\EXPORTS\ (React 18 + Vite project, one component:
src/components/SetupWizard.tsx). Decision per the map: ported into the vanilla file (option a) —
public/setup.html fully rewritten with the export's design (progress bars, glass card, styled
logo-upload box with preview thumbnail, staff-member cards with remove buttons, Back/Continue
footer, amber error banner, animated done screen w/ inline SVG icons; Tailwind→plain CSS, no
React/motion/lucide/CDN). Behavioral upgrades adopted from the export: Enter advances steps,
Back disabled on step 1, staff rows removable + renumbered, staff validation (username + min-8
password on any non-empty row; fully empty rows skipped). All logic-critical wiring KEPT as-is:
/api/setup/status bounce, real POST /api/setup/complete payload (logo_data field, LKR/Rs
defaults), server-side self-lock and hashing untouched. Only the setup-wizard export existed;
dashboard/settings/themes exports not yet delivered — wire per INTEGRATION_MAP §2-4 when they are.
Verified: node --check clean (server.js, routes/audit.js), setup.html inline script parses clean.

Related (live repo, logged here for cross-reference only): the RANGE (AZMI) ~Rs 8M variance in
C:\BATHCO_PHASE1's consolidated report is owner-confirmed resolved — details live in
C:\BATHCO_PHASE1\SESSION_LOG.md and the annotated report. No template impact, no DB change.

## 2026-07-11 — APEX platform integration (apex_backend drop)

Owner dropped apex_backend/ (control plane: tenant state machine, client payments, audit log,
LAYLA per-client config, package pricing). All 13 files read and audited against the REAL DB
before any SQL ran. Integrated:
- scripts/migrate_apex.js — idempotent DDL for tenants, client_payments, audit_log,
  layla_configs, package_config (+tier seed rows). audit_log UPDATE/DELETE revoked from the
  app role (verified: tamper UPDATE rejected). The apex RLS script was NOT applied — owner
  decision: it targeted nonexistent tables (inventory/sales/customer_ledgers/invoices), would
  ALTER golden-core financial tables, and isolation here is one-DB-per-client. Kept as
  reference in apex_backend/.
- utils/ (new): db.js, subdomainValidator.js (was missing but required), laylaOutput.js,
  laylaKnowledgePersistence.js, trialClientCreator.js.
- middleware/ (new): auditLogMiddleware.js; tenantStatusMiddleware.js rewritten — apex
  original had invalid `SET x = $1` (SET takes no bind params) + pool-unsafe session var;
  now APEX_TENANT_ID-based, fail-open, no-op unless APEX_ENFORCE_TENANT_STATUS=true.
- routes/apex_admin.js — /api/apex/* (payments, trial-clients, tenants, packages), session
  admin + Admin-PIN gated (apex original had NO auth); verified_by comes from session, not body.
- LAYLA wiring (no pipeline duplication): sanitizeAssistantOutput() at ALL 3 bridge send
  points (photo reply, text reply, /send); buildDateAnchor() replaced the inline CURRENT DATE
  line in getSystemPrompt(); TEACH now best-effort mirrors facts to layla_configs.corrections
  (file stays the single prompt source).
- WhatsApp: bridge TEST_MODE hardcode → WHATSAPP_MODE env, DEFAULT 'internal' (whitelist-only);
  'public' is an explicit .env decision. WHATSAPP_BRIDGE_PORT=3011 (live bridge owns 3001 on
  this machine — and NEVER start this bridge here: its orphan-Chrome cleanup would kill the
  live WhatsApp session).
- Seeded one fictional demo client (scripts/seed_demo_tenant.js): "Demo Hardware Stores",
  subdomain demo, TRIAL 30d, Growth tier + layla_configs row (inactive). APEX_TENANT_ID=1.
- Task-1 recheck: the 2026-07-10 live-path/live-DB scrub re-verified file-by-file — all clean,
  zero edits needed.
- Verified: node -c clean on all touched files; migration + seed ran; server boots, /health 200;
  /api/apex/* return 401 unauthenticated; trial-client + payment insert + duplicate-bank-ref
  rejection exercised against the real schema (test rows cleaned up); /simulate returns safe
  fallback (AI keys are placeholders); npm test identical to baseline (17 pre-existing failures,
  5 passes); git diff confirms zero golden-core files touched, no financial-table ALTERs.
- AZMI personal-payable and HSL/SL series logic: untouched (apex code references none of the
  supplier/invoice/reconciliation tables or routes; golden core diff-clean).
- Railway deployment deliberately NOT done — local sign-off first.
