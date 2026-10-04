# PHASE 2 PIVOT — STATUS

Generated 15 June 2026. Summarizes the PWA pivot session. Scope: BATH HUB COMMAND
only — Dubai Imports and Bath Hub Aromatic were not touched.

## 1. bathco-mobile — PAUSED ✅

`bathco-mobile/PAUSED.md` created. The Expo/React Native app is paused, not
deleted (node_modules, source, config all left in place). Reason: pivoted to a
PWA built on the existing `dashboard.html` instead — one codebase, no app-store
distribution needed, full UI already exists. The auth debugging work
(`AuthContext.tsx`, `LoginScreen.tsx`, `api.ts`) is documented as a reference
for PWA auth, though it turned out not to be needed (see §3).

## 2. PWA conversion ✅

- **`public/manifest.json`** — added. Name "BATH HUB COMMAND", short name
  "BATH HUB", dark/gold theme (`background_color`/`theme_color`: `#06120d`),
  `display: standalone`, `start_url: /dashboard.html`.
- **Icons** — `public/icons/icon-192.png`, `icon-512.png`,
  `icon-maskable-512.png` generated programmatically (gold 3×3 tile motif on
  dark background, matching the existing `.brand-icon` color scheme). No
  image libraries were available, so these were produced with a small
  pure-Node PNG encoder (zlib only, no new dependencies added).
- **`public/service-worker.js`** — added. Caches the static shell
  (`/`, `/dashboard.html`, `/manifest.json`, icons) with a cache-first +
  background-refresh strategy. `/api/*` requests are explicitly excluded —
  always hit the network (live data, session cookies, 401 handling all still
  work normally offline-first wouldn't make sense for live financial data).
- **`dashboard.html` `<head>`** — added `<link rel="manifest">`,
  `theme-color`, `apple-touch-icon`/`apple-mobile-web-app-*` tags, and
  `viewport-fit=cover`. Service worker registration added at the end of the
  main `<script>` block.
- **375px responsive review** — reviewed all CSS (existing breakpoints were
  900px/600px only, nothing below that). Added a new `@media(max-width:480px)`
  block covering:
  - Header: hides the Arabic bismillah line, shrinks the brand title/icon,
    hides the username label, compresses the "LAYLA ONLINE" pill and theme
    button so the header no longer overflows a 375px viewport.
  - `main` padding reduced 24px → 12px; card padding 20px/16px → 14px.
  - KPI numbers (`.kpi-value` 30px→22px, `.kpi-value-lg` 42px→28px) so large
    Net Profit / Credit Outstanding figures don't overflow their cards.
  - Existing `grid-4`/`grid-3`/`grid-2` already collapse to 1 column ≤600px,
    so Daily/Weekly/Monthly/Staff/Suppliers/Credit/Agents/Customers/Quotations
    all stack to single-column on phones. Tables already scroll horizontally
    via `.tbl-wrap{overflow-x:auto}`.
  - Calendar's 7-column grid (Daily tab) was checked — at 375px each cell is
    still ~40px, workable.

  **Caveat (honesty)**: this was a static CSS review, not a live browser
  screenshot test — no headless browser (Puppeteer/Playwright) is installed
  in this project and installing one wasn't done without asking first. The
  layout changes are standard, low-risk responsive CSS, but a manual check on
  an actual phone (or Chrome DevTools device toolbar at 375px) is recommended
  before relying on this for daily use.
- **"Add to Home Screen"** — with `manifest.json` + service worker +
  HTTPS/localhost served, Chrome on Android should now offer "Add to Home
  Screen" / "Install app" for `http://<server-ip>:3000` (or the ngrok HTTPS
  URL). Not verified on an actual Android device in this session — please
  test from Ajmal's phone and report back if the install prompt doesn't
  appear.

## 3. Role-based auth scaffolding ✅

The admin/owner/staff system built in an earlier phase **already implements**
the admin / uncle_readonly / staff spec — `owner` *is* uncle_readonly:

- `server.js` middleware (lines ~30-65) — documented this mapping explicitly
  in a comment. `admin`=full access, `owner`=read-only (GET only, 403 on
  writes) = uncle_readonly, `staff`=own salary/loans only.
- Ajmal's `admin` login already works against `/api/login` and will work
  identically inside the PWA (same-origin cookies — actually simpler than the
  old mobile app's `credentials:'include'` workaround).
- **New this session**: the dashboard frontend didn't previously hide/disable
  write controls for the `owner` role — a read-only user would see "Save"
  buttons that silently 403'd. Added:
  - `IS_READONLY` flag, set when `CURRENT_USER.role === 'owner'`.
  - `blockIfReadonly()` guard wired into `post()` (covers all
    `Add/Edit/Save` actions across Staff, Suppliers, Credit, Quotations, etc.)
    and the two raw-fetch write calls (`saveQuotation`, `setQuotationStatus`).
    Shows "View-only access — changes are disabled for this account." instead
    of a silent failed request.
  - A "VIEW ONLY" badge added next to the username in the header for the
    `owner` role.
- **No new accounts created** (per instruction) — `uncle` (role=`owner`) and
  the 9 staff accounts already exist from `scripts/seed_accounts.js`. Nothing
  further needed to satisfy "do NOT create those accounts yet".

## 4. DATA_MAPPING_STATUS.md ✅

Created at project root. Covers all 197 days from 1 Dec 2025 to 15 Jun 2026,
cross-referenced against `daily_summary` using the same tier logic as the
dashboard (TIER_EXPR):

| Status | Days | Meaning |
|---|---|---|
| COMPLETE | 32 | Tier FULL — real Lasersoft GP + expenses, Net Profit trustworthy |
| PARTIAL | 140 | Tier CASHFLOW/FOUNDATION — revenue known, GP/expenses missing |
| MISSING | 25 | No `daily_summary` row at all |

Notable: 1-20 Dec 2025 (20 days) MISSING — predates the tracked business
range, no source files exist. 11-15 Jun 2026 (5 days) MISSING — `/daily-close`
simply hasn't run yet for those days (expected).

## 5. Financial figures audit ✅

Formula audited: **Net Profit = Gross Profit (Lasersoft) − Total Daily
Expenses**, **commission = commission_pct% of pay-period Net Profit**.

- Row-level check: all 32 Tier-FULL days satisfy
  `net_profit = gross_profit - total_expenses` exactly — **0 mismatches**.
- **Bug found & fixed — Fahim's commission_pct**: 12 of 13 staff had
  `commission_pct = 1.000` (i.e. 1%), but Fahim had `0.010` (i.e. 0.01% —
  100x too low). Fixed in the database (`UPDATE staff SET commission_pct=1.00
  WHERE id=13`) and in both places that originally seeded the wrong value
  (`scripts/seed_accounts.js` and `server.js` POST `/api/staff` default).
- **Bug found & fixed — weekly/monthly Net Profit aggregate**:
  `/api/weekly-detail` and `/api/monthly-detail` summed
  `gross_profit - total_expenses` for any day where `gp_status <>
  'NOT_AVAILABLE'`, which on a Tier-FOUNDATION day (total_expenses=0, GP is an
  estimate) counts the whole GP as pure profit. Changed both to only sum
  `gross_profit - total_expenses` for Tier-FULL days (`TIER_EXPR='FULL'`),
  matching `/api/all-time-stats`'s existing `np_full` logic. Verified via
  direct SQL: Dec 2025 (`net_profit_old` ≈ 1.81M → `net_profit_fixed` = 0) and
  Jan 2026 (≈2.75M → 0) — both months have 0 FULL days, so the dashboard
  already showed "PENDING" for them via the `tFull===0` gate and this fix
  changes nothing currently *visible*; it prevents a future month that mixes
  FULL and non-FULL days from showing an inflated Net Profit. Apr/May 2026
  (which do have FULL days) are unchanged by the fix.
- Server restarted after these `server.js` edits; confirmed back up (401 on
  `/api/all-time-stats` when logged out, as expected).

## 6. Open items / for Ajmal

- **TEMP_PASSWORDS.txt**: during testing, an attempt to log in as `ajmal`
  using the temp password in `TEMP_PASSWORDS.txt` failed — the DB hash no
  longer matches that file, meaning **Ajmal has already changed his password**
  since the temp credentials were generated (11 Jun 2026), which is the
  expected/correct behavior. `TEMP_PASSWORDS.txt` is now stale for `ajmal`;
  per its own header ("DELETE THIS FILE once passwords have been
  distributed"), it should be deleted once any remaining staff/uncle accounts
  have collected their temp passwords.
- **Phone testing needed**: please open the dashboard on an Android phone
  (Chrome) at the LAN/ngrok URL, confirm "Add to Home Screen" appears, and
  check the Daily/Weekly/Monthly/Staff/Suppliers/Credit/Agents/Customers/
  Quotations tabs look right at phone width.
- **uncle (owner / uncle_readonly) account**: not tested end-to-end this
  session (would require its temp password from `TEMP_PASSWORDS.txt`, which
  wasn't touched to avoid further credential exposure). The "VIEW ONLY" badge
  and write-blocking should be sanity-checked on first real login.
