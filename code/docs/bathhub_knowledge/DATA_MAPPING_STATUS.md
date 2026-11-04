# DATA_MAPPING_STATUS.md

Generated 15 June 2026 as part of the Phase 2 pivot. Cross-references every date
from 1 December 2025 to today (15 June 2026) against the `daily_summary` table
in the `bathco` database, using the same tier formula as the dashboard
(see RECONCILIATION_RULES.md section 8 and server.js TIER_EXPR):

- **COMPLETE** = Tier FULL (real Lasersoft GP + real expense breakdown -> Net Profit trustworthy)
- **PARTIAL** = Tier CASHFLOW (revenue + cash-split known, GP/expenses missing) or Tier FOUNDATION (only total_sale known)
- **MISSING** = no `daily_summary` row at all for that date

## Summary

| Status | Days |
|---|---|
| COMPLETE | 35 |
| PARTIAL | 142 |
| MISSING | 20 |
| **Total** | 197 |

1-20 Dec 2025 (20 days) are MISSING with no source files located anywhere
under C:/BATHCO_PHASE1/DALI or C:/Royal Bath Hub/AI-Data/uploads - this predates
the tracked business range (21 Dec 2025 onward, see SOURCE_INVENTORY.md).

Update (15 Jun 2026, Desktop/1122 source review): 2026-06-11..06-15 promoted
MISSING -> PARTIAL (Tier CASHFLOW) using DAY SALE/*.xlsx transaction
breakdowns. 2026-05-14, 05-15, 05-19 promoted PARTIAL -> COMPLETE (Tier FULL)
using Lasersoft "ITEM PROFITABILITY BY GROUP REPORT" PDFs + handwritten
petty-cash sheets found in Desktop/1122/URGENT/. See report below for details.

## Day-by-day

| Date | Status | Notes |
|---|---|---|
| 2025-12-01 | MISSING | No daily_summary row; no source file found in DALI or AI-Data/uploads for this date (pre-tracking period). |
| 2025-12-02 | MISSING | No daily_summary row; no source file found in DALI or AI-Data/uploads for this date (pre-tracking period). |
| 2025-12-03 | MISSING | No daily_summary row; no source file found in DALI or AI-Data/uploads for this date (pre-tracking period). |
| 2025-12-04 | MISSING | No daily_summary row; no source file found in DALI or AI-Data/uploads for this date (pre-tracking period). |
| 2025-12-05 | MISSING | No daily_summary row; no source file found in DALI or AI-Data/uploads for this date (pre-tracking period). |
| 2025-12-06 | MISSING | No daily_summary row; no source file found in DALI or AI-Data/uploads for this date (pre-tracking period). |
| 2025-12-07 | MISSING | No daily_summary row; no source file found in DALI or AI-Data/uploads for this date (pre-tracking period). |
| 2025-12-08 | MISSING | No daily_summary row; no source file found in DALI or AI-Data/uploads for this date (pre-tracking period). |
| 2025-12-09 | MISSING | No daily_summary row; no source file found in DALI or AI-Data/uploads for this date (pre-tracking period). |
| 2025-12-10 | MISSING | No daily_summary row; no source file found in DALI or AI-Data/uploads for this date (pre-tracking period). |
| 2025-12-11 | MISSING | No daily_summary row; no source file found in DALI or AI-Data/uploads for this date (pre-tracking period). |
| 2025-12-12 | MISSING | No daily_summary row; no source file found in DALI or AI-Data/uploads for this date (pre-tracking period). |
| 2025-12-13 | MISSING | No daily_summary row; no source file found in DALI or AI-Data/uploads for this date (pre-tracking period). |
| 2025-12-14 | MISSING | No daily_summary row; no source file found in DALI or AI-Data/uploads for this date (pre-tracking period). |
| 2025-12-15 | MISSING | No daily_summary row; no source file found in DALI or AI-Data/uploads for this date (pre-tracking period). |
| 2025-12-16 | MISSING | No daily_summary row; no source file found in DALI or AI-Data/uploads for this date (pre-tracking period). |
| 2025-12-17 | MISSING | No daily_summary row; no source file found in DALI or AI-Data/uploads for this date (pre-tracking period). |
| 2025-12-18 | MISSING | No daily_summary row; no source file found in DALI or AI-Data/uploads for this date (pre-tracking period). |
| 2025-12-19 | MISSING | No daily_summary row; no source file found in DALI or AI-Data/uploads for this date (pre-tracking period). |
| 2025-12-20 | MISSING | No daily_summary row; no source file found in DALI or AI-Data/uploads for this date (pre-tracking period). |
| 2025-12-21 | PARTIAL | Tier FOUNDATION - only total_sale known (317,772), no cash-split or GP data. source=lasersoft |
| 2025-12-22 | PARTIAL | Tier FOUNDATION - only total_sale known (17,294), no cash-split or GP data. source=lasersoft |
| 2025-12-23 | PARTIAL | Tier FOUNDATION - only total_sale known (601,980), no cash-split or GP data. source=lasersoft |
| 2025-12-24 | PARTIAL | Tier FOUNDATION - only total_sale known (109,800), no cash-split or GP data. source=lasersoft |
| 2025-12-25 | PARTIAL | Tier FOUNDATION - only total_sale known (491,260), no cash-split or GP data. source=lasersoft |
| 2025-12-26 | PARTIAL | Tier FOUNDATION - only total_sale known (717,180), no cash-split or GP data. source=lasersoft |
| 2025-12-27 | PARTIAL | Tier FOUNDATION - only total_sale known (158,080), no cash-split or GP data. source=ocr |
| 2025-12-28 | PARTIAL | Tier FOUNDATION - only total_sale known (2,762,266), no cash-split or GP data. source=lasersoft |
| 2025-12-29 | PARTIAL | Tier FOUNDATION - only total_sale known (317,570), no cash-split or GP data. source=lasersoft |
| 2025-12-30 | PARTIAL | Tier FOUNDATION - only total_sale known (853,910), no cash-split or GP data. source=lasersoft |
| 2025-12-31 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 2,016,900), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=ocr |
| 2026-01-01 | PARTIAL | Tier FOUNDATION - only total_sale known (425,010), no cash-split or GP data. source=lasersoft |
| 2026-01-02 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 810,200), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=ocr |
| 2026-01-03 | PARTIAL | Tier FOUNDATION - only total_sale known (0), no cash-split or GP data. source=ocr |
| 2026-01-04 | PARTIAL | Tier FOUNDATION - only total_sale known (661,275), no cash-split or GP data. source=lasersoft |
| 2026-01-05 | PARTIAL | Tier FOUNDATION - only total_sale known (414,690), no cash-split or GP data. source=lasersoft |
| 2026-01-06 | PARTIAL | Tier FOUNDATION - only total_sale known (1,728,900), no cash-split or GP data. source=lasersoft |
| 2026-01-07 | PARTIAL | Tier FOUNDATION - only total_sale known (476,740), no cash-split or GP data. source=lasersoft |
| 2026-01-08 | PARTIAL | Tier FOUNDATION - only total_sale known (1,254,650), no cash-split or GP data. source=lasersoft |
| 2026-01-09 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 2,300), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=ocr |
| 2026-01-10 | PARTIAL | Tier FOUNDATION - only total_sale known (210,040), no cash-split or GP data. source=lasersoft |
| 2026-01-11 | PARTIAL | Tier FOUNDATION - only total_sale known (172,150), no cash-split or GP data. source=lasersoft |
| 2026-01-12 | PARTIAL | Tier FOUNDATION - only total_sale known (246,813), no cash-split or GP data. source=lasersoft |
| 2026-01-13 | PARTIAL | Tier FOUNDATION - only total_sale known (213,200), no cash-split or GP data. source=ocr |
| 2026-01-14 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 227,000), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=ocr |
| 2026-01-15 | PARTIAL | Tier FOUNDATION - only total_sale known (796,320), no cash-split or GP data. source=lasersoft |
| 2026-01-16 | PARTIAL | Tier FOUNDATION - only total_sale known (427,435), no cash-split or GP data. source=lasersoft |
| 2026-01-17 | PARTIAL | Tier FOUNDATION - only total_sale known (346,001), no cash-split or GP data. source=lasersoft |
| 2026-01-18 | PARTIAL | Tier FOUNDATION - only total_sale known (665,925), no cash-split or GP data. source=lasersoft |
| 2026-01-19 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 190,000), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=ocr |
| 2026-01-20 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 415,000), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=ocr |
| 2026-01-21 | PARTIAL | Tier FOUNDATION - only total_sale known (549,000), no cash-split or GP data. source=lasersoft |
| 2026-01-22 | PARTIAL | Tier FOUNDATION - only total_sale known (110,700), no cash-split or GP data. source=lasersoft |
| 2026-01-23 | PARTIAL | Tier FOUNDATION - only total_sale known (243,525), no cash-split or GP data. source=lasersoft |
| 2026-01-24 | PARTIAL | Tier FOUNDATION - only total_sale known (481,800), no cash-split or GP data. source=lasersoft |
| 2026-01-25 | PARTIAL | Tier FOUNDATION - only total_sale known (600,770), no cash-split or GP data. source=lasersoft |
| 2026-01-26 | PARTIAL | Tier FOUNDATION - only total_sale known (537,720), no cash-split or GP data. source=lasersoft |
| 2026-01-27 | PARTIAL | Tier FOUNDATION - only total_sale known (0), no cash-split or GP data. source=ocr |
| 2026-01-28 | PARTIAL | Tier FOUNDATION - only total_sale known (408,365), no cash-split or GP data. source=lasersoft |
| 2026-01-29 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 243,250), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=ocr |
| 2026-01-30 | PARTIAL | Tier FOUNDATION - only total_sale known (302,350), no cash-split or GP data. source=lasersoft |
| 2026-01-31 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 333,160), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_master |
| 2026-02-01 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 448,280), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_master |
| 2026-02-02 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 1,933,170), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_master |
| 2026-02-03 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 92,360), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_master |
| 2026-02-04 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 27,500), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=ocr |
| 2026-02-05 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 312,850), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_master |
| 2026-02-06 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 526,400), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=ocr |
| 2026-02-07 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 1,177,823), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_master |
| 2026-02-08 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 751,675), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_master |
| 2026-02-09 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 151,160), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_master |
| 2026-02-10 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 428,965), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_master |
| 2026-02-11 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 344,975), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_master |
| 2026-02-12 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 46,890), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_master |
| 2026-02-13 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 209,370), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_master |
| 2026-02-14 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 1,185,426), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_master |
| 2026-02-15 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 288,090), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=ocr |
| 2026-02-16 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 746,505), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_master |
| 2026-02-17 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 1,599,990), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_master |
| 2026-02-18 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 136,520), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_master |
| 2026-02-19 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 187,540), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_master |
| 2026-02-20 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 27,850), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=ocr |
| 2026-02-21 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 810,200), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=ocr |
| 2026-02-22 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 674,290), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=ocr |
| 2026-02-23 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 1,302,000), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=ocr |
| 2026-02-24 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 1,268,590), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=ocr |
| 2026-02-25 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 44,400), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=ocr |
| 2026-02-26 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 426,130), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=ocr |
| 2026-02-27 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 139,500), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=ocr |
| 2026-02-28 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 368,240), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_master |
| 2026-03-01 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 762,960), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=ocr |
| 2026-03-02 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 495,000), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=ocr |
| 2026-03-03 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 282,850), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=ocr |
| 2026-03-04 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 261,440), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=ocr |
| 2026-03-05 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 1,018,496), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_master |
| 2026-03-06 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 527,500), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_master |
| 2026-03-07 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 719,800), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=ocr |
| 2026-03-08 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 373,950), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_master |
| 2026-03-09 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 81,400), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=ocr |
| 2026-03-10 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 288,350), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=ocr |
| 2026-03-11 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 1,331,825), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_master |
| 2026-03-12 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 321,900), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_master |
| 2026-03-13 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 1,549,000), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=ocr |
| 2026-03-14 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 478,860), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_master |
| 2026-03-15 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 318,230), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_master |
| 2026-03-16 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 845,775), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_master |
| 2026-03-17 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 489,850), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=ocr |
| 2026-03-18 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 1,549,000), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=ocr |
| 2026-03-19 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 992,910), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=ocr |
| 2026-03-20 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 192,770), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_master |
| 2026-03-21 | PARTIAL | Tier FOUNDATION - only total_sale known (0), no cash-split or GP data. source=import_dali_root |
| 2026-03-22 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 1,744,565), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_master |
| 2026-03-23 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 1,223,270), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_master |
| 2026-03-24 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 685,750), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_master |
| 2026-03-25 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 4,612,925), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_master |
| 2026-03-26 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 1,425,870), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_root |
| 2026-03-27 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 14,400), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_root |
| 2026-03-28 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 262,500), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=ocr |
| 2026-03-29 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 1,834,980), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_master |
| 2026-03-30 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 1,345,575), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_master |
| 2026-03-31 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 2,326,505), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_master |
| 2026-04-01 | COMPLETE | Tier FULL - Lasersoft GP (369,888.03) + expenses (109,973.34) both present, Net Profit reliable. source=lasersoft |
| 2026-04-02 | COMPLETE | Tier FULL - Lasersoft GP (336,407.43) + expenses (68,843.34) both present, Net Profit reliable. source=lasersoft |
| 2026-04-03 | COMPLETE | Tier FULL - Lasersoft GP (470,754.11) + expenses (88,163.34) both present, Net Profit reliable. source=lasersoft |
| 2026-04-04 | COMPLETE | Tier FULL - Lasersoft GP (529,837.54) + expenses (85,100) both present, Net Profit reliable. source=lasersoft |
| 2026-04-05 | COMPLETE | Tier FULL - Lasersoft GP (750,961.2) + expenses (91,983.34) both present, Net Profit reliable. source=lasersoft |
| 2026-04-06 | COMPLETE | Tier FULL - Lasersoft GP (211,187.47) + expenses (69,743.34) both present, Net Profit reliable. source=lasersoft |
| 2026-04-07 | COMPLETE | Tier FULL - Lasersoft GP (245,569.52) + expenses (50,583.34) both present, Net Profit reliable. source=lasersoft |
| 2026-04-08 | COMPLETE | Tier FULL - Lasersoft GP (313,049.11) + expenses (52,253.34) both present, Net Profit reliable. source=lasersoft |
| 2026-04-09 | COMPLETE | Tier FULL - Lasersoft GP (263,233.08) + expenses (88,913.34) both present, Net Profit reliable. source=lasersoft |
| 2026-04-10 | COMPLETE | Tier FULL - Lasersoft GP (198,525.55) + expenses (91,923.34) both present, Net Profit reliable. source=lasersoft |
| 2026-04-11 | COMPLETE | Tier FULL - Lasersoft GP (498,571.6) + expenses (95,083.34) both present, Net Profit reliable. source=lasersoft |
| 2026-04-12 | COMPLETE | Tier FULL - Lasersoft GP (340,370.05) + expenses (94,108.34) both present, Net Profit reliable. source=lasersoft |
| 2026-04-13 | COMPLETE | Tier FULL - Lasersoft GP (259,870.59) + expenses (87,083.34) both present, Net Profit reliable. source=lasersoft |
| 2026-04-14 | COMPLETE | Tier FULL - Lasersoft GP (0) + expenses (25,083.34) both present, Net Profit reliable. source=lasersoft |
| 2026-04-15 | COMPLETE | Tier FULL - Lasersoft GP (45,432.2) + expenses (63,023.34) both present, Net Profit reliable. source=lasersoft |
| 2026-04-16 | COMPLETE | Tier FULL - Lasersoft GP (208,268.73) + expenses (40,333.34) both present, Net Profit reliable. source=lasersoft |
| 2026-04-17 | COMPLETE | Tier FULL - Lasersoft GP (186,430.83) + expenses (38,833.34) both present, Net Profit reliable. source=lasersoft |
| 2026-04-18 | COMPLETE | Tier FULL - Lasersoft GP (411,044.11) + expenses (88,438.34) both present, Net Profit reliable. source=lasersoft |
| 2026-04-19 | COMPLETE | Tier FULL - Lasersoft GP (463,168.43) + expenses (164,853.34) both present, Net Profit reliable. source=lasersoft |
| 2026-04-20 | COMPLETE | Tier FULL - Lasersoft GP (234,244.48) + expenses (94,163.34) both present, Net Profit reliable. source=lasersoft |
| 2026-04-21 | COMPLETE | Tier FULL - Lasersoft GP (182,516.7) + expenses (109,343.36) both present, Net Profit reliable. source=lasersoft |
| 2026-04-22 | COMPLETE | Tier FULL - Lasersoft GP (521,289.74) + expenses (59,403.34) both present, Net Profit reliable. source=lasersoft |
| 2026-04-23 | COMPLETE | Tier FULL - Lasersoft GP (134,358.47) + expenses (97,943.34) both present, Net Profit reliable. source=lasersoft |
| 2026-04-24 | COMPLETE | Tier FULL - Lasersoft GP (189,930.16) + expenses (67,843.34) both present, Net Profit reliable. source=lasersoft |
| 2026-04-25 | COMPLETE | Tier FULL - Lasersoft GP (274,961.64) + expenses (59,393.34) both present, Net Profit reliable. source=lasersoft |
| 2026-04-26 | COMPLETE | Tier FULL - Lasersoft GP (200,152.05) + expenses (104,003.34) both present, Net Profit reliable. source=lasersoft |
| 2026-04-27 | COMPLETE | Tier FULL - Lasersoft GP (130,170.53) + expenses (53,413.34) both present, Net Profit reliable. source=lasersoft |
| 2026-04-28 | COMPLETE | Tier FULL - Lasersoft GP (108,876.65) + expenses (53,203.34) both present, Net Profit reliable. source=lasersoft |
| 2026-04-29 | COMPLETE | Tier FULL - Lasersoft GP (126,969.41) + expenses (79,733.34) both present, Net Profit reliable. source=lasersoft |
| 2026-04-30 | COMPLETE | Tier FULL - Lasersoft GP (195,445.82) + expenses (63,193.34) both present, Net Profit reliable. source=lasersoft |
| 2026-05-01 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 945,220), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_may |
| 2026-05-02 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 1,238,290), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_may |
| 2026-05-03 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 1,430,360), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_may |
| 2026-05-04 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 734,720), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_fix |
| 2026-05-05 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 695,890), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_may |
| 2026-05-06 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 1,176,486), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_may |
| 2026-05-07 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 938,775), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_may |
| 2026-05-08 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 1,666,425), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_may |
| 2026-05-09 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 419,230), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_may |
| 2026-05-10 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 1,110,150), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_may |
| 2026-05-11 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 796,280), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_may |
| 2026-05-12 | COMPLETE | Tier FULL - Lasersoft GP (89,473.36) + expenses (76,940) both present, Net Profit reliable. source=dali_report |
| 2026-05-13 | COMPLETE | Tier FULL - Lasersoft GP (239,154.85) + expenses (53,820) both present, Net Profit reliable. source=dali_report |
| 2026-05-14 | COMPLETE | Tier FULL - Lasersoft GP (19,503.58, from FCVF.pdf ITEM PROFITABILITY BY GROUP REPORT, SALES matches total_sale exactly) + expenses (36,720) + payments (-500 loan return) both present, Net Profit -17,216.42 (loss day). credit_sale corrected to -10,680 (resolves prior breakdown_mismatch). cash_in_hand recomputed=-18,740 (matches handwritten ledger exactly, funded from savings; now flagged cash_short). source=import_dali_may+urgent_14-05_docs |
| 2026-05-15 | COMPLETE | Tier FULL - Lasersoft GP (351,771.46, from DD.pdf ITEM PROFITABILITY BY GROUP REPORT) + expenses (53,790) + payments (750,080) both present, Net Profit reliable (297,981.46). cash_in_hand recomputed=427,750 (matches handwritten ledger exactly). source=import_dali_may+urgent_15-05_docs |
| 2026-05-16 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 974,780), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_may |
| 2026-05-17 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 3,277,210), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_may |
| 2026-05-18 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 1,186,210), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_may |
| 2026-05-19 | COMPLETE | Tier FULL - Lasersoft GP (36,442.12, from AA.pdf ITEM PROFITABILITY BY GROUP REPORT, SALES matches total_sale exactly) + expenses (50,400) + payments (-500 loan return) both present, Net Profit -13,957.88 (loss day). cash_in_hand recomputed=190,600 (matches handwritten ledger exactly). source=import_dali_may+urgent_19-05_docs |
| 2026-05-20 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 275,675), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_may |
| 2026-05-21 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 300,475), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_may |
| 2026-05-22 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 286,310), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_may |
| 2026-05-23 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 1,545,695), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_may |
| 2026-05-24 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 1,578,320), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_may |
| 2026-05-25 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 1,325,515), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_fix |
| 2026-05-26 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 2,008,600), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_may |
| 2026-05-27 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 626,200), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_may |
| 2026-05-28 | PARTIAL | Tier FOUNDATION - only total_sale known (0), no cash-split or GP data. source=import_dali_may |
| 2026-05-29 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 712,135), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_may |
| 2026-05-30 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 219,450), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_may |
| 2026-05-31 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 709,560), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_may |
| 2026-06-01 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 1,874,445), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_june |
| 2026-06-02 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 503,400), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_june |
| 2026-06-03 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 367,995), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_june |
| 2026-06-04 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 1,053,855), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_june |
| 2026-06-05 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 251,560), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_june |
| 2026-06-06 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 890,325), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_june |
| 2026-06-07 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 1,671,030), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_june |
| 2026-06-08 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 2,347,170), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_june |
| 2026-06-09 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 352,300), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=manual_partial |
| 2026-06-10 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 190,540), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_june |
| 2026-06-11 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 944,950) imported from Desktop/1122/DAY SALE/11-06-2026.xlsx, Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_june |
| 2026-06-12 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 577,100) imported from Desktop/1122/DAY SALE/12-06-2026.xlsx, Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_june |
| 2026-06-13 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 156,300) imported from Desktop/1122/DAY SALE/13-06-2026.xlsx, credit_sale set to -9,600 (CRM0016, unallocated in source - allocated per CRM convention to resolve breakdown), Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_june |
| 2026-06-14 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 1,858,400) imported from Desktop/1122/DAY SALE/14-06-2026.xlsx, Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_june |
| 2026-06-15 | PARTIAL | Tier CASHFLOW - revenue/cash-split present (sale 95,830) imported from Desktop/1122/DAY SALE/15-06-2026.xlsx, Lasersoft GP/expenses not yet entered (gp_status=NOT_AVAILABLE). source=import_dali_june |
