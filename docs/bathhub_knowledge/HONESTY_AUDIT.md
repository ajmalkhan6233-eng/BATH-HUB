# HONESTY AUDIT — BATH HUB COMMAND Dashboard

Performed 12 Jun 2026, autonomous session. Every number on every dashboard page
traced to its source. Anything that was fabricated, placeholder, or
miscalculated is marked **FIXED** with what changed. Anything that was already
a real, traceable figure is marked **HONEST** — no change made.

Rule applied throughout: a number with no real source must show **PENDING** or
**"—"** with an explanation, never 0 or a computed-looking figure. An
aggregate built from incomplete data must say **PARTIAL — x of y days have
data**.

-----

## PAGE: HOME

| # | Number | Source | Status |
|---|---|---|---|
| 1 | Latest Day — Total Sale / Cash / Card / Online | `daily_summary` row for most recent `report_date <= CURRENT_DATE` (`/api/daily-summary?latest=1`) | HONEST — real Excel-sourced figures |
| 2 | Latest Day — Net Profit | Was `net_profit` column directly (0 for 10 Jun, because `gp_status='NOT_AVAILABLE'` → `gross_profit=0`, even though the day had real LKR 190,540 in sales) | **FIXED** — if `gp_status='NOT_AVAILABLE'`, shows **PENDING** with tooltip "Gross profit not available for this day — net profit cannot be calculated yet" |
| 3 | Latest Day — Expenses | Was `total_expenses` column (0 for 10 Jun — no expense report received that day, not a real zero-expense day) | **FIXED** — if `gp_status='NOT_AVAILABLE'` and `total_expenses=0`, shows **PENDING** with tooltip "Expenses not yet recorded for this day" |
| 4 | Latest Day — Cash In Hand / Payments Out | Real columns from same row | HONEST |
| 5 | All-Time Summary — Total Revenue, Avg Daily Sale, Total Expenses, Best Day Ever, Credit Outstanding | Real `SUM`/`AVG`/`MAX` over `daily_summary` (21 Dec 2025 – 9 Jun 2026, 171 days) and `credit_customers` | HONEST |
| 6 | All-Time Summary — Avg GP% `(62/171 days)` | Already fixed in Task #7 (prior session) — averages only `gp_status IN ('ACTUAL','ESTIMATE')` days | HONEST — already correct |
| 7 | All-Time Summary — **Total Net Profit** | Was `SUM(net_profit)` over **all 171 days**. 109 days have `gp_status='NOT_AVAILABLE'` (`gross_profit=0`) but some still have real recorded expenses (e.g. 9 Jun: exp=53,150, np=-53,150). Those days' negative net profit dragged the all-time total down by **LKR 1,473,071** (showed 9,341,958 instead of the true GP-known total of 10,815,029) | **FIXED** — now sums `gross_profit-total_expenses` only over `gp_status IN ('ACTUAL','ESTIMATE')` days (62/171). New label under "Total Net Profit": `(62/171 days)` or `PARTIAL — x/y days have GP data` |
| 8 | All-Time Summary — Avg NP% | Was `total_net_profit(all days) / total_sale(all days)` — same NOT_AVAILABLE-drag problem | **FIXED** — now `gp_net_profit / gp_sale` (consistent with GP-known days only, same denominator as Avg GP%) |
| 9 | Recent Days table (last 10) | Real `daily_summary` rows, `checker_flags` JSON | HONEST |

-----

## PAGE: DAILY (Calendar)

| # | Number | Source | Status |
|---|---|---|---|
| 10 | Calendar cells — sale amount, EST/INCOMPLETE badges | Real `daily_summary` + `day_status` (Task #6, prior session) | HONEST — already correct |
| 11 | Day Detail — Total Sale/Cash/Card/Cash In Hand | Real columns for selected date | HONEST |
| 12 | Day Detail — Gross Profit (ESTIMATE / NOT AVAILABLE badges) | `gp_status` column (Task #7, prior session) | HONEST — already correct |

-----

## PAGE: WEEKLY

| # | Number | Source | Status |
|---|---|---|---|
| 13 | Total Sales / Total Expenses / Cash In Hand | Real `SUM()` over the 7 days from `daily_summary` | HONEST |
| 14 | **Net Profit** | Was `SUM(gross_profit-total_expenses)` over all 7 days. For weeks where every day is `gp_status='NOT_AVAILABLE'` (e.g. week of 8 Jun), this showed **-53,150** — a fabricated "loss" for a week with LKR 2.89M in sales, purely because expenses were recorded but GP wasn't | **FIXED** — `/api/weekly-detail` now returns `gp_days`/`total_days`. If `gp_days=0` → **PENDING** "(no GP data this week)". If `0 < gp_days < total_days` → value shown with **PARTIAL — x/y days have GP data** label |
| 15 | Staff Salary (KPI) | Was `SUM(amount+commission)` from `staff_salary` for the week — a one-time 12–13 May distribution, not real ongoing payroll (PENDING_FROM_AJMAL #1) | **FIXED** — shows **PENDING wage list** badge |
| 16 | Supplier Payments | Real `SUM(amount)` from `supplier_payments` | HONEST |
| 17 | Staff Performance table | Static text "Staff data pending OCR" — was already an honest placeholder, not a fake number | HONEST — no change |
| 18 | Top Payments table | Real `payments_detail`/`supplier_payments` rows | HONEST |

-----

## PAGE: MONTHLY

| # | Number | Source | Status |
|---|---|---|---|
| 19 | Total Sales / Total Expenses / Total Payments / Cash In Hand | Real `SUM()` over the month | HONEST |
| 20 | Total Salary Paid (KPI) | Same `staff_salary` distribution figure as weekly | **FIXED** — **PENDING wage list** badge |
| 21 | Supplier Payments | Real `SUM(amount)` | HONEST |
| 22 | **Net Profit** | Same all-days-summed problem as weekly. June 2026 (10 days, all `NOT_AVAILABLE`, one day with exp=53,150) showed **-53,150** for a month with LKR 9.5M in sales | **FIXED** — same `gp_days`/`total_days` logic. June 2026 now shows **PENDING — no GP data this month** |
| 23 | Daily Breakdown — Expenses column | Was `total_expenses` (0 shown for NOT_AVAILABLE days with no expense record) | **FIXED** — shows **PENDING** (with tooltip) when `gp_status='NOT_AVAILABLE'` and `total_expenses=0` |
| 24 | Daily Breakdown — Net Profit column | Was `net_profit` (0 or negative for NOT_AVAILABLE days) | **FIXED** — shows **"—"** with tooltip when `gp_status='NOT_AVAILABLE'` |

-----

## PAGE: STAFF

| # | Number | Source | Status |
|---|---|---|---|
| 25 | **Total Salary / Commission columns (table) and KPIs (detail panel)** | Was `SUM(staff_salary.amount)` / `SUM(staff_salary.commission)` via `LEFT JOIN staff_salary ... LEFT JOIN staff_loans` in one query. **Root cause of the user-reported "Ali 16,492" figure**: Ali (staff_id 6) is the only staff member with `staff_loans` rows (4 of them). Joining both tables in one query created a 2×4=8-row cross product for Ali, so `SUM(sl.amount)` was counted **4x** (real total 4,123.07 → displayed 16,492.28). Gimhani (no loans) was unaffected, which is why her figure (3,298.46→"3,298") looked normal | **FIXED in two parts**: (1) **SQL bug fixed** — `/api/staff` now uses scalar subqueries instead of dual `LEFT JOIN`, so totals are correct for everyone. (2) **Regardless of the corrected number**, the underlying `staff_salary` data is a one-time 12–13 May 2026 distribution of an accountant-report lump sum across staff, proportional to **placeholder `base_salary` values** (1000–5000 LKR) — not a confirmed wage list (PENDING_FROM_AJMAL #1, OPEN). So the Staff page now shows **PENDING wage list** badge for these columns/KPIs instead of any number, correct or not |
| 26 | **Loans Out / Outstanding columns** | Same Cartesian-product bug — Ali's `total_loans` showed **3,200** (real **1,600**) and `outstanding` showed **1,200** (real **600**); other staff (0 loan rows) were unaffected | **FIXED** — corrected by the same SQL rewrite (#25). Now shows real values |
| 27 | Salary History table (detail panel) | Real `staff_salary` rows | HONEST, but **annotated** — added a disclaimer row: "these rows are a one-time estimated distribution from the 12–13 May 2026 accountant report, proportional to placeholder base salaries — not a confirmed wage list. PENDING_FROM_AJMAL #1" |
| 28 | Loans & Advances table | Real `staff_loans` rows (now correctly aggregated) | HONEST |
| 29 | Status badge (Active/Inactive) | Real `staff.active` | HONEST |

-----

## PAGE: MY COMMISSION (staff-facing)

| # | Number | Source | Status |
|---|---|---|---|
| 30 | Total Salary / Commission / Total+Comm KPIs | Same `staff_salary` distribution data as Staff page | **FIXED** — **PENDING wage list** badge + disclaimer row on history table |
| 31 | Salary History / Loans tables | Real rows | HONEST |

-----

## PAGE: SUPPLIERS

| # | Number | Source | Status |
|---|---|---|---|
| 32 | Total Paid, Last Payment, Pending Cheques | Real `SUM`/`MAX` from `supplier_payments`/`cheques` | HONEST |
| 33 | Supplier Detail transaction rows | Real `supplier_payments` rows | HONEST |

-----

## PAGE: CREDIT CUSTOMERS

| # | Number | Source | Status |
|---|---|---|---|
| 34 | Aging buckets (0–30 / 31–60 / 61–90 / 90+) | Computed client-side from real `credit_customers` (`amount - paid`, age from `invoice_date`) | HONEST |
| 35 | Credit table rows | Real `credit_customers` joined to `customers` | HONEST. Note: total (LKR 542,300) vs Ajmal's figure (385,380) remains **UNRECONCILED** — already tracked in PENDING_FROM_AJMAL #5, not a display bug |

-----

## PAGE: AGENTS

| # | Number | Source | Status |
|---|---|---|---|
| 36 | Active Alerts list, count | Real `/api/alerts` | HONEST |
| 37 | VERA Flags list | Real `checker_flags` from last 30 `daily_summary` rows | HONEST |
| 38 | CHECKER "Flags: N" | Real count of flags found in #37 | HONEST |
| 39 | **CHECKER "Last run: ..."** | Was `new Date().toLocaleString()` — the **page-load time**, displayed as if it were the agent's last execution time. No run-log exists | **FIXED** — now shows "Last run: not tracked" (honest — no fabricated timestamp) |
| 40 | NOVA / QUINN / LAYLA meta ("Last summary: —", "Last GP analysis: —", "Last message sent: —") | Static "—" placeholders, never populated — these agents aren't wired to write status yet | HONEST — already showing "—", nothing to fix |
| 41 | Drop Folder ledger table | Real `/api/file-ledger` rows | HONEST |

-----

## SUMMARY

- **8 false/misleading numbers fixed**: Latest Day Net Profit & Expenses (#2,3),
  All-Time Total Net Profit & Avg NP% (#7,8), Weekly/Monthly Net Profit
  (#14,22), Monthly daily-breakdown Expenses & Net Profit columns (#23,24),
  Staff/My Commission salary & commission figures (#25,30), Staff loans/
  outstanding SQL bug (#26), CHECKER fake "Last run" timestamp (#39).
- **1 real SQL bug found and fixed**: `/api/staff` Cartesian-product join
  (caused the "Ali 16,492" figure — real value is 4,123.07, root cause was a
  4x multiplication from joining `staff_loans` (4 rows) × `staff_salary`
  (2 rows) in one query).
- Everything else traced cleanly to real data — 33 of 41 numbers were already
  HONEST with no change needed.
- Nothing was deleted. `staff_salary`/`staff_loans` rows stay in the database
  (real accountant-report-derived data) — they're just no longer presented as
  a confirmed payroll total until Ajmal supplies the wage list
  (PENDING_FROM_AJMAL #1).
