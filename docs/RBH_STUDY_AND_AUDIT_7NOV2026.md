# RBH STUDY + APP AUDIT (Sat 7 Nov 2026)
Source: 9 lists from the reel "System Design For Frontend Engineers" (Himanshu Raj Singour), 20 concepts each = 180.
App checked: BATH-HUB branch `work`, commit 6328d50, cloud copy, READ-ONLY. Counted by search of the code. Nothing was run, so every finding is a code-reading result (UNVERIFIED at runtime). No live data touched.

## 1. SUMMARY (read this first)
- Of 180 concepts, about 45 matter to RBH (plain HTML/JS, Node, Express, PostgreSQL, one shop, iPhone + PC). About 60 are already in place. About 75 are for big teams or React-style apps and are skipped on purpose.
- The app is in better shape than most shop apps: sessions in Postgres, login and PIN brute-force limits, helmet headers, offline queue with idempotency, versioned service worker (v71), 50 test files, 6 backups.
- Top 5 gaps, in order: (1) no error handler or crash/shutdown handler, (2) no SameSite on the login cookie and no CSRF guard, (3) no way to see errors from the phone screens, (4) 24 dependency warnings from npm audit, (5) form and dialog accessibility on 323 inputs and 88 prompt/confirm boxes.
- Nothing here is urgent for opening week. All fixes are small, one module each, built in the cloud, tested on the copy, and only after AJ says "go".

## 2. WHAT THE 9 TOPICS MEAN FOR RBH
Key: HAVE = already in the app. USE = worth doing. SKIP = not for a one-shop plain-JS app.

### Observability (20)
- HAVE: Unit tests (50 jest files), Rollbacks (git tags v1.0, v1.1, backups 02:00), Dashboards (command centre), Alerting (06:00 message, cheque alerts, health check).
- USE: Error Tracking + Frontend Logging (phone screens report their errors to the server, shown in the 06:00 message), Performance Monitoring (log slow API calls), CI Checks (run jest on every push, free GitHub Actions), E2E Tests (Playwright on the test copy, already allowed).
- SKIP: Sentry (hosted service; own error log does the job free), RUM Analytics, Session Replay (records customers and staff screens, privacy), Product Analytics, A/B Testing, Component Tests, Visual Regression, Contract Tests, Canary Releases (one shop), Source Maps (no build step).

### Accessibility and i18n (20)
- HAVE: Semantic page setup (all 53 pages have lang and viewport), Alt Text (1 image missing), Intl formatting in 47 files, Pluralization and Date/Number formats (rbh-i18n rule), Translation workflow (native reader rule), Locale routing on the website.
- USE: Forms and Labels (323 inputs, only 36 aria-labels in total), Accessible Modals (only 2 pages mark a dialog), Focus Management and Keyboard Navigation (focus-visible in 9 files only), Color Contrast (gold on black: check), Reduced Motion (2 files).
- SKIP: ARIA Roles beyond buttons and dialogs, Screen Readers deep work, Skip Links, Live Regions, Testing with axe (can run once on the copy), WCAG levels as a target, RTL (Sinhala and Tamil are left-to-right).

### Security (20)
- HAVE: Secure Cookies (httpOnly, secure auto), Session Timeout (12 h, 1 year only if AJ ticks remember), CORS (not opened), Dependency Audits (run today), HTTPS Everywhere (Tailscale/tunnel), No Secrets in Frontend (searched: none found; .env, data/ ignored), Input Sanitization (parameterised SQL guarded by a test), Security Headers (helmet), Iframe Sandboxing (not needed: same-origin screens), Clickjacking (helmet X-Frame-Options).
- USE: CSRF + SameSite (cookie has no sameSite, no CSRF check), CSP (turned off for the owner app on purpose; try report-only mode first), XSS (379 innerHTML uses vs 153 escape-helper uses: review the ones that show customer text), Auth Flows (idle auto-lock with PIN, already on the checklist), Third Party Scripts (none found; keep it that way).
- SKIP: OAuth with PKCE, JWT Handling, Token Storage (the app uses sessions, not tokens), Subresource Integrity (no CDN files), Permissions Policy.

### Architecture (20)
- HAVE: Feature Modules (82 route files), Folder Structure, Routing (#/page), Plugin-style screens (addFramePage), Theming (Gold, Water, Light), Config Driven UI (menu groups), Separation of Concerns, Documentation (handover files, skills), Code Ownership (Rule 13).
- USE: Dependency Boundaries (server.js is 3,497 lines with many inline routes: move them out one at a time), Feature Flags (POS_DEDUCT_STOCK style env flags are already used; list them in one file), Shared Libraries (public/lib exists; keep growing it).
- SKIP: Monorepos, Micro Frontends, Module Federation, Atomic Design, Design Systems (CSS variables already do this), Clean Architecture layers, Shared package scaling.

### Caching (20)
- HAVE: Service Workers, Cache API, Offline First, PWA Basics (manifest ok), Precaching, App Shell, Versioned Assets (cache name v71), Data Sync (offline queue), Background Sync (queue retries), Conflict Resolution (idempotency key), Browser Cache.
- USE: Storage Quotas (cap the saved-copy cache size), Cache Busting (version bump is manual: a startup check that warns when public files changed but the version did not), Stale While Revalidate (API is network-first with saved copy; fine for money screens, keep it).
- SKIP: CDN Caching (shop runs on the PC), IndexedDB beyond the queue, SessionStorage, Push Notifications (WhatsApp 06:00 message does this).

### Networking (20)
- HAVE: Retries (offline queue), Request Deduping (idempotency), Timeouts (axios and AI calls have them), Handling Rate Limits, Offline Queue, Error Handling (JSON {error}), HTTP Caching and ETags (express.static default), Pagination (LIMIT used 90 times).
- USE: Request Cancellation (cancel old search when typing continues, 7 pages debounce), Batching Requests (dashboard makes many calls; one summary call is cheaper), Compression (gzip is not on; helps only over Tailscale or the internet, needs a package so AJ's OK first), API Contracts (one {error} shape check in tests).
- SKIP: REST vs GraphQL, Infinite Scroll (lists are short), Polling vs WebSockets vs Server-Sent Events (60 s refresh is enough), BFF Pattern, HTTP/2 and HTTP/3.

### State Management (20)
- HAVE: Local vs Global State (each screen keeps its own), Server State (fresh fetch), Persisting State (localStorage prefs), Form State (autosave in daily entry), Optimistic Updates (offline queue), Cache Invalidation (clear-api on logout), URL as State (#/page), Sync Across Tabs (partly).
- USE: Form State guard (most forms lose typed text on refresh; the checklist already lists it), Choosing a Store (answer: none; do not add one).
- SKIP: Redux Toolkit, Zustand, TanStack Query, Context API, Signals, State Machines, Normalized State, Immutability patterns, Selectors, Prop Drilling (no React).

### Performance (20)
- HAVE: Debounce (7 pages), Lazy Loading for screens (iframes load on first open), Compression of images (partly).
- USE: Image Optimization (8+ files over 300 KB in public/: logo tile, receipt previews, visiting card; only 1 of 12 img tags lazy-loads), Bundle Analysis (pdf.worker 1.2 MB, xlsx 0.9 MB, pdf.min 0.45 MB: confirm they load only when a PDF or Excel screen opens), Core Web Vitals + LCP/INP/CLS (one Lighthouse run on the test copy, phone size), Virtualized Lists (Prices list ~135 rows is fine; skip until 1,000+), Real User Monitoring (only as slow-call log), Performance Budgets (rule: new script under 100 KB, already in rbh-ux).
- SKIP: TTFB tuning, Tree Shaking and Code Splitting (no bundler), Font Loading (system fonts), Prefetch and Preload, Memoization, Web Workers.

### Rendering (20)
- HAVE: CSR (the owner app is client-rendered, correct for a logged-in tool), Lazy Rendering, Pre-rendering (website on Netlify).
- USE: Reflow and Repaint + Layout Thrashing (only if a screen feels slow: the 523-control daily-entry grid), Critical Rendering Path (put big scripts last on the POS page), SEO and Rendering (website only: SEO pass branch exists, not published).
- SKIP: SSR, SSG, ISR, Streaming SSR, Hydration, Partial Hydration, Islands, React Server Components, Edge Rendering, Virtual DOM, Reconciliation, Suspense, Paint and Composite deep work, Choosing a Strategy (answer: keep plain HTML).

## 3. APP AUDIT FINDINGS (numbered, with where to look)
Counts are from searching the code on 7 Nov. "Heads-up" = worth fixing, not an emergency.

| # | Heads-up | Evidence | Plain fix | Size |
|---|---|---|---|---|
| 1 | No error handler, no crash/shutdown handler | no 4-argument error middleware in server.js; no unhandledRejection; SIGTERM only in whatsapp-bridge.js | one file utils/safety.js: friendly JSON error, log the detail, close the database pool on pm2 restart | small |
| 2 | Login cookie has no SameSite; no CSRF check | server.js line 184: httpOnly, secure auto, maxAge only | add sameSite lax; add a same-origin check on POST/PUT/DELETE (test with Tailscale and the tunnel so phone access is not blocked) | small, needs test |
| 3 | Phone screens cannot report their own errors | no window.onerror or client-log route found | public/lib/errorlog.js + one route; errors appear in the 06:00 message (the "weekly what to fix" line) | small |
| 4 | npm audit: 24 warnings (1 critical, 15 high, 8 moderate) | direct: body-parser, multer (fix available), puppeteer-core, whatsapp-web.js, xlsx (no fix); critical is the indirect proxy-addr | update body-parser and multer on the test copy and run jest; for xlsx, keep uploads owner-only | medium |
| 5 | Forms and dialogs not fully accessible | 323 inputs vs 36 aria-labels; 2 pages mark a dialog; 88 prompt/confirm calls | label the money and item-code fields first; replace prompt/confirm in void and bounce flows with one small dialog | medium |
| 6 | Item-code fields can autocorrect | autocapitalize="off" found 0 times; 102 type=number but only 31 inputmode | add autocapitalize/autocorrect off on code and SKU fields, inputmode on number fields | small |
| 7 | Possible XSS spots | 379 innerHTML uses; escape helper used 153 times | list the innerHTML lines that show typed text (customer name, notes, item names) and wrap them | medium |
| 8 | No automatic test run on push | no .github/workflows | one GitHub Actions file running jest (free) | small |
| 9 | Big images | 8+ files over 300 KB in public/ (logo tile 1024, receipt and card previews) | resize or convert to WebP; add loading=lazy | small |
| 10 | Owner app has no CSP | helmet CSP off on purpose | try Content-Security-Policy-Report-Only first | later |
| 11 | No compression | no gzip in server.js or package.json | needs a new package: only on AJ's OK (low value on shop Wi-Fi) | ask |
| 12 | server.js is 3,497 lines | inline routes | move out one route group at a time, each with a test | later |
| 13 | Saved copies of API answers stay on the phone until logout | service worker keeps the last good answer; wiped on logout (clear-api exists) | add a size cap and an age limit | small |
| 14 | Earlier QA items still open | QA report 22 Oct: daily-entry-v2 inputs under 16 px, empty img src on about 20 pages | already listed there | small |

Also seen and fine: security headers (helmet), failed-login limit 10 and PIN limit 5 per 15 min, shop-network devices exempt from the general limit, idempotent saves, offline queue, versioned service worker, no secrets in public files, .env and data/ ignored by git, SQL guarded by a test, no state-changing GET routes found.
The cost-code key MONEYTALKS sits in public/costcode.js (known; AJ already offered to hide it behind login).

## 4. SUGGESTED ORDER (after AJ says "go N")
1. Fix 1 + Fix 3 together (safety + error log): best value, smallest risk.
2. Fix 2 (cookie + origin check): test phone over Tailscale first.
3. Fix 4 (dependency updates on the test copy) + Fix 8 (auto tests).
4. Fix 6 + Fix 9 (small cleanups).
5. Fix 5 + Fix 7 (forms, dialogs, innerHTML review), one screen at a time: POS first.
6. Later: 10, 12, 13.
Each is its own module, tested alone on the cloud copy (cloud_rig), then one bridge task for the PC. Anything not run stays UNVERIFIED.

## 5. WHAT I DID NOT CHECK
Runtime behaviour (nothing was started), the live PC app, real phone layout, Lighthouse scores, which pages load the big PDF/Excel files, the whatsapp bridge, the website repo (Netlify), and the Layla code.

## 6. ADDENDUM: second file "Frontend System Design Master Roadmap"
- Title says 10 domains / 200 concepts, but the file holds 8 domains / 160 concepts. Rendering (20) and one more domain are missing. The reel covers Rendering, so Section 2 above stays the full set.
- The 8 domains and their concepts match the reel. Same verdicts apply. No new gaps found.
- Small extras it adds: Cache Invalidation by TTL/event (RBH: logout wipe exists, add a size/age limit = Fix 13), HSTS and Referrer/Permissions headers (helmet sets most; check HSTS only matters if served on a public HTTPS domain), Storybook/ADRs (skip; handover files do the job), CODEOWNERS (skip, one owner).
- Its maturity scale (Level 1 Basic to Level 4 Enterprise). RBH today, by reading the code:
  - Observability: Level 2 (tests + alerts, no client error log)
  - Caching: Level 3 (service worker, offline queue, versioned)
  - Accessibility/i18n: Level 2 (Intl + lang ok, labels and dialogs weak)
  - Networking: Level 3 (idempotency, retries, rate limits, timeouts)
  - Security: Level 2 to 3 (headers, limits, sessions; no SameSite/CSRF, 24 audit warnings)
  - Architecture: Level 2 to 3 (82 route files, but a 3,497-line server.js)
  - State: Level 2 (fits a plain-JS app; no store needed)
  - Performance: Level 2 (big images, little lazy loading, no Lighthouse run)
  Level 4 (micro-frontends, monorepo, canary) is not a goal for one shop. Target: Level 3 everywhere, via the fix list in Section 4.
