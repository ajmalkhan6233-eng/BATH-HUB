# RECONCILIATION RULES — BATHCO COMMAND

Living document. Created 12 Jun 2026. Records data-truth hierarchy, known
discrepancies and their resolutions, and the quarantine log for bad records.
Full business rules live in `CLAUDE.md`; this file is the detail/audit trail
behind the "MASTER DATA TRUTH" section there. At end of Phase 1 both files get
a final consolidation pass.

-----

## 1. DATA TRUTH HIERARCHY

1. **Excel daily sheets (Ajmal's nightly upload) = 100% truth for revenue**, from day one (shop opened 21 Dec 2025).
2. **Lasersoft = price master only (read-only)**. Early Lasersoft data (21 Dec 2025–30 Jan 2026, 30 rows, source='lasersoft') is a backdated bulk entry — GP figures there are tagged `gp_status='ESTIMATE'` pending Ajmal's cutover-date confirmation (Task #7, done — see §6).
3. **OCR (handwritten expense photos)** — supplementary, lower confidence. Each OCR row carries `checker_flags` noting confidence/issues.
4. Day status tags (Task #6, pending column):
   - **VERIFIED** — from Ajmal's Excel, counted/confirmed
   - **ESTIMATED** — pre-cutover Lasersoft or low-confidence OCR
   - **INCOMPLETE** — missing day, real gap. Never shown as zero; excluded from aggregates.

-----

## 2. QUARANTINE LOG

Table `daily_summary_quarantine` (created 12 Jun 2026) — mirrors `daily_summary`
plus `quarantine_reason`, `source_file`, `quarantined_at`. **Nothing deleted**,
all 19 rows fully recoverable.

Trigger: shop opened 21 Dec 2025, so any `daily_summary` row dated before
2025-12-21 is impossible — these were OCR misreads of unrelated documents
(supplier invoices, bank slips, error dialogs, etc.) inserted with garbage
dates. One additional row (2026-08-04, future-dated) was already self-flagged
by the checker as a Seylan Bank SMS misread.

| Old ID | Date | Amount | What it actually was | Source file |
|---|---|---|---|---|
| 35 | 2023-02-15 | 114,315 | Generic "Thank You!" receipt footer | — |
| 117 | 2023-12-09 | 500,000 | Garbled OCR, unrelated doc | 61f49c7b-...85.JPG |
| 104 | 2024-01-08 | 340,000 | Single "Commed Set" line item | 13B969F2-...B2B.JPG / 9a70fae6-...3ec3.JPG (ambiguous) |
| 122 | 2024-01-31 | 6,000 | OCR notes: figures estimated | BEC94B52-...098F.JPG |
| 113 | 2024-05-12 | 0 | Supplier invoice (bathroom accessories) | ambiguous — 1 of 12 zero-total OCR files |
| 106 | 2024-06-04 | 6,000 | OCR captured Windows "RPC server unavailable" error | 165E5C57-...9B3B.JPG |
| 36 | 2024-08-22 | 22,426 | NDB Bank cash deposit slip | — |
| 37 | 2025-01-08 | 340,000 | Single "Commed Set" receipt | 13B969F2-...B2B.JPG / 9a70fae6-...3ec3.JPG (ambiguous) |
| 119 | 2025-01-30 | 158,080 | Looks like real report but predates opening | 760AA948-...0886.JPG |
| 103 | 2025-02-20 | 0 | OCR captured printer error dialog | 0F2C8A7E-...85AB.JPG |
| 116 | 2025-03-12 | 2,750 | Single invoice line item | 5fb2aad9-...0f873.JPG |
| 38 | 2025-05-12 | 2,921,000 | ESKEMA CERAMIC **supplier** invoices (purchases, not Bathco sales) | 6792c39b-...1852e.JPG (OCR date 26-05-12) |
| 39 | 2025-10-30 | 93,325 | Single cash-sale receipt (Mr. Sumith) | 9d268a5b-...803e35.JPG |
| 201 | 2025-11-27 | 60,340 | Lasersoft single-invoice report (GP%=82.4%, 1 invoice) misfiled as full day | — |
| 40 | 2025-12-02 | 13,500 | Customer credit memo / return note CRM#0714 | 50f36fa9-...8dd7.jpg |
| 41 | 2025-12-12 | 765,000 | RK Trading Ventures supplier invoice #821 (duplicate of 42) | 5ab1daba-...d473.JPG |
| 42 | 2025-12-13 | 765,000 | Same RK Trading invoice #821 (duplicate of 41) | 5d0c43e4-...e560b.jpg |
| 43 | 2025-12-18 | -32,000 | VOOS ART BASIN supplier credit invoice (negative balance) | E6353E3D-...CB1F3.JPG |
| 111 | 2026-08-04 | 0 | Seylan Bank deposit SMS misread (already self-flagged) | ambiguous — 1 of 12 zero-total OCR files |

**Result:** `daily_summary` clean — 172 days, 2025-12-21 → 2026-06-10, Rs. 144,493,969.97 total sales.

-----

## 3. KNOWN DISCREPANCIES & RESOLUTIONS

| Item | Status | Resolution |
|---|---|---|
| Credit total: DB 542,300 vs Ajmal's 385,380 | **UNRECONCILED** — keep flag | DB matches the 542,300 figure exactly (5 customers incl. ABC BUILDERS 237,300). Keep UNRECONCILED until Ajmal enters corrections per PENDING_FROM_AJMAL.md. |
| Code 1676 pricing error | RESOLVED (31 May 2026) | Do not flag — CHECKER suppression rule (Task #10, not yet coded). |
| Cheque #760329 "duplicate" | RESOLVED | Do not flag — CHECKER suppression rule (Task #10, not yet coded). |
| Tile GP ~18% | Normal | Sri Lanka market reality — do not flag (Task #10, not yet coded). |
| Staff roster: DB 13 vs v2.0 doc 11 names | UNRESOLVED | Blocked on Ajmal's daily-wage/monthly list (Task #9). |
| Bathco Aromatic — dashboard tabs/pages | PENDING removal (UI only) | **CLARIFIED 12 Jun 2026 by Ajmal:** do NOT touch `shop_config.json` or anything LAYLA uses — that bot must keep working with its perfume catalog intact. ONLY remove any Aromatic tab/page from the Bathco COMMAND dashboard UI (`public/dashboard.html`, `server.js` routes). Aromatic data stays as-is until it gets its own system. |
| 46-day gap (Apr 19–May 31 2026) | VERIFIED | All 43 days present via import_dali_fix/may/root. Spot-check list for Ajmal pending (Task #8). |
| 2026-08-04 future-dated row | QUARANTINED | See §2, row 111. |
| Pre-21-Dec-2025 rows (18 total) | QUARANTINED | See §2. |

-----

## 4. CHECKER SUPPRESSION RULES (implemented 12 Jun 2026)

`C:\Bathco\AI-Data\run_agents.py` now has a `SUPPRESSED_*` registry + `is_suppressed()`
helper near the top of the file:
- Never flag item code 1676 (2X2 FLOOR TILE pricing — fixed 31 May 2026)
- Never flag Cheque #760329 (resolved duplicate)
- Never flag ~18% tile-category GP (normal for Sri Lanka market) — pass `note="tile_gp_18pct"`

These are item/cheque-level and don't yet have a matching alert (products/cheques
tables are empty) — `is_suppressed()` must be called by QUINN (item-level GP,
Task #14) and the cheque register (Task #4) once built, before writing an alert.

Cleanup done 12 Jun 2026: 5 unread CHECKER alerts that referenced now-quarantined
rows (2023-2025 misdated OCR, see §2) were marked read with a pointer to
`daily_summary_quarantine`.

Still flag (Ajmal only): missing invoices, negative margins, unbalanced petty cash,
credit 30+/45+ days, cheques due ≤7/2 days, incomplete day by 8 PM.

HSL/SL invoice sequence gaps — implemented 12 Jun 2026 (Task #11, see §7).

**Known issue (not yet fixed):** `save_checker_alerts()` inserts new `alerts`
rows on every CHECKER run with no de-dup (no unique constraint on `alerts`),
so re-running `python run_agents.py --agent checker` creates duplicate
`checker`-type alerts for unchanged days. Found while testing Task #11 — 43
duplicate rows were created and removed (`DELETE FROM alerts WHERE
created_at = '2026-06-12 11:14:59.133127'`). Needs a `(type,message)` dedup
or unique constraint before CHECKER is run on a schedule.

-----

## 5. OPEN QUESTIONS — see PENDING_FROM_AJMAL.md

-----

## 6. GROSS PROFIT (`gp_status`) — Lasersoft cutover (Task #7, done 12 Jun 2026)

`gross_profit` is populated for only 62 of 172 days — all others are 0 (Lasersoft
GP figures haven't been entered for those days yet, not a true zero). Added
`gp_status` column to `daily_summary` to make this explicit:

| gp_status | Count | Date range | Meaning |
|---|---|---|---|
| **ESTIMATE** | 30 | 2025-12-21 → 2026-01-30 | `source='lasersoft'`, total_expenses=0 — GP came from a Lasersoft "Profit-by-Sales" report that was bulk/backdated-entered after Lasersoft was set up. net_profit=gross_profit (no expense breakdown for these days), so the displayed net profit for this period is also effectively an estimate. |
| **ACTUAL** | 32 | 2026-04-01 → 2026-05-13 | `source='lasersoft'` Apr days (live daily entry, full expense + net profit breakdown) plus 2 `dali_report` days (12–13 May) explicitly marked "real sales/GP/expense breakdown". |
| **NOT_AVAILABLE** | 110 | scattered, incl. all of Feb–Mar 2026 and Jun 2026 | gross_profit=0 — no Lasersoft GP report supplied for these days. Excluded from GP% averages. |

**Inferred cutover date = 2026-04-01** (Feb–Mar gap filled by non-Lasersoft "DALI"
sheets with no GP data at all, then live Lasersoft GP resumes 1 Apr with full
expense tracking). Flagged to Ajmal for confirmation — PENDING_FROM_AJMAL.md #7.

Dashboard changes:
- `/api/all-time-stats` → `avg_gp_pct` now averages only over `gp_status IN
  ('ACTUAL','ESTIMATE')` days (62/171 in the all-time range), with new `gp_days`
  field. Home page "Avg GP%" card shows `(62/171 days)` coverage note.
- Day-detail panel (`selectDay`) shows a 5th KPI card: "Gross Profit" (green),
  "Gross Profit (ESTIMATE — backdated Lasersoft entry)" (amber), or "Gross Profit
  (NOT AVAILABLE)" (—) depending on `gp_status`.

-----

## 7. HSL/SL INVOICE SEQUENCE GAP DETECTION (Task #11, done 12 Jun 2026)

Added `invoice_seq_start` / `invoice_seq_end` (VARCHAR) columns to `daily_summary`
to hold the first/last invoice number issued each day (e.g. `SL000040`,
`HSL000123` — HSL and SL are separate series). `C:\Bathco\AI-Data\run_agents.py`
now has `check_invoice_sequence_gaps()`, called at the end of `run_checker()`:
for each series, if the next VERIFIED day's `seq_start` isn't exactly one more
than the previous day's `seq_end`, it writes a quiet `invoice_gap` alert
(`data.visible_to='admin'`). `server.js` `/api/alerts` filters out `invoice_gap`
alerts for non-admin roles (owner/staff never see them — Ajmal only).

**Currently dormant**: 0/172 days have `invoice_seq_start`/`end` populated — no
Lasersoft export so far has included an invoice-number range, only an invoice
*count* (`notes` field, e.g. "Invoices=9"). One historical OCR row captured a
single invoice number (`SL000040`, 27 Dec 2025) but that's not a range. The
check runs cleanly and produces 0 alerts until this data is available — see
PENDING_FROM_AJMAL.md #10.

-----

## 8. DATA TIER BOUNDARIES (Phase 1 Final, period segregation)

Computed **per day, live SQL**, not from calendar assumptions — see
`SOURCE_INVENTORY.md` for full provenance detail behind these numbers.

```sql
CASE
  WHEN gp_status='ACTUAL' AND total_expenses>0 THEN 'FULL'
  WHEN (cash_sale+card_sale+online_sale+credit_sale)>0 THEN 'CASHFLOW'
  ELSE 'FOUNDATION'
END
```

| Tier | Days | What it shows | What it CANNOT show |
|---|---|---|---|
| **TIER 1 FULL** | 32 | Sales, GP, expenses, **Net Profit**, staff, anomalies — complete report | nothing |
| **TIER 2 CASHFLOW** | 104 | Revenue + cash in/out by method, net cash movement | Net Profit → "— (no GP data)", never 0 |
| **TIER 3 FOUNDATION** | 36 | Revenue total only | cash-in breakdown, Net Profit |

**Absolute truth rule (per owner)**: Excel-equivalent `total_sale` (and its
cash/card/online/credit split where present) is treated as truth for **all
172 days** and is the basis for every revenue figure regardless of tier —
this is unchanged by GP/expense availability. Excel covers sales only, never
expenses (per owner) — GP/expenses/net-profit completeness is what drives the
tier, not revenue.

### TIER 1 — FULL: 32 days
- **1–30 April 2026** (30 days) — `source='lasersoft'`, `gp_status='ACTUAL'`,
  `total_expenses>0` every day. The one calendar month fully reconciled.
- **12–13 May 2026** (2 days) — `source='dali_report'`, `gp_status='ACTUAL'`,
  `total_expenses>0` (76,940 / 53,820).

⚠️ Differs from the owner's initial framing: TIER 1 is **not** a clean
trailing "last 1-2 months". 14 May – 10 Jun 2026 has good revenue/cash-split
data (TIER 2) but `gp_status='NOT_AVAILABLE'` — the Lasersoft GP report for
that window hasn't been entered yet (data-entry backlog, not necessarily a
missing-document problem). April 2026 is currently the only fully-reconciled
month.

### TIER 2 — CASHFLOW: 104 days
Everything else in the 21 Dec 2025 – 10 Jun 2026 range that has a non-zero
cash/card/online/credit split: 31 Dec 2025 – 20 Mar 2026 (minus the
FOUNDATION dates below), 22–31 Mar 2026, all of May 2026 except 12–13, and
1–10 Jun 2026. Revenue + payment-method cash flow is usable; profit fields
must read "— (no GP data)".

### TIER 3 — FOUNDATION: 36 days
Only `total_sale` is known (payment-method split = 0):
- **21–30 Dec 2025** (10 days — the shop's first 10 days, before the
  cash/card/online/credit split was being recorded)
- **24 days in January 2026**: 1, 3–8, 10–13, 15–18, 21–28, 30 Jan (scattered
  gaps in the payment-split capture)
- **2 zero-sale special days**: 21 Mar 2026 (Eid holiday, shop closed) and
  28 May 2026 (closed/no sales recorded) — FOUNDATION because `total_sale=0`
  makes a payment split meaningless, not because data is missing.

### All-time Net Profit basis (per "profit only from FULL days, labeled so")
- `total_net_profit` = SUM(gross_profit − total_expenses) over the 32 TIER 1
  days = **LKR 6,263,396.56**; UI labels this "PARTIAL: profit from 32 of 172
  days" (`net_profit_days=32`, `days=172`).
- `avg_np_pct` (net margin) = same 32-day basis = **15.27%**.
- `avg_gp_pct` (gross margin) stays on the broader 62-day `gp_status IN
  ('ACTUAL','ESTIMATE')` basis = **22.80%** — GP itself is a real Lasersoft
  figure on ESTIMATE days, only the expense side is incomplete. Labeled
  separately from net margin since the bases differ.

### Cash flow (all tiers)
```sql
cash_in  = CASE WHEN (cash_sale+card_sale+online_sale+credit_sale)>0
                THEN (cash_sale+card_sale+online_sale+credit_sale)
                ELSE total_sale END   -- FOUNDATION days fall back to Excel total
cash_out = total_expenses + payments + salary + cash_out
net_cash_movement = cash_in - cash_out
```
All-time: `cash_in_total = 136,253,323.96`, `cash_out_total = 8,911,992.88`
(2025-12-21 → 2026-06-10).

-----

*Last updated: 12 Jun 2026 — quarantine pass, initial reconciliation baseline, Lasersoft GP cutover tagging, invoice-gap infra, Phase 1 Final tier boundaries (§8).*
