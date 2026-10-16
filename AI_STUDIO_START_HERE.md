# GOOGLE AI STUDIO PACK — ROYAL BATH HUB (ERP + POS) REDESIGN

════════════════════════════════════════════
## PART A — FOR AJ (owner)
1. AI Studio → **Build** → **Import from GitHub** → pick repo **BATH-HUB**, branch **ai-studio-redesign**.
2. Choose the strongest model, output length maximum.
3. Paste this one message:
   `Read AI_STUDIO_START_HERE.md completely, then read every file it tells you to read, then do everything in PART B. One attempt, complete files.`
4. Download the files Gemini produces and give them to Claude Code. Claude Code installs and tests them.

════════════════════════════════════════════
## PART B — INSTRUCTIONS FOR GEMINI (read every word; you get ONE attempt)
════════════════════════════════════════════

### B0. READ THESE REPO FILES FIRST (in this order) BEFORE WRITING ANYTHING
1. `public/bathco_complete.html` — the main app (CSS variables, sidebar, every `page-*` section, `loadDashboard`, `loadStock`, `loadCheques`, `loadVendors`, the GRN `mg*` functions, `saveManualGRN`).
2. `public/attach-widget.js` — shared Upload / Download / Remove widget.
3. `public/lib/grn_import.js` — Fill-from-file logic (JSON/CSV) to port into the GRN module.
4. `public/vendor-ledger.html`, `public/vendor-credit.html`, `public/cheque_register.html` — vendor bills, cheque statuses, forecast, reason prompts.
5. `public/pos_billing.html`, `public/assistant.html`, `public/daily-entry-v2.html` — skim only (they stay as frames).
6. `routes/*.js` and `server.js` — read-only reference for exact request/response shapes of the endpoints in B10. DO NOT edit them and do not output them.
7. Ignore: `node_modules`, `apex_backend`, `layla_v2`, `frontend/`, `reference/`, `scripts/`, `tests/`, `AGENT_GUIDE`, `docs/`, `public/_archive`.

### B1. WHO YOU ARE WORKING FOR
You are the senior ERP/POS UX architect and front-end engineer for **Royal Bath Hub**, a real tile and bathroom-fittings shop on Kandy Road, Thihariya, Sri Lanka (opened 15 Oct 2026). The owner, Ajmal Khan, runs it from a Windows PC browser and an iPhone. Staff: owner, one manager, a few sales people. It is a halal business with honest records. The software is live and holds real money data, so **correctness and safety beat novelty**.

### B2. WHAT EXISTS TODAY
A Node/Express + PostgreSQL web app. The front end is plain HTML/CSS/JS (no framework, no build step), served as static files from /public. The main file is `bathco_complete.html` (a single-page app with a flat sidebar of 27 items), plus ~60 standalone pages. You have the WHOLE project in this repo. Do not guess anything: read it first (list in B0).
The owner's complaint, in his words: *"Dashboard, POS billing, daily ledger, daily sales, stock, barcode labels, GRN… it is not convenient. Lasersoft-style ERP and accounting audit are not reachable. Layla is at the bottom. I want the classic format — File, Edit, View — and Excel-sheet style where I can control a lot of things. Rearrange the whole software like a proper standard ERP and POS system. Polished, pro level."*

### B3. YOUR JOB (one deliverable)
Build a **NEW APP SHELL** with a classic ERP layout, plus a small number of **native, polished modules**, and a **Legacy Bridge** so that EVERY existing screen is still reachable from the new menus on day one. Nothing may be lost. Do not rewrite money logic. Do not change the backend.

**Why this scope:** the existing screens work and carry real money logic. A full rewrite in one go would break them. So: new shell + 4 rebuilt modules + every other screen opened inside the shell through iframes (the Legacy Bridge). Later versions replace the iframes one by one.

### B4. TECH RULES (strict)
- **Plain static files: HTML + CSS + vanilla JavaScript (ES modules). No React, no Vite, no npm, no build step, no CDN, no external fonts or images.** The files must run when simply copied into the shop's /public folder. (If the AI Studio template forces React, still output plain static files as asked here.)
- Output exactly these files, each COMPLETE (never truncated, never "…rest unchanged"):
  1. `app.html` — the shell: menu bar, tabs, status bar, frame host, login gate, mock switch.
  2. `css/shell.css` — all styling, CSS variables, light/dark, responsive.
  3. `js/core.js` — router, tab manager, menu tree, keyboard shortcuts, role handling, toast, confirm, api(), mock switch.
  4. `js/grid.js` — the reusable Excel-style grid component (spec in B7).
  5. `js/mock.js` — fake-data layer (spec in B9) used ONLY in preview.
  6. `js/mod-dashboard.js`, `js/mod-grn.js`, `js/mod-stock.js`, `js/mod-vendors.js` — the four native modules (spec in B8).
  7. `js/legacy.js` — the Legacy Bridge table (copy B6 exactly).
  8. `README_INSTALL.md` — 10 lines: where each file goes (`/public/app.html`, `/public/css/`, `/public/js/`), and how to test.
- **If you are running out of output space:** finish the file you are writing completely, then add at the very end a section `NOT BUILT YET:` listing the files left. Never cut a file in half. Build in this priority order: core.js → shell.css → app.html → legacy.js → grid.js → mock.js → mod-grn.js → mod-dashboard.js → mod-stock.js → mod-vendors.js → README_INSTALL.md.
- Backend contract: call the SAME endpoints with the SAME request/response shapes already used in the repo code and listed in B10. **Do not invent endpoints.** If you need data and no endpoint exists, show a clear "Not available yet" state.
- Login is session-cookie based: `GET /api/me` returns the user (role: admin | owner | manager | staff | investor); `POST /api/login` {username,password}. Use `fetch(..., {credentials:'same-origin'})`. If `/api/me` is not ok → show a clean login card. `investor` = read-only (no buttons that write).
- All text in plain, short English words (no jargon). Add a language switch placeholder (English / සිංහල / தமிழ்) in View menu that only stores the choice for now.
- Currency: LKR. Format `LKR 1,234,567` (no decimals unless the value has them).
- Accessibility: keyboard reachable, visible focus, buttons ≥ 44 px on touch, contrast AA.

### B5. THE NEW LAYOUT (build exactly this)
**Top menu bar** (desktop): `File | Edit | View | Sell | Buy | Stock | Money | Reports | Layla | Tools | Help`. Opens dropdowns on click and with Alt+letter. On phones (<820 px) the menu bar becomes a **bottom tab bar**: Sell · Buy · Stock · Money · More; "More" opens a sheet with the rest.
**Document tabs** under the menu bar: every opened screen is a tab (like Excel sheets / browser tabs), with a close ✕, middle-click to close, drag to reorder, right-click → Close others. Remember open tabs in `sessionStorage` (wrap in try/catch). The tab strip scrolls horizontally on phones.
**Left panel** (collapsible): shows ONLY the screens of the currently selected menu group, as a plain list, with a search box ("Find a screen… Ctrl+K" command palette that searches every screen in every group).
**Status bar** (bottom): shop name · user + role · online/offline dot · today's date.
**Top-right**: a permanent round **Layla** chat button (opens the Layla chat screen in a right-hand slide-over using the frame `/assistant.html`), theme toggle, user menu (Sign out = existing logout route).

**Menu tree — assign every screen below to exactly ONE group; nothing dropped:**
- **File**: New Bill (opens POS Billing) · New GRN · New Expense · Import file (opens GRN → Fill from file) · Export current sheet (Excel/CSV/Print via grid) · Print · Sign out.
- **Edit**: Find (Ctrl+F in the current grid) · Settings · Users · Edit & Void.
- **View**: Dashboard · Full screen · Close all tabs · Theme (Light/Dark/Auto) · Language · Left panel on/off.
- **Sell**: POS Billing · Daily Sales · Quotations · Customers · Credit & Aging · Enquiries · Reply Drafts · Sale Commissions.
- **Buy**: GRN (native) · Purchasing · Vendors (native, with cheques) · Vendor Credit · Vendor Ledger · Document Inbox.
- **Stock**: Stock (native sheet) · Barcode Labels · Tile Gallery.
- **Money**: Daily Entry (day sheet) · Expenses · Cheques · Cheque Register · Money Control · Friend & Investor Loans · Salary & Costs · Staff · Accounting · Audit & Accounting · Audit Log.
- **Reports**: Reports · Reports & Analytics · Documents.
- **Layla**: Layla chat · Agent Review · Agent Rules.
- **Tools**: Website · Website Catalogue · Content · Competitors · Policy Watch · Branches · Shop Tools · Settings · Admin Settings · System & Backups · Users · Edit & Void.
- **Help**: Keyboard shortcuts · How to use (short) · About.
(Some screens, e.g. Settings/Users/Edit & Void, appear in two menus on purpose; they open the same tab.)
Role rules: staff sees Sell, Stock (view), Help only. manager adds Buy, Money (not salary, not loans, not cost structures), Reports. investor sees Reports and Dashboard read-only. admin/owner sees all. The server still decides — this only hides.

**Look and feel:** professional ERP, calm and dense but clean. Keep the brand: gold `#F5A623` on near-black `#0D0D0D` (dark) and a clean light theme `#f4f5f7`; copy the CSS variables from `public/bathco_complete.html`'s `:root` so colours stay identical. Subtle borders, 8-px spacing grid, 14 px base font, tabular numbers for money (right-aligned, `font-variant-numeric: tabular-nums`). No heavy animation; 150 ms transitions only. Empty states with one clear action. Skeleton loading rows. Errors in plain words with a retry button.

### B6. LEGACY BRIDGE (js/legacy.js — copy exactly; add each as a tab that hosts an iframe)
Each screen below opens inside the shell as an `<iframe src=... style="width:100%;height:100%;border:0">` filling the tab. Lazy-load on first open; keep it alive when the tab is hidden. If the page is not on the shop server (preview in AI Studio), show a friendly placeholder card "This screen runs on the shop server" with the URL.
| Screen | Open it in a frame with this exact URL |
|---|---|
| Daily Sales | /bathco_complete.html?embed=1#/daily-sales |
| Stock | /bathco_complete.html?embed=1#/stock |
| GRN | /bathco_complete.html?embed=1#/grn |
| Expenses | /bathco_complete.html?embed=1#/expenses |
| Cheques | /bathco_complete.html?embed=1#/cheques |
| Vendors | /bathco_complete.html?embed=1#/vendors |
| Salary & Costs | /bathco_complete.html?embed=1#/salary |
| Document Inbox | /bathco_complete.html?embed=1#/docinbox |
| Friend & Investor Loans | /bathco_complete.html?embed=1#/loans |
| Money Control | /bathco_complete.html?embed=1#/moneycontrol |
| Sale Commissions | /bathco_complete.html?embed=1#/commissions |
| Enquiries | /bathco_complete.html?embed=1#/enquiries |
| Reply Drafts | /bathco_complete.html?embed=1#/replies |
| Website Catalogue | /bathco_complete.html?embed=1#/webcat |
| Website | /bathco_complete.html?embed=1#/website |
| Tile Gallery | /bathco_complete.html?embed=1#/tilegallery |
| Policy Watch | /bathco_complete.html?embed=1#/policy |
| Branches | /bathco_complete.html?embed=1#/branches |
| Settings | /bathco_complete.html?embed=1#/settings |
| Shop Tools | /bathco_complete.html?embed=1#/shoptools |
| Content | /bathco_complete.html?embed=1#/content |
| Competitors | /bathco_complete.html?embed=1#/competitors |
| Agent Review | /bathco_complete.html?embed=1#/agentreview |
| Agent Rules | /bathco_complete.html?embed=1#/agent-rules |
| Reports | /bathco_complete.html?embed=1#/reports |
| POS Billing | /pos_billing.html |
| Barcode Labels | /labels.html |
| Customers | /customers.html |
| Credit & Aging | /credit_aging.html |
| Quotations | /quotations.html |
| Purchasing | /purchasing.html |
| Accounting | /accounting.html |
| Audit & Accounting | /audit_accounting.html |
| Staff | /staff.html |
| Reports & Analytics | /reports_analytics.html |
| Documents | /documents.html |
| Layla chat | /assistant.html |
| Vendor Ledger (cheques per bill) | /vendor-ledger.html |
| Vendor Credit (who we owe, forecast) | /vendor-credit.html |
| Cheque Register (planner) | /cheque_register.html |
| Money Control | /money-control.html |
| Investor & Friend Loans | /investor_loans.html |
| Sale Commissions | /sale_commissions.html |
| Daily Entry (day sheet) | /daily-entry-v2.html |
| System & Backups | /admin_system.html |
| Users | /admin_users.html |
| Audit Log | /admin_audit.html |
| Admin Settings | /admin_settings.html |
| Edit & Void | /admin_corrections.html |

Native modules REPLACE these keys: dashboard, grn, stock, vendors (B8). Everything else uses the bridge.

### B7. THE EXCEL-STYLE GRID (js/grid.js) — used by Stock, Vendors, GRN lines
A reusable `class SheetGrid` with: sticky header; click header to sort (asc/desc/none); filter row under the header (text contains / number ≥ ≤); column show/hide menu; column resize by drag; frozen first column; row selection (click, Shift-click, Ctrl-click); keyboard: arrows, Tab/Shift-Tab, Enter (edit/commit), Esc (cancel), F2 (edit), Ctrl+C / Ctrl+V of cell ranges (tab/newline text), Ctrl+F opens find bar, Home/End, PageUp/Down; inline edit only on columns marked `editable` and only when the user's role allows; **totals row** pinned at the bottom (sum for number columns, count otherwise); virtual scrolling for 5,000+ rows; zebra rows; sticky "row count · selected · filtered" footer; toolbar with **Export** (CSV, Excel-compatible `.xls` HTML table, Print) and **Columns**. Number columns right-aligned. Negative numbers red. Cells with status values show coloured chips (OK green, PENDING amber, OVERDUE red). Config: `new SheetGrid(el,{columns:[{key,label,type:'text|number|money|date|status',editable,width}],rows,onEdit,readOnly,totals:true})`.

### B8. THE FOUR NATIVE MODULES — read the real code in the repo files from B0 and reproduce its behaviour exactly
1. **Dashboard** (`mod-dashboard.js`): read `loadDashboard()` in the source for the exact endpoints and field names (`/api/home-stats`, `/api/weekly-chart`, `/api/daily-summary?latest=1`, `/api/daily-sales-live/today`, plus `/api/vendor-credit/summary`). Show at most **6 big numbers**: Today's sales · Cash in hand · Cheques due in 7 days · Vendor payable · Low-stock items · Profit today (show `PENDING` in amber when the source number is missing; never invent). Below: a 7-day sales bar chart (pure SVG you write) and a **"Needs you"** list (cheques due, bills without a phone number, low stock, vendor cheques not written). Every number/row is clickable and opens the matching screen tab.
2. **GRN** (`mod-grn.js`): reproduce `page-grn` and the `mg*` functions: supplier (pick or type, from `/api/suppliers`), date, notes, **credit days REQUIRED** (0 = pay now; or tick "Paid in cash on delivery"), item rows (name, qty, unit cost, selling price, optional photo), live total, Save → `POST /api/grn-manual` as `FormData` with a `payload` JSON string exactly as `saveManualGRN()` does (read it!). Two helper buttons above the rows: **Fill from file** (JSON/CSV/Excel via `js/lib` equivalents: use the provided `grn_import.js` logic, re-implemented inside your module; for Excel read with a tiny built-in parser or ask the user to save as CSV) and **Read photo (AI)** (`POST /api/grn-read-photo`, multipart field `file`, JPG/PNG only; returns `{supplier,date,ref,lines:[{name,qty,cost,price}],warnings,lines_total,paper_total}`). Both only FILL the rows and show a **review box** (line count, lines total vs paper total, warnings such as "Same item twice", "no quantity"). **Never auto-save.** The attach widget (`<div data-attach="grn" data-attach-id="@today">` + `attach-widget.js`) sits at the top with Upload · Download · **Remove**. After a successful save show: stock now, vendor credit/payable "cheque not written — payment pending", due date. Recent GRNs list below as a SheetGrid.
3. **Stock** (`mod-stock.js`): read `loadStock()` and `page-stock`. Items as a SheetGrid: code, name, category, qty, unit cost, selling price, min stock, status chip (OK / LOW / OUT), photo thumbnail. Editable cells only where the source lets the owner edit. Filters: category, low only, out only. Buttons: Export, Print labels (opens Barcode Labels tab), Add item (use the existing add flow from the source).
4. **Vendors** (`mod-vendors.js`): read `loadVendors()`, `loadCheques()` and `/vendor-credit.html` + `/vendor-ledger.html`. One screen with a left list of vendors (name, owed, next cheque date) and a right pane with 3 tabs: Bills · Cheques (ISSUED / CLEARED / BOUNCED / CANCELLED chips) · Forecast (owed after 1, 2, 3 months; cheques dated > 3 months out in amber). A cheque status change to BOUNCED or CANCELLED must ask for a reason (≥ 3 characters) and send it, exactly as `vendor-ledger.html` does. Payable only drops when a cheque is CLEARED. Voiding anything asks for a reason. No delete buttons for money records anywhere.

### B9. MOCK MODE (so it works in AI Studio's preview)
`js/mock.js` exports `installMock()`; `core.js` calls it automatically when `location.hostname` is not the shop's (anything except `localhost`, `127.0.0.1`, or an IP in 192.168.*) or when the URL has `?mock=1`. It replaces `window.fetch` for URLs starting with `/api/` and returns realistic Sri Lankan sample data in the SAME shapes the source expects (create the data by reading what each load function uses). Include: a user `{username:'ajmal',role:'admin',name:'Ajmal Khan'}`, 40 stock items (tiles, commodes, taps, showers, basins; LKR prices), 6 vendors (e.g. Metro Enterprises, Eskema Ceramic), 12 cheques in different statuses, 7 days of sales, 15 recent GRNs, plus 3 low-stock items. `POST/PUT/DELETE` just succeed in memory. A small orange banner "PREVIEW — sample data" shows while mock is on.

### B10. BACKEND ROUTES YOU MAY CALL (all under /api; session login). Do not call anything else.
```
GET    /api/users
POST   /api/users
PATCH  /api/users/:id
POST   /api/users/:id/disable
POST   /api/users/:id/enable
POST   /api/users/:id/reset-password
POST   /api/users/:id/force-logout
GET    /api/users/:id/login-history
GET    /api/audit
GET    /api/audit/export.csv
POST   /api/agent-brain/draft
GET    /api/agent-brain/reviews
GET    /api/agent-brain/drafts/:id/checks
PUT    /api/agent-brain/drafts/:id
POST   /api/agent-brain/drafts/:id/approve
POST   /api/agent-brain/drafts/:id/reject
GET    /api/agent-outbox
POST   /api/agent-outbox/:id/approve
POST   /api/agent-outbox/:id/reject
GET    /api/agent/rules
GET    /api/agent/rules/:id/history
POST   /api/agent/rules
PUT    /api/agent/rules/:id
POST   /api/agent/rules/:id/deactivate
GET    /api/agent/rulebook
POST   /api/api/apex/payments
GET    /api/api/apex/payments/:tenantId
POST   /api/api/apex/trial-clients
GET    /api/api/apex/tenants
PATCH  /api/api/apex/tenants/:id
GET    /api/api/apex/packages
PATCH  /api/api/apex/packages/:id
GET    /api/api/apex/fleet
POST   /api/api/apex/fleet
PATCH  /api/api/apex/fleet/:id
POST   /api/api/apex/fleet/:id/ping
POST   /api/api/apex/fleet/:id/control
GET    /api/app-settings
GET    /api/app-settings/public
PUT    /api/app-settings
POST   /api/app-settings/flag-audit
GET    /api/menu-config
PUT    /api/menu-config
POST   /api/menu-config/reset
POST   /api/attachments
GET    /api/attachments
GET    /api/attachments/zip
GET    /api/attachments/:id/download
DELETE /api/attachments/:id
GET    /api/api/audit/daily-detail
GET    /api/api/audit/summary
GET    /api/api/audit/flags
GET    /api/api/audit/workbook
GET    /api/api/audit/full-report
GET    /api/api/audit/full-report/pdf
GET    /api/backups
POST   /api/backups
GET    /api/backups/:name/download
POST   /api/restore
GET    /api/status
GET    /api/branches
POST   /api/branches
PUT    /api/branches/:id
GET    /api/branches/:id/can
GET    /api/cash-position-forecast
GET    /api/non-moving-stock
GET    /api/public/catalogue
GET    /api/public/catalogue/facets
GET    /api/catalogue-web
PUT    /api/catalogue-web/:item_code
GET    /api/cheque-clearing
GET    /api/cheque-clearing/alerts
POST   /api/cheque-clearing/:id/deposit
POST   /api/cheque-clearing/:id/personal
POST   /api/cheque-clearing/holidays
GET    /api/cheque-register
GET    /api/cheque-register/due-soon
GET    /api/cheque-register/overdue
POST   /api/cheque-register
PUT    /api/cheque-register/:id
GET    /api/competitors
POST   /api/competitors
PUT    /api/competitors/:id
DELETE /api/competitors/:id
POST   /api/competitors/:id/checks
GET    /api/competitors/due-check
GET    /api/competitors/checklist
GET    /api/content-posts
POST   /api/content-posts
PUT    /api/content-posts/:id
DELETE /api/content-posts/:id
POST   /api/content-posts/plan-week
GET    /api/modules
GET    /api/:m
GET    /api/:m/:id/history
PUT    /api/:m/:id
POST   /api/:m/:id/void
POST   /api/api/daily-entry/sync
GET    /api/api/daily-entry/sync/:date
GET    /api/api/daily-entry/meta/:date
GET    /api/api/daily-entry/range
GET    /api/daily-sales-live/today
GET    /api/daily-sales-live/:date
POST   /api/document-inbox/upload
GET    /api/document-inbox
GET    /api/document-inbox/:id/photo
PUT    /api/document-inbox/:id
POST   /api/document-inbox/:id/reread
POST   /api/document-inbox/:id/reject
POST   /api/document-inbox/:id/file
GET    /api/documents/reports
POST   /api/documents/generate
GET    /api/documents
GET    /api/documents/recipients
POST   /api/documents/recipients
PUT    /api/documents/recipients/:id
DELETE /api/documents/recipients/:id
GET    /api/documents/sends
POST   /api/documents/inbox/upload
GET    /api/documents/inbox
GET    /api/documents/inbox/:id/file
POST   /api/documents/inbox/:id/confirm
POST   /api/documents/inbox/:id/reject
GET    /api/documents/:id/download
DELETE /api/documents/:id
POST   /api/documents/:id/send
POST   /api/public/enquiry
GET    /api/enquiries
POST   /api/enquiries
PUT    /api/enquiries/:id/status
GET    /api/enquiries/summary
GET    /api/enquiries/weekly
POST   /api/grn-barcodes
POST   /api/grn-manual
POST   /api/grn-read-photo
GET    /api/investor-contacts
POST   /api/investor-contacts
DELETE /api/investor-contacts/:id
PUT    /api/investor-loans/:id/qr-balance
GET    /api/investor-loans
GET    /api/investor-loans/summary
GET    /api/investor-loans/:id
POST   /api/investor-loans
PUT    /api/investor-loans/:id
POST   /api/investor-loans/:id/payments
POST   /api/investor-loans/:id/documents
GET    /api/investor-loans/:id/documents
GET    /api/investor-loans/documents/:docId/download
DELETE /api/investor-loans/documents/:docId
GET    /api/investor-loans/:id/report/pdf
POST   /api/invoice-receipts/link
GET    /api/invoice-receipts
GET    /api/invoice-receipts/check-number
GET    /api/invoice-receipts/preview
POST   /api/invoice-receipts/send
GET    /api/items/next-code
GET    /api/items
GET    /api/items/reorder
GET    /api/items/export.csv
GET    /api/items/:code
POST   /api/items
POST   /api/items/import-csv
GET    /api/bank-accounts
POST   /api/bank-accounts
PUT    /api/bank-accounts/:id/balance
POST   /api/cheque-register/:id/hold
POST   /api/payment-breakdown
GET    /api/payment-breakdown
GET    /api/fixed-overheads
POST   /api/fixed-overheads
GET    /api/daily-reserve
GET    /api/money-allocations
POST   /api/money-allocations
PUT    /api/money-allocations/:id
POST   /api/viewer-requests
GET    /api/viewer-requests
POST   /api/viewer-requests/:id/approve
POST   /api/viewer-requests/:id/deny
GET    /api/viewer-dashboard
POST   /api/daily-cash-plan
GET    /api/daily-cash-plan
GET    /api/dashboard
GET    /api/notifications
POST   /api/notifications/dismiss
POST   /api/payment-planner/preview
POST   /api/payment-planner/save
GET    /api/payment-planner/outstanding
GET    /api/policy-notes
GET    /api/policy-notes/alerts
POST   /api/policy-notes
PUT    /api/policy-notes/:id
DELETE /api/policy-notes/:id
POST   /api/pos-bills/:id/void
PUT    /api/pos-bills/:id
GET    /api/pos-bills/:id/history
GET    /api/pos-bills/discount-cap
POST   /api/pos-bills
GET    /api/pos-bills/today
GET    /api/pos-bills/summary
GET    /api/pos-bills/top-items
GET    /api/pos-bills
GET    /api/pos-bills/:id
GET    /api/pos-bills/:id/pdf
GET    /api/pos-ledger/cheques
POST   /api/pos-ledger/cheques/:id/claim
POST   /api/pos-ledger/cheques/:id/done
POST   /api/pos-ledger/cheques/:id/release
GET    /api/pos-ledger/credit
GET    /api/pos-ledger/quotation-billed
GET    /api/api/purchase-orders
POST   /api/api/purchase-orders
PATCH  /api/api/purchase-orders/:id
GET    /api/api/po-grn-matches
GET    /api/api/supplier-prices
POST   /api/api/supplier-prices
GET    /api/api/supplier-prices/best
GET    /api/api/supplier-aging
GET    /api/api/landed-costs
POST   /api/api/landed-costs
GET    /api/api/shipments
POST   /api/api/shipments
PATCH  /api/api/shipments/:id
GET    /api/api/chart-of-accounts
POST   /api/api/chart-of-accounts
PATCH  /api/api/chart-of-accounts/:code
GET    /api/api/journal-entries
POST   /api/api/journal-entries
GET    /api/api/ledger/:account_code
GET    /api/api/trial-balance
GET    /api/api/pnl
GET    /api/api/balance-sheet
GET    /api/api/vat-report
GET    /api/api/bank-transactions
POST   /api/api/bank-transactions
PATCH  /api/api/bank-transactions/:id/match
GET    /api/api/cheque-calendar
GET    /api/api/petty-cash
POST   /api/api/petty-cash
GET    /api/api/expense-budgets
POST   /api/api/expense-budgets
GET    /api/api/year-end-closings
POST   /api/api/year-end-closings
GET    /api/reply-drafts
POST   /api/reply-drafts
PUT    /api/reply-drafts/:id
POST   /api/reply-drafts/:id/approve
POST   /api/reply-drafts/:id/reject
POST   /api/reply-drafts/:id/mark-sent
GET    /api/salary/settings
PUT    /api/salary/settings
GET    /api/salary/today
POST   /api/salary/cheque-cover/:id
GET    /api/salary/month
POST   /api/salary/month/:ym/close
GET    /api/salary/price-check
GET    /api/salary/overview
POST   /api/sale-commissions
POST   /api/sale-commissions/:id/return
GET    /api/sale-commissions
GET    /api/sale-commissions/weekly-summary
GET    /api/credit-limits
POST   /api/credit-limits
GET    /api/credit-limits/:customer_name
GET    /api/discount-rules
POST   /api/discount-rules
POST   /api/discount-check
GET    /api/stock-items
GET    /api/stock-items/low-stock
POST   /api/stock-items
POST   /api/stock-items/:id/adjust
POST   /api/receipt-queue
GET    /api/receipt-queue
POST   /api/receipt-queue/:id/image
GET    /api/receipt-queue/:id/image
POST   /api/receipt-queue/:id/send
GET    /api/robots.txt
GET    /api/sitemap.xml
GET    /api/site
GET    /api/api/site/catalogue.pdf
GET    /api/site/public
GET    /api/site/photo/:file
GET    /api/site/tiles
POST   /api/site/tiles
PUT    /api/site/tiles/:id
DELETE /api/site/tiles/:id
POST   /api/site/tiles/:id/photo
DELETE /api/site/tiles/:id/photo
GET    /api/site/text
PUT    /api/site/text
GET    /api/attendance
POST   /api/attendance
GET    /api/leave
POST   /api/leave
PATCH  /api/leave/:id
GET    /api/advances
POST   /api/advances
GET    /api/payroll-export
GET    /api/commission-autocalc
GET    /api/monthly-trends
GET    /api/daily-digest
GET    /api/cashflow-forecast
GET    /api/customer-ltv
GET    /api/heatmap
GET    /api/margin-by-product
GET    /api/top-slow-items
GET    /api/sync/status
POST   /api/sync/needs-review
GET    /api/sync/review
POST   /api/sync/review/:id/resolve
POST   /api/tools/tile-estimate
POST   /api/tools/price-per-sqm
# --- core routes defined in server.js ---
DELETE /api/daily-summary/:date/files/:filename
DELETE /api/grn/:id
GET    /api/admin/files
GET    /api/admin/files/:filename/download
GET    /api/agent-status
GET    /api/alerts
GET    /api/all-monthly-chart
GET    /api/all-time-stats
GET    /api/audit-log
GET    /api/auth/totp-setup
GET    /api/auth/totp-status
GET    /api/branding
GET    /api/calendar
GET    /api/cheques
GET    /api/conversations/:phone
GET    /api/credit-customers
GET    /api/credit-list
GET    /api/customers
GET    /api/customers/:phone
GET    /api/daily-summary
GET    /api/daily-summary/:date
GET    /api/daily-summary/:date/files
GET    /api/daily-summary/:date/files/:filename/download
GET    /api/error-log
GET    /api/expenses-detail
GET    /api/feature-flags
GET    /api/file-ledger
GET    /api/financial-health
GET    /api/grn
GET    /api/home-stats
GET    /api/layla-summary
GET    /api/leads
GET    /api/me
GET    /api/monthly-chart
GET    /api/monthly-detail
GET    /api/nova-weekly
GET    /api/packages
GET    /api/pay-period-summary
GET    /api/products
GET    /api/purchases-today
GET    /api/query
GET    /api/quinn-gp
GET    /api/quotations
GET    /api/quotations/:id
GET    /api/reorder-alerts
GET    /api/report-download
GET    /api/report-download-range
GET    /api/reports
GET    /api/setup/status
GET    /api/staff
GET    /api/staff/:id/loans
GET    /api/staff/:id/salary
GET    /api/stats
GET    /api/suppliers
GET    /api/suppliers/:id/payments
GET    /api/users
GET    /api/vera-alerts
GET    /api/weekly-chart
GET    /api/weekly-detail
PATCH  /api/alerts/:id/read
PATCH  /api/cheques/:id/status
PATCH  /api/daily-summary/:date/field
PATCH  /api/feature-flags/:key
PATCH  /api/grn/:id
PATCH  /api/leads/:id/status
PATCH  /api/users/:id
POST   /api/admin/blend-gp-retroactive
POST   /api/admin/rescan-uploads
POST   /api/admin/upload
POST   /api/admin/verify
POST   /api/agent-status
POST   /api/alerts/:id/set-amount
POST   /api/auth/change-password
POST   /api/auth/totp-disable
POST   /api/auth/totp-setup
POST   /api/auth/verify-totp
POST   /api/checker-run
POST   /api/cheques
POST   /api/credit-customers
POST   /api/customers
POST   /api/daily-close
POST   /api/daily-summary
POST   /api/daily-summary/:date/files
POST   /api/dashboard-assistant/chat
POST   /api/grn
POST   /api/inbox-upload
POST   /api/login
POST   /api/logout
POST   /api/nl-query
POST   /api/process-inbox
POST   /api/quotations
POST   /api/recon-check
POST   /api/reports
POST   /api/setup/complete
POST   /api/staff
POST   /api/staff/:id/salary
POST   /api/suppliers
POST   /api/users
PUT    /api/customers/:id
PUT    /api/quotations/:id/status
```

### B11. HARD RULES — do not break any
- Do NOT change any URL, request body or response shape. Front end only.
- No invented numbers. Missing data → `PENDING` (amber). Errors → plain sentence + Retry.
- Money rules (display only; never recompute differently): cash out = expenses + supplier payments; net profit = gross profit − expenses; supplier payments are NOT expenses; vendor payable falls only when a cheque CLEARS.
- AI/photo/file imports **never auto-save**; review first, then the owner presses Save.
- No delete for money records (void with a reason only). Uploaded files are **Removed** (hidden), never erased; always show Upload + Download + Remove together via the attach widget (`<div data-attach="TYPE" data-attach-id="ID">`; TYPE one of daily_sales, stock, grn, expense, cheque, vendor, pos_bill, money_control, loan, salary, document_inbox, general).
- Never hard-code secrets, keys, phone numbers or real customer data.
- Keep each module isolated: one module's bug must not break another (wrap init in try/catch and show an error card inside that tab only).
- Tests in your head before you answer: (1) every screen in B6 is reachable from at least one menu; (2) every menu item opens something; (3) phone width works; (4) the preview works with mock data; (5) no file is cut off; (6) no endpoint outside B10 is called.

### B12. HOW TO ANSWER
1. First, in ≤ 15 lines, restate the plan and list the files you will output.
2. Then output each file as a fenced block preceded by its exact path, e.g. `### FILE: js/core.js`.
3. Finish with `CHECKLIST` (the 6 tests above, each PASS/FAIL honestly) and `NOT BUILT YET` (if any).
Be exact, not creative with the backend; be excellent with the design.

