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
