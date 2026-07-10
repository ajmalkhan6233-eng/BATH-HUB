# EXTRACTION_STATUS — white-label extraction audit

> **UPDATE 2026-07-10 (later session):** items 9 and 10 below are now DONE (traces scrubbed,
> live paths/DB fallbacks env-parameterized — see the scrub note at the top of
> LEFTOVER_TRACES.md). Still open: DB schema rename (`lasersoft_invoices`/`lasersoft_total`,
> needs migration), item 11 (hardcoded "LKR"/"Rs" strings), and items 12-19.

Date: 2026-07-10 · Audited by: Claude Code (read-only, verified against actual files, not just SESSION_LOG.md)
Scope: C:\BATHCO_TEMPLATE. No DB access was used (audit rule); DB items verified at config level only.

## Where the extraction stopped
The 2026-07-07 session delivered a working template: clean app-code copy, own DB config
(`bathco_template`), config-driven branding, first-run setup wizard, support policy, AGENT_GUIDE,
LAYLA hardening. It stopped before: operational decoupling from the live shop machine (hardcoded
live paths/DB fallbacks remain), scrubbing business-rule traces (Lasersoft, HSL/SL, Rs 25,000
float, 1% commission), NOOR extraction, inventory catalog, staff permissions, and theme expansion.
Full trace list: see LEFTOVER_TRACES.md.

## Task status (verified)

### DONE
1. **Clean copy — personal identity scrub** — DONE.
   Re-verified by fresh grep over the whole tree (incl. node_modules for distinctive terms):
   zero hits for "1st Choice"/"First Choice", all 10 staff names (Imran, Gimhani, Nilshard, Ali,
   Jazeel, Fahim, Zaheem, Ansaf, Azmi, Nushra), +94/07x/011 phone patterns, email addresses.
2. **Config-driven branding files** — DONE.
   `config/active.branding.json` + `config/default.branding.json` exist, identical, fully generic
   ("Your Business Name"). `shop_config.json` generic. UI reads `/api/branding` and falls back to
   "Your Business Name" (BATHCO_NATURE.html:771,1236,1261,1272,1689,1696-1701).
3. **First-run setup wizard** — DONE.
   `public/setup.html` (4 steps + done screen: identity → logo/currency → admin → staff) and
   server gate + `/api/setup/status` + `/api/setup/complete` verified in server.js:187,376-391.
4. **SUPPORT_POLICY.md + Report a Problem card** — DONE.
   Policy file has fillable blanks only (no real vendor contact). Settings card at
   BATHCO_NATURE.html:582-599 with same tiers; contact spans auto-fill from branding config.
5. **AGENT_GUIDE** — DONE. 19 files present (18 numbered cards + README with standing rules).
6. **LAYLA hardening** — DONE.
   Reasoning-leak guard (`stripReasoning`/`looksLikeReasoning`, layla.js:92-108,311,319) and
   current-date context (layla.js:136-139) verified in code.
7. **Own database config** — DONE at config level (not DB-verified in this audit).
   `.env` points to `bathco_template` / role `bathco_template_app`; branding json db_name matches.
   `.env` has placeholder API keys only; DASH_PASS/NGROK pass are CHANGE_ME placeholders.
8. **create_instance.js "new client in 3 steps"** — DONE (script exists, scripts/create_instance.js).

### PARTIAL
9. **Business-trace scrub beyond names/phones** — PARTIAL. The name/phone/address scrub was real,
   but operational traces of the actual shop remain: Lasersoft (30+ refs, some user-visible),
   HSL/SL invoice series, Rs 25,000 petty-cash float hardcoded as constants, 1% commission rule,
   VAT comment "rate BATHCO is actually registered for", live-DB row counts ("2111 rows") inside
   user-visible strings. See LEFTOVER_TRACES.md §2-3.
10. **Decoupling from the live shop machine** — PARTIAL (mostly not done).
    Hardcoded live paths and live-DB fallbacks still present: `C:\BATHCO_DROP` (server.js,
    whatsapp-bridge.js, grn-watcher.js), `C:\Bathco\AI-Data` (server.js:1086, validate_data.js),
    `C:\BATHCO_PHASE1` (validate_data.js:114, scripts/migrate_grn.js:1), `|| 'bathco'` DB fallbacks
    in 6 files, check-system.js still checks live ports 3000/5173 and DB `bathco`. A template
    instance started on the live machine with a missing .env would touch the live system.
11. **Currency config-driven end-to-end** — PARTIAL. Branding config carries currency/symbol, and
    the wizard asks for them, but "LKR"/"Rs" are hardcoded in UI strings (BATHCO_NATURE.html:507,
    1261,1490,1689; bathco_complete.html:439) and backend texts (server.js:3153).
12. **Tests** — PARTIAL. Unit tests use generic mocked `admin` users (clean), but per SESSION_LOG
    the suite assumes a seeded dev DB, not a fresh client DB. Not re-run in this audit.
13. **Themes** — PARTIAL. Working registry with 2 themes (`nature`, `kim_forest`) +
    `_TEMPLATE.js` scaffold + Settings→Appearance picker. Expansion deferred.

### NOT STARTED
14. **NOOR template extraction** — NOT STARTED. No NOOR files anywhere in the tree.
15. **Inventory catalog** — NOT STARTED (deferred per SESSION_LOG; no catalog UI/files found).
16. **Staff permissions** — NOT STARTED (deferred; role select exists in User Management but no
    permission matrix).
17. **public/vendor/default-logo.png** — NOT STARTED. `public/vendor\` does not exist;
    branding config points at `/vendor/default-logo.png` → 404 until a client uploads a logo.
18. **WHATSAPP_NUMBER env var for owner alerts** — NOT STARTED (absent from `.env`).
19. **Legacy dashboard decision** — NOT STARTED. `public/bathco_complete.html` (old UI) still
    ships with "Live data from Bathco database" text; AGENT_GUIDE warns it is not the app.
    Decide: delete from template or scrub.

## Blockers hit during this audit
- `C:\BATHCO_TEMPLATE\CLAUDE.md` does not exist (requested read failed). Code comments reference
  a CLAUDE.md §3/3.5/3.6/5.1 that lives only in the live repo. Logged to SESSION_LOG.md.
- No DB access allowed for this audit, so DB contents (49 tables, zero rows) taken from
  SESSION_LOG, not re-verified.
