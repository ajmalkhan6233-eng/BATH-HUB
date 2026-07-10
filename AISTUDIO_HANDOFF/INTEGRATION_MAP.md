# INTEGRATION_MAP — wiring AI Studio output back into the template
Date: 2026-07-10. For Claude Code use only (the external AI never sees this file).

Terminology: this repo has no literal ENGINE/ or CONFIG/ folders.
**ENGINE** = `server.js`, `routes\`, `scripts\`, `layla.js`, `whatsapp-bridge.js`, `grn-watcher.js`.
**CONFIG** = `config\active.branding.json`, `config\default.branding.json`, `shop_config.json`, `.env`.
The current frontend is NOT React — it is single-file vanilla HTML/JS (`public\BATHCO_NATURE.html`,
`public\setup.html`). AI Studio output is React 18 + Vite + Tailwind, so each delivery is either
(a) ported back into the vanilla files (markup + Tailwind→CSS), or (b) kept as the start of a new
Vite frontend that talks to the same APIs. Decide once, per screen, before wiring.

## 1. UI_SPEC_SETUP_WIZARD → first-run wizard
Wire into:
- `public\setup.html` — replace markup/styles/step logic with the exported components' equivalent.
- ENGINE endpoints it must call when un-mocking: `GET /api/setup/status`,
  `POST /api/setup/complete` (server.js:386, 391); setup gate at server.js:187 and ~376.
- CONFIG written by the wizard: `config\active.branding.json` (company_name, legal_name, tagline,
  logo_url, currency, currency_symbol).
Logic-critical — STAYS with Claude Code, never hand to external AI:
- The whole `/api/setup/complete` handler: admin/staff creation, password hashing, branding-file
  write, and the **self-lock** ("wizard locks forever once an admin exists"). Only the exported
  `onComplete(payload)` boundary is swapped for the real POST.
- Logo upload handling (2MB limit is also enforced server-side).

## 2. UI_SPEC_DASHBOARD → dashboard shell + home
Wire into:
- `public\BATHCO_NATURE.html` — the ONE frontend (owner decision, server.js:372; served at
  `/nature`, server.js:462). Shell/nav lives at lines ~268-307, home page ~319-339,
  page containers ~342-601.
- ENGINE endpoints behind the mocks: `GET /api/branding` (branding + currency symbol),
  daily summary/KPI endpoints consumed by `home-kpis` and `home-recent` (per-day API in
  server.js), feature-flag registry endpoint (DB table `feature_flags`, seeded by
  `scripts\seed_feature_flags.js`), export endpoints (Excel/PDF, server.js:2319, 2387).
- CONFIG: `config\active.branding.json` theme block (emerald/earth/gold tokens) is the source of
  the palette the spec hardcodes as placeholders.
Logic-critical — STAYS with Claude Code:
- ALL financial formulas: locked net-profit formula (`net_profit = gross_profit − total_expenses`,
  routes\purchasing_accounting.js:18), tier/FULL-PENDING day-status logic, GP blend logic
  (server.js:1759-1843, 2970+), reconciliation and Cash Proof (routes\audit.js:234-240),
  petty-cash float rule (routes\purchasing_accounting.js:22-24).
- KPI **values** and status semantics come from the DB via ENGINE — the export supplies only the
  presentation. Keep the KPI colour rule (semantic accent per card; full red/green alarm only on
  Net Profit and Cash In Hand) when porting.
- Feature-flag enforcement (server-side gating), auth/session, rate limiting.

## 3. UI_SPEC_SETTINGS → settings page
Wire into:
- `public\BATHCO_NATURE.html` lines ~549-601 (`page-settings`): Change Password, User Management,
  Appearance, Feature Flags, Report a Problem cards.
- ENGINE endpoints behind the mocks: change-password endpoint, user CRUD endpoints
  (min-12-char rule is enforced server-side too), feature-flags read/toggle endpoints,
  `GET /api/branding` → `support_contact {name, phone, email}` fills the Report-a-Problem
  contact spans (BATHCO_NATURE.html:595-597).
- CONFIG: `config\active.branding.json` `support_contact`; SUPPORT_POLICY.md is the canonical
  text the card mirrors — keep them in sync.
Logic-critical — STAYS with Claude Code:
- Password hashing/validation, role model + who may create which role, session handling.
- Feature-flag persistence (DB `feature_flags` table) and its server-side effect.
- The `onThemeChange(id)` boundary connects to the existing `window.NATURE_3D.setTheme` engine
  (BATHCO_NATURE.html:573, 1856-1863) — do not let exported code re-implement it.

## 4. UI_SPEC_THEMES → theme pack
Wire into:
- `public\themes\` — one file per theme following the existing pattern in
  `public\themes\_TEMPLATE.js` (the AI Studio contract in the spec was written to match it:
  `mount(container)` returning `{resize, dispose}`).
- `THEME_REGISTRY` in `public\BATHCO_NATURE.html:1777-1780` — add `{ id, label }` per new theme;
  the Settings Appearance select then picks them up automatically.
- localStorage key: template currently uses `bathco_theme` (BATHCO_NATURE.html:1793, 1857); the
  exported preview uses `app_theme` — keep the template's key when porting (or rename it as part
  of the de-branding pass, see LEFTOVER_TRACES §7).
Logic-critical — STAYS with Claude Code:
- The mount/dispose engine, WebGL detection + fallback gating (BATHCO_NATURE.html:1785-1815),
  rAF stop-on-hidden performance rule, and the two existing WebGL themes (`nature.js`,
  `kim_forest.js`). The `paper_light` light-mode flip (`container.dataset.mode='light'`) needs a
  small host-side CSS variable switch — Claude Code writes that, not the external AI.

## Never hand to the external AI (global list)
- `server.js`, anything in `routes\` (financial formulas, audit, reconciliation, commission
  scaffold), `scripts\` (instance creation, migrations, OCR, reconciliation), `layla.js`,
  `whatsapp-bridge.js`, `grn-watcher.js`, `.env`, DB schema/queries, wizard save logic,
  auth/session/rate-limit code.
- Anything listed in LEFTOVER_TRACES.md — those traces must be scrubbed by Claude Code BEFORE any
  file is pasted into an external tool. In particular do not paste current
  `BATHCO_NATURE.html`/`routes\*` contents into AI Studio while they still contain Lasersoft /
  HSL-SL / Rs 25,000 / live-path strings.
