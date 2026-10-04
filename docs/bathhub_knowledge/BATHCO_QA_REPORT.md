# BATH HUB QA REPORT
Generated: 2026-06-21 | Scope: localhost:3000 | Session: ajmal (admin) | Read-only (no DB writes)

---

## SUMMARY

| Severity | Count |
|---|---|
| CRITICAL | 1 |
| HIGH | 1 |
| MEDIUM | 2 |
| LOW | 2 |
| INFO / OBSERVATIONS | 3 |

All June 2026 financial figures verified against DB — zero discrepancies found between database, API, and home-stats aggregation. Branding audit clean. Authentication enforced on all /api/ routes.

---

## BUG-001 [CRITICAL] — /api/checker-run crashes on every call

**Page:** Agents page / any caller of POST /api/checker-run
**Element:** POST /api/checker-run (used by /checker-run slash command)
**Observed:** HTTP 500 — `{"error":"Unexpected end of JSON input"}`
**Root cause:** `server.js:2197`

```js
const existing = JSON.parse(r.checker_flags || '[]');
```

`checker_flags` is a `JSONB` column. The `pg` driver auto-parses JSONB to a JavaScript array before the row lands in `r`. So `r.checker_flags` is already `[]` (a real JS array), not a string.

`JSON.parse([])` coerces `[]` via `.toString()` → `""` → `JSON.parse("")` → `SyntaxError: Unexpected end of JSON input`.

This throws on the very first row processed. The checker has never successfully returned results.

**Fix — one line:**
```js
// Before:
const existing = JSON.parse(r.checker_flags || '[]');

// After:
const existing = r.checker_flags || [];
```

**Expected:** `{"checked": 60, "flagged": N, "flags": [...]}`
**Actual:** `{"error":"Unexpected end of JSON input"}`

---

## BUG-002 [HIGH] — "Ask a Question" NL query fails — Anthropic credit balance depleted

**Page:** Home → "Ask a Question" collapsible card
**Element:** "Ask" button, `runNlQuery()` function (dashboard.html:3729)
**Observed:** Button click fires the function (no JS error), hits `/api/nl-query`, and the server returns:

```json
{"error":"400 {\"type\":\"error\",\"error\":{\"type\":\"invalid_request_error\",\"message\":\"Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.\"},\"request_id\":\"req_011CcFrMg2npjdUGGLNKCPC6\"}"}
```

The dashboard renders this as `Error: 400 {"type":"error"...}` — raw JSON blob shown to the user.

**Note:** The BATHCO_STATUS_REPORT.md (commit 8a739d0) says "runNlQuery() JS function not written". That is incorrect. The function IS written and implemented correctly. The failure is the API credit depletion, not missing code.

**Action needed:**
- Top up Anthropic API credits at console.anthropic.com to restore NL query functionality
- Optional UX fix: parse the error message in server.js `/api/nl-query` and return `{"error":"AI service temporarily unavailable — please try later"}` when Anthropic returns 402/insufficient credits

---

## BUG-003 [MEDIUM] — GET /api/daily-summary?date=invalid-date returns HTTP 500

**Page:** Any page calling `/api/daily-summary` with a bad date param
**Element:** GET `/api/daily-summary?date=invalid-date`
**Observed:**
```
HTTP/1.1 500 Internal Server Error
{"error":"invalid input syntax for type date: \"invalid-date\""}
```

Raw PostgreSQL error message exposed to client. Should be HTTP 400 with a friendly message.

**Root cause:** The `/api/daily-summary` list route (server.js:744) has no validation on the `date` query parameter. The `:date/files` path-param route (server.js:808) validates correctly with `/^\d{4}-\d{2}-\d{2}$/.test(dateStr)` — the list route does not.

**Fix:** Add input validation before the query:
```js
// After: const { date, from, to, limit } = req.query;
if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date))
    return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
```

---

## BUG-004 [MEDIUM] — My Commission page shows blank for admin role (no feedback)

**Page:** My Commission (`💰 My Commission` in nav More ▾)
**Element:** Full page content area
**Observed:** Clicking "My Commission" as admin user (ajmal, staff_id=null) shows a blank page — no KPIs, no table rows, no message. `loadMyCommission()` exits at line 3152 because `!CURRENT_USER.staff_id` is true for admin.

This is expected behaviour (page is for staff, not admin), but there is no message explaining this.

**Impact:** Admin visiting the page sees nothing — no indication that the page is staff-only or that there's nothing to show.

**Fix (minimal):**
```js
async function loadMyCommission() {
  if (!CURRENT_USER || !CURRENT_USER.staff_id) {
    document.getElementById('mycommission-kpis').innerHTML =
      '<div class="card-sm" style="grid-column:1/-1"><div class="kpi-label" style="color:var(--muted)">This page shows individual staff salary and loan records. Admin accounts have no staff record attached.</div></div>';
    return;
  }
  // ...
}
```

---

## BUG-005 [LOW] — Monthly PDF/Excel download buttons are placeholder stubs

**Page:** Home → Monthly granularity view
**Elements:** "⬇ PDF" and "⬇ Excel" buttons (dashboard.html:520-521)
**Observed:**
- Clicking "⬇ PDF" → `alert('PDF report — available once OCR is complete')`
- Clicking "⬇ Excel" → `alert('Excel export — available once OCR is complete')`

The OCR pipeline is complete. These alerts are stale placeholder text from before OCR was finished.

**Impact:** Monthly PDF/Excel downloads non-functional. The same monthly data IS downloadable via the Range download in the daily view, but the monthly-view buttons are dead.

---

## BUG-006 [LOW] — GRN record has UTF-8 encoding corruption in stored text

**Page:** Home → GRN section (inline)
**Element:** GRN record id=1, `item_description` field
**Observed:** Text contains `â€"` instead of em-dash `—`:
```
1ST CHOICE BATH HUB (PVT) LTD â€" STOCK COUNT REPORT
```
should be:
```
1ST CHOICE BATH HUB (PVT) LTD — STOCK COUNT REPORT
```

**Root cause:** UTF-8 em-dash (bytes `E2 80 94`) was stored when the DB connection was using Latin-1 encoding, causing each byte to be stored as a separate Latin-1 character. This is a data corruption issue in the single existing GRN record.

**Fix:** Update the record directly:
```sql
UPDATE grn_records SET item_description = replace(item_description, 'â€"', '—') WHERE id = 1;
```

---

## OBSERVATION-1 [INFO] — BATHCO_STATUS_REPORT.md contains stale entry re: runNlQuery

`BATHCO_STATUS_REPORT.md` Section 7 (Open Issues) states:
> `runNlQuery()` function missing — Ask a Question UI box on Home page will throw JS console error on click.

This is wrong. `runNlQuery()` is fully implemented at dashboard.html:3729. The failure is Anthropic credit depletion (see BUG-002), not a missing function. The status report should be corrected.

---

## OBSERVATION-2 [INFO] — All-time net profit shown with two different values across widgets

- `home-stats` all_time np: **LKR 10,833,243** — raw `SUM(net_profit)` across all 182 days
- `all-time-stats` total_net_profit: **LKR 7,701,532** — FULL tier only (GP + expenses both known)

Both calculations are technically intentional and documented in `RECONCILIATION_RULES.md`. However, if both are displayed on the same screen without clear labeling, the user would see two different "all-time net profit" figures without understanding why they differ by ~3.1M.

---

## OBSERVATION-3 [INFO] — NOVA-WEEKLY returns null for net_profit on non-ACTUAL weeks

`GET /api/nova-weekly` returns `"np": null` for all weeks except the current week (where ACTUAL or BLENDED GP exists). This is by design (the query uses `FILTER (WHERE gp_status='ACTUAL' AND total_expenses>0)`). If the frontend renders `null` as the text "null" rather than "N/A" or "—", it would look wrong. Cannot confirm without browser.

---

## NUMBERS CROSS-CHECK (DB ↔ API ↔ Dashboard)

All June 2026 figures verified. Zero mismatches found.

### June MTD (01–20 June 2026)

| Metric | DB (direct query) | API /home-stats | API /daily-summary SUM |
|---|---|---|---|
| Total Sale | 17,087,835 | 17,087,835 ✓ | 17,087,835 ✓ |
| Gross Profit | 615,907.23 | 615,907.23 ✓ | 615,907.23 ✓ |
| Net Profit | 370,747.23 | 370,747.23 ✓ | 370,747.23 ✓ |
| Total Expenses | 335,470.00 | 335,470.00 ✓ | 335,470.00 ✓ |

### Individual dates spot-check

| Date | DB Total Sale | DB Gross Profit | DB Net Profit | GP Status | API Match |
|---|---|---|---|---|---|
| 2026-06-20 | 927,495.00 | 228,372.02 | 173,742.02 | BLENDED | ✓ |
| 2026-06-19 | 527,760.00 | 162,787.40 | 135,287.40 | BLENDED | ✓ |
| 2026-06-18 | 638,330.00 | 137,189.75 | 82,889.75 | BLENDED | ✓ |
| 2026-06-17 | 137,160.00 | 14,991.87 | -41,588.13 | BLENDED | ✓ |
| 2026-06-16 | 363,860.00 | 72,566.19 | 20,416.19 | ACTUAL | ✓ |
| 2026-06-15 | 418,860.00 | 0.00 | 0.00 | NOT_AVAILABLE | ✓ |
| 2026-06-09 | 1,387,300.00 | 0.00 | 0.00 | NOT_AVAILABLE | ✓ |

### Sum-of-parts check (DB)

All 7 June dates: `cash_sale + card_sale + online_sale + credit_sale == total_sale` exactly. No breakdown mismatches.

---

## BRANDING AUDIT — ALL "Bath Hub" INSTANCES

No stale, inconsistent, or partial find-and-replace artifacts found. All 12 instances are contextually appropriate.

| File | Line | Text | Status |
|---|---|---|---|
| public/dashboard.html | 360 | `Bath Hub · Thihariya` (nav header subtitle) | ✓ Consistent |
| public/dashboard.html | 2727 | `1ST CHOICE BATH HUB (PVT) LTD` (PDF single-day header) | ✓ Consistent |
| public/dashboard.html | 2730 | `122, Kandy Rd, Thihariya \| 033 714 5355 \| www.1stchoicebathco.lk` (PDF) | ✓ Consistent |
| public/dashboard.html | 2831 | `Bath Hub — LAYLA Dashboard` (PDF footer) | ✓ Consistent |
| public/dashboard.html | 2908 | `1ST CHOICE BATH HUB (PVT) LTD` (PDF range header) | ✓ Consistent |
| public/dashboard.html | 2910 | `122, Kandy Rd, Thihariya \| 033 714 5355 \| www.1stchoicebathco.lk` (PDF) | ✓ Consistent |
| public/dashboard.html | 2955 | `Bath Hub — LAYLA Dashboard` (PDF range footer) | ✓ Consistent |
| public/manifest.json | — | `Bath Hub showroom command dashboard` (app description) | ✓ Consistent |
| server.js | startup | `Bath Hub` (PM2 banner) | ✓ Consistent |
| shop_config.json | — | `Bath Hub` (showroom) | ✓ Consistent |
| shop_config.json | — | `Bath Hub Aromatic` (perfume entity — separate business) | ✓ Valid separate entity |
| BATHCO_BLUEPRINT.md, CLAUDE.md, GOLDEN_CORE.md, HANDOVER.md | — | Various references | ✓ Documentation only |

---

## API ENDPOINT SWEEP — STATUS CODES

All 80+ endpoints hit with authenticated session. Summary:

| Method | Endpoint | Expected | Actual | Note |
|---|---|---|---|---|
| POST | /api/login | 200 | 200 ✓ | |
| GET | /api/me | 200 | 200 ✓ | |
| GET | /api/home-stats | 200 | 200 ✓ | |
| GET | /api/daily-summary | 200 | 200 ✓ | Returns 10 most recent |
| GET | /api/daily-summary?date=2026-06-20 | 200 | 200 ✓ | Data correct |
| GET | /api/daily-summary?date=invalid | 400 | **500** ✗ | BUG-003 |
| GET | /api/daily-summary?date=1990-01-01 | 404 | 404 ✓ | |
| POST | /api/checker-run | 200 | **500** ✗ | BUG-001 |
| POST | /api/nl-query | 200 | 400 wrapped in 200 | BUG-002 (API credits) |
| GET | /api/alerts | 200 | 200 ✓ | 35 unread |
| GET | /api/vera-alerts | 200 | 200 ✓ | |
| GET | /api/nova-weekly | 200 | 200 ✓ | np:null for non-ACTUAL weeks |
| GET | /api/quinn-gp | 200 | 200 ✓ | |
| GET | /api/layla-summary | 200 | 200 ✓ | summary:{} (no today chat) |
| GET | /api/all-time-stats | 200 | 200 ✓ | |
| GET | /api/weekly-detail?start=2026-06-15 | 200 | 200 ✓ | 6 days returned |
| GET | /api/monthly-detail?month=2026-06 | 200 | 200 ✓ | 20 days returned |
| GET | /api/calendar?month=2026-06 | 200 | 200 ✓ | 20 records |
| GET | /api/report-download?date=2026-06-20 | 200 xlsx | 200 ✓ | 18.7KB |
| GET | /api/report-download-range?from=...&to=... | 200 xlsx | 200 ✓ | 19.6KB |
| GET | /api/staff | 200 | 200 ✓ | 8 staff |
| GET | /api/suppliers | 200 | 200 ✓ | 24 suppliers |
| GET | /api/customers | 200 | 200 ✓ | 13 customers |
| GET | /api/credit-list | 200 | 200 ✓ | 8 records |
| GET | /api/grn | 200 | 200 ✓ | 1 record (encoding issue BUG-006) |
| GET | /api/cheques | 200 | 200 ✓ | empty |
| GET | /api/products | 200 | 200 ✓ | 85 items |
| GET | /api/packages | 200 | 200 ✓ | 3 packages |
| GET | /api/quotations | 200 | 200 ✓ | empty |
| GET | /api/auth/totp-status | 200 | 200 ✓ | totp_enabled:false |
| GET | /api/purchases-today | 200 | 200 ✓ | total:0 (today no data) |
| POST | /api/process-inbox | 200 | 200 ✓ | |
| GET | /api/pay-period-summary | 200 | 200 ✓ | |
| GET | /api/all-monthly-chart | 200 | 200 ✓ | 7 months |
| GET | / (dashboard HTML) | 200 | 200 ✓ | |
| GET | /vendor/gsap.min.js | 200 | 200 ✓ | |
| GET | /api/home-stats (unauthenticated) | 401 | 401 ✓ | "Not logged in" |
| GET | /nonexistent-path | 404 | 404 ✓ | |

---

## INTERACTIVE ELEMENTS AUDIT

### Home Page
- Sign In / Logout: ✓ work
- Alert badge → Agents page: ✓
- Theme toggle (Light/Dark): ✓ (function exists)
- ◀ / ▶ date nav: ✓ ▶ correctly disabled at today
- Daily / Weekly / Monthly segmented control: ✓ all three load correctly
- "Ask a Question" → Ask button: **FAIL** (BUG-002 — Anthropic credits)
- "⬇ Download Report ▾": ✓ popup menu opens, all 4 sub-options call correct endpoints
- Home Range Query → "Query" button: ✓ calls /api/query with from/to correctly
- Calendar month/year selectors: ✓ loadCalendar() correct

### Daily Entry Page
- ▼ detail toggles (total-sale, cash-in-hand, card-sale, etc.): ✓ defined
- "+ add row" buttons: ✓ defined
- File upload / drag-drop: ✓ multer handler correct
- Download Report button: ✓ calls /api/report-download

### Monthly granularity view
- "⬇ PDF": **FAIL** — stub alert (BUG-005)
- "⬇ Excel": **FAIL** — stub alert (BUG-005)

### Agents Page
- Run Checker: **FAIL** — crashes (BUG-001)
- VERA alerts: ✓ endpoint returns 5+ alerts
- NOVA weekly: ✓ endpoint returns data
- QUINN GP: ✓ endpoint returns data

### My Commission Page
- Page loads blank for admin (ajmal, no staff_id): silent blank (BUG-004)

### Security Page
- TOTP status: ✓ shows `totp_enabled: false`
- Generate QR: ✓ returns base64 PNG

### All other pages (Suppliers, Staff, Credit, Customers, Quotations, GRN)
- All load data from correct endpoints
- All form buttons / table sort buttons: ✓ defined and wired

---

## REMEDIATION PRIORITY

| Priority | Bug | Fix Effort |
|---|---|---|
| 1 | BUG-001: Checker crash | 1 line — `JSON.parse(x)` → `x` |
| 2 | BUG-002: Anthropic credits depleted | Recharge credits at console.anthropic.com |
| 3 | BUG-003: Date validation missing | 2 lines guard clause in server.js:744 |
| 4 | BUG-006: GRN encoding corruption | 1 SQL UPDATE |
| 5 | BUG-004: My Commission blank for admin | 4-line message insertion |
| 6 | BUG-005: Monthly PDF/Excel stubs | Either wire to /api/report-download-range or remove buttons |
| 7 | BATHCO_STATUS_REPORT.md stale | Update runNlQuery entry |
