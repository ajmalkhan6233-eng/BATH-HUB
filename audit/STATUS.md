# STATUS, 2026-10-03 (branch feature/tests-and-checks)

Labels: VERIFIED = run or seen. UNVERIFIED = could not check (reason given).
DB backup taken first: `backups\bathco_owner-2026-10-03_2236.sql` (plus its encrypted copy in D:\BathHubBackups).

## 1. Tests for the 4 modules that had none
New files in tests\integration: `business_intelligence`, `investor_loans`, `grn_manual`, `pos_bill_corrections`, `four_modules_auth`. No source file was edited.
- Auth: all 13 routes of the four modules are 401 with no login and 403 as staff (through the real server); void/edit/history of a POS bill are 403 for staff, owner and no session (only admin may correct a bill).
- Valid input, bad input, DB failure: covered for every route (loans: create, read, repay, QR balance, list, summary; GRN: new item, restock, 14 bad-input cases; corrections: edit, void, history; BI: forecast buckets HEALTHY/WATCH/TIGHT, thresholds, non-moving stock window).
- DB failure = the pool throws or the client fails: every route answers 500 with a message and the client is released.
- Full suite: 83 suites, 756 passed, 2 skipped, 0 failed (VERIFIED).
- Limits of the in-memory test database (pg-mem): it cannot run date_trunc or correlated sub-queries and cannot roll back, so the business-intelligence tests stub the pool (they test the route logic, not Postgres), and the GRN all-or-nothing rollback is only checked for validation errors.

## 2. Does pm2 survive a reboot?
Chain: Windows logon -> scheduled task `Apex_Owner_Server_Start` (logon trigger, user Sony, runs `pm2.cmd resurrect`) -> reads `C:\Users\Sony\.pm2\dump.pm2` -> starts what is saved there.
- dump.pm2 (saved 2026-10-02 20:33) holds `apex-server` (cwd E:\AI Sttuf\BATHCO_TEMPLATE, server.js, PORT 3100, production, autorestart on) and `premium-imports-server` (a different app, not touched). Today's restarts did not change the apex-server entry, so no `pm2 save` was needed. I changed nothing.
- The task last ran 2026-10-03 20:13 with result 0, so resurrect worked at the last logon. VERIFIED from the task record.
- Not tested with a real reboot (it would take the laptop and server down). UNVERIFIED.
- Weak spot: it starts at Windows LOGON, not at power-on. After a restart the server stays down until Sony signs in to Windows (unless Windows auto-login is on, not checked). Sleep must be Never when plugged in (already an open item).
- This pm2 has no live-shop process in it (only apex-server and premium-imports-server); the live shop was not touched.
- The backup task `Apex_Owner_DB_Backup` (23:00) now runs `scripts\backup_owner_db.ps1`; next run tonight 23:00.

## 3. Offline mode in the owner app
Two meanings, both checked.
A. The laptop has no internet (phone on the shop Wi-Fi). The owner app itself uses no internet: no CDN, fonts and Chart.js are local (VERIFIED by scanning the files; only wa.me links go out). Works: login, bills, stock, GRN, cheques, loans, salary, reports, website editor, backups, all data in the local database. Breaks without internet: sending WhatsApp (Graph API / bridge), the AI assistant and Layla replies (openrouter.ai), Excel/CSV are fine, the public Bath Hub site's Google Fonts (falls back to system fonts), and reaching the app away from the shop Wi-Fi (ngrok tunnel).
B. The phone or browser cannot reach the laptop (server stopped). Real test in headless Chromium with the service worker, server killed after warm-up (VERIFIED):
- The /owner app shell loads from the saved copy; no login screen appears.
- 12 of the 17 screens opened show their layout or their last saved data (dashboard shows the "saved copy" label; stock, cheques, GRN, salary, vendors, website, tile gallery, daily sales, expenses, enquiries, reports).
- Money Control rendered fully inside its frame.
- POS billing, Loans, Commissions and Settings are separate pages shown in frames: their files are served offline (fetch returned 200 with the full page for all five), but my automated check could not confirm that the frame content painted. UNVERIFIED for those four.
- A bill saved while offline returned 202 and is queued in the browser (IndexedDB "apex-offline") with a temporary OFF- number; it uploads once, in order, when the server is back (design verified earlier; the phone test in OPEN_ITEMS is still owed).
- Breaks offline: anything first opened offline that was never opened online (no saved copy yet gives a clear "no saved copy" message), login itself, WhatsApp send, and edits or voids made offline wait in "needs review" with no screen to review them (audit F12).

## 4. Feature status (from reading the code)
| Item | Status | Files | Notes |
|---|---|---|---|
| Item catalogue, auto codes, photos | EXISTS | routes/item_catalog.js (next-code, list, create with photo, CSV export); screen = Stock page in public/bathco_complete.html | Codes are 001, 002 ... (highest number + 1); photos up to 5 MB in uploads/item_photos; duplicate names refused. No edit route for an existing item (create, list, read only). |
| GRN manual page | EXISTS | routes/grn_manual.js; screen = GRN page in public/bathco_complete.html | Multi-row form with a photo per row; restocks a matching item or creates a new coded one; writes PENDING_REVIEW rows; now has tests. |
| Quotations | PARTIAL | public/quotations.html; routes inside server.js (about lines 1344 to 1410) | Create (Q-0001 numbers), list, view and change status work. No convert-to-bill and no print/PDF. |
| Stocktake | PARTIAL | routes/shop_operations.js (stock_adjustments, POST /stock-items/:id/adjust); "Stock-take sheet (CSV)" button in bathco_complete.html | A printable count sheet and a one-item adjustment exist. No count-entry screen, no counted vs system comparison, no bulk posting of differences to products. Adjustments go to stock_items, not the products table the shop uses. |
| Owner + colleague salary tab | PARTIAL | routes/salary.js, public/salary.js, utils/salaryMath.js; menu "Salary & Costs" | Owner and colleague exist as commission shares and daily pay settings, month split and month close. No separate owner/colleague pay or drawings tab and no record of what was actually paid out. |
| Customer credit | PARTIAL | public/credit_aging.html, public/customers.html, server.js (credit-customers, about lines 2762 to 2790), routes/shop_operations.js (credit limits) | Credit entries and aging buckets work; limits can be stored by customer name. No "payment received" action, no limit check at the till, no credit sale from the POS. |
