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
is unaffected. To demo repeatedly: after a demo run, reset with
`TRUNCATE users, staff, login_audit RESTART IDENTITY CASCADE` on bathco_template and
copy `config\default.branding.json` over `config\active.branding.json`.

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
