# BATHCO_TEMPLATE (apex-server) audit, 2026-10-03

Read-only. Code at master 19910f4. DB backup taken first: `backups\bathco_owner-2026-10-03_2101.sql`.
Live shop (C:\BATHCO_PHASE1) not touched. The live :3100 DB was not queried: I restored that backup into a throwaway Postgres (port 5433, deleted after) and ran a copy of the app on :3199 for screenshots and checks.
Labels: VERIFIED = actually run/seen. UNVERIFIED = could not check (reason given).

**Counts: CRITICAL 0 | HIGH 5 | MED 15 | LOW 11 (31 findings).**
Headline: no data-loss or open-door bug found in code. Parameterised SQL everywhere, central login gate, no CORS opened, every route file mounted, tests 75/75 suites green. The real risks are: single-laptop backups, vulnerable packages, phone-width tables, and finance rules that depend on settings I could not read.

## Findings (worst first)

| ID | Sev | Area | file:line | What is wrong | One-line fix |
|---|---|---|---|---|---|
| F01 | HIGH | Backup | local_ops/backup_owner_db.ps1:7 | Backups (14 kept) sit only in backups\ on the same laptop; laptop loss, theft or disk failure loses everything. | Add a nightly copy to USB/cloud drive; keep one monthly copy. |
| F02 | HIGH | Packages | package.json (axios, multer) | npm audit: 16 high in production deps; axios and multer are direct and have a fix available. | `npm audit fix` for axios/multer, rerun the suite. |
| F03 | HIGH | Phone UI | public/bathco_complete.html (pages moneycontrol, stock, cheques, loans, commissions, grn, salary, vendors) | Sideways scroll on iPhone 390px: pages measure 405 to 753px wide (stock 654, cheques 671, vendors 753). VERIFIED by browser test. | Wrap each table in an overflow-x:auto box or stack as cards under 600px. |
| F04 | HIGH | Database | routes/*.js, server.js (35 files with `new Pool`) | 35 modules each open their own pg Pool (10 connections each, up to 350) against Postgres default max 100. Live max_connections UNVERIFIED. | Use one shared pool from utils/db.js. |
| F05 | HIGH | Finance | routes/audit.js:19, routes/purchasing_accounting.js:26 | The Rs 25,000 cash float is not in code: it is PETTY_CASH_FLOAT from .env and defaults to 0. I could not read .env (blocked), so the live value is UNVERIFIED. | Default to 25000 or move it into app settings and show it on the cash screen. |
| F06 | MED | Packages | package.json (xlsx) | xlsx has prototype-pollution and ReDoS advisories and no fix; it reads uploaded Excel files (admin only). | Swap to exceljs, or keep uploads admin-only and size-limited. |
| F07 | MED | Packages | package.json (whatsapp-web.js, puppeteer chain) | Remaining highs come through whatsapp-web.js and puppeteer (browser and proxy helpers). Bridge is not run on this laptop. | Update whatsapp-web.js on the machine that runs the bridge. |
| F08 | MED | Cheques | routes/cheque_register.js:35 | No unique rule on bank + cheque number, so the same cheque can be entered twice (paper inbox also files cheques), doubling the reserve. | Add UNIQUE(bank, cheque_no) where cheque_no is set, and return a clear 409. |
| F09 | MED | Loans | routes/investor_loans.js:148 | QR balance is typed by hand, not worked out from entries; LKR and QR can drift apart unnoticed. | Store QR payments as entries and compute the QR balance. |
| F10 | MED | Loans | routes/investor_loans.js:43 | Loan status "overdue" is manual; nothing marks a loan overdue when its due date passes. | Compute overdue from due_date in the SELECT like cheques do. |
| F11 | MED | Commissions | routes/sale_commissions.js:3-12 | Commission is logged by hand, not calculated from POS bills (no salesperson on bills), so weekly commission depends on staff entering every sale. | Add salesperson to pos_bills and auto-create the commission row. |
| F12 | MED | Sync | routes/sync.js:147 | Offline edits and voids wait in "needs review" but there is no screen to review them (API only). | Add a small Review screen in Admin. |
| F13 | MED | Migrations | routes/*.js (61 CREATE TABLE IF NOT EXISTS) | Schema is built by start-up code in 35 files: no version table, only one down script (site_editor_down.sql); cannot tell which schema version a DB is on. | Add a schema_version table and one numbered migrations folder. |
| F14 | MED | Dev setup | scripts/dev/test_schema.sql | Dev schema misses columns the live code needs; a new instance built from it breaks. | Regenerate it from a pg_dump --schema-only of the live DB. |
| F15 | MED | Staff data | server.js (/api/staff outstanding/total_loans) | Repayments are counted as loans in /api/staff totals (Staff screen advances tab is right). | Fix with Aj's rule, add a test. |
| F16 | MED | Login | server.js:190 | Lockout is per IP (10 failed per 15 min), not per account; one attacker on a shop phone can lock staff out, and a spread attack is not slowed. | Add a per-username failed counter with a 15 min lock. |
| F17 | MED | Rate limit | server.js:156 | General API limit skips all private-address devices, so a device on the shop Wi-Fi is not limited on any API except login/PIN. | Keep skip for file GETs only; raise the limit for private IPs instead of skipping. |
| F18 | MED | Uploads | server.js:87, server.js:1549 | Upload limits of 200 MB per file on admin and daily-sales uploads, with no total cap. | Lower to 25 MB and add a disk-space check. |
| F19 | MED | Alerts | routes/backup_status.js:199 | No uptime alert: status screen only; if the server or laptop is down nobody is told. | Add a free external ping (UptimeRobot/Healthchecks) on /health with a WhatsApp or email alert. |
| F20 | MED | WhatsApp | routes/shop_operations.js (receipt_queue) | The only real receipt attempt failed ("bridge not reachable") and WhatsApp send is UNVERIFIED live; auto-send flags are off. | Test one real send from the bridge machine, then turn auto-send on. |
| F21 | LOW | Rate limit | routes/enquiries.js:29 | Rate limiter is created inside a request handler (logged ERR_ERL_CREATED_IN_REQUEST_HANDLER on 2026-10-02); works because the router is cached, but also opens a second Pool. | Create the limiter and Pool at load time. |
| F22 | LOW | Commissions | routes/sale_commissions.js:173 | Weekly summary anchors on `new Date()` (UTC), so Monday 00:00 to 05:30 Sri Lanka time can snap to the previous week. | Use the Colombo date for the anchor. |
| F23 | LOW | Commissions | routes/sale_commissions.js:119 | Refund/exchange rows are dated the day of the return, so the clawback lands in the return week, not the sale week. Matches "net after returns" per payout week; confirm it is what Aj wants. | Confirm with Aj; document it on the commissions screen. |
| F24 | LOW | Console | server.js (/api/daily-summary/:date) | Every owner page logs a 404 in the console when today has no daily summary (VERIFIED on all 12 screens). | Return 200 with `{empty:true}`. |
| F25 | LOW | A11y | public/bathco_complete.html | 1 image without alt text (found by script); inputs had labels on all 12 screens checked. | Add alt="" or a description. |
| F26 | LOW | Logs | local_ops/ecosystem.local.config.js | No pm2 log rotation (pm2-logrotate not installed). Logs are small now (15 KB err, 84 KB out). | `pm2 install pm2-logrotate` when convenient. |
| F27 | LOW | Tests | jest.config.js, tests | Jest "worker failed to exit gracefully" (open handles); 2 tests skipped (restore E2E). CLAUDE.md still says 17 baseline failures, but today's run is 0. | Update CLAUDE.md; find the open handles with --detectOpenHandles. |
| F28 | LOW | Lint | package.json | No lint script, so style bugs are not caught. | Add eslint with a minimal config. |
| F29 | LOW | Data | pos_bills id 1 | A voided "Test" bill (BHT-20261002-0001) and a failed receipt row remain in the DB. | Leave (voids are audited) or ask Aj before clearing. |
| F30 | LOW | Setup | server.js:231 | /api/setup/* is open to anyone, protected only by "locks once an admin exists" (status says setup_needed:false). POST lock UNVERIFIED (not tested to avoid changing data). | Add a test that POST /api/setup/* returns 403 after the first admin exists. |
| F31 | LOW | Privacy | public/website/index.html:9, public/bathhub.html:15 | Public sites load Google Fonts; owner app does not. | Self-host the fonts like /public/fonts. |

## What was checked and passed
- Tests: 75 suites, 656 pass, 2 skipped, 0 failed (VERIFIED, full run after the website merge).
- Secrets: no keys or passwords in tracked files or history (pattern scan of code and git log); .env and .pg_owner_superpw are gitignored and not tracked (VERIFIED). Only frontend/.env.example is tracked.
- Mounting: every file in routes\ is required in server.js (37 mounts, no unmounted route). VERIFIED.
- Auth: one gate before all routes; staff role can read only its own data; unauthenticated /api/customers, /api/document-inbox, /api/site/tiles, /api/users all 401 (VERIFIED on live :3100). Public exceptions are narrow (site feed, photos, enquiry POST, catalogue, branding).
- SQL: all values are parameterised; dynamic pieces come from fixed whitelists (audit.js:23 granularity map, corrections.js table map). No injection path found.
- CORS: no cors middleware, so same-origin only. Cookies httpOnly, secure:auto; helmet on (CSP off by design).
- Uploads: memory or disk storage with size limits, file-type sniffing by content, safe names, `res.sendFile` with root. Fine apart from F18.
- pm2: apex-server online, 1 restart (mine), 97 MB, max_memory_restart 512M, backoff restart on. Boot-after-reboot UNVERIFIED.
- Offline sync: idempotency key per write stored in sync_log (UUID, replay returns the first answer, race-safe); new records always accepted, edits/voids never auto-applied. Design sound (see F12). Phone behaviour UNVERIFIED.
- Migrations: all CREATE/ALTER use IF NOT EXISTS; no DROP TABLE/COLUMN or TRUNCATE; one admin-only, audited `DELETE FROM menu_config` (menu reset). Idempotent, not reversible (F13).
- Restore test: the backup dump restored into a clean Postgres with 0 errors, 84 tables (VERIFIED). This is the restore proof the Jest suite skips.
- Front end: no broken internal links, every page has a viewport tag, numbers on the screens checked used tabular-nums, public site fits 390px (fixed in v3).

## B. Finance audit
The database holds almost no business data (1 voided test bill, 1 customer, 0 cheques, 0 loans, 0 commissions, 0 daily summaries, 0 stock items), so there is nothing to tie out yet. Checked by data query plus code read:
- B1 daily totals vs payments vs bills: no days exist; only bill BHT-20261002-0001 (1000 less 10% = 900, correct). Nothing fails to tie.
- B2 cash in hand: formula in code = float + cash sales - expenses - payments (routes/audit.js:238). Float value depends on F05.
- B3 cheques: no rows. Code: overdue is worked out by date (not stored), held cheques keep the old date in held_from_date and show the new due date. Duplicate protection missing (F08).
- B4 investor loans: no rows. Outstanding = amount + profit% - payments (LKR); QR balance is manual (F09); overdue is manual (F10).
- B5 commissions: no rows, so 10-row spot check not possible. Code matches the rules: refund claws back the full commission; exchange stores new minus old (equal to reverse old then apply new); 15-day is a soft flag only (past_policy_window, never blocks); one return per sale; weekly summary Mon to Sun. See F11, F22, F23.
- B6 overhead reserve: monthly total / days in month, correct (routes/money_control.js:208-212).
- B7 rounding, negatives, orphans, future dates: none found in the data; money is NUMERIC(12,2), rounded to 2 places in code.

## C. Feature gap

| Feature | Status | Note |
|---|---|---|
| WhatsApp live send | PARTIAL | Bridge, receipt queue, auto-send exist (flags off); only test send failed (bridge unreachable). F20 |
| Item catalogue + auto codes | EXISTS | routes/item_catalog.js; 0 items entered yet |
| GRN page | EXISTS | GRN page, grn_manual.js, paper inbox |
| Off-machine backup + restore test | PARTIAL | Daily local backup and restore screen exist; no off-machine copy (F01); restore proven by me, Jest E2E skipped |
| Audit trail | EXISTS | admin_audit, Audit Log screen, record history, login_audit |
| Login lockout / 2-step | PARTIAL | IP lockout and optional authenticator (TOTP) 2-step exist; no per-account lockout (F16) |
| Offline sync | EXISTS | UUID queue + sync_log; phone test still owed (UNVERIFIED) |
| Barcode scan | PARTIAL | Item lookup by code and a barcode setting; no camera scan found |
| Stocktake | MISSING | Only stock adjustments |
| Supplier payables | EXISTS | supplier_payments, purchasing |
| Customer credit | EXISTS | Credit & Aging, credit limits |
| Quotations | EXISTS | Quotations screen and tables |
| Delivery scheduling | MISSING | Nothing for delivery dates or routes |
| VAT invoice | PARTIAL | VAT report only; the bill/receipt carries no VAT number or VAT line |
| Owner alerts | PARTIAL | Notifications and alertOwner exist; WhatsApp part depends on the bridge |
| Month-end close | PARTIAL | Salary month close and a year-end table; no general month close |
| Uptime alerts | MISSING | Status screen only (F19) |
| Staging copy | MISSING | None; this audit's scratch restore shows it is easy to build |
| Excel import/export | PARTIAL | Daily Excel upload and audit export; no item or customer import/export |
| Sinhala/Tamil staff UI | MISSING | Only the public website is trilingual; owner/staff app is English |

## D. Screens (iPhone 390 x 844, 2x) in audit\screens\
Run on the throwaway copy of the DB with a test login (no live data touched).
- owner-dashboard.png
- owner-moneycontrol.png
- owner-website.png
- owner-pos.png (billing)
- owner-stock.png
- owner-cheques.png
- owner-loans.png
- owner-commissions.png
- Extra: owner-grn.png, owner-salary.png, owner-vendors.png, owner-tilegallery.png
- Public site: website-v3-live-12-top.png, website-v3-live-12-full.png, website-v3-api-down-top.png, website-v3-api-down-full.png

Not covered: live .env values (read was blocked, so OWNER_READ_ONLY, PETTY_CASH_FLOAT, auto-send flags are UNVERIFIED), live DB max_connections, pm2 reboot survival, service-worker offline pages, real WhatsApp send.
