# SESSION_LOG — 2026-07-07 (Fable 5 white-label session)

<!-- ACTIVE SESSION 2026-07-12: see "2026-07-12 — AI Studio ports + fleet mgmt + local pm2/tunnel" section at the bottom for live progress + resume point. -->

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

## 2026-07-11 (later) — Railway deployment attempt: ON HOLD (owner decision)

Owner approved deploying apex as a brand-new isolated Railway project, name confirmed:
**apex-platform**. Attempt findings (account ajmalkhan6233@gmail.com):
- The LIVE production system runs in Railway project **alert-cooperation** (auto-generated
  name!): service "BATHCO" Online at bathco-production.up.railway.app + 2 Postgres DBs.
  NEVER touch it. If `railway status` in this folder ever shows alert-cooperation linked,
  run `railway unlink --yes` immediately (this folder is currently UNLINKED — verified).
- Project **alert-happiness** is a dead Failed BATHCO deploy, no DBs — deletion candidate,
  NOT approved.
- `railway init --name apex-platform` was REJECTED: "Free plan resource provision limit
  exceeded". Owner chose HOLD — no deploy, no plan change, all development stays LOCAL.
  Resume only on explicit owner go-live: create apex-platform → add Postgres → schema-only
  dump load (--no-owner --no-privileges) → migrate_apex + seed_demo_tenant +
  seed_feature_flags → railway up → verify /health → railway down (parked, not billing).

## 2026-07-11 (later still) — PlatformAdmin.tsx ported into BATHCO_NATURE.html

The untracked frontend/ folder turned out to be the FULL AI Studio "Master UI Template"
export (delivered 2026-07-10, contradicting the earlier "only setup wizard delivered" note):
DashboardApp, SettingsPage, ThemePreview + 4 themes, and PlatformAdmin — the apex vendor UI.
Owner said start with PlatformAdmin.tsx. Ported per INTEGRATION_MAP option (a) — into the
ONE vanilla frontend, house styles only (.card/.primary/.ghost, api()/goPage patterns):
- New page `page-apex` ("Platform Admin", nav under System group): Packages & Tiers cards
  (editable price → package_config, the only place prices live), Client Activations table
  (tier select, activation toggle ACTIVE↔SUSPENDED, status chip, TERMINATED locked), and
  New Client Entry form using the REAL trial-client contract (owner/industry/WhatsApp/tier/
  trial days — the export's mock email/currency fields were dropped, not faked).
- Admin-PIN lock card on the page (POST /api/admin/verify) mirrors the server gate.
- 'apex' added to AUTO_REFRESH_EXCLUDED so the 60s refresh can't wipe form input.
- Backend: routes/apex_admin.js gained PATCH /api/apex/packages/:id (price, validated) and
  PATCH /api/apex/tenants/:id (status/package_tier, enum+tier validated) — both audit-logged.
- Verified end-to-end with a real session: setup wizard API → login → PIN gate blocks →
  unlock → packages listed → price 5000→5500→5000 → negative price 400 → tenant
  SUSPENDED→TRIAL round-trip → bad tier 400 → trial client created (port-test-traders) →
  /nature serves the new page. audit_log captured all 5 mutations with from/to detail.
  Then FULL RESET to pristine template: test tenant deleted, TRUNCATE users/staff/
  login_audit + setvals, branding restored byte-identical (audit_log test rows remain —
  append-only by design). npm test = baseline 17/5, golden core diff-clean.
- Remaining exports to port later: DashboardApp.tsx (§2), SettingsPage.tsx (§3),
  themes (§4). frontend/ folder itself stays untracked pending owner adopt/remove decision.

## 2026-07-12 — AI Studio ports + fleet mgmt + local pm2/tunnel (ACTIVE SESSION)

Plan: A) wire remaining AI Studio exports (§2 dashboard, §3 settings, §4 themes);
B) fleet management (dedicated_clients + Railway control API + health pings) in
Platform Admin — control-plane only, NO Railway deploys, apex-platform stays parked;
C) run locally under pm2 + free Cloudflare quick tunnel, phone-reachable;
D) this log updated after every numbered step.

### Step A1 DONE — exports wired (all three, option (a): into the vanilla frontend)
- **§4 themes**: public/themes/{emerald_drift,gold_grid,ember_dusk,paper_light}.js
  created (TS→plain-JS from frontend/src/themes, logic identical, mount(container)
  contract). Theme engine in BATHCO_NATURE.html now supports BOTH contracts:
  existing WebGL build(canvas,THREE) untouched; new DOM mount() themes get their
  own fixed #theme-dom-layer, self-animate, need no WebGL. All 4 registered in
  THEME_REGISTRY; localStorage key stays `bathco_theme`. paper_light light-mode:
  engine mirrors container.dataset.mode='light' → body.theme-light CSS var flip
  (glass/text/muted/gold tokens) — the host-side switch the map called for.
- **§2 dashboard**: mobile hamburger + full-screen nav sheet (≤860px) added —
  items carry .nav-btn/data-page/data-flag so goPage()/applyFlags() drive them
  (no duplicate badge ids); kpiCard() gained the export's accent dot + gradient
  wash (colour classes unchanged → KPI colour semantics preserved); home date
  pill now renders "Mon 09 Jun 2026" style (fmtFriendlyDate; data/API untouched).
- **§3 settings**: Report-a-Problem severity rows colour-coded (red/amber/green/
  blue per export); Change Password + Add User now pre-validate client-side
  (min-12 etc, same rules the server enforces) with inline messages instead of
  alert(); feature-flag rows show ON/OFF badge next to the toggle.
- All logic-critical boundaries untouched: no endpoint, formula, auth, flag-
  enforcement or theme-engine-gating change; goPage/applyFlags selectors intact.
- Verified: 4 theme modules import clean in Node (.mjs copies) + expose mount().

### Step A2 DONE — all three screens tested in a real browser: 25/25 PASS
Headless Chrome (puppeteer from node_modules, installed Chrome binary — the
whatsapp bridge was NOT run) against live server on :3010, temp admin
`wiretest_admin` created via the real setup wizard API. Covered: login → home
renders (honest empty-DB state); all 4 new themes mount/dispose + paper_light
light-mode flip + back-to-nature cleanup; settings (6 themes in picker, 72 flag
rows, ON/OFF badges, severity colours, min-12 client validation); flag gating
(unbuilt→409, core-off→400 — the designed rejections; NOTE: pristine seed has
no legally-togglable flag: 15 built are all core, 72 dormant all unbuilt; the
nav keys pos_billing/inv_barcode_labels/staff_commission_display/
ai_assistant_chat are NOT in the 87-row registry — pre-existing seed gap, those
modules stay hidden until registered; logged, not changed); mobile hamburger +
sheet navigation at 390px; Platform Admin PIN gate + packages/tenants render.
Zero non-benign console errors (benign = default-logo 404 / favicon / pre-login
401 / pre-unlock apex 403).
- BUG FOUND+FIXED by the test: NATURE_3D.setTheme used `wasActive = !!active`
  (WebGL handle only) so DOM→DOM theme switches never re-mounted; now checks
  either contract.
- Test admin still present (will be wiped in the Part C pristine reset).
- Test script: scratchpad test_screens.js (session temp dir).

### Steps B3–B7 DONE — Dedicated Fleet in Platform Admin (control-plane only)
- **Schema** (B3): scripts/migrate_fleet.js (idempotent) → new `dedicated_clients`
  table: client_name, contact, railway_project_id (UNIQUE) + environment/service
  ids, subscription_status (TRIAL/ACTIVE/SUSPENDED/TERMINATED), health_url,
  last_known_state (ONLINE/OFFLINE/UNKNOWN), last_checked_at. Migration ran on
  bathco_template. No existing table touched.
- **Railway control** (B4): utils/railwayControl.js — Stop (deploymentRemove =
  `railway down`), Start/Deploy Update (serviceInstanceDeploy), Restart
  (deploymentRestart) via Railway public GraphQL API ONLY; never connects to any
  client DB. Disabled-by-default: RAILWAY_API_TOKEN unset (as on this laptop) →
  every action 501s with a clear message, zero Railway calls, $0. Blocklist:
  apex-platform project id hardcoded-blocked + APEX_FLEET_BLOCKED_PROJECT_IDS
  env for more (add the live project's id at go-live). CAVEAT in code: mutation
  names written offline from the public-API docs — re-verify against
  docs.railway.com/reference/public-api before FIRST live use with a token.
- **Routes** (in routes/apex_admin.js, same session+admin+PIN double gate, all
  mutations audit-logged): GET/POST /api/apex/fleet, PATCH /api/apex/fleet/:id,
  POST /api/apex/fleet/:id/ping (or /all/ping — HTTP status-code-only health
  check, 5s timeout, body never stored), POST /api/apex/fleet/:id/control
  {action: stop|start|restart|deploy}.
- **UI** (B5): "Dedicated Fleet" card on page-apex — live status dot
  (green/red/amber), Ping all, per-row 📡▶⏸⟳🚀 actions with confirm(), inline
  add-client form, visible warning banner when control is disabled (no token).
- **No-client-data rule** (B6): no endpoint exists that reads client business
  data — fleet stores ids/contact/status only; pings read HTTP status codes.
- **Tested** (B7): browser suite 10/10 PASS — card renders + disabled-note; add
  via real form; duplicate project id 400; ping-all → ONLINE (against own
  /health); dead URL → OFFLINE; subscription round-trip + bad value 400;
  control without token → 501; apex-platform id → 403 blocklist; bad action
  400; zero console errors. audit_log captured FLEET_CLIENT_ADDED + 4 UPDATEs.
  Test fleet row deleted after (audit rows remain, append-only by design).
- .env: RAILWAY_API_TOKEN / APEX_FLEET_BLOCKED_PROJECT_IDS documented, unset.

### Steps C8–C11 DONE — running locally under pm2 + free Cloudflare quick tunnel

⚠ **INCIDENT (fixed, logged honestly):** this laptop's pm2 daemon ALSO runs the
LIVE shop system (C:\BATHCO_PHASE1: bathco-server :3000, grn-watcher,
whatsapp-bridge :3001 — auto-resurrected at logon via pm2-windows-startup HKCU
Run key). My first local ecosystem used the app name "bathco-server", and pm2
start name-matched it → RESTARTED THE LIVE SERVER with PORT=3010 env. Live shop
was on the wrong port ~2 minutes; the quick tunnel pointed at the live server
for <2 min but its random URL had not been retrieved/shared by anyone (risk ≈
nil). Fixed: tunnel stopped first, live bathco-server restarted from
C:\BATHCO_PHASE1\ecosystem.config.js --update-env (PORT 3000, /health 200
verified), template app renamed **apex-server**. WhatsApp bridge was NEVER
restarted (uptime preserved) — live WhatsApp session untouched.
**STANDING RULE for this laptop: pm2 names bathco-server/grn-watcher/
whatsapp-bridge belong to the LIVE system. Template apps are apex-server /
apex-tunnel. Always `pm2 start <file> --only <app>`.**

- Pristine reset first: TRUNCATE users/staff/login_audit + setvals (proven
  recipe), branding restored byte-identical (MD5 899D0C19… matches pristine),
  no demo logo existed. DB state for the demo: wizard ARMED, demo tenant #1,
  4 packages, 87 flags — same as the Railway deploy had.
- ADMIN_PIN: 0000 replaced with a real random PIN in .env (required — pm2 runs
  NODE_ENV=production and the server refuses 0000; also the app is now
  internet-reachable). Owner has the PIN (in .env + final report).
- **local_ops\** (gitignored, never ship): ecosystem.local.config.js
  (apex-server = server.js :3010 production; apex-tunnel = bin\cloudflared.exe
  quick tunnel → localhost:3010, both autorestart), bin\cloudflared.exe
  (2026.7.1, downloaded from official GitHub releases), get-tunnel-url.ps1
  (prints current public URL from tunnel.log), tunnel logs.
- Verified: apex-server online (boot log clean, generic banner), live :3000
  AND template :3010 /health 200 side by side; THROUGH the tunnel: /health 200,
  /api/setup/status real query, / → 302 /setup.html, setup.html 200.
- Reboot auto-start (C10): pm2-windows-startup was ALREADY registered (HKCU Run
  → pm2_resurrect.cmd); `pm2 save` dump verified to contain all 5 apps
  (3 live + apex-server + apex-tunnel). Caveat: resurrect fires at Windows
  LOGON, so after a reboot someone must log in — same condition the live
  system already runs under.
- **Tunnel URL is EPHEMERAL**: a free quick tunnel mints a NEW random
  *.trycloudflare.com URL every time apex-tunnel restarts (reboot/crash/
  pm2 restart). Get the current one any time:
  `powershell -File C:\BATHCO_TEMPLATE\local_ops\get-tunnel-url.ps1`
- Exposure note: the wizard is armed and PUBLIC on that URL until the owner
  completes it (same posture as the Railway viewing). URL is unguessable but
  unlisted-only security — owner should complete the wizard promptly; after
  that, login + (for Platform Admin) admin PIN gate everything.
- Zero Railway involvement end-to-end: apex-platform stayed parked, no linking,
  no deploys, RAILWAY_API_TOKEN unset.

## 2026-07-11 — Railway: apex-platform DEPLOYED, VERIFIED, PARKED

Owner re-ordered the deploy; unblocked by owner-approved deletion of dead project
alert-happiness (owner ran the delete command themselves; deletion is scheduled by Railway).
- New project **apex-platform** (8f1fbc70-fc2a-4198-a6a2-47055eba309b) — completely separate
  from the live system (alert-cooperation), own Postgres 18 with own volume. The live
  project was never linked or touched at any step.
- apex-app service env: discrete DB_* reference vars → this project's Postgres private
  domain (route pools don't read DATABASE_URL), fresh SESSION_SECRET (a PS 5.1
  RandomNumberGenerator::Fill quirk zeroed the first one — caught and replaced),
  APEX_TENANT_ID=1, enforcement off, WHATSAPP_MODE=internal, puppeteer download skipped.
- DB: schema-only pg_dump (--no-owner --no-privileges) loaded via public proxy (54 tables),
  then migrate_apex + seed_demo_tenant + seed_feature_flags (4 packages, 87 flags, demo
  tenant TRIAL). Note: audit_log REVOKE doesn't bind on Railway's postgres superuser —
  go-live hardening item.
- Verified live at https://apex-app-production-4f8a.up.railway.app : /health 200,
  /api/setup/status real DB query, root 302 → /setup.html (wizard armed), /api/apex/* gated.
- Then PARKED per owner instruction: `railway down` on apex-app AND Postgres — both
  ○ Offline, public URL returns 404, nothing running or billing. Data persists on the
  volume. Unpause recipe + hardening list live in CLAUDE.md task queue item 1.
  DO NOT unpause until the owner explicitly calls go-live.
  (Briefly unpaused + re-parked same day at owner's request for a browser viewing.)

## 2026-07-11 — Security finalization pass (session close)

Full-tree sweep (code + config + frontend/src, node_modules excluded):
- Live paths (C:\BATHCO_DROP / C:\BATHCO_PHASE1 / AI-Data) in code/config: **0** — all
  remaining mentions are vendor-internal audit docs (this file, AISTUDIO_HANDOFF, CLAUDE.md
  safety rules). `'bathco'` live-DB fallbacks in code: **0**. Real phones/emails: **0**.
- One real-name leak FIXED: apex_backend/utils/laylaKnowledgePersistence.js comment named
  the owner ("Ajmal") → "the owner". (Reference copy of the original drop, was committed.)
- Known deliberate deferrals unchanged: lasersoft_invoices/lasersoft_total schema
  identifiers (+ audit.js:285 API string naming that table — golden core, needs the
  ALTER-migration decision) and the BATHCO product-name branding (§7).
- NEW GUARD utils/dbGuard.js wired into utils/db.js, layla.js (covers server.js
  transitively), grn-watcher.js: boot aborts if DB_NAME or DATABASE_URL resolves to the
  live shop DB — a live .env copied into a template instance now dies loudly instead of
  silently touching real data. No override by design. Tested: DB_NAME=bathco → exit 1,
  DATABASE_URL→/bathco → exit 1, bathco_template → boots clean.
- NEW server.js production check: NODE_ENV=production + ADMIN_PIN unset/0000 → fatal at
  boot (tested → exit 1). Local dev may keep 0000.
- Railway apex-platform: ADMIN_PIN=0000 replaced with a strong random PIN via
  `railway variables --skip-deploys` (owner has the PIN; both services stayed ○ Offline
  throughout — verified before and after).
- Non-superuser DB role: scripts/railway_harden_db.js written (creates apex_app role,
  full grants, audit_log UPDATE/DELETE revoked, prints the vars to set). MUST run at next
  unpause — the parked DB can't accept SQL, and owner ordered no unpausing this task.
- Distribution note added to CLAUDE.md queue: client-shipped copies must exclude
  SESSION_LOG.md / AISTUDIO_HANDOFF / CLAUDE.md / backups / frontend — the only remaining
  live-system references live in those vendor docs, not in code/config.
- Verified: all guards fire, local boot clean, npm test at baseline (17 pre-existing / 5
  pass), apex-platform still parked.
