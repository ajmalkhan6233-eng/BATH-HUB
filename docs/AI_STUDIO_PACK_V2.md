# GOOGLE AI STUDIO PACK — ROYAL BATH HUB (ERP + POS) REDESIGN

════════════════════════════════════════════
## PART A — FOR AJ (owner). Do exactly this, nothing else.
1. Open https://aistudio.google.com → **Build** → start a **NEW blank app**. Do NOT use "Import from GitHub" this time.
2. Choose the strongest model. Output length: maximum.
3. Upload THIS file (or paste it). Then send this one message:
   `Read the attached file completely. Ignore your default React/Vite template: build PLAIN static HTML + CSS + vanilla JS exactly as PART B says, inside a folder app_v2/. Do everything in PART B in one attempt, complete files.`
4. When it finishes, send: `Now push everything to GitHub: repo BATH-HUB, NEW branch ai-studio-build. NOT master, NOT work. Commit message "AI Studio redesign v1".` (If AI Studio asks which branch: type ai-studio-build and choose "create new branch".)
5. Tell Claude: `ai-studio-build is pushed.` Claude then checks and shows you a preview link.

════════════════════════════════════════════
## PART B — INSTRUCTIONS FOR GEMINI (read every word; you get ONE attempt)
════════════════════════════════════════════

### B0. THE REAL SOURCE IS AT THE END OF THIS FILE (PART C)
Read PART C first: `public/bathco_complete.html` (main app), `attach-widget.js`, `grn_import.js`, `vendor-ledger.html`, `vendor-credit.html`. They are the truth for CSS variables, endpoints and behaviour. Pages that are not included (pos_billing.html, assistant.html, etc.) stay as frames via the Legacy Bridge.

### B1. WHO YOU ARE WORKING FOR
You are the senior ERP/POS UX architect and front-end engineer for **Royal Bath Hub**, a real tile and bathroom-fittings shop on Kandy Road, Thihariya, Sri Lanka (opened 15 Oct 2026). The owner, Ajmal Khan, runs it from a Windows PC browser and an iPhone. Staff: owner, one manager, a few sales people. It is a halal business with honest records. The software is live and holds real money data, so **correctness and safety beat novelty**.

### B2. WHAT EXISTS TODAY
A Node/Express + PostgreSQL web app. The front end is plain HTML/CSS/JS (no framework, no build step), served as static files from /public. The main file is `bathco_complete.html` (a single-page app with a flat sidebar of 27 items), plus ~60 standalone pages. You have the real source in PART C. Do not guess anything: read it first (B0).
The owner's complaint, in his words: *"Dashboard, POS billing, daily ledger, daily sales, stock, barcode labels, GRN… it is not convenient. Lasersoft-style ERP and accounting audit are not reachable. Layla is at the bottom. I want the classic format — File, Edit, View — and Excel-sheet style where I can control a lot of things. Rearrange the whole software like a proper standard ERP and POS system. Polished, pro level."*

### B3. YOUR JOB (one deliverable)
Build a **NEW APP SHELL** with a classic ERP layout, plus a small number of **native, polished modules**, and a **Legacy Bridge** so that EVERY existing screen is still reachable from the new menus on day one. Nothing may be lost. Do not rewrite money logic. Do not change the backend.

**Why this scope:** the existing screens work and carry real money logic. A full rewrite in one go would break them. So: new shell + 4 rebuilt modules + every other screen opened inside the shell through iframes (the Legacy Bridge). Later versions replace the iframes one by one.

### B4. TECH RULES (strict)
- **Plain static files: HTML + CSS + vanilla JavaScript (ES modules). No React, no Vite, no npm, no build step, no CDN, no external fonts or images.** The files must run when simply copied into the shop's /public folder. (If the AI Studio template forces React, still output plain static files as asked here.)
- **Put every new file inside a NEW folder `app_v2/`** (e.g. `app_v2/app.html`, `app_v2/css/shell.css`, `app_v2/js/core.js`). Do NOT edit, move or delete any existing file in the GitHub repo you push to. The old app keeps running untouched; Claude Code copies `app_v2/` into place after testing. All paths below are relative to `app_v2/`, and inside the files use relative links only (`css/shell.css`, `js/core.js`) so the folder works anywhere.
- Output exactly these files, each COMPLETE (never truncated, never "…rest unchanged"):
  1. `app.html` — the shell: menu bar, tabs, status bar, frame host, login gate, mock switch.
  2. `css/shell.css` — all styling, CSS variables, light/dark, responsive.
  3. `js/core.js` — router, tab manager, menu tree, keyboard shortcuts, role handling, toast, confirm, api(), mock switch.
  4. `js/grid.js` — the reusable Excel-style grid component (spec in B7).
  5. `js/mock.js` — fake-data layer (spec in B9) used ONLY in preview.
  6. `js/mod-dashboard.js`, `js/mod-grn.js`, `js/mod-stock.js`, `js/mod-vendors.js` — the four native modules (spec in B8).
  7. `js/legacy.js` — the Legacy Bridge table (copy B6 exactly).
  8. `README_INSTALL.md` — 10 lines: copy the whole `app_v2/` folder to `/public/app_v2/` on the shop server, open `/app_v2/app.html`, and how to test (also `?mock=1` for sample data).
- **If you are running out of output space:** finish the file you are writing completely, then add at the very end a section `NOT BUILT YET:` listing the files left. Never cut a file in half. Build in this priority order: core.js → shell.css → app.html → legacy.js → grid.js → mock.js → mod-grn.js → mod-dashboard.js → mod-stock.js → mod-vendors.js → README_INSTALL.md.
- Backend contract: call the SAME endpoints with the SAME request/response shapes already used in the source code in PART C and listed in B10. **Do not invent endpoints.** If you need data and no endpoint exists, show a clear "Not available yet" state.
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

**Look and feel:** professional ERP, calm and dense but clean. Keep the brand: gold `#F5A623` on near-black `#0D0D0D` (dark) and a clean light theme `#f4f5f7`; copy the CSS variables from `public/bathco_complete.html`'s `:root` (PART C) so colours stay identical. Subtle borders, 8-px spacing grid, 14 px base font, tabular numbers for money (right-aligned, `font-variant-numeric: tabular-nums`). No heavy animation; 150 ms transitions only. Empty states with one clear action. Skeleton loading rows. Errors in plain words with a retry button.

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

### B8. THE FOUR NATIVE MODULES — read the real code in the source files in PART C and reproduce its behaviour exactly
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
POST   /api/apex/payments
GET    /api/apex/payments/:tenantId
POST   /api/apex/trial-clients
GET    /api/apex/tenants
PATCH  /api/apex/tenants/:id
GET    /api/apex/packages
PATCH  /api/apex/packages/:id
GET    /api/apex/fleet
POST   /api/apex/fleet
PATCH  /api/apex/fleet/:id
POST   /api/apex/fleet/:id/ping
POST   /api/apex/fleet/:id/control
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
GET    /api/audit/daily-detail
GET    /api/audit/summary
GET    /api/audit/flags
GET    /api/audit/workbook
GET    /api/audit/full-report
GET    /api/audit/full-report/pdf
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
POST   /api/daily-entry/sync
GET    /api/daily-entry/sync/:date
GET    /api/daily-entry/meta/:date
GET    /api/daily-entry/range
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
GET    /api/purchase-orders
POST   /api/purchase-orders
PATCH  /api/purchase-orders/:id
GET    /api/po-grn-matches
GET    /api/supplier-prices
POST   /api/supplier-prices
GET    /api/supplier-prices/best
GET    /api/supplier-aging
GET    /api/landed-costs
POST   /api/landed-costs
GET    /api/shipments
POST   /api/shipments
PATCH  /api/shipments/:id
GET    /api/chart-of-accounts
POST   /api/chart-of-accounts
PATCH  /api/chart-of-accounts/:code
GET    /api/journal-entries
POST   /api/journal-entries
GET    /api/ledger/:account_code
GET    /api/trial-balance
GET    /api/pnl
GET    /api/balance-sheet
GET    /api/vat-report
GET    /api/bank-transactions
POST   /api/bank-transactions
PATCH  /api/bank-transactions/:id/match
GET    /api/cheque-calendar
GET    /api/petty-cash
POST   /api/petty-cash
GET    /api/expense-budgets
POST   /api/expense-budgets
GET    /api/year-end-closings
POST   /api/year-end-closings
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
GET    /api/site/catalogue.pdf
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

### B11b. BUILD AND PUSH (you do this yourself)
After the files are complete: (1) run the app in the preview in mock mode and fix any console error; (2) walk the 6 tests in B11 and fix every FAIL; (3) commit ALL files under `app_v2/` to GitHub on a NEW branch named `ai-studio-build` with message "AI Studio redesign v1" using AI Studio's GitHub save/commit feature; (4) never commit to `main` or `work`, never touch files outside `app_v2/`, never commit secrets; (5) if pushing is not possible, say so plainly and list the exact files so the owner can download them.

### B12. HOW TO ANSWER
1. First, in ≤ 15 lines, restate the plan and list the files you will output.
2. Then output each file as a fenced block preceded by its exact path, e.g. `### FILE: js/core.js`.
3. After the files, push as in B11b and say the branch name and commit. Finish with `CHECKLIST` (the 6 tests above, each PASS/FAIL honestly) and `NOT BUILT YET` (if any).
Be exact, not creative with the backend; be excellent with the design.


════════════════════════════════════════════
## PART C — REAL SOURCE CODE (read it; reproduce behaviour; do not output it back)
════════════════════════════════════════════


---
### SOURCE FILE: public/attach-widget.js
```js
/* attach-widget.js: ONE shared widget: [Take photo] [Upload file] [Download] for any record.
   Use:  <div data-attach="stock" data-attach-id="general"></div>   (auto-mounted)   or   AttachWidget.mount(el, { type, id })
   data-attach-id may be "@today" (today's date) or "@month" (this month).
   Files go to /api/attachments (login required, 10 MB, photos / PDF / xlsx / csv). The upload step is replaceable:
   AttachWidget.setUploader(async (file, meta) => result) lets the offline queue take over without changing the screens. */
(function () {
  'use strict';
  var MAX = 10 * 1024 * 1024;
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var kb = function (n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; };
  var css = '.aw{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:14px;margin:6px 0}' +
    '.aw button{font:inherit;padding:5px 10px;border-radius:8px;border:1px solid var(--card-border,#c9bfae);background:var(--card,#fff);color:inherit;cursor:pointer}' +
    '.aw button:hover{filter:brightness(1.1)}.aw .aw-msg{font-size:12px;opacity:.85}.aw .aw-err{color:#c62828}' +
    '.aw-list{flex-basis:100%;margin:4px 0 0;padding:0;list-style:none;font-size:12px}' +
    '.aw-list li{display:flex;gap:8px;justify-content:space-between;align-items:center;padding:4px 0;border-top:1px solid var(--card-border,#e5dfd2)}' +
    '.aw-list a{color:inherit;font-weight:600}';
  var styled = false;
  function addCss() { if (styled) return; styled = true; var s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); }

  function resolveId(id) {
    var d = new Date(), p = function (n) { return String(n).padStart(2, '0'); };
    if (id === '@today') return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    if (id === '@month') return d.getFullYear() + '-' + p(d.getMonth() + 1);
    return String(id == null || id === '' ? 'general' : id);
  }

  // default uploader: straight to the server. Returns the saved attachment, or throws Error(message).
  var uploader = async function (file, meta) {
    var fd = new FormData();
    fd.append('record_type', meta.type); fd.append('record_id', meta.id);
    if (meta.clientUuid) fd.append('client_uuid', meta.clientUuid);
    fd.append('file', file, file.name || 'photo.jpg');
    var r = await fetch('/api/attachments', { method: 'POST', body: fd });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(j.error || ('Upload failed (' + r.status + ')'));
    return j;
  };

  function mount(el, opts) {
    addCss();
    if (!document.getElementById('bh-sprite') && !document.querySelector('script[src="/bathhub-icons.js"]')) { var ic = document.createElement('script'); ic.src = '/bathhub-icons.js'; document.head.appendChild(ic); }   // icons for pages that do not load the design files
    var state = { type: opts.type, id: resolveId(opts.id), open: false, files: [] };
    el.__aw = state; el.classList.add('aw');
    el.innerHTML = '<button type="button" data-a="photo"><svg class="bh-icon" aria-hidden="true"><use href="#i-camera"/></svg> Take photo</button><button type="button" data-a="upload"><svg class="bh-icon" aria-hidden="true"><use href="#i-upload"/></svg> Upload file</button>' +
      '<button type="button" data-a="dl"><svg class="bh-icon" aria-hidden="true"><use href="#i-download"/></svg> Download</button><span class="aw-msg"></span><ul class="aw-list" hidden></ul>' +
      '<input type="file" accept="image/*" capture="environment" hidden data-i="photo"><input type="file" accept="image/*,application/pdf,.pdf,.xlsx,.csv" hidden data-i="upload">';
    var msg = el.querySelector('.aw-msg'), list = el.querySelector('.aw-list');
    function say(t, bad) { msg.textContent = t || ''; msg.className = 'aw-msg' + (bad ? ' aw-err' : ''); }
    async function refresh() {
      try {
        var r = await fetch('/api/attachments?record_type=' + encodeURIComponent(state.type) + '&record_id=' + encodeURIComponent(state.id));
        if (!r.ok) { state.files = []; return render(); }
        state.files = await r.json();
      } catch (e) { /* offline: keep what we have */ }
      render();
    }
    function render() {
      el.querySelector('[data-a=dl]').innerHTML = '<svg class="bh-icon" aria-hidden="true"><use href="#i-download"/></svg> Download' + (state.files.length ? ' (' + state.files.length + ')' : '');
      list.hidden = !state.open;
      if (!state.open) return;
      list.innerHTML = state.files.length
        ? state.files.map(function (f) { return '<li><span>' + esc(f.filename) + ' <span style="opacity:.7">' + kb(f.size) + '</span></span><a href="' + esc(f.download_url) + '" download>Download</a></li>'; }).join('') +
          '<li><span></span><a href="/api/attachments/zip?record_type=' + encodeURIComponent(state.type) + '&record_id=' + encodeURIComponent(state.id) + '">Download all as .zip</a></li>'
        : '<li><span>No files attached here yet.</span></li>';
    }
    list.addEventListener('click', async function (ev) {
      var a = ev.target.closest && ev.target.closest('[data-rm]'); if (!a) return;
      ev.preventDefault();
      if (!confirm('Remove this file from here? It is hidden, not erased, and the removal is logged.')) return;
      try {
        var r = await fetch('/api/attachments/' + encodeURIComponent(a.getAttribute('data-rm')), { method: 'DELETE', credentials: 'same-origin' });
        var j = await r.json().catch(function () { return {}; });
        if (!r.ok) throw new Error(j.error || 'Could not remove');
        say('Removed.'); await refresh();
      } catch (e) { say(e.message, true); }
    });
    async function send(file) {
      if (!file) return;
      if (file.size > MAX) return say('That file is bigger than 10 MB.', true);
      say('Uploading ' + (file.name || 'photo') + '…');
      try {
        var res = await uploader(file, { type: state.type, id: state.id, clientUuid: (self.crypto && crypto.randomUUID) ? crypto.randomUUID() : null });
        say(res && res.queued ? 'Saved on this device. Waiting to sync.' : 'Attached.');
        await refresh();
      } catch (e) { say(e.message, true); }
    }
    el.addEventListener('click', function (ev) {
      var b = ev.target.closest('button[data-a]'); if (!b) return;
      var a = b.getAttribute('data-a');
      if (a === 'photo') el.querySelector('[data-i=photo]').click();
      else if (a === 'upload') el.querySelector('[data-i=upload]').click();
      else { state.open = !state.open; if (state.open) refresh(); else render(); }
    });
    el.addEventListener('change', function (ev) { var i = ev.target; if (i.matches && i.matches('input[type=file]')) { send(i.files[0]); i.value = ''; } });
    el.__awRefresh = refresh;
    refresh();
    return el;
  }

  function setRecord(el, id) { if (el.__aw) { el.__aw.id = resolveId(id); el.__awRefresh(); } }
  function scan(root) {
    (root || document).querySelectorAll('[data-attach]').forEach(function (el) {
      if (!el.__aw) mount(el, { type: el.getAttribute('data-attach'), id: el.getAttribute('data-attach-id') });
    });
  }
  window.AttachWidget = { mount: mount, scan: scan, setRecord: setRecord, setUploader: function (fn) { uploader = fn; }, resolveId: resolveId };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { scan(); }); else scan();
})();
```


---
### SOURCE FILE: public/lib/grn_import.js
```js
/* GRN import helper: turns a typed invoice (JSON / CSV rows / sheet rows) or an
 * OCR result into GRN screen rows. Pure functions, no DOM. Never saves anything. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GrnImport = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  var NAME = ['name', 'item', 'item_name', 'itemname', 'description', 'desc', 'product', 'particulars'];
  var QTY = ['qty', 'quantity', 'qnty', 'nos', 'units'];
  var COST = ['unit_cost', 'unitcost', 'cost', 'unit_price', 'unitprice', 'price', 'rate', 'unit rate'];
  var TOTAL = ['line_total', 'linetotal', 'amount', 'total', 'value'];
  var SELL = ['selling_price', 'sell_price', 'sale_price', 'retail_price'];

  function norm(k) { return String(k).trim().toLowerCase().replace(/[\s\-]+/g, '_'); }
  function pick(o, keys) {
    var m = {}; Object.keys(o || {}).forEach(function (k) { m[norm(k)] = o[k]; });
    for (var i = 0; i < keys.length; i++) { var v = m[keys[i].replace(/ /g, '_')]; if (v !== undefined && v !== null && v !== '') return v; }
    return undefined;
  }
  function num(v) {
    if (v === undefined || v === null || v === '') return null;
    var n = parseFloat(String(v).replace(/[,\s]/g, '').replace(/[\/\-]+$/, ''));
    return isFinite(n) ? n : null;
  }
  function isoDate(v) {
    if (!v) return '';
    var s = String(v).trim(), m;
    if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return m[1] + '-' + m[2] + '-' + m[3];
    if ((m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/))) // Sri Lanka: day first
      return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
    return '';
  }
  function key(s) { return String(s || '').trim().toLowerCase().replace(/\s+/g, ' '); }

  function fromLines(arr) {
    var lines = [];
    (arr || []).forEach(function (r) {
      if (!r || typeof r !== 'object') return;
      var name = pick(r, NAME); if (name === undefined) return;
      var qty = num(pick(r, QTY)), cost = num(pick(r, COST)), tot = num(pick(r, TOTAL));
      if (cost === null && tot !== null && qty) cost = Math.round(tot / qty * 100) / 100;
      lines.push({ name: String(name).trim(), qty: qty, cost: cost, price: num(pick(r, SELL)), line_total: tot });
    });
    return lines;
  }

  // input: object (parsed JSON) or array of row objects (CSV/sheet)
  function build(input) {
    var head = Array.isArray(input) ? {} : (input || {});
    var arr = Array.isArray(input) ? input : (head.lines || head.items || head.line_items || head.rows || []);
    var lines = fromLines(arr);
    var out = {
      supplier: String(pick(head, ['supplier', 'supplier_name', 'vendor', 'vendor_name']) || '').trim(),
      date: isoDate(pick(head, ['date', 'grn_date', 'invoice_date'])),
      ref: String(pick(head, ['invoice_no', 'invoice_number', 'ref', 'reference', 'bill_no', 'grn_number']) || '').trim(),
      paper_total: num(pick(head, ['total', 'grand_total', 'invoice_total', 'net_total'])),
      credit_days: num(pick(head, ['credit_days', 'terms_days'])),
      lines: lines, warnings: []
    };
    return check(out);
  }

  function check(out) {
    var w = out.warnings = [];
    if (!out.lines.length) w.push('No item lines found in this file.');
    var seen = {}, dup = {};
    out.lines.forEach(function (l, i) {
      var k = key(l.name);
      if (!k) w.push('Line ' + (i + 1) + ' has no item name.');
      else if (seen[k]) dup[l.name] = true; else seen[k] = true;
      if (!l.qty || l.qty <= 0) w.push('Line ' + (i + 1) + ' (' + l.name + ') has no quantity.');
      if (l.cost === null || l.cost < 0) w.push('Line ' + (i + 1) + ' (' + l.name + ') has no unit cost.');
    });
    Object.keys(dup).forEach(function (n) { w.push('Same item twice: "' + n + '". The GRN refuses a repeated name. Merge or rename one.'); });
    var sum = 0; out.lines.forEach(function (l) { sum += (l.qty || 0) * (l.cost || 0); });
    out.lines_total = Math.round(sum * 100) / 100;
    if (out.paper_total !== null && Math.abs(out.paper_total - out.lines_total) > 10)
      w.push('Lines add up to ' + out.lines_total + ' but the paper total is ' + out.paper_total + '. Check before saving.');
    if (!out.supplier) w.push('Supplier name not found: pick it yourself.');
    if (!out.date) w.push('Date not found: set it yourself.');
    return out;
  }

  function parseCsv(text) {
    var rows = [], row = [], cur = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) { if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some(function (x) { return x !== ''; })) rows.push(row); row = []; }
      else cur += c;
    }
    row.push(cur); if (row.some(function (x) { return x !== ''; })) rows.push(row);
    if (rows.length < 2) return [];
    var h = rows[0];
    return rows.slice(1).map(function (r) { var o = {}; h.forEach(function (k, i) { o[k] = r[i]; }); return o; });
  }

  function fromText(text, filename) {
    var t = String(text || '').replace(/^﻿/, '');
    if (/\.json$/i.test(filename || '') || /^\s*[\[{]/.test(t)) return build(JSON.parse(t));
    return build(parseCsv(t));
  }

  // OCR result from scripts/ocr_photo.js
  function fromOcr(doc) {
    doc = doc || {};
    var o = build({
      supplier: doc.supplier_name || doc.vendor_name || '', date: doc.date,
      invoice_no: doc.grn_number || doc.invoice_number || doc.bill_number || '',
      total: doc.total != null ? doc.total : doc.grand_total,
      lines: (doc.items || []).map(function (it) {
        return { name: it.name || it.description, qty: it.qty != null ? it.qty : it.quantity,
                 unit_cost: it.unit_cost != null ? it.unit_cost : it.unit_price, amount: it.amount };
      })
    });
    o.warnings.unshift('Read by AI from a photo. It can misread digits. Check every line against the paper.');
    if (doc.confidence === 'low') o.warnings.unshift('The AI said the photo was hard to read' + (doc.notes ? ': ' + doc.notes : '') + '.');
    return o;
  }

  return { build: build, check: check, fromText: fromText, fromOcr: fromOcr, parseCsv: parseCsv };
});

```


---
### SOURCE FILE: public/vendor-ledger.html
```html
<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Vendor ledger | Royal Bath Hub</title>
<style>
:root{--bg:#F6EFDC;--ink:#0B1B3A;--card:#fffdf7;--line:rgba(11,27,58,.15);--gold:#C9A24B;--red:#b3261e;--green:#1b7a46;--muted:#5b6070;padding-top:env(safe-area-inset-top,0);padding-bottom:env(safe-area-inset-bottom,0)}
@media(prefers-color-scheme:dark){:root{--bg:#0a1632;--ink:#F6EFDC;--card:#10224a;--line:rgba(232,207,138,.25);--muted:#b7bccb}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;font-variant-numeric:tabular-nums}
main{max-width:720px;margin:0 auto;padding:14px}h1{font-size:22px;margin:6px 0 12px}h2{font-size:17px;margin:20px 0 8px}
.grid{display:grid;gap:10px;grid-template-columns:repeat(2,1fr)}.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px}
.big{font-size:22px;font-weight:700}.sm{color:var(--muted);font-size:14px}.bad{color:var(--red)}.good{color:var(--green)}
input,select,button{font:inherit;color:inherit;min-height:44px;border-radius:10px;border:1px solid var(--line);background:var(--card);padding:8px 10px;max-width:100%}
button{background:var(--gold);color:#0B1B3A;font-weight:600;cursor:pointer;border:0}button.ghost{background:transparent;color:var(--ink);border:1px solid var(--line)}
.row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.chip{display:inline-block;padding:2px 10px;border-radius:99px;font-size:13px;border:1px solid var(--line)}
.bill{border-top:1px solid var(--line);padding:10px 0}.wrap{overflow-x:auto}form.add{display:grid;gap:8px;grid-template-columns:1fr 1fr}form.add .full{grid-column:1/-1}
details{margin:8px 0}summary{cursor:pointer;min-height:44px;display:flex;align-items:center}
</style><link rel="stylesheet" href="/design2_legacy.css">
</head><body><main>
<h1>Vendor ledger</h1>
<div id="msg" class="sm" role="status"></div><div id="saved" class="sm" role="status"></div>
<div class="row"><label>Cash on hand <input id="cash" type="number" inputmode="decimal" min="0" placeholder="0"></label><button id="go">Check</button><a class="sm" href="/api/vendor-ledger/export.csv">Download CSV</a></div>
<h2>Money owed</h2><div class="grid" id="tot"></div>
<h2>Cheques due</h2><div class="grid" id="cal"></div><div id="bulk" class="sm"></div>
<h2>Warnings</h2><div id="warn" class="sm">None</div>
<h2>Vendors</h2><div id="ven" class="wrap"></div>
<h2>Bills</h2>
<details><summary>Add a bill</summary>
<form class="add" id="billForm"><input class="full" name="vendor_name" placeholder="Vendor" required><input name="bill_no" placeholder="Bill no."><input name="total" type="number" step="0.01" min="0.01" placeholder="Total" required>
<label>Bill date<input name="bill_date" type="date" required></label><label>Due date<input name="due_date" type="date"></label><input class="full" name="notes" placeholder="Notes"><button class="full">Save bill</button></form></details>
<div id="bills"></div>
</main>
<script>
const $=(i)=>document.getElementById(i);const money=(n)=>'Rs. '+Math.round(Number(n)||0).toLocaleString('en-US');
const el=(t,o={},...k)=>{const e=document.createElement(t);Object.entries(o).forEach(([a,v])=>{if(a==='class')e.className=v;else if(a==='on')Object.entries(v).forEach(([x,f])=>e.addEventListener(x,f));else e.setAttribute(a,v)});k.flat().forEach(c=>e.append(c instanceof Node?c:document.createTextNode(String(c))));return e};
async function api(path,opt){if(opt&&opt.method&&opt.method!=='GET'&&window.OfflineSave){let body;try{body=opt.body?JSON.parse(opt.body):undefined}catch(_){body=undefined}const o=await OfflineSave.post('/api/vendor-ledger'+path,body,{method:opt.method});if(!o.ok)throw new Error(o.error||'Not saved');if(o.queued){$('msg').textContent='Saved on this phone, will sync';return{queued:true}}return o.response||{}}const r=await fetch('/api/vendor-ledger'+path,{credentials:'same-origin',headers:{'Content-Type':'application/json'},...opt});if(r.status===401){$('msg').textContent='Please log in to the owner app first.';throw new Error('401')}const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Error '+r.status);return j}
const stat=(label,val,cls='')=>el('div',{class:'card'},el('div',{class:'sm'},label),el('div',{class:'big '+cls},money(val)));
async function load(){
  try{
    const cash=Number($('cash').value||0);
    const [s,c,g,k,b]=await Promise.all([api('/summary'),api('/calendar'),api(`/cash-gap?cash=${cash}&days=2`),api('/checks'),api('/bills')]);
    $('tot').replaceChildren(stat('Payable',s.totals.outstanding),stat('Covered by cheque (not cleared)',s.totals.covered),stat('Cleared by cheque',s.totals.cleared),stat('Not covered',s.totals.uncovered,s.totals.uncovered>0?'bad':''),stat(`Cash short, next ${g.days} days`,g.gap,g.gap>0?'bad':'good'));
    $('cal').replaceChildren(stat('Today',c.today),stat('Tomorrow',c.tomorrow),stat('Monday '+c.monday.date,c.monday.amount),stat(`Overdue (${c.overdue.count})`,c.overdue.amount,c.overdue.count?'bad':''),stat('Next 7 days',c.windows[7]),stat('Next 14 days',c.windows[14]),stat('Next 30 days',c.windows[30]));
    $('bulk').textContent=c.bulkDays.length?'Bulk days: '+c.bulkDays.map(d=>d.date+' '+money(d.amount)).join(', '):'';
    const w=[];k.duplicates.sameNumber.forEach(p=>w.push(`Same cheque number on cheques ${p.join(' and ')}`));k.duplicates.likely.forEach(p=>w.push(`Possible duplicate: cheques ${p.join(' and ')}`));k.warnings.forEach(x=>w.push(`Cheque ${x.id}: ${x.flags.join(', ')}`));
    $('warn').replaceChildren(...(w.length?w.map(t=>el('div',{},t)):['None']));
    $('ven').replaceChildren(el('table',{width:'100%'},...s.vendors.map(v=>el('tr',{},el('td',{},v.vendor),el('td',{style:'text-align:right'},money(v.outstanding)),el('td',{class:'sm',style:'text-align:right'},'cleared '+money(v.cleared)+' | not covered '+money(v.uncovered))))));
    $('bills').replaceChildren(...b.map(bill=>el('div',{class:'bill'},
      el('div',{class:'row'},el('b',{},bill.vendor_name),el('span',{class:'chip'},bill.state.replace('_',' ')),bill.hasBounced?el('span',{class:'chip bad'},'bounced'):''),
      el('div',{class:'sm'},`${bill.bill_no||''} ${String(bill.bill_date).slice(0,10)} total ${money(bill.total)} owed ${money(bill.outstanding)} covered ${money(bill.covered)}`),
      ...bill.cheques.map(ch=>el('div',{class:'row sm'},`Cheque ${ch.cheque_no||''} ${money(ch.amount)} due ${String(ch.due_date).slice(0,10)} ${ch.status}`,
        ch.status==='ISSUED'?[el('button',{class:'ghost',on:{click:()=>act('/cheques/'+ch.id+'/clear')}},'Cleared'),el('button',{class:'ghost',on:{click:()=>act('/cheques/'+ch.id+'/bounce')}},'Bounced')]:'')),
      el('details',{},el('summary',{},'Add cheque'),(()=>{const f=el('form',{class:'add'},el('input',{name:'cheque_no',placeholder:'Cheque no.'}),el('input',{name:'bank',placeholder:'Bank'}),el('input',{name:'amount',type:'number',step:'0.01',min:'0.01',placeholder:'Amount',required:''}),el('label',{},'Cheque date',el('input',{name:'cheque_date',type:'date',required:''})),el('input',{class:'full',name:'payee',placeholder:'Payee (the vendor, not CASH)'}),el('label',{class:'full'},el('input',{name:'same_bank',type:'checkbox'}),' same bank'),el('button',{class:'full'},'Save cheque'));
        f.addEventListener('submit',async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(f));d.same_bank=!!d.same_bank;try{const r=await api(`/bills/${bill.id}/cheques`,{method:'POST',body:JSON.stringify(d)});$('msg').textContent=(r.warnings.length?'Check: '+r.warnings.join(', ')+'. ':'')+'Words: '+r.words;load()}catch(x){$('msg').textContent=x.message}});return f})())
    )));
  }catch(e){if(e.message!=='401')$('msg').textContent=e.message}
}
async function act(p){try{let body={};if(/\/(bounce|cancel)$/.test(p)){const r=prompt('Why? (needed for the record)');if(!r||r.trim().length<3){$('msg').textContent='Not changed: a reason is needed.';return}body={reason:r.trim()}}await api(p,{method:'POST',body:JSON.stringify(body)});load()}catch(e){$('msg').textContent=e.message}}
$('go').addEventListener('click',load);
$('billForm').addEventListener('submit',async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));Object.keys(d).forEach(k=>d[k]===''&&delete d[k]);try{await api('/bills',{method:'POST',body:JSON.stringify(d)});e.target.reset();load()}catch(x){$('msg').textContent=x.message}});
load();
</script><script src="/lib/offlineSave.js"></script><script>if(window.OfflineSave)OfflineSave.badge(document.getElementById('saved'))</script><script src="/bathhub-logo.js"></script>
</body></html>

```


---
### SOURCE FILE: public/vendor-credit.html
```html
<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Vendor credit | Royal Bath Hub</title>
<style>
:root{--bg:#F6EFDC;--ink:#0B1B3A;--card:#fffdf7;--line:rgba(11,27,58,.15);--gold:#C9A24B;--red:#b3261e;--green:#1b7a46;--muted:#5b6070}
@media(prefers-color-scheme:dark){:root{--bg:#0a1632;--ink:#F6EFDC;--card:#10224a;--line:rgba(232,207,138,.25);--muted:#b7bccb}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;font-variant-numeric:tabular-nums}
main{max-width:720px;margin:0 auto;padding:14px}h1{font-size:22px;margin:6px 0 4px}h2{font-size:17px;margin:20px 0 8px}
.grid{display:grid;gap:10px;grid-template-columns:repeat(2,1fr)}.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px}
.big{font-size:22px;font-weight:700}.sm{color:var(--muted);font-size:14px}.bad{color:var(--red)}.good{color:var(--green)}
a.back{display:inline-block;min-height:44px;line-height:44px;color:var(--ink)}
.chip{display:inline-block;padding:2px 10px;border-radius:99px;font-size:13px;border:1px solid var(--line)}
.vendor{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px;margin:10px 0}
.bill{border-top:1px solid var(--line);padding:8px 0;font-size:15px}
.alert{border:1px solid var(--red);border-radius:12px;padding:10px;margin:10px 0}
</style></head><body><main>
<a class="back" href="/bathco_complete.html">&larr; Back</a>
<h1>Vendor credit</h1>
<div class="sm">What we owe each vendor, and what is left after 1, 2 and 3 months if nothing more is paid. Cheques only count when they clear.</div>
<div id="msg" class="sm" role="status">Loading...</div>
<h2>All vendors</h2><div class="grid" id="tot"></div>
<div id="long"></div>
<h2>By vendor</h2><div id="ven"></div>
<script>
(function () {
  var rs = function (n) { return 'Rs ' + Number(n || 0).toLocaleString('en-LK', { maximumFractionDigits: 0 }); };
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  function stat(label, value, cls) { var c = el('div', 'card'); c.appendChild(el('div', 'sm', label)); c.appendChild(el('div', 'big' + (cls ? ' ' + cls : ''), rs(value))); return c; }
  function load() {
    fetch('/api/vendor-credit/summary?months=1,2,3', { credentials: 'include' }).then(function (r) {
      if (r.status === 401) { location.href = '/bathco_complete.html'; return null; }
      return r.json().then(function (d) { return { ok: r.ok, d: d }; });
    }).then(function (x) {
      if (!x) return;
      var msg = document.getElementById('msg');
      if (!x.ok) { msg.textContent = (x.d && x.d.error) || 'Could not load'; return; }
      var d = x.d, t = d.totals; msg.textContent = d.vendors.length ? 'Up to date for ' + d.today : 'Nothing owed to any vendor.';
      var tot = document.getElementById('tot'); tot.textContent = '';
      tot.appendChild(stat('Total owed', t.owed));
      tot.appendChild(stat('Cheque not written', t.notWritten, t.notWritten > 0 ? 'bad' : 'good'));
      tot.appendChild(stat('Written, not cleared', t.writtenNotClear));
      tot.appendChild(stat('Past the vendor\'s date', t.pastDue, t.pastDue > 0 ? 'bad' : 'good'));
      [1, 2, 3].forEach(function (m) { tot.appendChild(stat('Still owed after ' + m + (m === 1 ? ' month' : ' months'), t.after[m])); });
      if (d.planner && d.planner.count) {
        tot.appendChild(stat('Planner cheques, not on a bill (' + d.planner.count + ')', d.planner.total, 'bad'));
        [1, 2, 3].forEach(function (m) { tot.appendChild(stat('Planner cheques due within ' + m + (m === 1 ? ' month' : ' months'), d.planner.dueBy[m])); });
      }
      var lg = document.getElementById('long'); lg.textContent = '';
      if (d.longDated.length) {
        var a = el('div', 'alert'); a.appendChild(el('strong', 'bad', 'Heads-up: cheques that clear after more than 3 months'));
        d.longDated.forEach(function (c) { a.appendChild(el('div', 'sm', c.vendor + ' — ' + rs(c.amount) + ' — clears ' + c.clears_on + ' (' + c.days_ahead + ' days away)')); });
        lg.appendChild(a);
      }
      var ven = document.getElementById('ven'); ven.textContent = '';
      d.vendors.forEach(function (v) {
        var box = el('div', 'vendor');
        box.appendChild(el('strong', '', v.vendor));
        box.appendChild(el('div', 'big', rs(v.owed)));
        box.appendChild(el('div', 'sm', 'Cheque not written ' + rs(v.notWritten) + ' · Written, not cleared ' + rs(v.writtenNotClear)));
        box.appendChild(el('div', 'sm', 'After 1 month ' + rs(v.after[1]) + ' · 2 months ' + rs(v.after[2]) + ' · 3 months ' + rs(v.after[3])));
        v.bills.forEach(function (b) {
          var row = el('div', 'bill');
          row.appendChild(el('span', '', (b.bill_no || 'Bill') + ' — ' + rs(b.owed) + ' owed '));
          row.appendChild(el('span', 'chip', b.status_text));
          if (b.due_date) row.appendChild(el('div', 'sm' + (b.overdue ? ' bad' : ''), (b.overdue ? 'Vendor date passed: ' : 'Vendor wants payment by ') + b.due_date + (b.notCoveredAtDue > 0 && !b.overdue ? ' — not covered by written cheques: ' + rs(b.notCoveredAtDue) : '')));
          box.appendChild(row);
        });
        ven.appendChild(box);
      });
    }).catch(function (e) { document.getElementById('msg').textContent = 'Could not reach the server: ' + e.message; });
  }
  load();
})();
</script>
</main></body></html>

```


---
### SOURCE FILE: public/bathco_complete.html
```html
<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<script src="/bathhub-theme.js"></script><script src="/bathhub-icons.js"></script><script src="/bathhub-a11y.js" defer></script>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Royal Bath Hub — Owner</title>
<link rel="manifest" href="/manifest.json">
<link rel="icon" href="/favicon.ico" sizes="any"><link rel="icon" type="image/png" sizes="32x32" href="/brand/favicon-32.png"><link rel="icon" type="image/png" sizes="48x48" href="/brand/favicon-48.png">
<link rel="apple-touch-icon" sizes="180x180" href="/brand/apple-touch-icon-180.png">
<script src="/offline-queue.js"></script><script>if (window.OfflineQueue) { OfflineQueue.install(); window.addEventListener("DOMContentLoaded", () => OfflineQueue.mountChip(document.getElementById("chip-slot") || document.body)); }</script>
<meta name="theme-color" content="#0B1B3A">
<link href="/fonts/inter.css" rel="stylesheet">
<script src="/vendor/chart.umd.min.js"></script>
<style>
/* ── VARIABLES ── */
:root{
  --gold:#F5A623;--gold-dark:#d4891a;--gold-light:#ffc15e;
  --bg:#0D0D0D;--bg2:#141414;--bg3:#1a1a1a;
  --card:rgba(255,255,255,0.04);--card-border:rgba(255,255,255,0.08);--card-hover:rgba(255,255,255,0.07);
  --text:#f0f0f0;--text2:#999;--text3:#666;
  --green:#22c55e;--red:#ef4444;--amber:#f59e0b;--blue:#3b82f6;--purple:#8b5cf6;
  --sidebar-w:240px;--radius:16px;--radius-sm:8px;
  --shadow:0 8px 32px rgba(0,0,0,0.4);--t:0.25s cubic-bezier(0.4,0,0.2,1)
}
[data-theme="light"]{
  --bg:#f4f5f7;--bg2:#fff;--bg3:#eaedf1;
  --card:rgba(255,255,255,0.9);--card-border:rgba(0,0,0,0.08);--card-hover:rgba(255,255,255,1);
  --text:#1a1a1a;--text2:#555;--text3:#888;--shadow:0 4px 20px rgba(0,0,0,0.1)
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--text);min-height:100vh;overflow-x:hidden;transition:background var(--t),color var(--t)}
input,select,textarea,button{font-family:inherit}
ul{list-style:none}
button{cursor:pointer;border:none;background:none}
table{border-collapse:collapse;width:100%}
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-thumb{background:rgba(245,166,35,0.3);border-radius:99px}

/* ── LOGIN OVERLAY ── */
#login-overlay{
  position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:9999;
  display:flex;align-items:center;justify-content:center;
  backdrop-filter:blur(8px)
}
.login-box{
  background:var(--bg2);border:1px solid var(--card-border);border-radius:var(--radius);
  padding:40px;width:360px;text-align:center;box-shadow:var(--shadow)
}
.login-logo{font-size:48px;margin-bottom:12px}
.login-title{font-size:20px;font-weight:800;color:var(--gold);margin-bottom:4px}
.login-sub{font-size:14px;color:var(--text2);margin-bottom:28px}
.login-err{color:var(--red);font-size:12px;margin-top:10px;display:none}

/* ── LAYOUT ── */
.app-wrapper{display:flex;min-height:100vh}
.sidebar{
  width:var(--sidebar-w);height:100vh;height:100dvh;background:var(--bg2);
  border-right:1px solid var(--card-border);display:flex;flex-direction:column;
  position:fixed;top:0;left:0;z-index:100;overflow:hidden;
  transition:width var(--t),transform var(--t)
}
.sidebar.collapsed{width:60px}
.sidebar-logo{padding:18px 16px;display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--card-border)}
.logo-icon{width:36px;height:36px;background:var(--gold);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
.logo-text{font-size:12px;font-weight:700;color:var(--gold);white-space:nowrap;transition:opacity var(--t)}
.sidebar.collapsed .logo-text,.sidebar.collapsed .nav-label,.sidebar.collapsed .toggle-lbl{opacity:0;pointer-events:none}
.sidebar-nav{flex:1;min-height:0;padding:10px 8px;overflow-y:auto;overflow-x:hidden;list-style:none;margin:0;scrollbar-width:thin;scrollbar-color:var(--card-border) transparent}
.sidebar-nav::-webkit-scrollbar{width:6px}.sidebar-nav::-webkit-scrollbar-thumb{background:var(--card-border);border-radius:3px}
.nav-item{display:flex;align-items:center;gap:12px;padding:10px;border-radius:var(--radius-sm);cursor:pointer;transition:all var(--t);margin-bottom:2px;white-space:nowrap}
.nav-item:hover{background:var(--card-hover)}
.nav-item.active{background:rgba(245,166,35,0.15);color:var(--gold)}
.nav-icon{font-size:18px;flex-shrink:0;width:22px;text-align:center}
.nav-label{font-size:14px;font-weight:500}
.sidebar-footer{padding:10px 8px;border-top:1px solid var(--card-border)}
.sidebar-toggle{display:flex;align-items:center;gap:12px;padding:10px;border-radius:var(--radius-sm);cursor:pointer;transition:all var(--t)}
.sidebar-toggle:hover{background:var(--card)}
.main-content{margin-left:var(--sidebar-w);flex:1;min-height:100vh;transition:margin-left var(--t)}
.sidebar.collapsed ~ .main-content{margin-left:60px}

/* ── TOPBAR ── */
.topbar{background:var(--bg2);border-bottom:1px solid var(--card-border);padding:0 24px;height:60px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:50}
.topbar-right{display:flex;align-items:center;gap:12px}
.live-clock{font-size:14px;font-weight:600;color:var(--gold);background:rgba(245,166,35,0.1);padding:5px 12px;border-radius:99px}
.theme-toggle{width:34px;height:34px;border-radius:50%;background:var(--card);border:1px solid var(--card-border);display:flex;align-items:center;justify-content:center;font-size:16px;transition:all var(--t)}
.theme-toggle:hover{transform:scale(1.1)}
.logout-btn{font-size:12px;padding:6px 12px;border-radius:var(--radius-sm);background:var(--card);border:1px solid var(--card-border);color:var(--text2);transition:all var(--t)}
.logout-btn:hover{border-color:var(--red);color:var(--red)}

/* ── PAGES ── */
.page{display:none;padding:20px;animation:fadeIn 0.25s ease}
.page.active{display:block}
@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}

/* ── CARDS ── */
.card{background:var(--card);border:1px solid var(--card-border);border-radius:var(--radius);padding:20px;backdrop-filter:blur(12px);transition:all var(--t);box-shadow:var(--shadow)}
.card:hover{border-color:rgba(245,166,35,0.2);transform:translateY(-1px)}

/* ── KPI ── */
.kpi-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:14px;margin-bottom:20px}
.kpi-card{background:var(--card);border:1px solid var(--card-border);border-radius:var(--radius);padding:18px;position:relative;overflow:hidden;transition:all var(--t);backdrop-filter:blur(12px)}
.kpi-card:hover{transform:translateY(-2px);box-shadow:0 12px 40px rgba(0,0,0,0.4);border-color:rgba(245,166,35,0.3)}
.kpi-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--accent,var(--gold))}
.kpi-card[data-type=profit]{--accent:#22c55e}
.kpi-card[data-type=expense]{--accent:#ef4444}
.kpi-card[data-type=cash]{--accent:#3b82f6}
.kpi-card[data-type=card]{--accent:#8b5cf6}
.kpi-card[data-type=online]{--accent:#f59e0b}
.kpi-label{font-size:12px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:6px}
.kpi-value{font-size:24px;font-weight:800;margin-bottom:6px;font-variant-numeric:tabular-nums}
.kpi-change{font-size:12px;font-weight:600;color:var(--text2)}
.kpi-change.up{color:var(--green)}
.kpi-change.down{color:var(--red)}
.kpi-sparkline{margin-top:10px;height:36px}

/* ── SKELETON ── */
.skeleton{background:linear-gradient(90deg,var(--bg3) 25%,var(--bg2) 50%,var(--bg3) 75%);background-size:200% 100%;animation:skel 1.5s infinite;border-radius:var(--radius-sm)}
@keyframes skel{0%{background-position:200% 0}100%{background-position:-200% 0}}
.skel-txt{height:12px;margin-bottom:8px;border-radius:4px}
.skel-val{height:28px;width:55%;margin-bottom:10px;border-radius:4px}

/* ── PROGRESS ── */
.prog-wrap{background:var(--bg3);border-radius:99px;height:7px;overflow:hidden}
.prog-bar{height:100%;border-radius:99px;background:linear-gradient(90deg,var(--gold),var(--gold-light));transition:width 1.4s cubic-bezier(0.4,0,0.2,1)}

/* ── GRIDS ── */
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px}
.chart-wrap{position:relative;height:200px}

/* ── TABLE ── */
.tbl-wrap{overflow-x:auto;border-radius:var(--radius)}
table th{text-align:left;padding:9px 13px;font-size:12px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid var(--card-border);background:var(--bg3)}
table td{padding:9px 13px;font-size:14px;border-bottom:1px solid rgba(255,255,255,0.04)}
table tr:hover td{background:var(--card)}
table tr:last-child td{border-bottom:none}

/* ── BADGES ── */
.badge{display:inline-flex;align-items:center;padding:3px 8px;border-radius:99px;font-size:12px;font-weight:600}
.bg{background:rgba(34,197,94,0.15);color:var(--green)}
.br{background:rgba(239,68,68,0.15);color:var(--red)}
.ba{background:rgba(245,158,11,0.15);color:var(--amber)}
.bb{background:rgba(59,130,246,0.15);color:var(--blue)}
.bp{background:rgba(139,92,246,0.15);color:var(--purple)}
.bgold{background:rgba(245,166,35,0.15);color:var(--gold)}

/* ── FORM ── */
.fg{margin-bottom:14px}
.fl{display:block;font-size:12px;font-weight:600;color:var(--text2);margin-bottom:5px;text-transform:uppercase;letter-spacing:0.05em}
.fi,.fs,.fta{width:100%;background:var(--bg3);border:1px solid var(--card-border);border-radius:var(--radius-sm);padding:9px 13px;color:var(--text);font-size:14px;transition:all var(--t)}
.fi:focus,.fs:focus,.fta:focus{outline:none;border-color:var(--gold);box-shadow:0 0 0 3px rgba(245,166,35,0.15)}
.fs option{background:var(--bg2)}
.fta{resize:vertical;min-height:70px}

/* ── BUTTONS ── */
.btn{display:inline-flex;align-items:center;gap:7px;padding:8px 16px;border-radius:var(--radius-sm);font-size:14px;font-weight:600;transition:all var(--t)}
.btn-p{background:var(--gold);color:#000}
.btn-p:hover{background:var(--gold-light);transform:translateY(-1px);box-shadow:0 4px 16px rgba(245,166,35,0.4)}
.btn-s{background:var(--card);border:1px solid var(--card-border);color:var(--text)}
.btn-s:hover{background:var(--card-hover);border-color:var(--gold)}
.btn-d{background:rgba(239,68,68,0.12);color:var(--red);border:1px solid rgba(239,68,68,0.3)}
.btn-g{background:rgba(34,197,94,0.12);color:var(--green);border:1px solid rgba(34,197,94,0.3)}

/* ── SEARCH ── */
.search-wrap{position:relative}
.search-wrap input{padding-left:34px}
.search-icon{position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:14px;color:var(--text3);pointer-events:none}

/* ── TOAST ── */
#toasts{position:fixed;bottom:20px;right:20px;display:flex;flex-direction:column;gap:8px;z-index:9998}
.toast{background:var(--bg2);border:1px solid var(--card-border);border-radius:var(--radius-sm);padding:11px 16px;display:flex;align-items:center;gap:9px;font-size:14px;font-weight:500;box-shadow:var(--shadow);animation:slideUp 0.3s ease;min-width:260px}
.toast.success{border-left:3px solid var(--green)}
.toast.error{border-left:3px solid var(--red)}
.toast.warning{border-left:3px solid var(--amber)}
.toast.info{border-left:3px solid var(--blue)}
@keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}

/* ── CONFETTI ── */
#confetti-canvas{position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9997;display:none}

/* ── BARCODE SCAN LINE ── */
.barcode-panel{position:relative;overflow:hidden}
.scan-line{position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,var(--gold),transparent);animation:scan 2s ease-in-out infinite;pointer-events:none}
@keyframes scan{0%{top:0}50%{top:100%}100%{top:0}}

/* ── MISC ── */
.section-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
.section-title{font-size:16px;font-weight:700}
.section-sub{font-size:12px;color:var(--text2);margin-top:2px}
.welcome-banner{background:linear-gradient(135deg,rgba(245,166,35,0.12),rgba(245,166,35,0.04));border:1px solid rgba(245,166,35,0.2);border-radius:var(--radius);padding:18px 22px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between}
.pay-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:18px}
.pay-item{background:var(--card);border:1px solid var(--card-border);border-radius:var(--radius-sm);padding:12px;text-align:center}
.pay-label{font-size:12px;color:var(--text2);font-weight:600;text-transform:uppercase;margin-bottom:5px}
.pay-val{font-size:16px;font-weight:800}
.report-row{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--card-border);font-size:14px}
.report-row:last-child{border-bottom:none}
.report-row.total{font-weight:800;font-size:15px;color:var(--gold)}
.upload-box{border:2px dashed var(--card-border);border-radius:var(--radius);padding:24px;text-align:center;cursor:pointer;transition:all var(--t)}
.upload-box:hover{border-color:var(--gold);background:rgba(245,166,35,0.04)}
.stock-bar{height:5px;border-radius:99px;background:var(--bg3);overflow:hidden;margin-top:3px}
.stock-fill{height:100%;border-radius:99px}
.top-item{display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--card-border)}
.top-item:last-child{border-bottom:none}
.rank{width:22px;height:22px;border-radius:50%;background:var(--gold);color:#000;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.rank.r2{background:var(--text3)}.rank.r3{background:#cd7f32}
.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-top:12px}
.cal-hdr{text-align:center;font-size:12px;font-weight:600;color:var(--text2);padding:4px 0}
.cal-day{min-height:46px;background:var(--bg3);border-radius:6px;padding:4px;font-size:12px;border:1px solid transparent;transition:all var(--t)}
.cal-day.c-cheque{border-color:var(--amber);background:rgba(245,158,11,0.1)}
.cal-day.c-due{border-color:var(--red);background:rgba(239,68,68,0.12)}
.cal-day.c-clear{border-color:var(--green);background:rgba(34,197,94,0.08)}
.cal-day-n{font-weight:700;color:var(--text2);margin-bottom:1px}
.no-data{text-align:center;padding:32px;color:var(--text3);font-size:14px}
.data-tier{font-size:12px;padding:2px 6px;border-radius:4px;font-weight:700}
.tier-full{background:rgba(34,197,94,0.15);color:var(--green)}
.tier-cash{background:rgba(59,130,246,0.15);color:var(--blue)}
.tier-found{background:rgba(100,100,100,0.15);color:var(--text2)}

#bottom-nav{display:none}
.nav-sep{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--text3);padding:10px 12px 4px}
@media(max-width:768px){
  body{padding-bottom:62px}
  /* embedded screens stop above the bottom menu so their last buttons are not hidden (Ajmal 13:06) */
  #pos-frame, iframe[id^="frame-"]{height:calc(100dvh - 205px)!important;min-height:420px!important}
  #bottom-nav{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:150;background:var(--bg2);border-top:1px solid var(--card-border);padding:4px 0 max(4px,env(safe-area-inset-bottom))}
  #bottom-nav button{flex:1;background:none;border:0;color:var(--text2);font:inherit;font-size:12px;display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 0;cursor:pointer}
  #bottom-nav button .bi{font-size:20px;line-height:1}
  #bottom-nav button.active{color:var(--gold)}
  .sidebar{transform:translateX(-100%);width:var(--sidebar-w)!important;z-index:200}
  .sidebar.open{transform:translateX(0)}
  .main-content{margin-left:0!important}
  .kpi-grid,.grid-2,.grid-3{grid-template-columns:1fr}
  .pay-grid{grid-template-columns:1fr 1fr}
  /* phone width: button rows and header wrap instead of pushing the page sideways; wide tables scroll inside their own box */
  .main-content [style*="display:flex"],.main-content [style*="display: flex"]{flex-wrap:wrap!important}
  .main-content [style*="margin-left:auto"]{margin-left:0!important}
  .topbar{padding:0 12px;gap:8px}
  .topbar-right{gap:6px;min-width:0;flex-shrink:1}
  .main-content,.page{min-width:0;max-width:100vw}
  .page table{display:block;max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch}
}
/* embed mode: the new shell shows a screen inside a frame, without this page's own menu and header */
.embed .sidebar,.embed .topbar{display:none!important}.embed .main-content{margin:0!important;padding:0!important;width:100%!important;max-width:none!important}
</style>
<link rel="stylesheet" href="/bathhub-design.css">
</head>
<body>
<script>if(/[?&]embed=1/.test(location.search))document.documentElement.classList.add('embed');</script>
<canvas id="confetti-canvas"></canvas>
<div id="toasts"></div>
<nav id="bottom-nav" aria-label="Main menu">
  <button data-go="dashboard" onclick="navigate('dashboard')"><span class="bi"><svg class="bh-icon" aria-hidden="true"><use href="#i-chart"/></svg></span>Home</button>
  <button data-go="pos" onclick="navigate('pos')"><span class="bi"><svg class="bh-icon" aria-hidden="true"><use href="#i-cart"/></svg></span>POS</button>
  <button data-go="daily-sales" onclick="navigate('daily-sales')"><span class="bi"><svg class="bh-icon" aria-hidden="true"><use href="#i-receipt"/></svg></span>Sales</button>
  <button data-go="stock" onclick="navigate('stock')"><span class="bi"><svg class="bh-icon" aria-hidden="true"><use href="#i-box"/></svg></span>Stock</button>
  <button data-go="__more" onclick="document.getElementById('sidebar').classList.toggle('open')"><span class="bi">☰</span>More</button>
</nav>

<!-- LOGIN OVERLAY -->
<div id="login-overlay">
  <div class="login-box">
    <div class="login-logo" style="font-size:inherit"><span class="bh-lockup bh-lockup-lg"><img src="/brand/logo-header-400h.png" alt="Royal Bath Hub"><span><span class="bh-name">Royal Bath Hub</span><span class="bh-sub">Thihariya</span></span></span></div>
    <div class="login-sub">Owner sign in</div>
    <div class="fg">
      <label class="fl">Username</label>
      <input class="fi" id="l-user" type="text" placeholder="Enter username" autocomplete="username">
    </div>
    <div class="fg">
      <label class="fl">Password</label>
      <input class="fi" id="l-pass" type="password" placeholder="Enter password" autocomplete="current-password">
    </div>
    <button class="btn btn-p" style="width:100%;justify-content:center;padding:11px" id="login-btn" onclick="doLogin()">Sign In</button>
    <div class="login-err" id="login-err">Invalid username or password</div>
  </div>
</div>

<!-- APP -->
<div class="app-wrapper">
  <nav class="sidebar" id="sidebar">
    <div class="sidebar-logo">
      <span class="bh-lockup"><img src="/brand/logo-header-400h.png" alt="Royal Bath Hub"><span><span class="bh-name">Royal Bath Hub</span><span class="bh-sub">Thihariya</span></span></span>
    </div>
    <ul class="sidebar-nav">
      <li class="nav-item active" data-page="dashboard"><span class="nav-icon"><svg class="bh-icon" aria-hidden="true"><use href="#i-chart"/></svg></span><span class="nav-label">Dashboard</span></li>
      <li class="nav-item" data-page="daily-sales"><span class="nav-icon"><svg class="bh-icon" aria-hidden="true"><use href="#i-receipt"/></svg></span><span class="nav-label">Daily Sales</span></li>
      <li class="nav-item" data-page="stock"><span class="nav-icon"><svg class="bh-icon" aria-hidden="true"><use href="#i-box"/></svg></span><span class="nav-label">Stock</span></li>
      <li class="nav-item" data-page="pos"><span class="nav-icon"><svg class="bh-icon" aria-hidden="true"><use href="#i-cart"/></svg></span><span class="nav-label">POS Billing</span></li>
      <li class="nav-item" data-page="grn"><span class="nav-icon"><svg class="bh-icon" aria-hidden="true"><use href="#i-inbox"/></svg></span><span class="nav-label">GRN</span></li>
      <li class="nav-item" data-page="expenses"><span class="nav-icon"><svg class="bh-icon" aria-hidden="true"><use href="#i-wallet"/></svg></span><span class="nav-label">Expenses</span></li>
      <li class="nav-item" data-page="cheques"><span class="nav-icon"><svg class="bh-icon" aria-hidden="true"><use href="#i-clipboard"/></svg></span><span class="nav-label">Cheques</span></li>
      <li class="nav-item" data-page="vendors"><span class="nav-icon"><svg class="bh-icon" aria-hidden="true"><use href="#i-link"/></svg></span><span class="nav-label">Vendors</span></li>
      <li class="nav-item" data-page="salary"><span class="nav-icon"><svg class="bh-icon" aria-hidden="true"><use href="#i-briefcase"/></svg></span><span class="nav-label">Salary &amp; Costs</span></li>
      <li class="nav-item" data-page="docinbox"><span class="nav-icon"><svg class="bh-icon" aria-hidden="true"><use href="#i-inbox"/></svg></span><span class="nav-label">Document Inbox</span></li>
      <li class="nav-item" data-page="loans"><span class="nav-icon"><svg class="bh-icon" aria-hidden="true"><use href="#i-link"/></svg></span><span class="nav-label">Friend &amp; Investor Loans</span></li>
      <li class="nav-item" data-page="moneycontrol"><span class="nav-icon"><svg class="bh-icon" aria-hidden="true"><use href="#i-shield"/></svg></span><span class="nav-label">Money Control</span></li>
      <li class="nav-item" data-page="commissions"><span class="nav-icon"><svg class="bh-icon" aria-hidden="true"><use href="#i-tag"/></svg></span><span class="nav-label">Sale Commissions</span></li>
      <li class="nav-item" data-page="enquiries"><span class="nav-icon"><svg class="bh-icon" aria-hidden="true"><use href="#i-phone-call"/></svg></span><span class="nav-label">Enquiries</span></li>
      <li class="nav-item" data-page="replies"><span class="nav-icon"><svg class="bh-icon" aria-hidden="true"><use href="#i-chat"/></svg></span><span class="nav-label">Reply Drafts</span></li>
      <li class="nav-item" data-page="webcat"><span class="nav-icon"><svg class="bh-icon" aria-hidden="true"><use href="#i-globe"/></svg></span><span class="nav-label">Website Catalogue</span></li>
      <li class="nav-item" data-page="website"><span class="nav-icon"><svg class="bh-icon" aria-hidden="true"><use href="#i-globe"/></svg></span><span class="nav-label">Website</span></li>
      <li class="nav-item" data-page="tilegallery"><span class="nav-icon"><svg class="bh-icon" aria-hidden="true"><use href="#i-box"/></svg></span><span class="nav-label">Tile Gallery</span></li>
      <li class="nav-item" data-page="policy"><span class="nav-icon"><svg class="bh-icon" aria-hidden="true"><use href="#i-scale"/></svg></span><span class="nav-label">Policy Watch</span></li>
      <li class="nav-item" data-page="branches"><span class="nav-icon"><svg class="bh-icon" aria-hidden="true"><use href="#i-store"/></svg></span><span class="nav-label">Branches</span></li>
      <li class="nav-item" data-page="settings"><span class="nav-icon"><svg class="bh-icon" aria-hidden="true"><use href="#i-gear"/></svg></span><span class="nav-label">Settings</span></li>
      <li class="nav-item" data-page="shoptools"><span class="nav-icon"><svg class="bh-icon" aria-hidden="true"><use href="#i-toolbox"/></svg></span><span class="nav-label">Shop Tools</span></li>
      <li class="nav-item" data-page="content"><span class="nav-icon"><svg class="bh-icon" aria-hidden="true"><use href="#i-film"/></svg></span><span class="nav-label">Content</span></li>
      <li class="nav-item" data-page="competitors"><span class="nav-icon"><svg class="bh-icon" aria-hidden="true"><use href="#i-eye"/></svg></span><span class="nav-label">Competitors</span></li>
      <li class="nav-item" data-page="agentreview"><span class="nav-icon"><svg class="bh-icon" aria-hidden="true"><use href="#i-sparkles"/></svg></span><span class="nav-label">Agent Review</span></li>
      <li class="nav-item" data-page="agent-rules"><span class="nav-icon"><svg class="bh-icon" aria-hidden="true"><use href="#i-book"/></svg></span><span class="nav-label">Agent Rules</span></li>
      <li class="nav-item" data-page="reports"><span class="nav-icon"><svg class="bh-icon" aria-hidden="true"><use href="#i-trend"/></svg></span><span class="nav-label">Reports</span></li>
    </ul>
    <div class="sidebar-footer">
      <div class="sidebar-toggle" onclick="toggleSidebar()">
        <span style="font-size:18px"><svg class="bh-icon" aria-hidden="true"><use href="#i-chevron-left"/></svg></span>
        <span class="nav-label toggle-lbl">Collapse</span>
      </div>
    </div>
  </nav>

  <div class="main-content" id="main-content">
    <header class="topbar">
      <div class="topbar-brand"><img class="brand-logo" src="/brand/logo-header-400h.png" alt="Royal Bath Hub" height="44">
      <div>
        <div style="font-size:16px;font-weight:700" id="page-title">Dashboard</div>
        <div style="font-size:12px;color:var(--text2)" id="page-sub">Loading…</div>
      </div></div>
      <div class="topbar-right">
        <span id="chip-slot"></span>
        <div class="live-clock" id="clock">00:00:00</div>
        <button class="theme-toggle" onclick="toggleTheme()"><svg class="bh-icon" aria-hidden="true"><use href="#i-moon"/></svg></button>
        <button class="logout-btn" onclick="doLogout()">Sign Out</button>
      </div>
    </header>

    <!-- ── DASHBOARD ── -->
    <section class="page active" id="page-dashboard">
      <div class="welcome-banner">
        <div>
          <div style="font-size:19px;font-weight:800">Welcome back </div>
          <div style="font-size:12px;color:var(--text2);margin-top:3px">Live data from your database · <span id="dash-date"></span></div>
          <a id="website-btn" class="btn btn-s" href="/site" target="_blank" rel="noopener" style="margin-top:8px;padding:5px 12px;font-size:12px">Website</a>
        </div>
        <div style="font-size:38px"></div>
      </div>
      <div id="salary-card"></div>
      <!-- Target bar -->
      <div class="card" style="margin-bottom:18px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div><div style="font-size:14px;font-weight:700">Daily Sales Target</div><div style="font-size:12px;color:var(--text2)" id="target-label">LKR 250,000 target</div></div>
          <div style="font-size:14px;font-weight:800;color:var(--gold)" id="target-pct">—</div>
        </div>
        <div class="prog-wrap"><div class="prog-bar" id="target-bar" style="width:0%"></div></div>
        <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:12px;color:var(--text3)">
          <span>LKR 0</span><span id="target-achieved"></span><span id="target-max">LKR 2,50,000</span>
        </div>
      </div>
      <!-- KPI grid -->
      <div class="kpi-grid" id="kpi-grid"></div>
      <!-- MTD row -->
      <div class="grid-2" style="margin-bottom:18px">
        <div class="card">
          <div class="section-title" style="margin-bottom:4px">Month to Date</div>
          <div style="font-size:12px;color:var(--text2);margin-bottom:14px" id="mtd-days-label">—</div>
          <div id="mtd-rows"></div>
        </div>
        <div class="card">
          <div class="section-title" style="margin-bottom:4px">Weekly Sales</div>
          <div style="font-size:12px;color:var(--text2);margin-bottom:10px">This week's daily totals</div>
          <div class="chart-wrap"><canvas id="weeklyChart"></canvas></div>
        </div>
      </div>
      <div style="text-align:right;font-size:12px;color:var(--text3)">Last updated: <span id="last-upd">—</span></div>
    </section>

    <!-- ── DAILY SALES ── -->
    <section class="page" id="page-daily-sales">
      <div data-attach="daily_sales" data-attach-id="@today"></div>
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:16px">
        <div style="display:flex;align-items:center;gap:10px">
          <button class="btn btn-s" style="padding:6px 10px" onclick="changeDate(-1)"><svg class="bh-icon" aria-hidden="true"><use href="#i-chevron-left"/></svg></button>
          <input type="date" class="fi" style="width:160px" id="sales-date" onchange="loadSalesDate()">
          <button class="btn btn-s" style="padding:6px 10px" onclick="changeDate(1)"><svg class="bh-icon" aria-hidden="true"><use href="#i-play"/></svg></button>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-s" onclick="copyWhatsApp()"><svg class="bh-icon" aria-hidden="true"><use href="#i-phone"/></svg> WhatsApp</button>
          <button class="btn btn-s" onclick="window.open('/api/report-download?date='+document.getElementById('sales-date').value)"><svg class="bh-icon" aria-hidden="true"><use href="#i-file"/></svg> Excel</button>
        </div>
      </div>
      <!-- Payment breakdown -->
      <div class="pay-grid" id="pay-grid">
        <div class="pay-item"><div class="pay-label">Cash</div><div class="pay-val" style="color:var(--blue)" id="p-cash">—</div></div>
        <div class="pay-item"><div class="pay-label">Card</div><div class="pay-val" style="color:var(--purple)" id="p-card">—</div></div>
        <div class="pay-item"><div class="pay-label">Online</div><div class="pay-val" style="color:var(--amber)" id="p-online">—</div></div>
        <div class="pay-item"><div class="pay-label">Credit</div><div class="pay-val" style="color:var(--red)" id="p-credit">—</div></div>
        <div class="pay-item"><div class="pay-label">Cheque</div><div class="pay-val" style="color:var(--green)" id="p-cheque">—</div></div>
      </div>
      <div id="live-note" style="display:none;font-size:12px;color:var(--text2);margin-bottom:12px"></div>
      <!-- Mismatch flag -->
      <div id="mismatch-flag" style="display:none;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:var(--radius-sm);padding:10px 14px;margin-bottom:14px;font-size:12px;color:var(--red)">
        <svg class="bh-icon" aria-hidden="true"><use href="#i-warning"/></svg> Cash+Card+Online+Credit+Cheque does not match Total Sale — check records
      </div>
      <!-- Charts -->
      <div class="grid-2" style="margin-bottom:16px">
        <div class="card">
          <div class="section-title" style="margin-bottom:12px">Payment Split</div>
          <div style="display:flex;gap:16px;align-items:center">
            <div style="width:150px;height:150px;flex-shrink:0"><canvas id="donutChart"></canvas></div>
            <div id="donut-legend" style="display:flex;flex-direction:column;gap:7px;flex:1"></div>
          </div>
        </div>
        <div class="card">
          <div class="section-title" style="margin-bottom:10px">Daily Info</div>
          <div id="daily-info-rows"></div>
        </div>
      </div>
      <!-- Invoice table -->
      <div class="card" style="margin-bottom:16px">
        <div class="section-hdr">
          <div class="section-title">Invoices</div>
          <div class="search-wrap" style="max-width:200px">
            <span class="search-icon"><svg class="bh-icon" aria-hidden="true"><use href="#i-search"/></svg></span>
            <input type="text" class="fi" placeholder="Search..." id="inv-search" oninput="filterInv()">
          </div>
        </div>
        <div class="tbl-wrap"><table><thead><tr><th>Invoice</th><th>Method</th><th>Amount</th><th>Refund</th><th>Notes</th></tr></thead><tbody id="inv-tbody"></tbody></table></div>
      </div>
      <!-- Add invoice form -->
      <div class="card" style="margin-bottom:16px">
        <div class="section-title" style="margin-bottom:14px">+ Add Invoice Record</div>
        <div class="grid-3">
          <div class="fg"><label class="fl">Invoice No.</label><input class="fi" id="n-inv" placeholder="INV-0001"></div>
          <div class="fg"><label class="fl">Total Sale (LKR)</label><input class="fi" id="n-total" type="number" placeholder="0"></div>
          <div class="fg"><label class="fl">Cash</label><input class="fi" id="n-cash" type="number" placeholder="0"></div>
          <div class="fg"><label class="fl">Card</label><input class="fi" id="n-card" type="number" placeholder="0"></div>
          <div class="fg"><label class="fl">Online</label><input class="fi" id="n-online" type="number" placeholder="0"></div>
          <div class="fg"><label class="fl">Credit</label><input class="fi" id="n-credit" type="number" placeholder="0"></div>
          <div class="fg"><label class="fl">Cheque</label><input class="fi" id="n-cheque" type="number" placeholder="0"></div>
          <div class="fg"><label class="fl">Notes</label><input class="fi" id="n-notes" placeholder="Optional"></div>
        </div>
        <button class="btn btn-p" onclick="saveInvoice()">Save Invoice</button>
      </div>
    </section>

    <!-- ── STOCK ── -->
    <section class="page" id="page-stock">
      <div data-attach="stock" data-attach-id="general"></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;align-items:center">
        <div class="search-wrap" style="max-width:220px">
          <span class="search-icon"><svg class="bh-icon" aria-hidden="true"><use href="#i-search"/></svg></span>
          <input type="text" class="fi" placeholder="Search code or name..." id="stk-search" oninput="filterStock()">
        </div>
        <select class="fs" style="width:160px" id="stk-cat" onchange="filterStock()"><option value="">All Categories</option></select>
        <div style="margin-left:auto;display:flex;gap:8px">
          <button class="btn btn-p" onclick="toggleItemForm()">+ Add Item</button>
          <button class="btn btn-p" onclick="toggleGRNForm()">+ GRN Entry</button>
          <button class="btn btn-s" onclick="loadStock()">↺ Refresh</button>
        </div>
      </div>
      <div id="stk-alerts" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px"></div>
      <div class="card" style="margin-bottom:16px"><div class="tbl-wrap"><table><thead><tr><th>Photo</th><th>Code</th><th>Name</th><th>Category</th><th>Stock</th><th>Level</th><th>Supplier</th></tr></thead><tbody id="stk-tbody"></tbody></table></div></div>
      <!-- Add item form -->
      <div class="card" id="item-form" style="display:none;margin-bottom:16px">
        <div class="section-hdr"><div class="section-title">Add Item — next code <code style="color:var(--gold)" id="i-next-code">…</code></div><button class="btn btn-s" onclick="toggleItemForm()">✕ Close</button></div>
        <div class="grid-3">
          <div class="fg"><label class="fl">Item Name *</label><input class="fi" id="i-name" placeholder="e.g. Wash basin 20&quot; white"></div>
          <div class="fg"><label class="fl">Category</label><input class="fi" id="i-cat" placeholder="e.g. Basins" list="i-cat-list"><datalist id="i-cat-list"></datalist></div>
          <div class="fg"><label class="fl">Selling Price (LKR)</label><input type="number" min="0" class="fi" id="i-price" placeholder="0"></div>
          <div class="fg"><label class="fl">Cost (LKR)</label><input type="number" min="0" class="fi" id="i-cost" placeholder="0"></div>
          <div class="fg"><label class="fl">Opening Stock</label><input type="number" min="0" class="fi" id="i-qty" placeholder="0"></div>
          <div class="fg"><label class="fl">Reorder Level</label><input type="number" min="0" class="fi" id="i-reorder" placeholder="0"></div>
        </div>
        <div class="fg"><label class="fl">Photo (JPG / PNG / WEBP, max 5 MB)</label>
          <input type="file" class="fi" id="i-photo" accept="image/jpeg,image/png,image/webp" onchange="previewItemPhoto(this)">
          <img id="i-photo-prev" alt="" style="display:none;margin-top:8px;width:80px;height:80px;object-fit:cover;border-radius:8px;border:1px solid var(--card-border)">
        </div>
        <button class="btn btn-p" id="i-save" onclick="saveItem()">Save Item</button>
      </div>
      <!-- GRN form -->
      <div class="card" id="grn-form" style="display:none">
        <div class="section-hdr"><div class="section-title">GRN Entry</div><button class="btn btn-s" onclick="toggleGRNForm()">✕ Close</button></div>
        <div class="grid-3">
          <div class="fg"><label class="fl">GRN Number</label><input class="fi" id="g-num" placeholder="GRN-001"></div>
          <div class="fg"><label class="fl">Supplier</label><select class="fs" id="g-supplier"><option value="">Select supplier...</option></select></div>
          <div class="fg"><label class="fl">Date</label><input type="date" class="fi" id="g-date"></div>
          <div class="fg"><label class="fl">Item Description</label><input class="fi" id="g-item" placeholder="Item name/description"></div>
          <div class="fg"><label class="fl">Quantity</label><input type="number" class="fi" id="g-qty" placeholder="0"></div>
          <div class="fg"><label class="fl">Unit Cost (LKR)</label><input type="number" class="fi" id="g-cost" placeholder="0"></div>
        </div>
        <div class="fg"><label class="fl">Notes</label><input class="fi" id="g-notes" placeholder="Optional"></div>
        <button class="btn btn-p" onclick="saveGRN()">Save GRN</button>
      </div>
      <!-- GRN history -->
      <div class="card">
        <div class="section-hdr"><div class="section-title">Recent GRN Records</div><button class="btn btn-s" onclick="loadGRN()">↺ Refresh</button></div>
        <div class="tbl-wrap"><table><thead><tr><th>GRN#</th><th>Date</th><th>Supplier</th><th>Item</th><th>Qty</th><th>Unit Cost</th><th>Total</th><th>Status</th></tr></thead><tbody id="grn-tbody"></tbody></table></div>
      </div>
    </section>

    <!-- ── POS BILLING (embeds public/pos_billing.html) ── -->
    <section class="page" id="page-pos">
      <iframe id="pos-frame" title="POS Billing" style="width:100%;height:calc(100vh - 130px);min-height:520px;border:1px solid var(--card-border);border-radius:12px;background:var(--bg-surface)"></iframe>
    </section>

    <!-- ── GRN (manual entry) ── -->
    <section class="page" id="page-grn">
      <div data-attach="grn" data-attach-id="@today"></div>
      <div class="card" style="margin-bottom:16px">
        <div class="section-hdr"><div class="section-title">New GRN — receive a delivery</div></div>
        <div class="grid-3">
          <div class="fg"><label class="fl">Supplier *</label><input class="fi" id="mg-supplier" list="mg-supplier-list" placeholder="Pick or type a supplier"><datalist id="mg-supplier-list"></datalist></div>
          <div class="fg"><label class="fl">Date *</label><input type="date" class="fi" id="mg-date"></div>
          <div class="fg"><label class="fl">Notes</label><input class="fi" id="mg-notes" placeholder="Optional (delivery note no., etc.)"></div>
          <div class="fg"><label class="fl">Credit days the vendor allows</label><input class="fi" id="mg-credit-days" type="number" inputmode="numeric" min="0" max="1095" placeholder="Required. 0 = pay now, 30 = 30 days"></div>
          <div class="fg"><label class="fl" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="mg-paid-now"> Paid in cash on delivery (nothing owed)</label></div>
        </div>
        <div style="font-size:12px;color:var(--text2);margin:6px 0 10px">Each new item gets the next item code automatically. An item whose name already exists is restocked instead of duplicated.</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px">
          <button class="btn btn-s" type="button" onclick="document.getElementById('mg-file').click()">📄 Fill from file</button>
          <button class="btn btn-s" type="button" onclick="document.getElementById('mg-photo-read').click()">📷 Read photo (AI)</button>
          <span style="font-size:12px;color:var(--text2)">Fills the boxes below. Nothing is saved until you press Save GRN.</span>
          <input type="file" id="mg-file" accept=".json,.csv,.xlsx,.xls" style="display:none" onchange="mgFillFromFile(this)">
          <input type="file" id="mg-photo-read" accept="image/jpeg,image/png" style="display:none" onchange="mgReadPhoto(this)">
        </div>
        <div id="mg-review" style="display:none"></div>
        <div id="mg-rows"></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px">
          <button class="btn btn-s" onclick="mgAddRow()">+ Add item row</button>
          <div style="margin-left:auto;font-weight:700">Total: <span id="mg-total">LKR 0</span></div>
          <button class="btn btn-p" id="mg-save" onclick="saveManualGRN()">Save GRN</button>
        </div>
        <div id="mg-result" style="margin-top:12px"></div>
      </div>
      <div class="card">
        <div class="section-hdr"><div class="section-title">Recent GRN Records</div><button class="btn btn-s" onclick="loadManualGRNList()">↺ Refresh</button></div>
        <div class="tbl-wrap"><table><thead><tr><th>GRN#</th><th>Date</th><th>Supplier</th><th>Item</th><th>Qty</th><th>Unit Cost</th><th>Total</th></tr></thead><tbody id="mg-tbody"></tbody></table></div>
      </div>
    </section>

    <!-- ── EXPENSES ── -->
    <section class="page" id="page-expenses">
      <div data-attach="expense" data-attach-id="@today"></div>
      <div style="display:flex;gap:10px;align-items:center;margin-bottom:16px;flex-wrap:wrap">
        <div><label class="fl" style="display:inline;margin-right:8px">Date</label><input type="date" class="fi" style="width:160px" id="exp-date" onchange="loadExpenses()"></div>
        <button class="btn btn-s" onclick="loadExpenses()">↺ Load</button>
      </div>
      <div class="grid-2" style="margin-bottom:16px">
        <!-- Expense summary from daily_summary -->
        <div class="card">
          <div class="section-title" style="margin-bottom:14px">Day Summary</div>
          <div id="exp-summary-rows"><div class="no-data">Select a date to load</div></div>
        </div>
        <!-- Petty cash panel -->
        <div class="card">
          <div class="section-title" style="margin-bottom:14px">Petty Cash</div>
          <div class="kpi-label">Current Balance</div>
          <div class="kpi-value" style="color:var(--green);font-size:28px" id="petty-bal">—</div>
          <div style="font-size:12px;color:var(--text2);margin-bottom:12px">Float: fixed (set per business)</div>
          <div class="prog-wrap"><div class="prog-bar" id="petty-bar" style="width:100%;background:linear-gradient(90deg,var(--green),#4ade80)"></div></div>
          <div style="margin-top:16px;padding:12px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:var(--radius-sm)">
            <div style="font-size:12px;font-weight:700;color:var(--amber)"><svg class="bh-icon" aria-hidden="true"><use href="#i-warning"/></svg> RENOVATION — ALWAYS SEPARATE</div>
            <div style="font-size:12px;color:var(--text2);margin-top:4px">Renovation costs are never mixed with operating expenses</div>
          </div>
        </div>
      </div>
      <!-- Expense line items -->
      <div class="card">
        <div class="section-title" style="margin-bottom:14px">Expense Line Items</div>
        <div class="tbl-wrap"><table><thead><tr><th>Category</th><th>Description</th><th>Amount</th></tr></thead><tbody id="exp-tbody"></tbody></table></div>
      </div>
    </section>

    <!-- ── CHEQUES ── -->
    <section class="page" id="page-cheques">
      <div data-attach="cheque" data-attach-id="general"></div>
      <div class="kpi-grid" style="margin-bottom:16px" id="cheq-kpi-grid"></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">
        <div class="search-wrap" style="max-width:220px">
          <span class="search-icon"><svg class="bh-icon" aria-hidden="true"><use href="#i-search"/></svg></span>
          <input type="text" class="fi" placeholder="Search cheque# or vendor..." id="cheq-search" oninput="filterCheques()">
        </div>
        <button class="btn btn-p" onclick="showAddChequeForm()">+ Add Cheque</button>
        <button class="btn btn-s" onclick="loadCheques()">↺ Refresh</button>
        <button class="btn btn-s" onclick="window.print()"><svg class="bh-icon" aria-hidden="true"><use href="#i-printer"/></svg> Print</button>
      </div>
      <!-- Add cheque form -->
      <div class="card" id="add-cheq-form" style="display:none;margin-bottom:16px">
        <div class="section-hdr"><div class="section-title">Add Cheque</div><button class="btn btn-s" onclick="hideAddChequeForm()">✕</button></div>
        <div class="grid-3">
          <div class="fg"><label class="fl">Cheque No.</label><input class="fi" id="cq-num" placeholder="CHQ-0001"></div>
          <div class="fg"><label class="fl">Bank</label><input class="fi" id="cq-bank" placeholder="HNB / Commercial..."></div>
          <div class="fg"><label class="fl">Amount (LKR)</label><input type="number" class="fi" id="cq-amount" placeholder="0"></div>
          <div class="fg"><label class="fl">Due Date</label><input type="date" class="fi" id="cq-due"></div>
          <div class="fg"><label class="fl">Customer (optional)</label><select class="fs" id="cq-customer"><option value="">Walk-in / N/A</option></select></div>
          <div class="fg"><label class="fl">Notes</label><input class="fi" id="cq-notes" placeholder="Vendor or reference"></div>
        </div>
        <button class="btn btn-p" onclick="saveCheque()">Save Cheque</button>
      </div>
      <div class="card" style="margin-bottom:16px">
        <div class="tbl-wrap"><table><thead><tr><th>Cheque #</th><th>Bank</th><th>Amount</th><th>Due Date</th><th>Customer</th><th>Status</th><th>Action</th></tr></thead><tbody id="cheq-tbody"></tbody></table></div>
      </div>
      <div class="card" style="margin-bottom:16px" id="pos-cheq-card">
        <div class="section-title" style="margin-bottom:6px">From POS bills (not in the register yet)</div>
        <div style="font-size:12px;opacity:.75;margin-bottom:8px">Cheques taken on POS bills. Pick the customer and due date, then register: it is added to the list above once.</div>
        <div class="tbl-wrap"><table><thead><tr><th>Bill</th><th>Cheque</th><th>Amount</th><th>Customer</th><th>Due date</th><th>Action</th></tr></thead><tbody id="pos-cheq-tbody"></tbody></table></div>
      </div>
      <div class="card">
        <div class="section-title" style="margin-bottom:10px">Cheque Calendar — Current Month</div>
        <div class="cal-grid" id="cheq-cal"></div>
      </div>
    </section>

    <!-- ── VENDORS ── -->
    <section class="page" id="page-vendors">
      <div data-attach="vendor" data-attach-id="general"></div>
      <div class="grid-2" style="margin-bottom:16px">
        <div class="card">
          <div class="section-title" style="margin-bottom:14px">Add Payment to Supplier</div>
          <div class="fg"><label class="fl">Supplier</label><select class="fs" id="vend-sel"></select></div>
          <div class="fg"><label class="fl">Amount (LKR)</label><input type="number" class="fi" id="vend-amt" placeholder="0"></div>
          <div class="fg"><label class="fl">Payment Method</label><select class="fs" id="vend-method"><option>Cheque</option><option>Cash</option><option>Online Transfer</option></select></div>
          <div class="fg"><label class="fl">Date</label><input type="date" class="fi" id="vend-date"></div>
          <div class="fg"><label class="fl">Reference / Cheque No.</label><input class="fi" id="vend-ref" placeholder="CHQ-00123"></div>
          <button class="btn btn-p" style="width:100%;justify-content:center" onclick="saveVendorPayment()">Record Payment</button>
        </div>
        <div>
          <div class="card" style="margin-bottom:12px">
            <div class="kpi-label">Total Supplier Payables</div>
            <div class="kpi-value" style="color:var(--red)" id="vend-total-out">Loading…</div>
          </div>
          <div class="card">
            <div class="kpi-label">Pending Cheques</div>
            <div class="kpi-value" style="color:var(--amber)" id="vend-pending-cheq">—</div>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="section-hdr"><div class="section-title">Supplier Directory</div><button class="btn btn-s" onclick="loadVendors()">↺ Refresh</button></div>
        <div class="tbl-wrap"><table><thead><tr><th>Name</th><th>Total Paid</th><th>Last Payment</th><th>Pending Cheques</th><th>Days Since Pay</th><th>History</th></tr></thead><tbody id="vend-tbody"></tbody></table></div>
      </div>
    </section>

    <!-- ── BARCODE ── -->
    <section class="page" id="page-barcode">
      <div class="grid-2">
        <div>
          <div class="card" style="margin-bottom:14px">
            <div class="section-title" style="margin-bottom:12px">Select Items</div>
            <div style="display:flex;gap:8px;margin-bottom:10px">
              <div class="search-wrap" style="flex:1"><span class="search-icon"><svg class="bh-icon" aria-hidden="true"><use href="#i-search"/></svg></span><input type="text" class="fi" placeholder="Search..." oninput="filterBarcodeItems(this.value)"></div>
              <button class="btn btn-s" onclick="selectAllBC()">All</button>
              <button class="btn btn-s" onclick="deselectAllBC()">None</button>
            </div>
            <div class="tbl-wrap" style="max-height:280px;overflow-y:auto">
              <table><thead><tr><th><input type="checkbox" id="bc-all" onchange="toggleAllBC(this)"></th><th>Code</th><th>Name</th><th>Copies</th></tr></thead><tbody id="bc-tbody"></tbody></table>
            </div>
          </div>
          <div class="card">
            <div class="section-title" style="margin-bottom:12px">Label Settings</div>
            <div class="fg"><label class="fl">Label Size</label><select class="fs" id="lbl-size" onchange="updatePreview()"><option value="50x25">50×25 mm</option><option value="40x20">40×20 mm</option><option value="60x30">60×30 mm</option></select></div>
            <div class="fg"><label class="fl">Copies per Item</label><input type="number" class="fi" id="lbl-copies" value="1" min="1" max="100"></div>
            <div style="display:flex;align-items:center;gap:12px">
              <button class="btn btn-p" onclick="printLabels()"><svg class="bh-icon" aria-hidden="true"><use href="#i-printer"/></svg> Print Selected</button>
              <span style="font-size:12px;color:var(--text2)">Printed today: <strong id="print-cnt">0</strong></span>
            </div>
          </div>
        </div>
        <!-- Preview -->
        <div class="card barcode-panel" id="bc-preview">
          <div class="scan-line"></div>
          <div class="section-title" style="margin-bottom:14px">Label Preview</div>
          <div style="background:var(--bg-surface);border-radius:var(--radius-sm);padding:16px 20px;display:inline-block;margin:10px 0;min-width:200px">
            <div style="font-size:12px;font-weight:700;color:#000;margin-bottom:4px" id="pv-name">Select an item</div>
            <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px" id="pv-code">—</div>
            <div id="pv-bars" style="display:flex;align-items:flex-end;gap:1px;height:50px"></div>
            <div style="font-size:12px;font-weight:800;color:#000;margin-top:6px" id="pv-price">—</div>
          </div>
          <div style="font-size:12px;color:var(--text2);margin-top:6px">Size: <span id="pv-size">50×25 mm</span></div>
        </div>
      </div>
    </section>

    <!-- ── BRANCHES (M8) ── -->
    <section class="page" id="page-branches">
      <div class="card" style="margin-bottom:16px">
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
          <div class="fg" style="margin-bottom:0;flex:1;min-width:160px"><label class="fl">New branch</label><input class="fi" id="br-name" placeholder="Branch name"></div>
          <div class="fg" style="margin-bottom:0"><label class="fl">Approver</label><input class="fi" id="br-approver" value="Aj"></div>
          <button class="btn btn-p" onclick="brAdd()">Add (read-only)</button>
        </div>
        <div style="font-size:12px;color:var(--text2);margin-top:8px">Every branch starts read-only with a 0 spend cap. Ticking more actions or raising the cap asks you to confirm. Even then the agent only prepares work; the approver decides.</div>
        <div id="br-msg" style="font-size:12px;margin-top:6px;color:var(--amber)"></div>
      </div>
      <div id="br-list"></div>
    </section>

    <!-- ── POLICY WATCH (M7) ── -->
    <section class="page" id="page-policy">
      <div class="card" style="margin-bottom:16px;border-left:3px solid var(--amber)">
        <b>Rates are not verified.</b> Imported tiles carry heavy duty and cess, and policy changes move prices hard.
        Confirm any number against the source link before using it. A note is "verified" only when you tick it and it has a source link.
      </div>
      <div class="card" style="margin-bottom:16px">
        <div class="section-title" style="margin-bottom:10px">Add note</div>
        <div class="grid-3">
          <div class="fg"><label class="fl">Date</label><input type="date" class="fi" id="pn-date"></div>
          <div class="fg"><label class="fl">Topic</label><select class="fs" id="pn-topic"><option>import duty</option><option>cess</option><option>anti-dumping</option><option>import ban</option></select></div>
          <div class="fg"><label class="fl">Price risk</label><select class="fs" id="pn-risk"><option>low</option><option selected>med</option><option>high</option></select></div>
        </div>
        <div class="fg"><label class="fl">Summary</label><textarea class="fi" rows="2" id="pn-summary" style="width:100%"></textarea></div>
        <div class="fg"><label class="fl">Source link</label><input class="fi" id="pn-url" placeholder="https://..."></div>
        <button class="btn btn-p" onclick="pnAdd()">Add</button>
        <div id="pn-msg" style="font-size:12px;margin-top:6px;color:var(--amber)"></div>
      </div>
      <div class="card"><div class="tbl-wrap"><table><thead><tr><th>Date</th><th>Topic</th><th>Summary</th><th>Source</th><th>Risk</th><th>Verified</th><th></th></tr></thead><tbody id="pn-tbody"></tbody></table></div></div>
    </section>

    <!-- ── REPLY DRAFTS (M6) ── -->
    <section class="page" id="page-replies">
      <div class="card" style="margin-bottom:16px">
        <div class="section-title" style="margin-bottom:10px">New draft</div>
        <div class="grid-3">
          <div class="fg"><label class="fl">Channel</label><select class="fs" id="rd-channel"><option>whatsapp</option><option>email</option></select></div>
          <div class="fg"><label class="fl">Customer (phone / email)</label><input class="fi" id="rd-ref"></div>
        </div>
        <div class="fg"><label class="fl">Customer wrote</label><textarea class="fi" rows="2" id="rd-in" style="width:100%"></textarea></div>
        <div class="fg"><label class="fl">Draft reply</label><textarea class="fi" rows="3" id="rd-draft" style="width:100%"></textarea></div>
        <button class="btn btn-p" onclick="rdAdd()">Save draft</button>
        <div style="font-size:12px;color:var(--text2);margin-top:8px">Nothing is sent from here. Approve the wording, then send it yourself and tap "I sent it". Replies with prices are marked.</div>
        <div id="rd-msg" style="font-size:12px;margin-top:6px;color:var(--amber)"></div>
      </div>
      <div id="rd-list"></div>
    </section>

    <!-- ── WEBSITE CATALOGUE (M5) ── -->
    <section class="page" id="page-webcat">
      <div class="card" style="margin-bottom:16px;font-size:12px;color:var(--text2)">
        The public website shows only: name, size (cm + inches), finish, use and photo. Never price, cost or stock.
        Items stay hidden until you tick Show. An item needs a size and a photo first.
        <div id="wc-msg" style="margin-top:6px;color:var(--amber)"></div>
      </div>
      <div class="card"><div class="tbl-wrap"><table><thead><tr><th>Code</th><th>Name</th><th>Photo</th><th>Size cm (60x60)</th><th>Finish</th><th>Use</th><th>Show on website</th></tr></thead><tbody id="wc-tbody"></tbody></table></div></div>
    </section>

    <!-- ── WEBSITE EDITOR ── -->
    <section class="page" id="page-website">
      <div class="card" style="margin-bottom:16px">
        <a id="we-view" class="btn btn-p" href="/site" target="_blank" rel="noopener" style="width:100%;justify-content:center;min-height:50px;font-size:16px">View website</a>
        <div id="we-msg" style="margin-top:10px;font-size:13px"></div>
      </div>

      <div class="card" style="margin-bottom:16px">
        <div class="section-title" style="margin-bottom:10px">Tiles on the website</div>
        <button id="we-add" type="button" class="btn btn-p" style="width:100%;justify-content:center;min-height:50px;font-size:16px">+ Add a tile</button>
        <div id="we-tiles" style="margin-top:10px"></div>
      </div>

      <div class="card" id="we-form" style="margin-bottom:16px;display:none">
        <div class="section-title" id="we-form-title" style="margin-bottom:10px">Add a tile</div>
        <div class="fg"><label class="fl" for="we-name">Name</label><input class="fi" style="font-size:16px;min-height:46px" id="we-name" maxlength="80"></div>
        <div class="fg"><label class="fl" for="we-size">Size (for example 24 x 24 in)</label><input class="fi" style="font-size:16px;min-height:46px" id="we-size" maxlength="40"></div>
        <div class="fg"><label class="fl" for="we-finish">Finish</label><select class="fs" style="font-size:16px;min-height:46px" id="we-finish"><option value="glossy">Glossy</option><option value="matt">Matt</option><option value="polished">Polished</option></select></div>
        <div class="fg"><label class="fl" for="we-group">Group</label><select class="fs" style="font-size:16px;min-height:46px" id="we-group"><option value="stone">Stone look</option><option value="wood">Wood look</option><option value="wall">Wall and mosaic</option><option value="conc">Concrete and terrazzo</option></select></div>
        <div class="fg"><label class="fl" for="we-photo">Photo (JPG, PNG or WebP, up to 5 MB)</label><input type="file" class="fi" id="we-photo" accept="image/jpeg,image/png,image/webp" style="font-size:16px"></div>
        <div id="we-preview" style="display:none;width:120px;height:120px;border-radius:10px;background-size:cover;background-position:center;margin-bottom:12px"></div>
        <label style="display:flex;align-items:center;gap:12px;min-height:48px;font-size:16px;margin-bottom:12px"><input type="checkbox" id="we-visible" checked style="width:24px;height:24px"> Show on website</label>
        <button id="we-save" type="button" class="btn btn-p" style="width:100%;justify-content:center;min-height:50px;font-size:16px;margin-bottom:10px">Save tile</button>
        <button id="we-cancel" type="button" class="btn btn-s" style="width:100%;justify-content:center;min-height:50px;font-size:16px;margin-bottom:10px">Cancel</button>
        <button id="we-rmphoto" type="button" class="btn btn-s" style="width:100%;justify-content:center;min-height:50px;font-size:16px;margin-bottom:10px;display:none">Remove photo</button>
        <button id="we-delete" type="button" class="btn btn-d" style="width:100%;justify-content:center;min-height:50px;font-size:16px;display:none">Delete tile</button>
        <div id="we-fmsg" style="margin-top:10px;font-size:13px"></div>
      </div>

      <div class="card" style="margin-bottom:16px">
        <div class="section-title" style="margin-bottom:10px">Website text</div>
        <div class="fg"><label class="fl" for="we-wa">WhatsApp number</label><input class="fi" style="font-size:16px;min-height:46px" id="we-wa" type="tel" maxlength="20" placeholder="0777999219"></div>
        <div class="fg"><label class="fl" for="we-addr">Address</label><input class="fi" style="font-size:16px;min-height:46px" id="we-addr" maxlength="200"></div>
        <div class="fg"><label class="fl" for="we-hen">Promise heading (English)</label><input class="fi" style="font-size:16px;min-height:46px" id="we-hen" maxlength="120"></div>
        <div class="fg"><label class="fl" for="we-pen">Promise paragraph (English)</label><textarea class="fi" style="font-size:16px;min-height:90px" id="we-pen" maxlength="600"></textarea></div>
        <div class="fg"><label class="fl" for="we-hsi">Promise heading (Sinhala)</label><input class="fi" style="font-size:16px;min-height:46px" id="we-hsi" maxlength="120"></div>
        <div class="fg"><label class="fl" for="we-psi">Promise paragraph (Sinhala)</label><textarea class="fi" style="font-size:16px;min-height:90px" id="we-psi" maxlength="600"></textarea></div>
        <div class="fg"><label class="fl" for="we-hta">Promise heading (Tamil)</label><input class="fi" style="font-size:16px;min-height:46px" id="we-hta" maxlength="120"></div>
        <div class="fg"><label class="fl" for="we-pta">Promise paragraph (Tamil)</label><textarea class="fi" style="font-size:16px;min-height:90px" id="we-pta" maxlength="600"></textarea></div>
        <button id="we-tsave" type="button" class="btn btn-p" style="width:100%;justify-content:center;min-height:50px;font-size:16px">Save text</button>
        <div id="we-tmsg" style="margin-top:10px;font-size:13px"></div>
      </div>
    </section>
    <!-- ── TILE GALLERY (read-only) ── -->
    <section class="page" id="page-tilegallery">
      <style>
        #tg-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px}
        .tg-card{display:flex;flex-direction:column;gap:6px;text-align:left;padding:8px;min-height:48px;border-radius:var(--radius-sm);background:var(--card);border:1px solid var(--card-border);color:var(--text);cursor:pointer}
        .tg-card img{width:100%;height:auto;aspect-ratio:1;object-fit:cover;border-radius:8px;display:block}
        .tg-name{font-size:14px;font-weight:700}.tg-note{font-size:12px;color:var(--text2)}
        #tg-dlg{position:fixed;inset:0;margin:auto;height:fit-content;border:1px solid var(--card-border);border-radius:var(--radius);background:var(--card);color:var(--text);padding:12px;max-width:min(92vw,560px)}
        #tg-dlg::backdrop{background:rgba(0,0,0,.6)}#tg-big{width:100%;height:auto;border-radius:8px;display:block}
      </style>
      <div class="card" style="margin-bottom:16px;font-size:13px;color:var(--text2)">Real tiles from the shop. Tap a picture to see it larger. Pictures only: no prices, no stock.</div>
      <div class="card"><div id="tg-grid"></div></div>
      <dialog id="tg-dlg" aria-labelledby="tg-title">
        <div id="tg-title" style="font-weight:700;font-size:16px;margin-bottom:10px"></div>
        <img id="tg-big" alt="">
        <button id="tg-close" type="button" class="btn btn-s" style="width:100%;justify-content:center;min-height:48px;font-size:16px;margin-top:12px">Close</button>
      </dialog>
    </section>
    <!-- ── COMPETITOR WATCH (M4) ── -->
    <section class="page" id="page-competitors">
      <div class="card" style="margin-bottom:16px">
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
          <div class="fg" style="margin-bottom:0"><label class="fl">Month</label><input type="month" class="fi" id="cw-month" onchange="loadCompetitors()"></div>
          <div class="fg" style="margin-bottom:0;flex:1;min-width:160px"><label class="fl">Add competitor</label><input class="fi" id="cw-name" placeholder="Name"></div>
          <div class="fg" style="margin-bottom:0"><label class="fl">Area</label><input class="fi" id="cw-area" placeholder="nawala / thihariya strip / island-wide"></div>
          <button class="btn btn-p" onclick="cwAdd()">Add</button>
        </div>
        <div style="font-size:12px;color:var(--text2);margin-top:8px">Monthly check: who posts, who goes live, who has an online store, any promotions. Blank means not checked yet.</div>
        <div id="cw-msg" style="font-size:12px;margin-top:6px"></div>
      </div>
      <div class="card"><div class="tbl-wrap"><table><thead><tr><th>Name</th><th>Area</th><th>Channels (tiktok,facebook,site)</th><th>Posts</th><th>Live</th><th>Online store</th><th>Promotions</th><th>Last checked</th><th>Notes</th><th></th></tr></thead><tbody id="cw-tbody"></tbody></table></div></div>
    </section>

    <!-- ── CONTENT CALENDAR (M3) ── -->
    <section class="page" id="page-content">
      <div class="card" style="margin-bottom:16px">
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
          <div class="fg" style="margin-bottom:0"><label class="fl">Week of</label><input type="date" class="fi" id="cp-week"></div>
          <button class="btn btn-p" onclick="cpPlanWeek()">Plan this week (3 videos + 1 live)</button>
        </div>
        <div style="font-size:12px;color:var(--text2);margin-top:8px">Nothing is posted automatically. Film and post by hand, then mark it posted and paste the link.</div>
        <div id="cp-msg" style="font-size:12px;margin-top:6px"></div>
      </div>
      <div class="card" style="margin-bottom:16px">
        <div class="section-title" style="margin-bottom:10px">Add one</div>
        <div class="grid-3">
          <div class="fg"><label class="fl">Date</label><input type="date" class="fi" id="cp-date"></div>
          <div class="fg"><label class="fl">Platform</label><select class="fs" id="cp-platform"><option>tiktok</option><option>live</option><option>facebook</option></select></div>
          <div class="fg"><label class="fl">Type</label><select class="fs" id="cp-type"><option>price-per-sqm</option><option>room idea</option><option>delivery/job clip</option><option>live</option></select></div>
        </div>
        <button class="btn btn-p" onclick="cpAdd()">Add</button>
      </div>
      <div id="cp-list"></div>
    </section>

    <!-- ── SALARY & COSTS ── -->
    <section class="page" id="page-salary">
      <div data-attach="salary" data-attach-id="@month"></div>
      <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap" id="sl-tabs"></div>
      <div id="sl-body"></div>
    </section>

    <!-- ── DOCUMENT INBOX ── -->
    <section class="page" id="page-docinbox">
      <div class="card" style="margin-bottom:16px">
        <div class="section-title" style="margin-bottom:10px">Add a paper</div>
        <div class="grid-3">
          <div class="fg"><label class="fl">What is it?</label>
            <select class="fs" id="di-type"><option value="auto">Let the app decide (from the heading)</option><option value="manual_bill">Manual bill</option><option value="grn">GRN (goods received)</option><option value="cheque">Cheque</option><option value="day_sheet">Daily sales sheet</option><option value="expense_sheet">Expense list</option></select></div>
          <div class="fg" style="grid-column:span 2"><label class="fl">Photo (take one or choose a file)</label><input type="file" class="fi" id="di-file" accept="image/*,application/pdf" capture="environment"></div>
        </div>
        <button class="btn btn-p" onclick="diUpload()">Upload and read</button>
        <div style="font-size:12px;color:var(--text2);margin-top:8px">Write the heading at the top of the paper: BILL, GRN, CHEQUE, EXPENSES or DAILY SALES. Photos sent to LAYLA on WhatsApp land here too. Nothing is filed until you check it and press Confirm.</div>
        <div id="di-msg" style="font-size:12px;margin-top:6px;color:var(--amber)"></div>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap" id="di-tabs"></div>
      <div id="di-list"></div>
    </section>

    <!-- ── SHOP TOOLS ── -->
    <section class="page" id="page-shoptools">
      <div class="card" style="margin-bottom:16px">
        <div class="section-title" style="margin-bottom:10px">How many tiles?</div>
        <div class="grid-3">
          <div class="fg"><label class="fl">Room length (m)</label><input type="number" step="0.01" class="fi" id="st-len"></div>
          <div class="fg"><label class="fl">Room width (m)</label><input type="number" step="0.01" class="fi" id="st-wid"></div>
          <div class="fg"><label class="fl">Tile size (cm)</label><input class="fi" id="st-size" placeholder="60x60"></div>
          <div class="fg"><label class="fl">Pieces per box (optional)</label><input type="number" class="fi" id="st-ppb"></div>
          <div class="fg"><label class="fl">Wastage % (default 10)</label><input type="number" class="fi" id="st-waste" placeholder="10"></div>
        </div>
        <button class="btn btn-p" onclick="stEstimate()">Work it out</button>
        <div id="st-est-out" style="margin-top:10px;font-size:14px"></div>
      </div>
      <div class="card" style="margin-bottom:16px">
        <div class="section-title" style="margin-bottom:10px">Price per square metre</div>
        <div class="grid-3">
          <div class="fg"><label class="fl">Box price</label><input type="number" class="fi" id="sp-box"></div>
          <div class="fg"><label class="fl">Pieces per box</label><input type="number" class="fi" id="sp-ppb"></div>
          <div class="fg"><label class="fl">Tile size (cm)</label><input class="fi" id="sp-size" placeholder="60x60"></div>
        </div>
        <button class="btn btn-p" onclick="stPerSqm()">Work it out</button>
        <div id="st-sqm-out" style="margin-top:10px;font-size:14px"></div>
      </div>
      <div class="card" style="margin-bottom:16px">
        <div class="section-title" style="margin-bottom:10px">Find an item</div>
        <input class="fi" id="st-q" placeholder="Name or code" oninput="stFindItems()" style="font-size:16px">
        <div class="tbl-wrap"><table><thead><tr><th>Code</th><th>Name</th><th>Category</th><th>Stock</th><th>Price</th></tr></thead><tbody id="st-items"></tbody></table></div>
      </div>
      <div class="card" style="margin-bottom:16px">
        <div class="section-title" style="margin-bottom:10px">Till summary</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
          <div class="fg" style="margin-bottom:0"><label class="fl">Day</label><input type="date" class="fi" id="st-day"></div>
          <button class="btn btn-p" onclick="stTill()">Show</button>
        </div>
        <div id="st-till-out" style="margin-top:10px;font-size:14px"></div>
      </div>
      <div class="card" style="margin-bottom:16px">
        <div class="section-title" style="margin-bottom:10px">Best sellers (last 30 days, from bills)</div>
        <div class="tbl-wrap"><table><thead><tr><th>Item</th><th>Units</th><th>Sales</th><th>Bills</th></tr></thead><tbody id="st-top"></tbody></table></div>
      </div>
      <div class="card">
        <div class="section-title" style="margin-bottom:10px">Running low</div>
        <div class="tbl-wrap"><table><thead><tr><th>Code</th><th>Name</th><th>Stock</th><th>Level</th><th>Suggested order</th></tr></thead><tbody id="st-low"></tbody></table></div>
        <button class="btn btn-s" style="margin-top:10px" onclick="window.open('/api/items/export.csv')">Stock-take sheet (CSV)</button>
      </div>
    </section>

    <!-- ── ENQUIRIES (M2) ── -->
    <section class="page" id="page-enquiries">
      <div class="card" style="margin-bottom:16px">
        <div class="section-title" style="margin-bottom:10px">Quick add</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px" id="enq-channels"></div>
        <div class="fg"><label class="fl">Product interest</label><input class="fi" id="enq-product" placeholder="e.g. floor tile 60x60" style="font-size:16px"></div>
        <div class="fg"><label class="fl">How did they find us?</label><input class="fi" id="enq-how" placeholder="e.g. saw TikTok live" style="font-size:16px"></div>
        <div class="fg"><label class="fl">Notes</label><input class="fi" id="enq-notes" style="font-size:16px"></div>
        <button class="btn btn-p" style="width:100%;padding:14px;font-size:16px" onclick="enqSave()">Save enquiry</button>
        <div id="enq-msg" style="font-size:12px;margin-top:6px;color:var(--text2)"></div>
      </div>
      <div class="card" style="margin-bottom:16px">
        <div class="section-title" style="margin-bottom:10px">Weekly count by channel (last 8 weeks)</div>
        <div class="tbl-wrap"><table><thead><tr><th>Week of</th><th>Channel</th><th>Enquiries</th></tr></thead><tbody id="enq-weekly"></tbody></table></div>
      </div>
      <div class="card"><div class="tbl-wrap"><table><thead><tr><th>Date</th><th>Channel</th><th>Interest</th><th>Found us</th><th>Status</th></tr></thead><tbody id="enq-tbody"></tbody></table></div></div>
    </section>

    <!-- ── AGENT REVIEW (M9) ── -->
    <section class="page" id="page-agentreview">
      <div class="card" style="margin-bottom:16px">
        <div class="section-title" style="margin-bottom:10px">Try a customer message</div>
        <div class="fg"><label class="fl">Customer wrote</label><input class="fi" id="av-in" placeholder="e.g. Do you have item 1001 in stock?" style="font-size:16px"></div>
        <label style="font-size:14px"><input type="checkbox" id="av-price"> include the price (it will be marked "needs Aj approval")</label>
        <div style="margin-top:8px"><button class="btn btn-p" onclick="avDraft()">Let the agent draft a reply</button></div>
        <div style="font-size:12px;color:var(--text2);margin-top:8px">Nothing is sent from here. The agent drafts, checks its own draft, and you approve or reject. Approve means "the wording is fine": you still send it yourself.</div>
        <div id="av-msg" style="font-size:12px;margin-top:6px;color:var(--amber)"></div>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap" id="av-tabs"></div>
      <div id="av-list"></div>
    </section>

    <!-- ── AGENT RULES (M1) ── -->
    <section class="page" id="page-agent-rules">
      <div class="card" style="margin-bottom:16px">
        <div class="section-title" style="margin-bottom:10px" id="ar-form-title">Add rule</div>
        <input type="hidden" id="ar-id">
        <div class="grid-3">
          <div class="fg"><label class="fl">Topic</label><input class="fi" id="ar-topic" placeholder="commission"></div>
          <div class="fg" style="grid-column:span 2"><label class="fl">Rule</label><input class="fi" id="ar-text" placeholder="State the rule clearly"></div>
        </div>
        <button class="btn btn-p" onclick="arSave()">Save</button>
        <button class="btn btn-s" onclick="arReset()">Clear</button>
        <button class="btn btn-s" onclick="window.open('/api/agent/rulebook')">Export text</button>
        <label style="font-size:12px;margin-left:10px"><input type="checkbox" id="ar-all" onchange="loadAgentRules()"> show old/inactive</label>
        <div style="font-size:12px;color:var(--text2);margin-top:8px">Editing saves a new version; the old one is kept.</div>
      </div>
      <div class="card"><div class="tbl-wrap"><table><thead><tr><th>Topic</th><th>Rule</th><th>Ver</th><th>Status</th><th>Action</th></tr></thead><tbody id="ar-tbody"></tbody></table></div></div>
    </section>

    <!-- ── REPORTS ── -->
    <section class="page" id="page-loans">
      <iframe id="frame-loans" title="Friend &amp; Investor Loans" data-src="/investor_loans.html" style="width:100%;height:calc(100vh - 130px);min-height:520px;border:1px solid var(--card-border);border-radius:12px;background:var(--bg-surface)"></iframe>
    </section>
    <section class="page" id="page-moneycontrol">
      <iframe id="frame-moneycontrol" title="Money Control" data-src="/money-control.html" style="width:100%;height:calc(100vh - 130px);min-height:520px;border:1px solid var(--card-border);border-radius:12px;background:var(--bg-surface)"></iframe>
    </section>
    <section class="page" id="page-commissions">
      <iframe id="frame-commissions" title="Sale Commissions" data-src="/sale_commissions.html" style="width:100%;height:calc(100vh - 130px);min-height:520px;border:1px solid var(--card-border);border-radius:12px;background:var(--bg-surface)"></iframe>
    </section>
    <section class="page" id="page-settings">
      <iframe id="frame-settings" title="Settings" data-src="/settings.html" style="width:100%;height:calc(100vh - 130px);min-height:520px;border:1px solid var(--card-border);border-radius:12px;background:var(--bg-surface)"></iframe>
    </section>
    <section class="page" id="page-reports">
      <div class="card" style="margin-bottom:16px">
        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end">
          <div class="fg" style="margin-bottom:0;flex:1;min-width:130px"><label class="fl">From</label><input type="date" class="fi" id="rpt-from"></div>
          <div class="fg" style="margin-bottom:0;flex:1;min-width:130px"><label class="fl">To</label><input type="date" class="fi" id="rpt-to"></div>
          <button class="btn btn-p" onclick="loadReport()">Generate</button>
          <button class="btn btn-s" onclick="window.open('/api/report-download-range?from='+document.getElementById('rpt-from').value+'&to='+document.getElementById('rpt-to').value)"><svg class="bh-icon" aria-hidden="true"><use href="#i-chart"/></svg> Excel</button>
        </div>
      </div>
      <!-- P&L -->
      <div class="card" style="margin-bottom:16px" id="pl-card">
        <div style="font-size:14px;font-weight:800;color:var(--gold);margin-bottom:14px;text-transform:uppercase;letter-spacing:0.06em">Profit &amp; Loss Summary</div>
        <div id="pl-rows"><div class="no-data">Generate a report to see P&amp;L</div></div>
        <div style="margin-top:10px;font-size:12px;color:var(--amber);padding:8px;background:rgba(245,158,11,0.06);border-radius:6px">
          <svg class="bh-icon" aria-hidden="true"><use href="#i-warning"/></svg> Rule enforced: Net Profit = Gross Profit − Expenses. Never Total Sale − Expenses.
        </div>
      </div>
      <!-- WhatsApp / Investor -->
      <div class="grid-2" style="margin-bottom:16px">
        <div class="card">
          <div class="section-title" style="margin-bottom:10px"><svg class="bh-icon" aria-hidden="true"><use href="#i-phone"/></svg> WhatsApp Daily Report</div>
          <div style="background:var(--bg3);border-radius:var(--radius-sm);padding:12px;font-size:12px;font-family:monospace;line-height:1.9;margin-bottom:10px" id="wa-text">Select a date in Daily Sales tab first</div>
          <button class="btn btn-g" onclick="copyWA()"><svg class="bh-icon" aria-hidden="true"><use href="#i-clipboard"/></svg> Copy &amp; Share</button>
        </div>
        <div class="card">
          <div class="section-title" style="margin-bottom:10px">Investor Report</div>
          <div style="background:var(--bg3);border-radius:var(--radius-sm);padding:18px;font-size:20px;font-weight:700;line-height:2.2;text-align:center;margin-bottom:10px" id="investor-text">—</div>
          <button class="btn btn-s" onclick="window.print()"><svg class="bh-icon" aria-hidden="true"><use href="#i-printer"/></svg> Print</button>
        </div>
      </div>
      <!-- Daily list -->
      <div class="card">
        <div class="section-title" style="margin-bottom:12px">Daily Breakdown</div>
        <div class="tbl-wrap"><table><thead><tr><th>Date</th><th>Total Sale</th><th>Cash</th><th>Card</th><th>Online</th><th>Credit</th><th>GP</th><th>Expenses</th><th>Net Profit</th><th>Tier</th></tr></thead><tbody id="rpt-tbody"></tbody></table></div>
      </div>
    </section>

  </div>
</div>

<script>
/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
let TARGET = 100000; // daily sales target for the gauge: replaced by the Admin Settings value (dashboard_sales_target) after login
function _paintTarget() {   // the target figure shown on the dashboard always matches the real target (it used to say 250,000 while the gauge used 100,000)
  const tl = document.getElementById('target-label'), tm = document.getElementById('target-max');
  if (tl) tl.textContent = 'LKR ' + TARGET.toLocaleString() + ' target'; if (tm) tm.textContent = 'LKR ' + TARGET.toLocaleString();
}
document.addEventListener('DOMContentLoaded', _paintTarget);

let charts = {};
let _invoices = [];   // cached for filter
let _stock = [];
let _cheques = [];
let _bcItems = [];
let _currentSalesDay = null;
let printCnt = 0;

const today = () => new Date().toISOString().slice(0,10);
const fmt = v => Number(v||0).toLocaleString('en-IN');
const fmtLKR = v => 'LKR ' + fmt(v);
const fmtDate = iso => {
  if (!iso) return '—';
  const [y,m,d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

/* ─────────────────────────────────────────────
   API WRAPPER
───────────────────────────────────────────── */
async function api(path, opts = {}) {
  try {
    const r = await fetch(path, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...opts.headers },
      ...opts
    });
    if (r.status === 401) { showLogin(); return null; }
    // 404 = no data for that date/record — return null silently, no toast
    if (r.status === 404) { console.info('No data:', path); return null; }
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || r.statusText);
    return data;
  } catch (e) {
    console.error(path, e);
    toast(e.message || 'API error', 'error');
    return null;
  }
}

/* ─────────────────────────────────────────────
   AUTH
───────────────────────────────────────────── */
function showLogin() {
  document.getElementById('login-overlay').style.display = 'flex';
}
function hideLogin() {
  document.getElementById('login-overlay').style.display = 'none';
}

async function doLogin() {
  const btn = document.getElementById('login-btn');
  const err = document.getElementById('login-err');
  const user = document.getElementById('l-user').value.trim();
  const pass = document.getElementById('l-pass').value;
  if (!user || !pass) { err.textContent = 'Enter username and password'; err.style.display = 'block'; return; }
  btn.textContent = 'Signing in…';
  btn.disabled = true;
  const r = await fetch('/api/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: user, password: pass })
  });
  const data = await r.json();
  btn.textContent = 'Sign In';
  btn.disabled = false;
  if (!r.ok || data.error) {
    err.textContent = data.error || 'Login failed';
    err.style.display = 'block';
    return;
  }
  err.style.display = 'none';
  hideLogin();
  initApp();
}

document.getElementById('l-pass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
document.getElementById('l-user').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('l-pass').focus(); });

async function doLogout() {
  try { if (navigator.serviceWorker && navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage({ type: 'clear-api' }); } catch (e) {}
  await fetch('/api/logout', { method: 'POST', credentials: 'include' });
  showLogin();
}

/* Check session on load */
(async () => {
  const me = await fetch('/api/me', { credentials: 'include' });
  if (me.ok) { hideLogin(); initApp(); }
  else showLogin();
})();

/* ─────────────────────────────────────────────
   NAV
───────────────────────────────────────────── */
const PAGE_META = {
  dashboard:   ['Dashboard',    'Live sales & KPI overview'],
  'daily-sales':['Daily Sales', 'Invoices & payment breakdown'],
  stock:       ['Stock',        'Inventory & GRN records'],
  pos:         ['POS Billing',  'Itemized bill with discount — share, print or PDF'],
  grn:         ['GRN',          'Receive a supplier delivery'],
  expenses:    ['Expenses',     'Daily expense detail'],
  cheques:     ['Cheques',      'Cheque register & calendar'],
  vendors:     ['Vendors',      'Supplier directory & payments'],
  barcode:     ['Barcode',      'Label print & preview'],
  reports:     ['Reports',      'P&L, range export, Investor report'],
  branches:    ['Branches',     'What the agent may do at each branch (starts read-only)'],
  policy:      ['Policy Watch','Import duty, cess, bans: unverified until sourced'],
  replies:     ['Reply Drafts','Agent drafts, you approve, you send by hand'],
  webcat:      ['Website Catalogue','Choose what the public website shows (no prices)'],
  website:     ['Website','Tiles and text of the public website (/site)'],
  tilegallery: ['Tile Gallery','Pictures of real tiles in the shop. Look only: no prices'],
  competitors: ['Competitors', 'Monthly check: who posts, goes live, sells online'],
  content:     ['Content',     'TikTok / live plan. Post by hand, nothing auto-posts'],
  agentreview: ['Agent Review', 'LAYLA drafts replies and checks itself. You approve. Nothing is sent'],
  loans:       ['Friend & Investor Loans','Money lent to the business: record loans and repayments (halal, no interest)'],
  moneycontrol:['Money Control','Where the money goes: allocations and viewer access'],
  commissions: ['Sale Commissions','Commission on sales and exchanges'],
  settings:    ['Settings','Shop, branding and options'],
  salary:      ['Salary & Costs', 'Daily cost target, monthly profit split, cheque set-aside'],
  docinbox:    ['Document Inbox', 'Photos of bills, GRNs, cheques and sheets. Check, then file'],
  shoptools:   ['Shop Tools',   'Tile calculator, item search, till summary, best sellers, low stock'],
  enquiries:   ['Enquiries',   'Where customers come from: TikTok, walk-in, WhatsApp...'],
  'agent-rules': ['Agent Rules', 'What the agent has been taught. Edits make new versions'],
};

/* Branch Profile (M8): new branches are read-only; widening asks for confirmation */
const BR_ACTIONS = [['draft','Draft text'],['stage_order','Prepare orders'],['stage_post','Prepare posts']];
async function brCall(url, method, body) {
  const r = await fetch(url, { method, headers: {'Content-Type':'application/json'}, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) { document.getElementById('br-msg').textContent = (await r.json()).error || 'Failed'; return null; }
  document.getElementById('br-msg').textContent = ''; return r.json();
}
async function loadBranches() {
  const r = await fetch('/api/branches');
  if (!r.ok) { document.getElementById('br-list').innerHTML = '<div class="card no-data">Owner only</div>'; return; }
  const rows = await r.json();
  document.getElementById('br-list').innerHTML = rows.map(x => `<div class="card" style="margin-bottom:10px">
    <div style="margin-bottom:6px"><b>${arEsc(x.name)}</b> · approver ${arEsc(x.approver)} · agent: <b>${x.agent_allowed_actions.length === 1 ? 'read-only' : arEsc(x.agent_allowed_actions.join(', '))}</b></div>
    <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center">
      ${BR_ACTIONS.map(([k, label]) => `<label style="font-size:14px"><input type="checkbox" ${x.agent_allowed_actions.includes(k) ? 'checked' : ''} onchange="brToggle(${x.id},'${k}',this.checked)"> ${label}</label>`).join('')}
      <label style="font-size:14px">Spend cap (LKR) <input class="fi" type="number" min="0" style="width:120px" value="${x.spend_cap_lkr}" onchange="brCap(${x.id},this.value)"></label>
    </div></div>`).join('') || '<div class="card no-data">No branches yet</div>';
  window._brRows = rows;
}
async function brAdd() {
  const name = document.getElementById('br-name').value;
  if (await brCall('/api/branches', 'POST', { name, approver: document.getElementById('br-approver').value })) { document.getElementById('br-name').value = ''; loadBranches(); }
}
async function brToggle(id, action, on) {
  const row = window._brRows.find(r => r.id === id);
  const set = new Set(row.agent_allowed_actions); on ? set.add(action) : set.delete(action);
  if (on && !confirm('Let the agent "' + action + '" for ' + row.name + '? It still needs ' + row.approver + '\'s approval each time.')) { loadBranches(); return; }
  await brCall('/api/branches/' + id, 'PUT', { agent_allowed_actions: [...set], widen_confirm: on });
  loadBranches();
}
async function brCap(id, val) {
  const row = window._brRows.find(r => r.id === id), n = Number(val);
  const up = n > row.spend_cap_lkr;
  if (up && !confirm('Raise the spend cap for ' + row.name + ' to LKR ' + n + '?')) { loadBranches(); return; }
  await brCall('/api/branches/' + id, 'PUT', { spend_cap_lkr: val, widen_confirm: up });
  loadBranches();
}

/* Policy Watch (M7) */
async function pnCall(url, method, body) {
  const r = await fetch(url, { method, headers: {'Content-Type':'application/json'}, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) { document.getElementById('pn-msg').textContent = (await r.json()).error || 'Failed'; return null; }
  document.getElementById('pn-msg').textContent = ''; return r.json();
}
async function loadPolicy() {
  const dEl = document.getElementById('pn-date'); if (!dEl.value) dEl.value = new Date().toISOString().slice(0, 10);
  const r = await fetch('/api/policy-notes');
  if (!r.ok) { document.getElementById('pn-tbody').innerHTML = '<tr><td colspan="7" class="no-data">Owner only</td></tr>'; return; }
  const rows = await r.json();
  document.getElementById('pn-tbody').innerHTML = rows.map(x => `<tr>
    <td>${arEsc(x.date)}</td><td>${arEsc(x.topic)}</td><td>${arEsc(x.summary)}</td>
    <td><input class="fi" style="min-width:150px" value="${arEsc(x.source_url)}" onchange="pnSet(${x.id},{source_url:this.value})"></td>
    <td><select class="fs" style="width:auto" onchange="pnSet(${x.id},{price_risk:this.value})">${['low','med','high'].map(s => `<option ${s === x.price_risk ? 'selected' : ''}>${s}</option>`).join('')}</select></td>
    <td><input type="checkbox" ${x.verified ? 'checked' : ''} onchange="pnSet(${x.id},{verified:this.checked})"> ${x.verified ? '' : '<span style="color:var(--amber);font-size:12px">unverified</span>'}</td>
    <td><button class="btn btn-s" onclick="pnDel(${x.id})">✕</button></td></tr>`).join('') || '<tr><td colspan="7" class="no-data">No notes yet</td></tr>';
}
async function pnAdd() {
  const body = { date: document.getElementById('pn-date').value, topic: document.getElementById('pn-topic').value, price_risk: document.getElementById('pn-risk').value,
    summary: document.getElementById('pn-summary').value, source_url: document.getElementById('pn-url').value };
  if (await pnCall('/api/policy-notes', 'POST', body)) { document.getElementById('pn-summary').value = ''; document.getElementById('pn-url').value = ''; loadPolicy(); }
}
async function pnSet(id, patch) { await pnCall('/api/policy-notes/' + id, 'PUT', patch); loadPolicy(); }
async function pnDel(id) { if (confirm('Delete this note?') && await pnCall('/api/policy-notes/' + id, 'DELETE')) loadPolicy(); }

/* Reply Drafts (M6): drafts only, nothing is sent from here */
async function rdCall(url, method, body) {
  const r = await fetch(url, { method, headers: {'Content-Type':'application/json'}, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) { document.getElementById('rd-msg').textContent = (await r.json()).error || 'Failed'; return null; }
  document.getElementById('rd-msg').textContent = ''; return r.json();
}
async function loadReplies() {
  const r = await fetch('/api/reply-drafts');
  if (!r.ok) { document.getElementById('rd-list').innerHTML = '<div class="card no-data">Owner only</div>'; return; }
  const rows = await r.json();
  document.getElementById('rd-list').innerHTML = rows.map(x => `<div class="card" style="margin-bottom:10px">
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:6px">
      <b>${arEsc(x.channel)}</b> <span>${arEsc(x.customer_ref)}</span> <b>${arEsc(x.status)}</b>
      ${x.has_price ? '<span style="color:var(--amber);font-weight:700"><svg class="bh-icon" aria-hidden="true"><use href="#i-warning"/></svg> contains a price</span>' : ''}
    </div>
    ${x.incoming_text ? `<div style="font-size:12px;color:var(--text2);margin-bottom:6px">Customer: ${arEsc(x.incoming_text)}</div>` : ''}
    <textarea class="fi" rows="3" style="width:100%" ${x.status === 'sent' ? 'disabled' : ''} onchange="rdEdit(${x.id},this.value)">${arEsc(x.draft_text)}</textarea>
    <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
      ${x.status === 'draft' ? `<button class="btn btn-p" onclick="rdAct(${x.id},'approve')">Approve wording</button>` : ''}
      ${x.status === 'approved' ? `<button class="btn btn-p" onclick="rdAct(${x.id},'mark-sent')">I sent it</button>` : ''}
      ${x.status === 'draft' || x.status === 'approved' ? `<button class="btn btn-s" onclick="rdAct(${x.id},'reject')">Reject</button>` : ''}
    </div></div>`).join('') || '<div class="card no-data">No drafts yet</div>';
}
async function rdAdd() {
  const body = { channel: document.getElementById('rd-channel').value, customer_ref: document.getElementById('rd-ref').value,
    incoming_text: document.getElementById('rd-in').value, draft_text: document.getElementById('rd-draft').value };
  if (await rdCall('/api/reply-drafts', 'POST', body)) { ['rd-ref','rd-in','rd-draft'].forEach(i => document.getElementById(i).value = ''); loadReplies(); }
}
async function rdEdit(id, text) { if (await rdCall('/api/reply-drafts/' + id, 'PUT', { draft_text: text })) loadReplies(); }
async function rdAct(id, act) { if (await rdCall('/api/reply-drafts/' + id + '/' + act, 'POST')) loadReplies(); }

/* Website Catalogue (M5) */
async function loadWebCat() {
  const r = await fetch('/api/catalogue-web');
  if (!r.ok) { document.getElementById('wc-tbody').innerHTML = '<tr><td colspan="7" class="no-data">Owner only</td></tr>'; return; }
  const rows = await r.json();
  document.getElementById('wc-tbody').innerHTML = rows.map(x => `<tr>
    <td>${arEsc(x.item_code)}</td><td>${arEsc(x.name)}</td>
    <td>${x.photo_url ? `<img src="${arEsc(x.photo_url)}" style="height:36px">` : '<span style="color:var(--amber)">none</span>'}</td>
    <td><input class="fi" style="width:90px" value="${arEsc(x.size_cm)}" onchange="wcSave('${arEsc(x.item_code)}',{size_cm:this.value})"></td>
    <td><input class="fi" style="width:110px" value="${arEsc(x.finish)}" onchange="wcSave('${arEsc(x.item_code)}',{finish:this.value})"></td>
    <td><input class="fi" style="width:150px" value="${arEsc(x.use)}" onchange="wcSave('${arEsc(x.item_code)}',{use:this.value})"></td>
    <td><input type="checkbox" ${x.published ? 'checked' : ''} onchange="wcSave('${arEsc(x.item_code)}',{published:this.checked})"></td></tr>`).join('')
    || '<tr><td colspan="7" class="no-data">No items</td></tr>';
}
async function wcSave(code, patch) {
  const r = await fetch('/api/catalogue-web/' + encodeURIComponent(code), { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(patch) });
  document.getElementById('wc-msg').textContent = r.ok ? '' : ((await r.json()).error || 'Save failed');
  if (!r.ok) loadWebCat();
}

/* Competitor Watch (M4) */
function cwMsg(t) { document.getElementById('cw-msg').textContent = t || ''; }
async function cwCall(url, method, body) {
  const r = await fetch(url, { method, headers: {'Content-Type':'application/json'}, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) { cwMsg((await r.json()).error || 'Failed'); return null; }
  cwMsg(''); return r.json();
}
function cwTri(id, field, cur) {
  const v = cur == null ? '' : String(cur);
  return `<select class="fs" style="width:auto" onchange="cwCheck(${id},'${field}',this.value)"><option value="" ${v===''?'selected':''}>–</option><option value="true" ${v==='true'?'selected':''}>yes</option><option value="false" ${v==='false'?'selected':''}>no</option></select>`;
}
async function loadCompetitors() {
  const mEl = document.getElementById('cw-month');
  if (!mEl.value) mEl.value = new Date().toISOString().slice(0, 7);
  const r = await fetch('/api/competitors/checklist?month=' + mEl.value);
  if (!r.ok) { document.getElementById('cw-tbody').innerHTML = '<tr><td colspan="10" class="no-data">Owner only</td></tr>'; return; }
  const data = await r.json();
  document.getElementById('cw-tbody').innerHTML = data.items.map(x => { const c = x.check || {}; return `<tr>
    <td>${arEsc(x.name)}</td>
    <td><input class="fi" style="min-width:110px" value="${arEsc(x.area)}" onchange="cwCall('/api/competitors/${x.id}','PUT',{area:this.value})"></td>
    <td><input class="fi" style="min-width:110px" value="${arEsc(x.channels)}" onchange="cwCall('/api/competitors/${x.id}','PUT',{channels:this.value})"></td>
    <td>${cwTri(x.id,'posts',c.posts)}</td><td>${cwTri(x.id,'goes_live',c.goes_live)}</td><td>${cwTri(x.id,'online_store',c.online_store)}</td>
    <td><input class="fi" style="min-width:130px" value="${arEsc(c.promotions)}" onchange="cwCheck(${x.id},'promotions',this.value)"></td>
    <td>${arEsc(x.last_checked || '')}</td>
    <td><input class="fi" style="min-width:130px" value="${arEsc(x.notes)}" onchange="cwCall('/api/competitors/${x.id}','PUT',{notes:this.value})"></td>
    <td><button class="btn btn-s" onclick="cwDel(${x.id})">✕</button></td></tr>`; }).join('');
}
// Each edit of a check field saves a fresh check for the chosen month, carrying over the other answers.
async function cwCheck(id, field, val) {
  const r = await fetch('/api/competitors/checklist?month=' + document.getElementById('cw-month').value);
  const cur = ((await r.json()).items.find(i => i.id === id) || {}).check || {};
  const body = { posts: cur.posts, goes_live: cur.goes_live, online_store: cur.online_store, promotions: cur.promotions || '' };
  body[field] = field === 'promotions' ? val : (val === '' ? null : val === 'true');
  const m = document.getElementById('cw-month').value, today = new Date().toISOString().slice(0, 10);
  body.checked_on = today.slice(0, 7) === m ? today : m + '-01';
  if (await cwCall('/api/competitors/' + id + '/checks', 'POST', body)) loadCompetitors();
}
async function cwAdd() {
  const name = document.getElementById('cw-name').value;
  if (!name.trim()) { cwMsg('Enter a name'); return; }
  if (await cwCall('/api/competitors', 'POST', { name, area: document.getElementById('cw-area').value })) {
    document.getElementById('cw-name').value = ''; document.getElementById('cw-area').value = ''; loadCompetitors();
  }
}
async function cwDel(id) { if (confirm('Remove this competitor and its checks?') && await cwCall('/api/competitors/' + id, 'DELETE')) loadCompetitors(); }

/* Content Calendar (M3): manual posting only */
const CP_STATUSES = ['idea','scripted','filmed','posted'];
function cpMsg(t) { document.getElementById('cp-msg').textContent = t || ''; }
async function cpCall(url, method, body) {
  const r = await fetch(url, { method, headers: {'Content-Type':'application/json'}, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) { cpMsg((await r.json()).error || 'Failed'); return null; }
  cpMsg(''); return r.json();
}
async function loadContent() {
  const r = await fetch('/api/content-posts');
  if (!r.ok) { document.getElementById('cp-list').innerHTML = '<div class="card no-data">Owner only</div>'; return; }
  const rows = await r.json();
  document.getElementById('cp-list').innerHTML = rows.map(x => `<div class="card" style="margin-bottom:10px">
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px">
      <b>${arEsc(x.planned_date)}</b> <span>${arEsc(x.platform)} · ${arEsc(x.type)}</span>
      <select class="fs" style="width:auto" onchange="cpSet(${x.id},{status:this.value})">${CP_STATUSES.map(s => `<option ${s === x.status ? 'selected' : ''}>${s}</option>`).join('')}</select>
      <button class="btn btn-s" onclick="cpDel(${x.id})">Delete</button>
    </div>
    <textarea class="fi" rows="3" placeholder="Script / caption draft" style="width:100%;font-size:14px" onchange="cpSet(${x.id},{script_draft:this.value})">${arEsc(x.script_draft)}</textarea>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
      <input class="fi" style="flex:2;min-width:160px" placeholder="Posted link (after you post it)" value="${arEsc(x.posted_url)}" onchange="cpSet(${x.id},{posted_url:this.value})">
      <input class="fi" type="number" min="0" style="flex:1;min-width:110px" placeholder="Enquiries after" value="${x.enquiries_after == null ? '' : x.enquiries_after}" onchange="cpSet(${x.id},{enquiries_after:this.value===''?null:Number(this.value)})">
    </div></div>`).join('') || '<div class="card no-data">Nothing planned. Use "Plan this week".</div>';
}
async function cpPlanWeek() {
  const w = document.getElementById('cp-week').value || new Date().toISOString().slice(0, 10);
  const r = await cpCall('/api/content-posts/plan-week', 'POST', { week_of: w });
  if (r) { cpMsg(r.created.length ? 'Added ' + r.created.length + ' slots' : 'That week is already planned'); loadContent(); }
}
async function cpAdd() {
  const d = document.getElementById('cp-date').value;
  if (!d) { cpMsg('Pick a date'); return; }
  const r = await cpCall('/api/content-posts', 'POST', { planned_date: d, platform: document.getElementById('cp-platform').value, type: document.getElementById('cp-type').value });
  if (r) loadContent();
}
async function cpSet(id, patch) { await cpCall('/api/content-posts/' + id, 'PUT', patch); }
async function cpDel(id) { if (confirm('Delete this post?') && await cpCall('/api/content-posts/' + id, 'DELETE')) loadContent(); }

/* Shop Tools */
const stNum = id => document.getElementById(id).value;
const stMoney = n => Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
async function stPost(url, body) {
  const r = await fetch(url, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Failed');
  return d;
}
async function stEstimate() {
  const out = document.getElementById('st-est-out');
  try {
    const d = await stPost('/api/tools/tile-estimate', { room_length_m: stNum('st-len'), room_width_m: stNum('st-wid'), tile_size_cm: stNum('st-size'),
      pieces_per_box: stNum('st-ppb') || undefined, wastage_pct: stNum('st-waste') || undefined });
    out.innerHTML = `Room ${d.room_area_m2} m². Needs <b>${d.pieces_needed} pieces</b> (${d.pieces_without_wastage} + ${d.wastage_pct}% for cuts)` +
      (d.boxes_needed ? `, which is <b>${d.boxes_needed} boxes</b> (${d.pieces_bought} pieces, ${d.spare_pieces} spare, ${d.area_bought_m2} m²).` : '.');
  } catch (e) { out.textContent = e.message; }
}
async function stPerSqm() {
  const out = document.getElementById('st-sqm-out');
  try {
    const d = await stPost('/api/tools/price-per-sqm', { box_price: stNum('sp-box'), pieces_per_box: stNum('sp-ppb'), tile_size_cm: stNum('sp-size') });
    out.innerHTML = `Per tile <b>${stMoney(d.price_per_tile)}</b> · per m² <b>${stMoney(d.price_per_m2)}</b>`;
  } catch (e) { out.textContent = e.message; }
}
let _stTimer;
function stFindItems() { clearTimeout(_stTimer); _stTimer = setTimeout(stLoadItems, 250); }
async function stLoadItems() {
  const r = await fetch('/api/items?limit=20&q=' + encodeURIComponent(stNum('st-q')));
  const rows = r.ok ? await r.json() : [];
  document.getElementById('st-items').innerHTML = rows.map(x => `<tr><td>${arEsc(x.item_code)}</td><td>${arEsc(x.name)}</td><td>${arEsc(x.category)}</td>` +
    `<td style="${x.low_stock ? 'color:var(--amber);font-weight:700' : ''}">${arEsc(x.stock_level)}</td><td>${stMoney(x.selling_price)}</td></tr>`).join('') || '<tr><td colspan="5" class="no-data">No items</td></tr>';
}
async function stTill() {
  const day = stNum('st-day'); const out = document.getElementById('st-till-out');
  const r = await fetch('/api/pos-bills/summary?date=' + day); const d = await r.json();
  if (!r.ok) { out.textContent = d.error; return; }
  out.innerHTML = `<b>${d.bills} bills</b> · sales ${stMoney(d.subtotal)} · discounts ${stMoney(d.discount)} · <b>total ${stMoney(d.total)}</b><br>` +
    (d.by_payment.map(p => `${arEsc(p.payment_method)}: ${stMoney(p.total)} (${p.bills})`).join(' · ') || 'No bills that day');
}
async function loadShopTools() {
  const dEl = document.getElementById('st-day'); if (!dEl.value) { const n = new Date(); dEl.value = `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`; }
  stLoadItems(); stTill();
  const [top, low] = await Promise.all([fetch('/api/pos-bills/top-items'), fetch('/api/items/reorder')]);
  const t = top.ok ? (await top.json()).items : [], l = low.ok ? await low.json() : [];
  document.getElementById('st-top').innerHTML = t.map(x => `<tr><td>${arEsc(x.item_name)}</td><td>${x.units}</td><td>${stMoney(x.revenue)}</td><td>${x.bills}</td></tr>`).join('') || '<tr><td colspan="4" class="no-data">No bills yet</td></tr>';
  document.getElementById('st-low').innerHTML = l.map(x => `<tr><td>${arEsc(x.item_code)}</td><td>${arEsc(x.name)}</td><td>${x.stock_level}</td><td>${x.reorder_threshold}</td><td><b>${x.suggested_order_qty}</b></td></tr>`).join('') || '<tr><td colspan="5" class="no-data">Nothing is low</td></tr>';
}

/* Enquiry Tracker (M2) */
const ENQ_CHANNELS = ['tiktok','facebook','whatsapp','walk-in','google','website','other'];
const ENQ_STATUSES = ['new','quoted','won','lost'];
let _enqChannel = '';
function enqPickChannel(c) {
  _enqChannel = c;
  document.querySelectorAll('#enq-channels button').forEach(b => b.className = 'btn ' + (b.dataset.c === c ? 'btn-p' : 'btn-s'));
}
async function loadEnquiries() {
  document.getElementById('enq-channels').innerHTML = ENQ_CHANNELS.map(c =>
    `<button class="btn ${c === _enqChannel ? 'btn-p' : 'btn-s'}" data-c="${c}" style="padding:12px 16px;font-size:15px" onclick="enqPickChannel('${c}')">${c}</button>`).join('');
  const [l, w] = await Promise.all([fetch('/api/enquiries'), fetch('/api/enquiries/weekly?weeks=8')]);
  if (!l.ok) { document.getElementById('enq-tbody').innerHTML = '<tr><td colspan="5" class="no-data">Owner only</td></tr>'; return; }
  const rows = await l.json(), wk = await w.json();
  document.getElementById('enq-weekly').innerHTML = wk.map(x => `<tr><td>${arEsc(x.week_start)}</td><td>${arEsc(x.channel)}</td><td>${x.n}</td></tr>`).join('') || '<tr><td colspan="3" class="no-data">No enquiries yet</td></tr>';
  document.getElementById('enq-tbody').innerHTML = rows.map(x =>
    `<tr><td>${arEsc(String(x.date).slice(0,10))}</td><td>${arEsc(x.channel)}</td><td>${arEsc(x.product_interest)}</td><td>${arEsc(x.how_found_us)}</td>` +
    `<td><select class="fs" onchange="enqStatus(${x.id}, this.value)">${ENQ_STATUSES.map(s => `<option ${s === x.status ? 'selected' : ''}>${s}</option>`).join('')}</select></td></tr>`
  ).join('') || '<tr><td colspan="5" class="no-data">No enquiries yet</td></tr>';
}
async function enqSave() {
  const msg = document.getElementById('enq-msg');
  if (!_enqChannel) { msg.textContent = 'Pick a channel first'; return; }
  const r = await fetch('/api/enquiries', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({
    channel: _enqChannel, product_interest: document.getElementById('enq-product').value,
    how_found_us: document.getElementById('enq-how').value, notes: document.getElementById('enq-notes').value }) });
  if (!r.ok) { msg.textContent = (await r.json()).error || 'Save failed'; return; }
  ['enq-product','enq-how','enq-notes'].forEach(i => document.getElementById(i).value = '');
  msg.textContent = 'Saved'; loadEnquiries();
}
async function enqStatus(id, status) {
  await fetch('/api/enquiries/' + id + '/status', { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ status }) });
}

/* Agent Review (M9): LAYLA drafts, checks itself, Aj approves or rejects. Nothing is sent. */
let _avStatus = 'draft';
async function avCall(url, method, body) {
  const r = await fetch(url, { method, headers: {'Content-Type':'application/json'}, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { document.getElementById('av-msg').textContent = d.error || 'Failed'; return null; }
  document.getElementById('av-msg').textContent = ''; return d;
}
function avTabs() {
  document.getElementById('av-tabs').innerHTML = [['draft','To review'],['approved','Approved'],['rejected','Rejected']].map(([k, l]) =>
    `<button class="btn ${k === _avStatus ? 'btn-p' : 'btn-s'}" onclick="_avStatus='${k}';loadAgentReview()">${l}</button>`).join('');
}
async function loadAgentReview() {
  avTabs();
  const r = await fetch('/api/agent-brain/reviews?status=' + _avStatus);
  if (!r.ok) { document.getElementById('av-list').innerHTML = '<div class="card no-data">Owner only</div>'; return; }
  const rows = await r.json();
  document.getElementById('av-list').innerHTML = rows.map(x => {
    const c = x.check || { checks: [], rules_used: [], reasoning: '', passed: false };
    const checks = c.checks.map(k => `<div style="font-size:14px;margin:2px 0"><b style="color:${k.pass ? 'var(--green,#2e7d32)' : 'var(--red,#c62828)'}">${k.pass ? '✓' : '✗'}</b> ${arEsc(k.label)} <span style="color:var(--text2)">· ${arEsc(k.detail)}</span></div>`).join('');
    const rules = c.rules_used.map(u => `[${arEsc(u.topic)}] v${u.version}`).join(', ') || 'none';
    const actions = x.status === 'draft'
      ? `<button class="btn btn-p" ${c.passed ? '' : 'disabled title="Fix the failed checks first"'} onclick="avAct(${x.id},'approve')">Approve wording</button>
         <button class="btn btn-s" onclick="avAct(${x.id},'reject')">Reject</button>
         <button class="btn btn-s" onclick="avSave(${x.id})">Save my edit and re-check</button>`
      : (x.status === 'approved' ? avSendButtons(x) + `<button class="btn btn-s" onclick="avAct(${x.id},'reject')">Reject</button>` : '');
    return `<div class="card" style="margin-bottom:12px;border-left:4px solid ${c.passed ? 'var(--green,var(--status-success))' : 'var(--red,#c62828)'}">
      <div style="margin-bottom:6px"><b>${arEsc(x.channel)}</b> · ${arEsc(x.customer_ref || 'no reference')} · <b>${arEsc(x.status)}</b> · checks: <b>${c.passed ? 'all passed' : 'FAILED'}</b></div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:6px">Customer wrote: ${arEsc(x.incoming_text)}</div>
      <textarea class="fi" id="av-t-${x.id}" rows="3" style="width:100%" ${x.status === 'draft' ? '' : 'disabled'}>${arEsc(x.draft_text)}</textarea>
      <div style="margin:8px 0">${checks}</div>
      <details style="margin-bottom:8px"><summary style="cursor:pointer;font-size:12px">How the agent decided (rules used: ${rules})</summary><pre style="white-space:pre-wrap;font-size:12px">${arEsc(c.reasoning)}</pre></details>
      <div style="display:flex;gap:8px;flex-wrap:wrap">${actions}</div></div>`;
  }).join('') || '<div class="card no-data">Nothing here</div>';
}
// Sending stays manual: this only OPENS WhatsApp with the approved text filled in, or copies it. You press send yourself.
function avSendButtons(x) {
  const num = String(x.customer_ref || '').replace(/\D/g, '');
  const link = num.length >= 9 ? `<a class="btn btn-p" style="text-decoration:none" target="_blank" rel="noopener" href="https://wa.me/${num}?text=${encodeURIComponent(x.customer_text)}">Open in WhatsApp (you press send)</a>` : '';
  return link + `<button class="btn btn-s" onclick="avCopy(${x.id})">Copy text</button>`;
}
function avCopy(id) {
  const t = document.getElementById('av-t-' + id).value.split('\n').filter(l => !/needs\s+aj\s+approval/i.test(l)).join('\n').trim();
  (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => { document.getElementById('av-msg').textContent = 'Copied. Paste it into WhatsApp.'; }, () => { document.getElementById('av-msg').textContent = 'Could not copy: select the text in the box and copy it.'; });
}
async function avDraft() {
  const text = document.getElementById('av-in').value;
  if (!text.trim()) { document.getElementById('av-msg').textContent = 'Type the customer message first'; return; }
  if (await avCall('/api/agent-brain/draft', 'POST', { channel: 'whatsapp', incoming_text: text, allow_price: document.getElementById('av-price').checked })) {
    document.getElementById('av-in').value = ''; _avStatus = 'draft'; loadAgentReview();
  }
}
async function avAct(id, act) { if (await avCall('/api/agent-brain/drafts/' + id + '/' + act, 'POST')) loadAgentReview(); }
async function avSave(id) { if (await avCall('/api/agent-brain/drafts/' + id, 'PUT', { draft_text: document.getElementById('av-t-' + id).value })) loadAgentReview(); }

/* Agent Rulebook (M1) */
let _arRules = [];
function arEsc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
async function loadAgentRules() {
  const all = document.getElementById('ar-all').checked ? '?all=1' : '';
  const r = await fetch('/api/agent/rules' + all);
  if (!r.ok) { document.getElementById('ar-tbody').innerHTML = '<tr><td colspan="5" class="no-data">Owner only</td></tr>'; return; }
  _arRules = await r.json();
  document.getElementById('ar-tbody').innerHTML = _arRules.map(x =>
    `<tr style="${x.active ? '' : 'opacity:.5'}"><td>${arEsc(x.topic)}</td><td>${arEsc(x.rule_text)}</td><td>v${x.version}</td><td>${x.active ? 'active' : 'old'}</td>` +
    `<td>${x.active ? `<button class="btn btn-s" onclick="arEdit(${x.id})">Edit</button> <button class="btn btn-s" onclick="arOff(${x.id})">Deactivate</button>` : ''}</td></tr>`
  ).join('') || '<tr><td colspan="5" class="no-data">No rules yet</td></tr>';
}
function arReset() { ['ar-id','ar-topic','ar-text'].forEach(i => document.getElementById(i).value = ''); document.getElementById('ar-form-title').textContent = 'Add rule'; }
function arEdit(id) {
  const x = _arRules.find(r => r.id === id); if (!x) return;
  document.getElementById('ar-id').value = id; document.getElementById('ar-topic').value = x.topic;
  document.getElementById('ar-text').value = x.rule_text; document.getElementById('ar-form-title').textContent = 'Correct rule (saves as v' + (x.version + 1) + ')';
}
async function arSave() {
  const id = document.getElementById('ar-id').value;
  const body = JSON.stringify({ topic: document.getElementById('ar-topic').value, rule_text: document.getElementById('ar-text').value });
  const r = await fetch('/api/agent/rules' + (id ? '/' + id : ''), { method: id ? 'PUT' : 'POST', headers: {'Content-Type':'application/json'}, body });
  if (!r.ok) { alert((await r.json()).error || 'Save failed'); return; }
  arReset(); loadAgentRules();
}
async function arOff(id) {
  if (!confirm('Deactivate this rule?')) return;
  await fetch('/api/agent/rules/' + id + '/deactivate', { method: 'POST' }); loadAgentRules();
}

document.querySelectorAll('.nav-item').forEach(el => {
  el.addEventListener('click', () => navigate(el.dataset.page));
});

let _fromHash = false;
function navigate(page) {
  if (!document.getElementById('page-' + page)) page = 'dashboard';           // unknown address -> Dashboard
  if (!_fromHash && location.hash !== '#/' + page) history.pushState(null, '', '#/' + page);
  document.getElementById('sidebar').classList.remove('open');               // phone: close the menu after choosing
  document.querySelectorAll('#bottom-nav button').forEach(b => b.classList.toggle('active', b.dataset.go === page));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelector(`.nav-item[data-page="${page}"]`).classList.add('active');
  document.getElementById(`page-${page}`).classList.add('active');
  const [title, sub] = PAGE_META[page] || [page, ''];
  document.getElementById('page-title').textContent = title;
  if (page === 'grn') openGRNPage();
  if (page === 'agent-rules') loadAgentRules();
  if (page === 'enquiries') loadEnquiries();
  if (page === 'shoptools') loadShopTools();
  if (page === 'docinbox') loadDocInbox();
  if (page === 'salary') loadSalary();
  if (page === 'dashboard' && typeof loadSalaryCard === 'function') loadSalaryCard();
  if (page === 'agentreview') loadAgentReview();
  if (page === 'content') loadContent();
  if (page === 'competitors') loadCompetitors();
  if (page === 'webcat') loadWebCat();
  if (page === 'website' && typeof loadWebsiteEditor === 'function') loadWebsiteEditor();
  if (page === 'tilegallery' && typeof loadTileGallery === 'function') loadTileGallery();
  if (page === 'replies') loadReplies();
  if (page === 'policy') loadPolicy();
  if (page === 'branches') loadBranches();
  // POS Billing is its own page (own tables); load it into the tab the first time it's opened.
  { const fr = document.getElementById('frame-' + page); if (fr && !fr.getAttribute('src')) fr.setAttribute('src', fr.dataset.src); }
  if (page === 'pos') { const f = document.getElementById('pos-frame'); if (!f.getAttribute('src')) f.setAttribute('src', '/pos_billing.html'); }
  document.getElementById('page-sub').textContent = sub;
}

/* ONE SHELL: extra screens that open as frames inside /owner (same tab, sidebar kept) + address bar routes (#/page) */
const EXTRA_FRAMES = [
  { key: 'customers', label: 'Customers', icon: '<svg class="bh-icon" aria-hidden="true"><use href="#i-users"/></svg>', url: '/customers.html', sub: 'Customer list, add and edit', after: 'vendors' },
  { key: 'credit', label: 'Credit & Aging', icon: '<svg class="bh-icon" aria-hidden="true"><use href="#i-credit-card"/></svg>', url: '/credit_aging.html', sub: 'Who owes what, and how old it is', after: 'customers' },
  { key: 'quotations', label: 'Quotations', icon: '<svg class="bh-icon" aria-hidden="true"><use href="#i-file"/></svg>', url: '/quotations.html', sub: 'Create quotations, track status', after: 'credit' },
  { key: 'purchasing', label: 'Purchasing', icon: '<svg class="bh-icon" aria-hidden="true"><use href="#i-truck"/></svg>', url: '/purchasing.html', sub: 'Purchase orders, shipments, supplier prices and aging', after: 'grn' },
  { key: 'accounting', label: 'Accounting', icon: '<svg class="bh-icon" aria-hidden="true"><use href="#i-chart"/></svg>', url: '/accounting.html', sub: 'Accounts, journal, statements, bank, budgets', after: 'expenses' },
  { key: 'auditacc', label: 'Audit & Accounting', icon: '<svg class="bh-icon" aria-hidden="true"><use href="#i-calculator"/></svg>', url: '/audit_accounting.html', sub: 'Daily audit, flags, full report, Excel and PDF', after: 'accounting' },
  { key: 'staff', label: 'Staff', icon: '<svg class="bh-icon" aria-hidden="true"><use href="#i-user"/></svg>', url: '/staff.html', sub: 'Staff, attendance, leave, advances, commission', after: 'salary' },
  { key: 'reports2', label: 'Reports & Analytics', icon: '<svg class="bh-icon" aria-hidden="true"><use href="#i-trend"/></svg>', url: '/reports_analytics.html', sub: 'Trends, digest, forecast, heatmap, margins, payroll export', after: 'reports' },
  { key: 'labels', label: 'Barcode Labels', icon: '<svg class="bh-icon" aria-hidden="true"><use href="#i-tag"/></svg>', url: '/labels.html', sub: 'Choose items, label size, print', after: 'stock' },
  { key: 'assistant', label: 'AI Assistant', icon: '<svg class="bh-icon" aria-hidden="true"><use href="#i-sparkles"/></svg>', url: '/assistant.html', sub: 'Ask about your figures (needs internet or Ollama)', after: 'shoptools' },
  { key: 'chequereg', label: 'Cheque Register', icon: '<svg class="bh-icon" aria-hidden="true"><use href="#i-receipt"/></svg>', url: '/cheque_register.html', sub: 'Cheques with due dates and status', after: 'cheques' },
  { key: 'vendorledger', label: 'Vendor Ledger', icon: '<svg class="bh-icon" aria-hidden="true"><use href="#i-receipt"/></svg>', url: '/vendor-ledger.html', sub: 'Supplier bills, cheques, payable', after: 'chequereg' },
  { key: 'vendorcredit', label: 'Vendor Credit', icon: '<svg class="bh-icon" aria-hidden="true"><use href="#i-receipt"/></svg>', url: '/vendor-credit.html', sub: 'Owed now and after 1, 2, 3 months', after: 'vendorledger' },
  { key: 'moneyplan', label: 'Money Plan', icon: '<svg class="bh-icon" aria-hidden="true"><use href="#i-receipt"/></svg>', url: '/money-plan.html', sub: 'Profit waterfall, commission, split', after: 'vendorledger' },
  { key: 'morningbrief', label: 'Morning Brief', icon: '<svg class="bh-icon" aria-hidden="true"><use href="#i-receipt"/></svg>', url: '/morning-brief.html', sub: 'Yesterday, cheques due and what to do today', after: 'moneyplan' },
  { key: 'layla', label: 'Layla', icon: '<svg class="bh-icon" aria-hidden="true"><use href="#i-receipt"/></svg>', url: '/layla-owner.html', sub: 'Chat, voice, reminders, cheque notes', after: 'morningbrief' },
  { key: 'dailyledger', label: 'Daily Ledger', icon: '<svg class="bh-icon" aria-hidden="true"><use href="#i-receipt"/></svg>', url: '/daily-entry-v2.html', sub: 'Daily sales, expenses and cash entry', after: 'layla' },
  { key: 'posledger', label: 'POS + Ledger', icon: '<svg class="bh-icon" aria-hidden="true"><use href="#i-receipt"/></svg>', url: '/pos-ledger.html', sub: 'Bill and daily ledger side by side', after: 'dailyledger' },
];
function addFramePage(def) {
  if (document.getElementById('page-' + def.key)) return;
  const ul = document.querySelector('.sidebar-nav');
  const li = document.createElement('li');
  li.className = 'nav-item'; li.dataset.page = def.key;
  li.innerHTML = '<span class="nav-icon"></span><span class="nav-label"></span>';
  li.querySelector('.nav-icon').innerHTML = def.icon; li.querySelector('.nav-label').textContent = def.label;   // the icon is an inline SVG
  li.addEventListener('click', () => navigate(def.key));
  const anchor = def.after && ul.querySelector('.nav-item[data-page="' + def.after + '"]');
  if (anchor) anchor.after(li); else ul.appendChild(li);
  const sec = document.createElement('section'); sec.className = 'page'; sec.id = 'page-' + def.key;
  sec.innerHTML = '<iframe id="frame-' + def.key + '" title="" style="width:100%;height:calc(100vh - 130px);min-height:520px;border:1px solid var(--card-border);border-radius:12px;background:var(--bg-surface)"></iframe>';
  sec.querySelector('iframe').title = def.label; sec.querySelector('iframe').dataset.src = def.url;
  document.querySelector('.page').parentNode.appendChild(sec);
  PAGE_META[def.key] = [def.label, def.sub || ''];
}
EXTRA_FRAMES.forEach(addFramePage);
function routeFromHash() {
  const m = /^#\/([\w-]+)/.exec(location.hash);
  _fromHash = true; try { navigate(m ? m[1] : 'dashboard'); } finally { _fromHash = false; }
}
window.addEventListener('popstate', routeFromHash);
window.addEventListener('hashchange', routeFromHash);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/service-worker.js').catch(() => {});

/* Admin Settings -> shop name, dashboard target, menu hide/show/order. Admin-only screens are added for admins. */
const ADMIN_FRAMES = [
  { key: 'adminsystem', label: 'System & Backups', icon: '<svg class="bh-icon" aria-hidden="true"><use href="#i-lifebuoy"/></svg>', url: '/admin_system.html', sub: 'Server status, backups, restore' },
  { key: 'adminusers', label: 'Users', icon: '<svg class="bh-icon" aria-hidden="true"><use href="#i-users"/></svg>', url: '/admin_users.html', sub: 'Add, disable, change role, reset password, force logout, login history' },
  { key: 'adminaudit', label: 'Audit Log', icon: '<svg class="bh-icon" aria-hidden="true"><use href="#i-receipt"/></svg>', url: '/admin_audit.html', sub: 'Who changed what, and when' },
  { key: 'adminsettings', label: 'Admin Settings', icon: '<svg class="bh-icon" aria-hidden="true"><use href="#i-gear"/></svg>', url: '/admin_settings.html', sub: 'Shop, targets, WhatsApp switch, feature flags, menu' },
  { key: 'corrections', label: 'Edit & Void', icon: '<svg class="bh-icon" aria-hidden="true"><use href="#i-pencil"/></svg>', url: '/admin_corrections.html', sub: 'Fix or void vendors, stock, items, commissions, staff, cheques, discount rules' },
];
async function applyAppSettings() {
  try {
    const me = await fetch('/api/me', { credentials: 'include' }).then(r => r.ok ? r.json() : null);
    // Documents & Reports: owner/admin only (the server refuses everyone else too)
    if (me && (me.role === 'admin' || me.role === 'owner')) { addFramePage({ key: 'documents', label: 'Documents', icon: '<svg class="bh-icon" aria-hidden="true"><use href="#i-file"/></svg>', url: '/documents.html', sub: 'Reports as PDF or CSV, send on WhatsApp, files that arrive', after: 'reports2' }); if (location.hash === '#/documents') routeFromHash(); }
    if (me && me.role === 'admin' && !document.getElementById('admin-sep')) {
      const sep = document.createElement('li'); sep.id = 'admin-sep'; sep.className = 'nav-sep'; sep.textContent = 'Admin';
      document.querySelector('.sidebar-nav').appendChild(sep);
      ADMIN_FRAMES.forEach(addFramePage);
    }
    const [s, m] = await Promise.all([
      fetch('/api/app-settings/public', { credentials: 'include' }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/menu-config', { credentials: 'include' }).then(r => r.ok ? r.json() : null).catch(() => null)]);
    if (s) {
      if (Number(s.dashboard_sales_target) > 0) {
        TARGET = Number(s.dashboard_sales_target);
        _paintTarget();
      }
      if (s.shop_name) { const lt = document.querySelector('.logo-text'); if (lt) lt.textContent = s.shop_name; document.title = s.shop_name + ' — Owner'; }
    }
    if (Array.isArray(m) && m.length) {
      const ul = document.querySelector('.sidebar-nav');
      m.slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).forEach(row => {
        const li = ul.querySelector('.nav-item[data-page="' + row.item_key + '"]'); if (!li) return;
        if (row.label) li.querySelector('.nav-label').textContent = row.label;
        li.style.display = row.visible === false ? 'none' : '';
        ul.appendChild(li);                                    // in saved order; items not in the list keep their place at the end
      });
      const sep = document.getElementById('admin-sep'); if (sep) { ul.appendChild(sep); ADMIN_FRAMES.forEach(f => { const li = ul.querySelector('.nav-item[data-page="' + f.key + '"]'); if (li) ul.appendChild(li); }); }
    }
    if (window.BHMenuPrefs) BHMenuPrefs.apply();   // Dashboard, POS, Daily Ledger first; hide what this device unticked
  } catch (e) { /* settings are a nicety: the app works without them */ }
}

function toggleSidebar() {
  const s = document.getElementById('sidebar');
  s.classList.toggle('collapsed');
  document.querySelector('.toggle-lbl').textContent = s.classList.contains('collapsed') ? 'Expand' : 'Collapse';
}

/* ─────────────────────────────────────────────
   CLOCK
───────────────────────────────────────────── */
function tick() {
  const n = new Date();
  document.getElementById('clock').textContent =
    [n.getHours(), n.getMinutes(), n.getSeconds()].map(x => String(x).padStart(2,'0')).join(':');
}
setInterval(tick, 1000); tick();

/* ─────────────────────────────────────────────
   THEME
───────────────────────────────────────────── */
let _theme = (window.BHTheme && BHTheme.current()) || 'dark';
const _themeIcon = { dark: 'moon', water: 'water', light: 'sun' }, _themeName = { dark: 'Gold', water: 'Water', light: 'Light' };
function _paintThemeButton() {
  const btn = document.querySelector('.theme-toggle'); if (!btn) return;
  btn.innerHTML = '<svg class="bh-icon" aria-hidden="true"><use href="#i-' + _themeIcon[_theme] + '"/></svg>';
  btn.title = 'Theme: ' + _themeName[_theme] + ' (tap to change)';
}
function toggleTheme() {                      // Gold -> Water -> Light
  _theme = window.BHTheme ? BHTheme.next() : (_theme === 'dark' ? 'light' : 'dark');
  document.documentElement.setAttribute('data-theme', _theme);
  _paintThemeButton();
}
document.addEventListener('DOMContentLoaded', _paintThemeButton);
window.addEventListener('storage', e => { if (e.key === 'bathhub-theme' && window.BHTheme) { _theme = BHTheme.current(); _paintThemeButton(); } });   // theme picked inside Settings

/* ─────────────────────────────────────────────
   TOAST
───────────────────────────────────────────── */
function toast(msg, type = 'info') {
  const c = document.getElementById('toasts');
  const t = document.createElement('div');
  const icons = { success:'<svg class="bh-icon" aria-hidden="true"><use href="#i-check-circle"/></svg>', error:'<svg class="bh-icon" aria-hidden="true"><use href="#i-x-circle"/></svg>', warning:'<svg class="bh-icon" aria-hidden="true"><use href="#i-warning"/></svg>', info:'<svg class="bh-icon" aria-hidden="true"><use href="#i-info"/></svg>' };
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${icons[type]||'<svg class="bh-icon" aria-hidden="true"><use href="#i-info"/></svg>'}</span><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(() => { t.style.opacity='0'; t.style.transform='translateX(16px)'; t.style.transition='all 0.3s'; setTimeout(()=>t.remove(),300); }, 3500);
}

/* ─────────────────────────────────────────────
   COUNTER ANIMATION
───────────────────────────────────────────── */
function animCount(el, target, prefix='') {
  const dur = 1100; const t0 = performance.now();
  const step = now => {
    const p = Math.min((now - t0) / dur, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    el.textContent = prefix + fmt(Math.round(ease * target));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ─────────────────────────────────────────────
   CONFETTI
───────────────────────────────────────────── */
function confetti() {
  const cv = document.getElementById('confetti-canvas');
  cv.style.display = 'block';
  const ctx = cv.getContext('2d');
  cv.width = innerWidth; cv.height = innerHeight;
  const COLORS = ['#C9A227','#15803d','#0B0B0C','#b91c1c','#6B6E73'];
  const particles = Array.from({length:100}, () => ({
    x: Math.random()*cv.width, y:-10,
    w: Math.random()*10+4, h: Math.random()*6+3,
    color: COLORS[~~(Math.random()*COLORS.length)],
    vy: Math.random()*3+2, vx: (Math.random()-.5)*3,
    rot: Math.random()*360, rv: (Math.random()-.5)*7
  }));
  let f=0;
  const draw = () => {
    ctx.clearRect(0,0,cv.width,cv.height);
    particles.forEach(p => {
      p.y+=p.vy; p.x+=p.vx; p.rot+=p.rv;
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot*Math.PI/180);
      ctx.fillStyle=p.color; ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h); ctx.restore();
    });
    if (++f<200) requestAnimationFrame(draw);
    else { cv.style.display='none'; ctx.clearRect(0,0,cv.width,cv.height); }
  };
  draw();
  toast(' Daily target reached!', 'success');
}

/* ─────────────────────────────────────────────
   DASHBOARD
───────────────────────────────────────────── */
async function loadDashboard() {
  // Show skeletons
  const grid = document.getElementById('kpi-grid');
  grid.innerHTML = Array(6).fill(0).map(() => `
    <div class="kpi-card">
      <div class="skeleton skel-txt" style="width:60%"></div>
      <div class="skeleton skel-val"></div>
      <div class="skeleton skel-txt" style="width:80%"></div>
    </div>`).join('');

  const [stats, weekly, live] = await Promise.all([
    api('/api/home-stats'),
    api('/api/weekly-chart'),
    api('/api/daily-sales-live/today')
  ]);
  if (!stats) return;

  const t = { ...(stats.today || {}) };
  const m = stats.mtd   || {};
  // Open day (no day sheet yet): today's sale comes from the POS bills. A saved day sheet always wins.
  let saleNote = '';
  if (live && live.mode === 'open_day' && live.bills_count > 0) { t.sale = live.sale; saleNote = live.label; }

  // Date display
  document.getElementById('dash-date').textContent = fmtDate(today());
  document.getElementById('page-sub').textContent = fmtDate(today()) + ' — Live data';

  // Target bar
  const sale = parseFloat(t.sale||0);
  const pct = Math.min((sale/TARGET)*100,100);
  document.getElementById('target-bar').style.width = pct+'%';
  document.getElementById('target-pct').textContent = pct.toFixed(0)+'%';
  document.getElementById('target-achieved').textContent = fmtLKR(sale)+' achieved';
  if (pct>=100) setTimeout(confetti, 800);

  // KPI definitions
  const kpis = [
    { key:'sale',  label:'Total Sale',  type:'total',   icon:'<svg class="bh-icon" aria-hidden="true"><use href="#i-money"/></svg>', val:t.sale  },
    { key:'gp',    label:'Gross Profit',type:'profit',  icon:'<svg class="bh-icon" aria-hidden="true"><use href="#i-trend"/></svg>', val:t.gp   },
    { key:'np',    label:'Net Profit',  type:'profit',  icon:'<svg class="bh-icon" aria-hidden="true"><use href="#i-check-circle"/></svg>', val:t.np   },
    { key:'exp',   label:'Expenses',    type:'expense', icon:'<svg class="bh-icon" aria-hidden="true"><use href="#i-wallet"/></svg>', val:t.exp  },
    { key:'msale', label:'MTD Sales',   type:'total',   icon:'<svg class="bh-icon" aria-hidden="true"><use href="#i-calendar"/></svg>', val:m.sale  },
    { key:'mnp',   label:'MTD Profit',  type:'profit',  icon:'<svg class="bh-icon" aria-hidden="true"><use href="#i-trend"/></svg>', val:m.np   },
  ];

  grid.innerHTML = kpis.map(k => `
    <div class="kpi-card" data-type="${k.type}">
      <div class="kpi-label">${k.icon} ${k.label}</div>
      <div class="kpi-value" id="kv-${k.key}">LKR 0</div>
      ${k.key==='sale' && saleNote ? `<div id="kv-sale-note" style="font-size:11px;color:var(--text3);margin-top:4px">${saleNote}</div>` : ''}
    </div>`).join('');

  kpis.forEach(k => {
    const el = document.getElementById('kv-'+k.key);
    if (el) animCount(el, parseFloat(k.val||0), 'LKR ');
  });

  // MTD rows
  const mtdEl = document.getElementById('mtd-rows');
  mtdEl.innerHTML = [
    ['Days recorded', m.days||'0'],
    ['Total Sales', fmtLKR(m.sale)],
    ['Gross Profit', fmtLKR(m.gp)],
    ['Total Expenses', fmtLKR(m.exp)],
    ['Net Profit', fmtLKR(m.np)],
  ].map(([l,v]) => `
    <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--card-border);font-size:14px">
      <span style="color:var(--text2)">${l}</span><strong>${v}</strong>
    </div>`).join('');
  document.getElementById('mtd-days-label').textContent = `${m.days||0} trading days this month`;

  // Weekly chart
  if (weekly && weekly.length) {
    const cEl = document.getElementById('weeklyChart');
    if (charts.weekly) charts.weekly.destroy();
    charts.weekly = new Chart(cEl, {
      type:'line',
      data:{
        labels: weekly.map(r=>r.label||fmtDate(r.report_date)),
        datasets:[{
          label:'Sales (LKR)',
          data: weekly.map(r=>parseFloat(r.total||0)),
          borderColor:'#C9A227', backgroundColor:'rgba(201,162,39,0.12)',
          tension:0.4, fill:true, borderWidth:2, pointRadius:4, pointBackgroundColor:'#C9A227'
        }]
      },
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{legend:{display:false}},
        scales:{
          x:{ticks:{color:'#999'},grid:{color:'rgba(255,255,255,0.06)'}},
          y:{ticks:{color:'#999'},grid:{color:'rgba(255,255,255,0.06)'}}
        }
      }
    });
  }

  document.getElementById('last-upd').textContent = new Date().toLocaleTimeString();
}

/* ─────────────────────────────────────────────
   DAILY SALES
───────────────────────────────────────────── */
async function loadSalesDate() {
  const date = document.getElementById('sales-date').value;
  if (!date) return;

  // Load summary and invoices in parallel
  let [summary, invoices, live] = await Promise.all([
    api(`/api/daily-summary/${date}`),
    api(`/api/reports?date=${date}`),
    api(`/api/daily-sales-live/${date}`)
  ]);

  // POS bills on a day with no day sheet (open day): show them as the day's sales. A saved day sheet always wins;
  // its page shows the bills total beside it as a reference only (never added).
  const liveNote = document.getElementById('live-note');
  const openDay = !summary && live && live.mode === 'open_day' && live.bills_count > 0;
  if (openDay) {
    summary = { report_date: date, total_sale: live.sale, cash_sale: live.pay.cash, card_sale: live.pay.card, online_sale: live.pay.online,
                credit_sale: live.pay.credit, cheq_payment: live.pay.cheque, gp_status: 'NOT_AVAILABLE', net_profit: null };
    liveNote.style.display = 'block';
    liveNote.textContent = `${live.label} (${live.bills_count} bill${live.bills_count===1?'':'s'}, voids left out)`;
  } else if (summary && live && live.bills_count > 0) {
    liveNote.style.display = 'block';
    liveNote.textContent = `${live.label}: ${fmtLKR(live.bills_total)} (${live.bills_count} bill${live.bills_count===1?'':'s'})`;
  } else {
    liveNote.style.display = 'none';
  }

  _currentSalesDay = summary;
  _invoices = invoices || [];

  if (summary) {
    const s = summary;
    const cash   = parseFloat(s.cash_sale||0);
    const card   = parseFloat(s.card_sale||0);
    const online = parseFloat(s.online_sale||0);
    const credit = parseFloat(s.credit_sale||0);
    const cheque = parseFloat(s.cheq_payment||0);
    const total  = parseFloat(s.total_sale||0);

    document.getElementById('p-cash').textContent   = fmt(cash);
    document.getElementById('p-card').textContent   = fmt(card);
    document.getElementById('p-online').textContent = fmt(online);
    document.getElementById('p-credit').textContent = fmt(credit);
    document.getElementById('p-cheque').textContent = fmt(cheque);

    // Mismatch check (if split is recorded)
    const splitSum = cash+card+online+credit+cheque;
    const mismatch = splitSum > 0 && Math.abs(splitSum - total) > 1;
    document.getElementById('mismatch-flag').style.display = mismatch ? 'block' : 'none';

    // Donut chart
    const dCtx = document.getElementById('donutChart');
    if (charts.donut) charts.donut.destroy();
    const donutVals = [cash, card, online, credit, cheque];
    const donutColors = ['#0B0B0C','#C9A227','#6B6E73','#b91c1c','#15803d'];
    const donutLabels = ['Cash','Card','Online','Credit','Cheque'];
    charts.donut = new Chart(dCtx, {
      type:'doughnut',
      data:{
        labels: donutLabels,
        datasets:[{ data:donutVals, backgroundColor:donutColors, borderWidth:0, hoverOffset:6 }]
      },
      options:{ responsive:true, maintainAspectRatio:false, cutout:'65%', plugins:{legend:{display:false}} }
    });
    const dLegend = document.getElementById('donut-legend');
    const dTotal = donutVals.reduce((a,b)=>a+b,0);
    dLegend.innerHTML = donutLabels.map((l,i) => `
      <div style="display:flex;align-items:center;justify-content:space-between;font-size:12px">
        <div style="width:10px;height:10px;border-radius:50%;background:${donutColors[i]};margin-right:8px;flex-shrink:0"></div>
        <span style="flex:1">${l}</span>
        <strong>${dTotal>0?((donutVals[i]/dTotal)*100).toFixed(1):'0.0'}%</strong>
      </div>`).join('');

    // Daily info rows
    document.getElementById('daily-info-rows').innerHTML = [
      ['Total Sale', fmtLKR(total)],
      ['Gross Profit', s.gp_status === 'NOT_AVAILABLE' ? '<span style="color:var(--text3)">Not available</span>' : fmtLKR(s.gross_profit)],
      ['Total Expenses', openDay ? '<span style="color:var(--text3)">—</span>' : fmtLKR(s.total_expenses)],
      ['Net Profit', s.net_profit != null ? fmtLKR(s.net_profit) : '<span style="color:var(--text3)">—</span>'],
      ['Cash In Hand', openDay ? '<span style="color:var(--text3)">—</span>' : fmtLKR(s.cash_in_hand)],
      ['GP Status', openDay ? '<span class="badge ba">OPEN DAY</span>' : `<span class="badge ${s.gp_status==='ACTUAL'?'bg':s.gp_status==='NOT_AVAILABLE'?'br':'ba'}">${s.gp_status||'—'}</span>`],
    ].map(([l,v]) => `
      <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--card-border);font-size:14px">
        <span style="color:var(--text2)">${l}</span><span>${v}</span>
      </div>`).join('');

    // Build WhatsApp text for Reports page
    buildWhatsApp(s);
  } else {
    ['p-cash','p-card','p-online','p-credit','p-cheque'].forEach(id => document.getElementById(id).textContent='—');
    document.getElementById('daily-info-rows').innerHTML='<div class="no-data">No data for this date</div>';
  }

  renderInvoices();
}

function renderInvoices(filter='') {
  const tbody = document.getElementById('inv-tbody');
  const rows = filter
    ? _invoices.filter(r => r.invoice_no?.toLowerCase().includes(filter) || r.notes?.toLowerCase().includes(filter))
    : _invoices;
  if (!rows.length) { tbody.innerHTML = '<tr><td colspan="5" class="no-data">No invoices found</td></tr>'; return; }
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td><strong>${r.invoice_no||'—'}</strong></td>
      <td>${r.cash_amount>0?'Cash':r.card_amount>0?'Card':r.online_amount>0?'Online':r.credit_amount>0?'Credit':'Mixed'}</td>
      <td><strong>${fmtLKR(r.total_sale)}</strong></td>
      <td>${r.is_refund?'<span class="badge br">Refund</span>':'—'}</td>
      <td style="color:var(--text2)">${r.notes||'—'}</td>
    </tr>`).join('');
}

function filterInv() { renderInvoices(document.getElementById('inv-search').value.toLowerCase()); }

function changeDate(dir) {
  const dp = document.getElementById('sales-date');
  const d = new Date(dp.value || today());
  d.setDate(d.getDate() + dir);
  dp.value = d.toISOString().slice(0,10);
  loadSalesDate();
}

async function saveInvoice() {
  const date = document.getElementById('sales-date').value;
  if (!date) { toast('Select a date first', 'warning'); return; }
  const body = {
    report_date:   date,
    invoice_no:    document.getElementById('n-inv').value || null,
    total_sale:    parseFloat(document.getElementById('n-total').value)||0,
    cash_amount:   parseFloat(document.getElementById('n-cash').value)||0,
    card_amount:   parseFloat(document.getElementById('n-card').value)||0,
    online_amount: parseFloat(document.getElementById('n-online').value)||0,
    credit_amount: parseFloat(document.getElementById('n-credit').value)||0,
    cheque_amount: parseFloat(document.getElementById('n-cheque').value)||0,
    notes:         document.getElementById('n-notes').value || null,
  };
  if (!body.total_sale) { toast('Enter a total sale amount', 'warning'); return; }
  const r = await api('/api/reports', { method:'POST', body:JSON.stringify(body) });
  if (r) {
    toast('Invoice saved', 'success');
    loadSalesDate();
    ['n-inv','n-total','n-cash','n-card','n-online','n-credit','n-cheque','n-notes'].forEach(id=>document.getElementById(id).value='');
  }
}

function buildWhatsApp(s) {
  if (!s) return;
  const text = `*Your Business Name — ${fmtDate(s.report_date||s.date_str)}*\n`+
    `─────────────────────\n`+
    `<svg class="bh-icon" aria-hidden="true"><use href="#i-money"/></svg> Total Sales: *${fmtLKR(s.total_sale)}*\n`+
    `<svg class="bh-icon" aria-hidden="true"><use href="#i-cash"/></svg> Cash: ${fmtLKR(s.cash_sale)}\n`+
    `<svg class="bh-icon" aria-hidden="true"><use href="#i-credit-card"/></svg> Card: ${fmtLKR(s.card_sale)}\n`+
    `<svg class="bh-icon" aria-hidden="true"><use href="#i-phone"/></svg> Online: ${fmtLKR(s.online_sale)}\n`+
    `<svg class="bh-icon" aria-hidden="true"><use href="#i-note"/></svg> Credit: ${fmtLKR(s.credit_sale)}\n`+
    `<svg class="bh-icon" aria-hidden="true"><use href="#i-receipt"/></svg> Cheque: ${fmtLKR(s.cheq_payment)}\n`+
    `─────────────────────\n`+
    (s.net_profit != null ? `<svg class="bh-icon" aria-hidden="true"><use href="#i-check-circle"/></svg> Net Profit: ${fmtLKR(s.net_profit)}\n` : '')+
    `_Generated automatically_`;
  document.getElementById('wa-text').innerHTML = text.replace(/\n/g,'<br>').replace(/\*(.*?)\*/g,'<strong>$1</strong>');

  document.getElementById('investor-text').innerHTML =
    `Your Business Name<br>`+
    `<span style="font-size:14px;color:var(--text2);font-weight:400">${fmtDate(s.report_date||s.date_str)}</span><br>`+
    `Total: <span style="color:var(--gold)">${fmt(s.total_sale)}</span><br>`+
    `<span style="font-size:15px">Cash: ${fmt(s.cash_sale)}</span><br>`+
    `<span style="font-size:15px">Card: ${fmt(s.card_sale)}</span><br>`+
    `<span style="font-size:15px">Online: ${fmt(s.online_sale)}</span>`;
}

function copyWhatsApp() {
  const txt = document.getElementById('wa-text')?.innerText || '';
  navigator.clipboard.writeText(txt).then(() => toast('Copied!','success'));
}
function copyWA() { copyWhatsApp(); }

/* ─────────────────────────────────────────────
   STOCK
───────────────────────────────────────────── */
async function loadStock() {
  const rows = await api('/api/products');
  if (!rows) return;
  _stock = rows;

  // Populate category filter
  const cats = [...new Set(rows.map(r=>r.category).filter(Boolean))].sort();
  const catSel = document.getElementById('stk-cat');
  catSel.innerHTML = '<option value="">All Categories</option>' + cats.map(c=>`<option>${c}</option>`).join('');

  renderStock();
}

function renderStock() {
  const search = document.getElementById('stk-search').value.toLowerCase();
  const cat    = document.getElementById('stk-cat').value;
  const rows = _stock.filter(r =>
    (!search || r.item_code?.toLowerCase().includes(search) || r.name?.toLowerCase().includes(search)) &&
    (!cat || r.category === cat)
  );
  const tbody = document.getElementById('stk-tbody');
  if (!rows.length) { tbody.innerHTML = '<tr><td colspan="7" class="no-data">No items found</td></tr>'; return; }

  // Alerts
  const zero = rows.filter(r=>r.stock_level<=0).length;
  const low  = rows.filter(r=>r.stock_level>0 && r.stock_level<=5).length;
  const alertEl = document.getElementById('stk-alerts');
  alertEl.innerHTML = [
    low>0  && `<span class="badge br"><svg class="bh-icon" aria-hidden="true"><use href="#i-circle"/></svg> Low Stock: ${low}</span>`,
    zero>0 && `<span class="badge br"><svg class="bh-icon" aria-hidden="true"><use href="#i-square"/></svg> Zero Stock: ${zero}</span>`,
  ].filter(Boolean).join('');

  tbody.innerHTML = rows.map(r => {
    const lvl = r.stock_level||0;
    const pct = Math.min((lvl/30)*100,100);
    const cls = lvl<=0?'#ef4444':lvl<=5?'#f59e0b':'#22c55e';
    return `<tr style="${lvl<=0?'background:rgba(239,68,68,0.04)':''}">
      <td>${r.photo_url?`<img src="${encodeURI(r.photo_url)}" alt="" loading="lazy" style="width:40px;height:40px;object-fit:cover;border-radius:6px;border:1px solid var(--card-border)">`:'<span style="color:var(--text3)">—</span>'}</td>
      <td><code style="color:var(--gold)">${r.item_code||'—'}</code></td>
      <td><strong>${r.name}</strong></td>
      <td><span class="badge bb">${r.category||'—'}</span></td>
      <td style="font-weight:700;color:${lvl<=0?'var(--red)':lvl<=5?'var(--amber)':'var(--text)'}">${lvl}</td>
      <td style="min-width:70px"><div class="stock-bar"><div class="stock-fill" style="width:${pct}%;background:${cls}"></div></div></td>
      <td style="color:var(--text2)">${r.supplier||'—'}</td>
    </tr>`;
  }).join('');
}

function filterStock() { renderStock(); }

/* ── Manual GRN page ── */
let _mgSuppliers = [];
const mgEsc = v => String(v ?? '—').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function mgAddRow() {
  const wrap = document.getElementById('mg-rows');
  const row = document.createElement('div');
  row.className = 'mg-row';
  row.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid var(--card-border)';
  row.innerHTML = `
    <div class="fg" style="flex:2;min-width:160px;margin:0"><label class="fl">Item name</label><input class="fi mg-name" list="mg-item-list" placeholder="Item name"></div>
    <div class="fg" style="flex:0 0 90px;margin:0"><label class="fl">Qty</label><input type="number" min="0" step="any" class="fi mg-qty" placeholder="0" oninput="mgRecalc()"></div>
    <div class="fg" style="flex:0 0 120px;margin:0"><label class="fl">Unit cost</label><input type="number" min="0" step="any" class="fi mg-cost" placeholder="0" oninput="mgRecalc()"></div>
    <div class="fg" style="flex:0 0 120px;margin:0"><label class="fl">Selling price</label><input type="number" min="0" step="any" class="fi mg-price" placeholder="0"></div>
    <div class="fg" style="flex:1;min-width:150px;margin:0"><label class="fl">Photo</label><input type="file" class="fi mg-photo" accept="image/jpeg,image/png,image/webp"></div>
    <button class="btn btn-s" type="button" title="Remove this row" onclick="mgRemoveRow(this)">✕</button>`;
  wrap.appendChild(row);
}
// ═══ GRN IMPORT (Fill from file / Read photo) — fills the form for review, never saves ═══
function mgApplyImport(r, label) {
  const wrap = document.getElementById('mg-rows'); wrap.innerHTML = '';
  (r.lines.length ? r.lines : [{}]).forEach(l => {
    mgAddRow();
    const row = wrap.lastElementChild;
    row.querySelector('.mg-name').value = l.name || '';
    row.querySelector('.mg-qty').value = l.qty != null ? l.qty : '';
    row.querySelector('.mg-cost').value = l.cost != null ? l.cost : '';
    if (l.price != null) row.querySelector('.mg-price').value = l.price;
  });
  if (r.supplier) document.getElementById('mg-supplier').value = r.supplier;
  if (r.date) document.getElementById('mg-date').value = r.date;
  if (r.ref) document.getElementById('mg-notes').value = 'Invoice ' + r.ref;
  if (r.credit_days != null) document.getElementById('mg-credit-days').value = r.credit_days;
  mgRecalc();
  const box = document.getElementById('mg-review');
  const warns = r.warnings || [];
  box.style.display = 'block';
  box.innerHTML = '<div class="card" style="border:1px solid ' + (warns.length ? '#d9a300' : '#2e9d5b') + ';padding:10px;margin-bottom:10px">'
    + '<b>' + mgEsc(label) + ': ' + r.lines.length + ' lines, lines add up to ' + fmtLKR(r.lines_total) + (r.paper_total != null ? ' (paper total ' + fmtLKR(r.paper_total) + ')' : '') + '</b>'
    + (warns.length ? '<ul style="margin:6px 0 0 18px">' + warns.map(w => '<li>' + mgEsc(w) + '</li>').join('') + '</ul>' : '<div>No problems found. Still check it against the paper.</div>')
    + '<div style="margin-top:6px;font-size:12px">Credit days: type the days this vendor really allows. Then press Save GRN.</div></div>';
}
async function mgFillFromFile(inp) {
  const f = inp.files && inp.files[0]; inp.value = ''; if (!f) return;
  try {
    let r;
    if (/\.xlsx?$/i.test(f.name)) {
      if (!window.XLSX) await new Promise((ok, no) => { const s = document.createElement('script'); s.src = '/lib/xlsx.full.min.js'; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
      const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
      r = GrnImport.build(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' }));
    } else {
      r = GrnImport.fromText(await f.text(), f.name);
    }
    mgApplyImport(r, 'From file ' + f.name);
  } catch (e) { toast('Could not read that file: ' + e.message, 'error'); }
}
async function mgReadPhoto(inp) {
  const f = inp.files && inp.files[0]; inp.value = ''; if (!f) return;
  toast('AI is reading the photo… up to 1 minute', 'info');
  try {
    const fd = new FormData(); fd.append('file', f);
    const res = await fetch('/api/grn-read-photo', { method: 'POST', body: fd, credentials: 'same-origin' });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { toast(j.error || 'Could not read the photo', 'error'); return; }
    mgApplyImport(j, 'AI read photo');
  } catch (e) { toast('Could not read the photo: ' + e.message, 'error'); }
}
function mgRemoveRow(btn) {
  if (document.querySelectorAll('#mg-rows .mg-row').length <= 1) { toast('A GRN needs at least one item row', 'warning'); return; }
  btn.closest('.mg-row').remove();
  mgRecalc();
}
function mgRecalc() {
  let t = 0;
  document.querySelectorAll('#mg-rows .mg-row').forEach(r => {
    t += (parseFloat(r.querySelector('.mg-qty').value)||0) * (parseFloat(r.querySelector('.mg-cost').value)||0);
  });
  document.getElementById('mg-total').textContent = fmtLKR(t);
}
async function loadManualGRNList() {
  const rows = await api('/api/grn');
  const tbody = document.getElementById('mg-tbody');
  if (!rows) { tbody.innerHTML = '<tr><td colspan="7" class="no-data">Could not load GRN records</td></tr>'; return; }
  if (!rows.length) { tbody.innerHTML = '<tr><td colspan="7" class="no-data">No GRN records yet</td></tr>'; return; }
  // /api/grn sorts by a minute-resolution text alias, so newest-first is enforced here by id.
  tbody.innerHTML = [...rows].sort((a, b) => b.id - a.id).slice(0, 25).map(r => `<tr>
    <td>${mgEsc(r.grn_number)}</td><td>${mgEsc(r.grn_date)}</td><td>${mgEsc(r.supplier_name)}</td><td>${mgEsc(r.item_description)}</td>
    <td>${r.quantity||0}</td><td>${fmtLKR(r.unit_cost)}</td><td>${fmtLKR(r.total_amount)}</td></tr>`).join('');
}
async function openGRNPage() {
  const d = document.getElementById('mg-date');
  if (!d.value) d.value = today();
  if (!document.querySelector('#mg-rows .mg-row')) mgAddRow();
  if (!document.getElementById('mg-item-list')) {
    const dl = document.createElement('datalist'); dl.id = 'mg-item-list'; document.body.appendChild(dl);
  }
  const sup = await api('/api/suppliers');
  if (sup) {
    _mgSuppliers = sup;
    document.getElementById('mg-supplier-list').innerHTML = sup.map(s => `<option value="${mgEsc(s.name)}">`).join('');
  }
  document.getElementById('mg-item-list').innerHTML = _stock.map(r => `<option value="${mgEsc(r.name)}">`).join('');
  loadManualGRNList();
}
let _mgLastItems = [];
async function mgPrintBarcodes(layout) {
  const items = _mgLastItems.map(i => ({ item_code: i.item_code, name: i.name, price: i.selling_price, copies: i.qty }));
  if (!items.length) { toast('Save the GRN first', 'warning'); return; }
  const noPrice = items.filter(i => !(Number(i.price) > 0));
  if (noPrice.length) { toast('Enter the selling price first: ' + noPrice.map(i => i.name).join(', '), 'warning'); return; }
  const r = await fetch('/api/grn-barcodes', { method:'POST', credentials:'include', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ items, layout }) });
  if (r.status === 401) { showLogin(); return; }
  if (!r.ok) { const d = await r.json().catch(() => ({})); toast(d.error || 'Could not make the barcode PDF', 'error'); return; }
  window.open(URL.createObjectURL(await r.blob()), '_blank');
}
async function saveManualGRN() {
  const supplier_name = document.getElementById('mg-supplier').value.trim();
  const grn_date = document.getElementById('mg-date').value;
  if (!supplier_name) { toast('Enter the supplier', 'warning'); return; }
  if (!grn_date) { toast('Pick the GRN date', 'warning'); return; }
  const lines = [], fd = new FormData();
  const rows = [...document.querySelectorAll('#mg-rows .mg-row')];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const name = r.querySelector('.mg-name').value.trim();
    const qty = parseFloat(r.querySelector('.mg-qty').value);
    const unit_cost = parseFloat(r.querySelector('.mg-cost').value);
    if (!name) { toast(`Row ${i+1}: enter the item name`, 'warning'); return; }
    if (!(qty > 0)) { toast(`Row ${i+1} (${name}): quantity must be more than 0`, 'warning'); return; }
    if (!(unit_cost >= 0)) { toast(`Row ${i+1} (${name}): enter the unit cost`, 'warning'); return; }
    const selling_price = r.querySelector('.mg-price').value;
    lines.push({ name, qty, unit_cost, selling_price });
    const f = r.querySelector('.mg-photo').files[0];
    if (f) fd.append('photo_' + i, f);
  }
  if (String(document.getElementById('mg-credit-days').value).trim() === '' && !document.getElementById('mg-paid-now').checked) { toast('Enter the credit days (0 = pay now) or tick Paid in cash', 'warning'); return; }
  const sup = _mgSuppliers.find(s => String(s.name).toLowerCase() === supplier_name.toLowerCase());
  fd.append('payload', JSON.stringify({ supplier_name, supplier_id: sup ? sup.id : null, grn_date, notes: document.getElementById('mg-notes').value, credit_days: document.getElementById('mg-credit-days').value, paid_now: document.getElementById('mg-paid-now').checked, lines }));
  const btn = document.getElementById('mg-save');
  btn.disabled = true;
  try {
    // Raw fetch: api() forces a JSON Content-Type, which would break the multipart upload.
    const r = await fetch('/api/grn-manual', { method:'POST', body: fd, credentials:'include' });
    if (r.status === 401) { showLogin(); return; }
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { toast(d.error || `Could not save the GRN (server said ${r.status})`, 'error'); return; }
    toast(`GRN ${d.grn_number} saved`, 'success');
    document.getElementById('mg-result').innerHTML = `<div style="padding:12px;border-radius:8px;background:rgba(34,197,94,0.1);font-size:14px">
      <strong>${mgEsc(d.grn_number)}</strong> — ${mgEsc(d.supplier_name)}, ${mgEsc(d.grn_date)} — ${fmtLKR(d.total)}<br>` +
      d.items.map(i => `<code style="color:var(--gold)">${mgEsc(i.item_code)}</code> ${mgEsc(i.name)} × ${i.qty} <span class="badge ${i.is_new?'bg':'ba'}">${i.is_new?'new item':'restocked'}</span> in stock now: <strong>${Number(i.stock_now)}</strong>`).join('<br>') + '</div>' + mgCreditBlock(d);
    _mgLastItems = d.items;
    document.getElementById('mg-result').insertAdjacentHTML('beforeend', `<div style="margin-top:10px"><button class="btn btn-p" type="button" onclick="mgPrintBarcodes('sticker')">Print barcode</button> <button class="btn btn-s" type="button" onclick="mgPrintBarcodes('a4')">Print barcode (A4 sheet)</button></div>`);
    document.getElementById('mg-rows').innerHTML = '';
    document.getElementById('mg-notes').value = '';
    document.getElementById('mg-credit-days').value = '';
    document.getElementById('mg-paid-now').checked = false;
    mgAddRow(); mgRecalc();
    loadManualGRNList();
    loadStock();
  } catch (e) {
    toast(`Could not reach the server: ${e.message}`, 'error');
  } finally {
    btn.disabled = false;
  }
}

// What the owner sees under a saved GRN: payment status, who is owed, written/not written, owed after 1-3 months.
function mgCreditBlock(d) {
  const c = d && d.credit; if (!c) return '';
  const box = (inner) => `<div style="margin-top:10px;padding:12px;border-radius:8px;background:rgba(201,162,75,0.12);font-size:14px;line-height:1.6">${inner}</div>`;
  if (c.bill && c.bill.skipped) return box(`Saved. The vendor payable was not created yet: ${mgEsc(c.bill.skipped)}`);
  const t = c.this_bill; if (!t) return c.note ? box(mgEsc(c.note)) : '';
  const v = c.vendor, a = v ? v.after : {};
  let h = `<strong>${mgEsc(t.status_text)}</strong> — ${fmtLKR(t.total)}` + (t.due_date ? ` — vendor wants payment by ${mgEsc(t.due_date)}` : '');
  if (v) {
    h += `<br>${mgEsc(d.supplier_name)} total owed: <strong>${fmtLKR(v.owed)}</strong>` +
         `<br>Cheque not written: ${fmtLKR(v.notWritten)} &middot; Written, not cleared: ${fmtLKR(v.writtenNotClear)}` +
         `<br>Still owed after 1 month: ${fmtLKR(a[1])} &middot; 2 months: ${fmtLKR(a[2])} &middot; 3 months: ${fmtLKR(a[3])}`;
  }
  if (c.long_dated && c.long_dated.length) h += `<br><span style="color:#b3261e">Heads-up: ${c.long_dated.length} written cheque(s) clear after more than 3 months.</span>`;
  return box(h);
}

async function toggleItemForm() {
  const f = document.getElementById('item-form');
  const open = f.style.display === 'none';
  f.style.display = open ? 'block' : 'none';
  if (!open) return;
  f.scrollIntoView({behavior:'smooth'});
  document.getElementById('i-cat-list').innerHTML = [...new Set(_stock.map(r=>r.category).filter(Boolean))].map(c=>`<option value="${c.replace(/"/g,'&quot;')}">`).join('');
  const n = await api('/api/items/next-code');
  document.getElementById('i-next-code').textContent = n ? n.next_code : '?';
}

function previewItemPhoto(inp) {
  const img = document.getElementById('i-photo-prev');
  const f = inp.files[0];
  if (!f) { img.style.display = 'none'; return; }
  img.src = URL.createObjectURL(f);
  img.style.display = 'block';
}

async function saveItem() {
  const name = document.getElementById('i-name').value.trim();
  if (!name) { toast('Enter the item name', 'warning'); return; }
  const fd = new FormData();
  fd.append('name', name);
  [['category','i-cat'],['selling_price','i-price'],['avg_cost','i-cost'],['stock_level','i-qty'],['reorder_threshold','i-reorder']]
    .forEach(([k,id]) => fd.append(k, document.getElementById(id).value));
  const photo = document.getElementById('i-photo').files[0];
  if (photo) fd.append('photo', photo);
  const btn = document.getElementById('i-save');
  btn.disabled = true;
  try {
    // Raw fetch: api() forces a JSON Content-Type, which would break the multipart upload.
    const r = await fetch('/api/items', { method:'POST', body: fd, credentials:'include' });
    if (r.status === 401) { showLogin(); return; }
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { toast(d.error || `Could not save the item (server said ${r.status})`, 'error'); return; }
    toast(`Saved as item ${d.item_code}`, 'success');
    ['i-name','i-cat','i-price','i-cost','i-qty','i-reorder','i-photo'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('i-photo-prev').style.display = 'none';
    await loadStock();
    const n = await api('/api/items/next-code');
    document.getElementById('i-next-code').textContent = n ? n.next_code : '?';
  } catch (e) {
    toast(`Could not reach the server: ${e.message}`, 'error');
  } finally {
    btn.disabled = false;
  }
}
function toggleGRNForm() {
  const f = document.getElementById('grn-form');
  f.style.display = f.style.display==='none'?'block':'none';
  if (f.style.display==='block') f.scrollIntoView({behavior:'smooth'});
}

async function loadGRN() {
  const rows = await api('/api/grn');
  if (!rows) return;
  const tbody = document.getElementById('grn-tbody');
  if (!rows.length) { tbody.innerHTML='<tr><td colspan="8" class="no-data">No GRN records</td></tr>'; return; }
  tbody.innerHTML = rows.map(r => `<tr>
    <td>${r.grn_number||'—'}</td>
    <td>${r.grn_date||'—'}</td>
    <td>${r.supplier_name||'—'}</td>
    <td>${r.item_description||'—'}</td>
    <td>${r.quantity||0}</td>
    <td>${fmtLKR(r.unit_cost)}</td>
    <td>${fmtLKR(r.total_amount)}</td>
    <td><span class="badge ${r.status==='PENDING_REVIEW'?'ba':'bg'}">${r.status||'—'}</span></td>
  </tr>`).join('');
}

async function saveGRN() {
  const supplier_name = document.getElementById('g-supplier').value;
  const grn_date = document.getElementById('g-date').value;
  const qty = parseFloat(document.getElementById('g-qty').value)||0;
  const cost = parseFloat(document.getElementById('g-cost').value)||0;
  const item = document.getElementById('g-item').value;
  if (!item || !grn_date) { toast('Fill item and date', 'warning'); return; }
  const body = {
    grn_number: document.getElementById('g-num').value||null,
    supplier_name, grn_date,
    item_description: item,
    quantity: qty, unit_cost: cost,
    total_amount: qty*cost,
    notes: document.getElementById('g-notes').value||null
  };
  const r = await api('/api/grn', { method:'POST', body:JSON.stringify(body) });
  if (r) { toast('GRN saved','success'); toggleGRNForm(); loadGRN(); }
}

/* ─────────────────────────────────────────────
   EXPENSES
───────────────────────────────────────────── */
async function loadExpenses() {
  const date = document.getElementById('exp-date').value;
  if (!date) return;

  const [summary, detail] = await Promise.all([
    api(`/api/daily-summary/${date}`),
    api(`/api/expenses-detail?date=${date}`)
  ]);

  // Summary rows
  const sumEl = document.getElementById('exp-summary-rows');
  if (summary) {
    const reno = parseFloat(summary.renovation_cost||0);
    const ops  = parseFloat(summary.total_expenses||0);
    sumEl.innerHTML = [
      ['Total Sale', fmtLKR(summary.total_sale)],
      ['Operating Expenses', `<span style="color:var(--red)">${fmtLKR(ops)}</span>`],
      ['Renovation (separate)', `<span style="color:var(--amber)">${fmtLKR(reno)}</span>`],
      ['Payments Out', fmtLKR(summary.payments)],
      ['Cash In Hand', fmtLKR(summary.cash_in_hand)],
    ].map(([l,v])=>`
      <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--card-border);font-size:14px">
        <span style="color:var(--text2)">${l}</span><span>${v}</span>
      </div>`).join('');

    // Petty cash estimate
    const PETTY_FLOAT = 0; // set to your business's fixed petty-cash float
    const spent = parseFloat(summary.total_expenses||0);
    const bal   = Math.max(PETTY_FLOAT - spent, 0);
    document.getElementById('petty-bal').textContent = PETTY_FLOAT ? fmtLKR(bal) : '—';
    document.getElementById('petty-bar').style.width = PETTY_FLOAT ? Math.min((bal/PETTY_FLOAT)*100,100)+'%' : '0%';
  } else {
    sumEl.innerHTML = '<div class="no-data">No summary data for this date</div>';
  }

  // Expense detail lines
  const tbody = document.getElementById('exp-tbody');
  if (!detail || !detail.length) {
    tbody.innerHTML = '<tr><td colspan="3" class="no-data">No expense detail for this date</td></tr>';
    return;
  }
  tbody.innerHTML = detail.map(r => {
    const isReno = r.category?.toLowerCase().includes('reno');
    return `<tr style="${isReno?'background:rgba(245,158,11,0.06)':''}">
      <td>${isReno?`<span class="badge ba"><svg class="bh-icon" aria-hidden="true"><use href="#i-warning"/></svg> ${r.category} (separate)</span>`:`<span class="badge bb">${r.category||'Other'}</span>`}</td>
      <td>${r.description||'—'}</td>
      <td style="font-weight:700;color:${isReno?'var(--amber)':'var(--red)'}">${fmtLKR(r.amount)}</td>
    </tr>`;
  }).join('');
}

/* ─────────────────────────────────────────────
   CHEQUES
───────────────────────────────────────────── */
async function loadCheques() {
  const rows = await api('/api/cheques');
  if (!rows) return;
  _cheques = rows;
  loadPosCheques();
  renderCheques();
  renderChequeKPIs(rows);
  renderChequeCalendar(rows);
}

function renderCheques(filter='') {
  const tbody = document.getElementById('cheq-tbody');
  const rows = filter
    ? _cheques.filter(r => r.cheque_no?.toLowerCase().includes(filter) || r.name?.toLowerCase().includes(filter) || r.notes?.toLowerCase().includes(filter))
    : _cheques;
  if (!rows.length) { tbody.innerHTML='<tr><td colspan="7" class="no-data">No cheques found</td></tr>'; return; }
  const now = today();
  const in3 = new Date(); in3.setDate(in3.getDate()+3);
  tbody.innerHTML = rows.map(r => {
    const due = r.due_date?.slice?.(0,10) || '';
    const isToday = due===now;
    const isNear  = !isToday && due && due <= in3.toISOString().slice(0,10);
    const isClear = r.status==='cleared';
    const statCls = isClear?'bg':isToday?'br':isNear?'ba':'bb';
    const statLbl = isClear?'<svg class="bh-icon" aria-hidden="true"><use href="#i-check-circle"/></svg> Cleared':isToday?'<svg class="bh-icon" aria-hidden="true"><use href="#i-circle"/></svg> Due Today':isNear?'<svg class="bh-icon" aria-hidden="true"><use href="#i-circle"/></svg> Due Soon':'<svg class="bh-icon" aria-hidden="true"><use href="#i-hourglass"/></svg> Pending';
    return `<tr style="${isToday?'background:rgba(239,68,68,0.05)':''}">
      <td><strong>${r.cheque_no||r.cheque_number||'—'}</strong></td>
      <td>${r.bank||'—'}</td>
      <td><strong>${fmtLKR(r.amount)}</strong></td>
      <td style="${isToday?'color:var(--red);font-weight:700':''}">${fmtDate(due)}</td>
      <td>${r.name||'—'}</td>
      <td><span class="badge ${statCls}">${statLbl}</span></td>
      <td>${!isClear?`<button class="btn btn-g" style="padding:3px 9px;font-size:12px" onclick="clearCheque(${r.id})">Mark Cleared</button>`:''}</td>
    </tr>`;
  }).join('');
}

// ── POS cheque bills not yet on this page (read side; "Register" uses the normal cheque create route) ──
async function loadPosCheques() {
  const tb = document.getElementById('pos-cheq-tbody'); if (!tb) return;
  const [list, custs] = await Promise.all([api('/api/pos-ledger/cheques'), api('/api/customers')]);
  tb.textContent = '';
  if (!Array.isArray(list) || !list.length) { const tr = tb.insertRow(); const td = tr.insertCell(); td.colSpan = 6; td.className = 'no-data'; td.textContent = 'No POS cheques waiting'; return; }
  list.forEach(p => {
    const tr = tb.insertRow();
    tr.insertCell().textContent = p.bill_number;
    tr.insertCell().textContent = p.reference || '—';
    tr.insertCell().textContent = fmtLKR(p.amount);
    const sel = document.createElement('select'); sel.className = 'fs'; sel.setAttribute('aria-label', 'Customer for ' + p.bill_number);
    const o0 = document.createElement('option'); o0.value = ''; o0.textContent = 'Choose customer'; sel.appendChild(o0);
    (custs || []).forEach(c => { const o = document.createElement('option'); o.value = c.id; o.textContent = c.name || c.phone || ('#' + c.id); sel.appendChild(o); });
    if (p.customer_id) sel.value = String(p.customer_id);
    tr.insertCell().appendChild(sel);
    const due = document.createElement('input'); due.type = 'date'; due.className = 'fi'; due.value = p.bill_date; due.setAttribute('aria-label', 'Due date for ' + p.bill_number);
    tr.insertCell().appendChild(due);
    const btn = document.createElement('button'); btn.className = 'btn btn-p'; btn.style.cssText = 'padding:3px 9px;font-size:12px'; btn.textContent = 'Register this cheque';
    btn.onclick = () => registerPosCheque(p, sel.value, due.value, btn);
    tr.insertCell().appendChild(btn);
  });
}
async function registerPosCheque(p, customerId, dueDate, btn) {
  if (!customerId) { toast('Choose the customer first', 'warning'); return; }
  if (!dueDate) { toast('Choose the due date', 'warning'); return; }
  btn.disabled = true;
  const claim = await api('/api/pos-ledger/cheques/' + p.payment_id + '/claim', { method: 'POST', body: '{}' });
  if (!claim) { btn.disabled = false; loadPosCheques(); return; }          // already registered (or error): the list is refreshed
  const no = (String(p.reference || '').match(/\d{3,}/) || [null])[0];
  const made = await api('/api/cheques', { method: 'POST', body: JSON.stringify({ customer_id: customerId, amount: p.amount, due_date: dueDate, cheque_no: no, notes: 'From POS bill ' + p.bill_number + (p.reference ? ' · ' + p.reference : '') }) });
  if (!made) { await api('/api/pos-ledger/cheques/' + p.payment_id + '/release', { method: 'POST', body: '{}' }); btn.disabled = false; return; }
  await api('/api/pos-ledger/cheques/' + p.payment_id + '/done', { method: 'POST', body: JSON.stringify({ cheque_id: made.id }) });
  toast('Cheque registered', 'success'); loadCheques();
}

function filterCheques() { renderCheques(document.getElementById('cheq-search').value.toLowerCase()); }

async function clearCheque(id) {
  const r = await api(`/api/cheques/${id}/status`, { method:'PATCH', body:JSON.stringify({ status:'cleared' }) });
  if (r) { toast('Cheque marked cleared','success'); loadCheques(); }
}

function renderChequeKPIs(rows) {
  const pending   = rows.filter(r=>r.status==='pending');
  const total     = pending.reduce((a,r)=>a+parseFloat(r.amount||0),0);
  const now       = today();
  const in3       = new Date(); in3.setDate(in3.getDate()+3);
  const dueToday  = pending.filter(r=>r.due_date?.slice(0,10)===now).reduce((a,r)=>a+parseFloat(r.amount||0),0);
  const thisWeek  = pending.filter(r=>r.due_date && r.due_date.slice(0,10)<=in3.toISOString().slice(0,10)).reduce((a,r)=>a+parseFloat(r.amount||0),0);
  const cleared   = rows.filter(r=>r.status==='cleared').reduce((a,r)=>a+parseFloat(r.amount||0),0);
  const grid = document.getElementById('cheq-kpi-grid');
  grid.innerHTML = [
    {label:'Total Outstanding',val:fmtLKR(total),type:'total'},
    {label:'Due This Week',val:fmtLKR(thisWeek),type:'card'},
    {label:'Due Today',val:fmtLKR(dueToday),style:'color:var(--red)',type:'expense'},
    {label:'Cleared Total',val:fmtLKR(cleared),type:'profit'},
  ].map(k=>`
    <div class="kpi-card" data-type="${k.type}">
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-value" ${k.style?`style="${k.style}"`:''}>${k.val}</div>
    </div>`).join('');
}

function renderChequeCalendar(rows) {
  const cal = document.getElementById('cheq-cal');
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  let html = days.map(d=>`<div class="cal-hdr">${d}</div>`).join('');
  const d = new Date(); d.setDate(1);
  const yr=d.getFullYear(), mo=d.getMonth();
  for (let i=0;i<d.getDay();i++) html+='<div></div>';
  const daysInMonth = new Date(yr,mo+1,0).getDate();
  const nowStr = today();
  for (let day=1;day<=daysInMonth;day++) {
    const ds = `${yr}-${String(mo+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const match = rows.find(r=>r.due_date?.slice(0,10)===ds);
    const cls = match ? (match.status==='cleared'?'c-clear':ds===nowStr?'c-due':'c-cheque') : '';
    html+=`<div class="cal-day ${cls}">
      <div class="cal-day-n">${day}</div>
      ${match?`<div style="font-size:12px;color:var(--amber)">${fmt(match.amount/1000)}k</div>`:''}
    </div>`;
  }
  cal.innerHTML = html;
}

function showAddChequeForm() { document.getElementById('add-cheq-form').style.display='block'; }
function hideAddChequeForm() { document.getElementById('add-cheq-form').style.display='none'; }

async function saveCheque() {
  const amount = parseFloat(document.getElementById('cq-amount').value)||0;
  const due_date = document.getElementById('cq-due').value;
  if (!amount || !due_date) { toast('Amount and due date required','warning'); return; }
  const body = {
    cheque_no:   document.getElementById('cq-num').value||null,
    bank:        document.getElementById('cq-bank').value||null,
    amount, due_date,
    customer_id: document.getElementById('cq-customer').value||null,
    notes:       document.getElementById('cq-notes').value||null,
  };
  const r = await api('/api/cheques', { method:'POST', body:JSON.stringify(body) });
  if (r) { toast('Cheque saved','success'); hideAddChequeForm(); loadCheques(); }
}

/* ─────────────────────────────────────────────
   VENDORS
───────────────────────────────────────────── */
async function loadVendors() {
  const rows = await api('/api/suppliers');
  if (!rows) return;
  const tbody = document.getElementById('vend-tbody');
  const sel   = document.getElementById('vend-sel');

  // Populate dropdown
  sel.innerHTML = rows.map(r=>`<option value="${r.id}">${r.name}</option>`).join('');

  // Totals
  const totalPaid = rows.reduce((a,r)=>a+parseFloat(r.total_paid||0),0);
  const pendChq   = rows.reduce((a,r)=>a+parseFloat(r.pending_cheques||0),0);
  document.getElementById('vend-total-out').textContent = fmtLKR(totalPaid) + ' total paid';
  document.getElementById('vend-pending-cheq').textContent = fmtLKR(pendChq);

  if (!rows.length) { tbody.innerHTML='<tr><td colspan="6" class="no-data">No suppliers found</td></tr>'; return; }
  tbody.innerHTML = rows.map(r => {
    const paid    = parseFloat(r.total_paid||0);
    const pending = parseFloat(r.pending_cheques||0);
    return `<tr>
      <td><strong>${r.name}</strong><br><span style="font-size:12px;color:var(--text3)">${r.category||''}</span></td>
      <td style="font-weight:700;color:var(--blue)">${fmtLKR(paid)}</td>
      <td>${r.last_payment?fmtDate(r.last_payment):'—'}</td>
      <td>${pending>0?`<span style="color:var(--amber);font-weight:700">${fmtLKR(pending)}</span>`:'—'}</td>
      <td><span style="font-size:12px;color:var(--text3)">${r.days_since_payment>=0?r.days_since_payment+' days ago':'—'}</span></td>
      <td><button class="btn btn-s" style="padding:3px 9px;font-size:12px" onclick="viewVendorPayments(${r.id},'${r.name}')">History</button></td>
    </tr>`;
  }).join('');
}

async function viewVendorPayments(id, name) {
  const rows = await api(`/api/suppliers/${id}/payments`);
  if (!rows) return;
  toast(`${name}: ${rows.length} payment(s) — total ${fmtLKR(rows.reduce((a,r)=>a+parseFloat(r.amount||0),0))}`, 'info');
}

async function saveVendorPayment() {
  toast('Vendor payments — connect /api/supplier_payments endpoint', 'info');
}

/* ─────────────────────────────────────────────
   BARCODE
───────────────────────────────────────────── */
function loadBarcodeItems() {
  _bcItems = _stock.map(r => ({ ...r, selected: false, copies: 1 }));
  renderBarcodeItems();
}

function renderBarcodeItems(filter='') {
  const tbody = document.getElementById('bc-tbody');
  const items = filter ? _bcItems.filter(r => r.item_code?.toLowerCase().includes(filter) || r.name?.toLowerCase().includes(filter)) : _bcItems;
  if (!items.length) { tbody.innerHTML='<tr><td colspan="4" class="no-data">No items</td></tr>'; return; }
  tbody.innerHTML = items.map((r,i) => `
    <tr>
      <td><input type="checkbox" ${r.selected?'checked':''} onchange="_bcItems[${i}].selected=this.checked;previewItem(${i})"></td>
      <td><code style="color:var(--gold);font-size:12px">${r.item_code||'—'}</code></td>
      <td style="font-size:12px">${r.name}</td>
      <td><input type="number" style="width:46px;background:var(--bg3);border:1px solid var(--card-border);border-radius:4px;padding:3px 5px;color:var(--text);font-size:12px" value="${r.copies||1}" min="1" onchange="_bcItems[${i}].copies=parseInt(this.value)||1"></td>
    </tr>`).join('');
}

function filterBarcodeItems(v) { renderBarcodeItems(v.toLowerCase()); }
function selectAllBC()  { _bcItems.forEach(r=>r.selected=true);  renderBarcodeItems(); }
function deselectAllBC(){ _bcItems.forEach(r=>r.selected=false); renderBarcodeItems(); }
function toggleAllBC(cb){ if(cb.checked) selectAllBC(); else deselectAllBC(); }

function previewItem(i) {
  const r = _bcItems[i];
  document.getElementById('pv-name').textContent  = r.name;
  document.getElementById('pv-code').textContent  = r.item_code||'—';
  document.getElementById('pv-price').textContent = r.price_tier||'—';
  buildBarSVG(r.item_code||'ITEM');
}

function buildBarSVG(code) {
  const el = document.getElementById('pv-bars');
  el.innerHTML = Array.from(code).flatMap(c => {
    const n = c.charCodeAt(0);
    return [
      `<div style="height:${n%2===0?50:40}px;width:${n%3===0?5:2}px;background:#000;flex-shrink:0"></div>`,
      `<div style="width:${n%4===0?4:2}px;flex-shrink:0"></div>`
    ];
  }).join('');
}

function updatePreview() {
  document.getElementById('pv-size').textContent = document.getElementById('lbl-size').value.replace('x','×')+' mm';
}

function printLabels() {
  const sel = _bcItems.filter(r=>r.selected);
  if (!sel.length) { toast('No items selected','warning'); return; }
  printCnt += sel.length;
  document.getElementById('print-cnt').textContent = printCnt;
  toast(`Printing ${sel.length} label(s)`,'success');
  window.print();
}

/* ─────────────────────────────────────────────
   REPORTS
───────────────────────────────────────────── */
async function loadReport() {
  const from = document.getElementById('rpt-from').value;
  const to   = document.getElementById('rpt-to').value;
  if (!from || !to) { toast('Select date range','warning'); return; }
  const rows = await api(`/api/daily-summary?from=${from}&to=${to}`);
  if (!rows) return;

  // Totals
  const totSale = rows.reduce((a,r)=>a+parseFloat(r.total_sale||0),0);
  const totGP   = rows.reduce((a,r)=>a+parseFloat(r.gross_profit||0),0);
  const totExp  = rows.reduce((a,r)=>a+parseFloat(r.total_expenses||0),0);
  const totNP   = rows.reduce((a,r)=>r.net_profit!=null?a+parseFloat(r.net_profit):a,0);
  const totReno = rows.reduce((a,r)=>a+parseFloat(r.renovation_cost||0),0);

  // P&L
  document.getElementById('pl-rows').innerHTML = [
    ['Total Sales',        fmtLKR(totSale),  ''],
    ['Gross Profit',       fmtLKR(totGP),    'positive'],
    ['Operating Expenses', `− ${fmtLKR(totExp)}`, 'negative'],
    ...(totReno>0?[['Renovation (separate)', `− ${fmtLKR(totReno)}`, 'reno']]: []),
    ['NET PROFIT',         fmtLKR(totNP),    'total'],
  ].map(([l,v,cls]) => {
    const c = cls==='positive'?'color:var(--green)':cls==='negative'||cls==='reno'?'color:var(--red)':cls==='total'?'color:var(--gold);font-weight:800;font-size:15px':'';
    return `<div class="report-row" style="${cls==='reno'?'background:rgba(245,158,11,0.06);':''}">`+
      `<span${cls==='total'?' style="font-weight:800"':''}>${l}</span>`+
      `<span style="${c}">${v}</span>`+
      `</div>`;
  }).join('');

  // Daily table
  const tbody = document.getElementById('rpt-tbody');
  if (!rows.length) { tbody.innerHTML='<tr><td colspan="10" class="no-data">No data</td></tr>'; return; }
  tbody.innerHTML = rows.map(r => {
    const tier = r.data_tier||'FOUNDATION';
    const tierCls = tier==='FULL'?'tier-full':tier==='CASHFLOW'?'tier-cash':'tier-found';
    return `<tr>
      <td>${fmtDate(r.date_str||r.report_date)}</td>
      <td>${fmtLKR(r.total_sale)}</td>
      <td>${fmtLKR(r.cash_sale)}</td>
      <td>${fmtLKR(r.card_sale)}</td>
      <td>${fmtLKR(r.online_sale)}</td>
      <td>${fmtLKR(r.credit_sale)}</td>
      <td>${r.gp_status!=='NOT_AVAILABLE'?fmtLKR(r.gross_profit):'<span style="color:var(--text3)">—</span>'}</td>
      <td>${fmtLKR(r.total_expenses)}</td>
      <td style="${r.net_profit<0?'color:var(--red)':r.net_profit>0?'color:var(--green)':''}">
        ${r.net_profit!=null?fmtLKR(r.net_profit):'—'}
      </td>
      <td><span class="data-tier ${tierCls}">${tier}</span></td>
    </tr>`;
  }).join('');
}

/* ─────────────────────────────────────────────
   INIT APP (called after login)
───────────────────────────────────────────── */
async function initApp() {
  applyAppSettings();
  if (/^#\/[\w-]+/.test(location.hash)) setTimeout(routeFromHash, 400);        // open the page named in the address
  // Load the most recent date that has actual data
  const latestDay = await api('/api/daily-summary?latest=1');
  const latestDate = Array.isArray(latestDay) ? (latestDay[0]?.date_str || today()) : (latestDay?.date_str || today());

  const dp = document.getElementById('sales-date');
  if (!dp.value) dp.value = latestDate;

  const expDp = document.getElementById('exp-date');
  if (!expDp.value) expDp.value = latestDate;

  const vendDp = document.getElementById('vend-date');
  if (!vendDp.value) vendDp.value = today();

  const grnDp = document.getElementById('g-date');
  if (!grnDp.value) grnDp.value = today();

  const now = new Date();
  const m1 = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
  document.getElementById('rpt-from').value = m1;
  document.getElementById('rpt-to').value   = today();

  // Load all data in parallel
  await Promise.all([
    loadDashboard(),
    loadSalesDate(),
    loadStock().then(()=>{ loadBarcodeItems(); }),
    loadCheques(),
    loadVendors(),
    loadExpenses(),
    loadGRN(),
  ]);

  // Populate customer dropdown for cheques
  const customers = await api('/api/customers');
  if (customers) {
    const sel = document.getElementById('cq-customer');
    sel.innerHTML = '<option value="">Walk-in / N/A</option>' +
      customers.map(c=>`<option value="${c.id}">${c.name||c.phone}</option>`).join('');
  }

  // Populate supplier dropdown for GRN form
  const suppliers = await api('/api/suppliers');
  if (suppliers) {
    const sel = document.getElementById('g-supplier');
    sel.innerHTML = '<option value="">Select supplier…</option>' +
      suppliers.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
  }

  document.getElementById('page-sub').textContent = fmtDate(today()) + ' — Connected to database';
}
</script>
<script src="/document-inbox.js"></script>
<script src="/website-editor.js"></script>
<script src="/tile-gallery.js"></script>
<script src="/attach-widget.js"></script>
<script src="/salary.js"></script>
<script src="/lib/menuPrefs.js"></script>
<script src="/bathhub-logo.js"></script>
<script src="/lib/grn_import.js"></script>
</body>
</html>

```
