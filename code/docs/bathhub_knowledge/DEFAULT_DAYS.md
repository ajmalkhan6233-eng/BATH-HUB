---
title: Days still on DEFAULTED expenses (dry-run, FINAL_BUILD_2.md Task 4 item 14)
purpose: List every daily_summary row where expenses_source='DEFAULT_50000' - i.e. real expense-sheet data was never entered and the system fell back to a flat 50,000 placeholder. Ajmal sends the real sheet photo for whichever of these he can find; each gets corrected individually (see the 2026-06-30 example already dry-run'd in this session's chat).
generated: 2026-07-05
total_days: 100
EOF_note: nothing has been written to the DB - this is a list only.
---

# How to use this list

Every row below has `total_expenses = 50,000` and `expenses_source =
'DEFAULT_50000'` in `daily_summary` - meaning nobody ever entered that
day's real expense sheet, so the system used a flat placeholder instead of
the real figure. The `cash_in_hand` shown is whatever fell out of that
placeholder math (see 2026-06-30 for a worked example of how wrong this
can get: -44,000 instead of the real +249,250).

For each day you can find the sheet photo for: send it, and it gets
corrected the same way 2026-06-30 will be once you confirm that one.
Correcting these doesn't require doing them in order or all at once.

# The 100 days (chronological)

| Date | Total Sale (real, unaffected) | Cash In Hand (placeholder-derived, likely wrong) |
|---|---|---|
| 2025-12-21 | 317,772 | 0 |
| 2025-12-22 | 17,294 | 0 |
| 2025-12-23 | 601,980 | 0 |
| 2025-12-24 | 109,800 | 0 |
| 2025-12-25 | 491,260 | 0 |
| 2025-12-26 | 717,180 | 0 |
| 2025-12-27 | 158,080 | 158,080 |
| 2025-12-28 | 2,762,266 | 0 |
| 2025-12-29 | 317,570 | 0 |
| 2025-12-30 | 853,910 | 0 |
| 2025-12-31 | 2,016,900 | 5,000 |
| 2026-01-01 | 425,010 | 0 |
| 2026-01-04 | 661,275 | 0 |
| 2026-01-05 | 414,690 | 0 |
| 2026-01-06 | 1,728,900 | 0 |
| 2026-01-07 | 476,740 | 0 |
| 2026-01-08 | 1,254,650 | 0 |
| 2026-01-09 | 2,300 | 2,300 |
| 2026-01-10 | 210,040 | 0 |
| 2026-01-11 | 172,150 | 0 |
| 2026-01-12 | 246,813 | 0 |
| 2026-01-13 | 213,200 | 213,200 |
| 2026-01-14 | 227,000 | 0 |
| 2026-01-15 | 796,320 | 0 |
| 2026-01-16 | 427,435 | 0 |
| 2026-01-17 | 346,001 | 0 |
| 2026-01-18 | 665,925 | 0 |
| 2026-01-19 | 190,000 | 140,000 |
| 2026-01-20 | 415,000 | 5,754,550 (implausible - flag for review, likely a separate data error, not just the default-expense issue) |
| 2026-01-21 | 549,000 | 0 |
| 2026-01-22 | 110,700 | 0 |
| 2026-01-23 | 243,525 | 0 |
| 2026-01-24 | 481,800 | 0 |
| 2026-01-25 | 600,770 | 0 |
| 2026-01-26 | 537,720 | 0 |
| 2026-01-27 | 0 | 106,868.40 |
| 2026-01-28 | 408,365 | 0 |
| 2026-01-29 | 243,250 | 243,250 |
| 2026-01-30 | 302,350 | 0 |
| 2026-01-31 | 333,160 | 333,160 |
| 2026-02-01 | 448,280 | 399,880 |
| 2026-02-02 | 1,933,170 | 370,240 |
| 2026-02-03 | 92,360 | 66,560 |
| 2026-02-04 | 27,500 | 20,926 |
| 2026-02-05 | 312,850 | 229,650 |
| 2026-02-07 | 1,177,823 | 674,200 |
| 2026-02-08 | 751,675 | 601,245 |
| 2026-02-09 | 151,160 | 89,180 |
| 2026-02-10 | 428,965 | 349,035 |
| 2026-02-11 | 344,975 | 178,900 |
| 2026-02-12 | 46,890 | 20,440 |
| 2026-02-13 | 209,370 | 209,370 |
| 2026-02-14 | 1,185,426 | 379,680 |
| 2026-02-15 | 288,090 | 288,090 |
| 2026-02-16 | 746,505 | 692,935 |
| 2026-02-17 | 1,599,990 | 390,190 |
| 2026-02-18 | 136,520 | 56,520 |
| 2026-02-19 | 187,540 | 17,220 |
| 2026-02-28 | 368,240 | 147,940 |
| 2026-03-05 | 1,018,496 | 254,870 |
| 2026-03-06 | 527,500 | 473,750 |
| 2026-03-08 | 373,950 | 130,450 |
| 2026-03-11 | 1,331,825 | 325,410 |
| 2026-03-12 | 321,900 | 199,500 |
| 2026-03-14 | 478,860 | 227,310 |
| 2026-03-15 | 318,230 | 110,350 |
| 2026-03-16 | 845,775 | 347,825 |
| 2026-03-20 | 192,770 | 190,930 |
| 2026-03-21 | 0 | 0 (Eid holiday, shop closed per RECONCILIATION_RULES.md §8 - not missing data) |
| 2026-03-22 | 1,744,565 | 467,700 |
| 2026-03-23 | 1,223,270 | 666,790 |
| 2026-03-24 | 685,750 | 244,600 |
| 2026-03-25 | 4,612,925 | 3,332,910 |
| 2026-03-26 | 1,425,870 | 858,510 |
| 2026-03-27 | 14,400 | 14,400 |
| 2026-03-28 | 262,500 | 212,500 |
| 2026-03-29 | 1,834,980 | 1,083,360 |
| 2026-03-30 | 1,345,575 | 469,230 |
| 2026-03-31 | 2,326,505 | 1,634,430 |
| 2026-05-18 | 1,186,210 | 480,210 |
| 2026-05-20 | 275,675 | 275,675 |
| 2026-05-21 | 300,475 | 300,475 |
| 2026-05-22 | 286,310 | 169,570 |
| 2026-05-23 | 1,545,695 | 984,295 |
| 2026-05-24 | 1,578,320 | 1,169,500 |
| 2026-05-25 | 1,325,515 | 792,015 |
| 2026-05-26 | 2,008,600 | 1,523,200 |
| 2026-05-27 | 626,200 | 161,600 |
| 2026-05-28 | 0 | 0 (closed/no sales, per RECONCILIATION_RULES.md §8) |
| 2026-05-29 | 712,135 | 230,465 |
| 2026-05-30 | 219,450 | 83,500 |
| 2026-05-31 | 709,560 | 530,960 |
| 2026-06-21 | 945,360 | 569,440 |
| 2026-06-22 | 327,915 | 149,150 |
| 2026-06-23 | 1,877,235 | 1,090,050 |
| 2026-06-24 | 520,450 | 156,170 |
| 2026-06-25 | 486,300 | 382,300 |
| 2026-06-28 | 998,130.01 | -23,550 |
| 2026-06-29 | 108,300 | -39,000 |
| 2026-06-30 | 399,900 | -44,000 (already dry-run'd this session - see chat/commit history for the corrected values, awaiting your OK to write) |

# Notes

- 2025-12-21 → 2026-03-31 is the bulk of this list (85 of 100 days) - this
  matches `RECONCILIATION_RULES.md`'s own tier breakdown, where most of
  that window is already known to be TIER 2/3 (cash-flow-only or
  revenue-only), so defaulted expenses there isn't a new discovery, just a
  consolidated to-do list in one place.
- 2026-01-20's `cash_in_hand` of 5,754,550 looks implausible on its face
  (far outside the pattern of every other day) - worth a second look
  independent of the expense-default issue, since fixing just the expense
  side won't fix whatever's driving that number.
- 2026-06-21 through 2026-06-30 (the most recent 8 days on this list) are
  the ones most likely to still have a findable paper sheet - probably the
  most efficient place to start.
