# SOURCE_INVENTORY.md — Where Every Number Comes From

Generated 12 Jun 2026, Phase 1 Final. Answers your 3 questions directly, in order.
All figures below are read straight from the live database (`daily_summary`,
`expenses_detail`, `daily_reports`).

---

## (a) Excel sales data: how many of the 172 days are covered?

**The shop has been open 172 calendar days (21 Dec 2025 → 10 Jun 2026), and
every single one of those 172 days has a `daily_summary` row with a revenue
figure. There are NO missing dates.**

BUT — important honesty finding: the database has a dedicated table for
**per-receipt** Excel rows (`daily_reports` — Date, Invoice No, Sales Total,
Cash, Card, Online, Cheque, Credit, per your sheet's columns). **That table is
completely empty (0 rows).** Your invoice-level Excel data was never loaded
row-by-row. Instead, someone (or an automated import) entered/derived a
**daily total** for each day and wrote it straight into `daily_summary`. The
172 days break down by *how that daily total got there*:

| Source tag (in DB) | Days | Date range | What it actually is |
|---|---|---|---|
| `lasersoft` (gp_status=ESTIMATE) | 30 | 21 Dec 2025 – 30 Jan 2026 | Pulled from the Lasersoft POS export. **Not your Excel.** |
| `ocr` | 34 | 27 Dec 2025 – 28 Mar 2026 | OCR'd from photos (presumably your Excel sheet photos) |
| `import_dali_master` | 34 | 31 Jan – 31 Mar 2026 | Bulk import of daily totals (presumed Excel-derived) |
| `import_dali_root` | 3 | 21, 27 Mar 2026 (+1) | Bulk import, same family |
| `lasersoft` (gp_status=ACTUAL) | 30 | 1 – 30 Apr 2026 | Lasersoft POS export, but WITH real GP + expenses (this is your good month) |
| `import_dali_may` | 27 | 1 – 31 May 2026 | Bulk import of daily totals |
| `import_dali_fix` | 2 | 4, 25 May 2026 | Bulk import correction |
| `dali_report` | 2 | 12 – 13 May 2026 | Has real GP + expenses too |
| `import_dali_june` | 9 | 1 – 10 Jun 2026 | Bulk import of daily totals |
| `manual_partial` | 1 | 9 Jun 2026 | Manually entered, partial |

**Bottom line on (a):** revenue *figures* exist for all 172 days (good — your
all-time revenue total is not missing data). But **30 days (21 Dec 2025 – 30
Jan 2026, LKR 17,249,211 total)** came from the Lasersoft POS, not your Excel,
and per your rule ("Lasersoft can't be trusted for the first 2-4 months") —
**this 17.25M is the portion that most needs checking against your Excel.**
The other 142 days are tagged as OCR/bulk-import which I'm treating as
Excel-derived already (no separate raw Excel table exists to double-check
them against, so they stand as currently entered).

---

## (b) Expense papers/photos: how many of 172 days actually have one?

**You were right to suspect this. Only 2 of 172 days have an itemized
expense-paper record in the database:**

| Date | # line items | Itemized total | Notes |
|---|---|---|---|
| 2026-02-20 | 11 | LKR 123,392 | Real itemized list (rent, renovation, tissue, salary...) |
| 2026-05-13 | 14 + 4 "total" rows | ~LKR 99,190 (items) | Real itemized list, but ALSO has 4 stray rows ("total"/"total cash"/"total card"/"total online" = 854,590/557,260/433,940/297,330) that look like the day's SALES totals accidentally filed as "expenses" |

Two more dates exist in the expense table but are almost certainly **OCR date
errors on real papers**, not real entries for those literal days (the shop
didn't exist yet):
- `2024-01-31` (5 items, LKR 41,950) — a year before opening
- `2025-01-30` (3 items, all LKR 0) — 11 months before opening

**So: 170 of 172 days have ZERO itemized expense-paper backup in the
database.** Separately, `daily_summary.total_expenses` (an aggregate number,
not itemized) is >0 for **55 of 172 days** (2 Jan – 9 Jun 2026) — these
totals arrived bundled with the daily import/OCR, not from a separately
ingested paper.

Of those 55 days, only **32 also have a real GP figure** (`gp_status='ACTUAL'`
AND `total_expenses>0`) — these 32 are the only days where both halves
(revenue minus cost) are real, which is the TIER 1 FULL set.

⚠️ **One inconsistency found while checking this**: for 2026-05-13,
`daily_summary.total_expenses = 53,820.00`, which exactly equals just the
**"shop rent"** line from that day's 14-item paper — not the full itemized sum
(~99,190). Either the rest of that day's expenses were never added to the
day's total, or the rent figure overwrote the total by mistake. Flagging this
for your review — I have not changed it, since I can't tell which number is
"more correct" without seeing the original paper again.

---

## (c) How was the LKR 144.5M total revenue computed?

`total_sale` = LKR **144,493,969.97**, exactly `SUM(daily_summary.total_sale)`
across all 172 days (21 Dec 2025 – 10 Jun 2026). No filtering, no exclusions —
every day's number counts toward this total, which matches your instruction
that **Excel-equivalent revenue from ALL days is the truth for the all-time
total**.

Composition (same table as part a):
- **17,249,211.00** (11.9%) — 30 days, sourced from **Lasersoft POS**, not
  Excel → **needs re-verification against your Excel** per your rule.
- **127,244,758.97** (88.1%) — 142 days, sourced from OCR'd photos or bulk
  "dali" imports, which I'm treating as Excel-derived.

If, after you check your Excel for 21 Dec 2025 – 30 Jan 2026, the real total
for that period differs from 17,249,211, the all-time total (144.5M) will move
by the difference — nothing else in the 144.5M figure should need to change.

---

## What this means for tiers (see RECONCILIATION_RULES.md for full detail)

- **TIER 1 FULL (32 days)**: April 2026 (all 30 days) + 12–13 May 2026 — only
  these have real GP AND real itemized-or-aggregate expenses together →
  Net Profit is trustworthy here.
- **TIER 2/3 (140 days)**: revenue is usable (per part c), but profit fields
  must show "— (no GP data)", never 0.
