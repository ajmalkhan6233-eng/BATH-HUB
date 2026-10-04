# BATH HUB GOLDEN CORE — v1 (tagged: golden-core-v1)

Snapshot of the engine as of 2026-06-19. This document separates what is
reusable infrastructure from what is BATH HUB-specific, so the engine can
be extracted or ported to a second client without carrying business-specific
assumptions.

---

## REUSABLE ENGINE

These components contain no BATH HUB-specific business logic. They could be
lifted to a new project with only config changes.

| Component | Files | What it does |
|---|---|---|
| **Auth & session** | `server.js:66–117` | Express-session + bcrypt, role-based (admin/owner/staff), global middleware, /api/login, /api/logout, /api/me |
| **File detection & upload** | `server.js:42–57`, `/api/daily-summary/:date/files` | multer diskStorage, extension + MIME-type validation (file-type), per-date upload directories |
| **Daily entry form** | `public/dashboard.html` page-dailysummary | Multi-field numeric entry, line-item detail rows, cash reconciliation checker, live summary panel |
| **PDF export** | `public/dashboard.html` downloadDayPDF / downloadRangePDF | Client-side jsPDF; portrait single-day + landscape range; no server dependency |
| **Excel export** | `server.js` /api/report-download, /api/report-download-range | SheetJS; single-day (4 sheets) + date-range (1 sheet with date spine) |
| **Dashboard render pipeline** | `public/dashboard.html` loadUnified → loadUnifiedDaily/Weekly/Monthly | Granularity switcher, KPI boxes, breakdown panels, day-kpis grid, recent-days table, calendar heatmap |
| **OCR pipeline** | `scripts/ocr_expense_photos.py` | OpenRouter vision API, free-tier fallback chain, resume via JSON, aggregation by summary-sheet detection |
| **Uncertainty indicator** | `uncWrap`, `uncEdit`, `uncCommit`, `uncAbort` (dashboard.html) | Amber ▲ inline-edit for estimated/partial figures; PATCHes /api/daily-summary/:date/field |
| **Pending override** | `openPendingOverride`, `submitPendingOverride` (dashboard.html) | Red [+] modal for PENDING values; same PATCH endpoint |
| **Backtrack modal** | `backtrackModal`, `closeBacktrackModal` (dashboard.html) | Click KPI value → modal shows source breakdown from breakdown divs |
| **Flag dropdown** | `flagDropdownHtml`, `saveFlagPanel` (dashboard.html) | checker_flag → plain-English panel in card breakdown with inline edit + confirm |
| **Field override endpoint** | `server.js` PATCH /api/daily-summary/:date/field | Overrides gross_profit / total_expenses / total_sale; recalculates NP; clears specified checker_flag |
| **Natural language query** | `server.js` /api/nl-query, `layla.js` callAnthropic | LLM date-range parser + SQL executor; returns plain-English answer |
| **GRN watcher** | `grn-watcher.js`, PM2 config in ecosystem.config.js | Background process monitoring goods-received notes |
| **Data tier system** | `TIER_EXPR` (server.js) | FULL / CASHFLOW / FOUNDATION classification; controls which KPIs are shown as real vs pending |

---

## BATH HUB-SPECIFIC

These sections contain logic, values, or assumptions that are specific to
Bath Hub and would need to be changed for any other client.

| Item | Location | What makes it BATH HUB-specific |
|---|---|---|
| **Brand identity** | dashboard.html header | "Bath Hub", "Thihariya", bismillah text, gold colour scheme |
| **50,000/day expense assumption** | Historical OCR notes, AUDIT_REPORT.md | Default daily expense estimate used before OCR; not in live code but referenced in offline scripts |
| **LKR currency** | fmtN() in dashboard.html, all display labels | "Rs." prefix, Sri Lanka locale formatting |
| **Lasersoft GP source** | build_master_data.js, server.js gp_status logic | GP comes from Lasersoft RepSalesAnalysis exports; `gp_status='ACTUAL'` means Lasersoft-confirmed |
| **WhatsApp photo naming** | `ocr_expense_photos.py` filename parser | Expense photos named "WhatsApp Image YYYY-MM-DD at HH.MM.SS" |
| **Sri Lanka business calendar** | No Sunday closing, no public holiday logic | Days are never skipped; every calendar day is a potential business day |
| **Checker flag thresholds** | server.js TIER_EXPR, checker_flags logic | `high_expenses` = expenses > 50% of sales; `cash_shortfall` specific to local cash-handling norms |
| **Admin PIN** | server.js /api/admin/verify-pin | Single shared admin PIN (not per-user); set via ADMIN_PIN in .env |
| **Upload directory path** | server.js UPLOAD_DIR | Hardcoded to `/uploads` inside __dirname; BATH HUB-specific deployment path |
| **Hardcoded date range** | server.js RANGE_FROM = '2025-12-21' | Business start date; all-time stats count from 21 Dec 2025 |
| **Staff commission structure** | server.js, Daily Entry form | Commission % per staff member; structure matches BATH HUB payroll |
| **Supplier categories** | suppliers page | Category list matches BATH HUB procurement (tiles, bathware, plumbing) |
| **LAYLA branding** | layla.js, dashboard LAYLA ONLINE pill | AI assistant name; BATH HUB-specific persona |

---

## ENGINE EXTRACTION CHECKLIST

To port the engine to a new client:

- [ ] Replace brand in dashboard.html header and `<title>`
- [ ] Set currency symbol and locale in `fmtN()`
- [ ] Replace RANGE_FROM with new client's business start date
- [ ] Set ADMIN_PIN, SESSION_SECRET, OPENROUTER_API_KEY in new `.env`
- [ ] Update checker_flag thresholds (50% expense ratio) to match new client norms
- [ ] Replace Lasersoft GP integration with new client's cost-report source
- [ ] Replace WhatsApp photo naming pattern in OCR script if client uses different naming
- [ ] Review staff commission structure and adjust Daily Entry form fields
