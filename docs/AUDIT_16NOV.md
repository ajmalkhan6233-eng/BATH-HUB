# Audit 16 Nov (read-only, nothing changed)
Evidence from shell checks on branch claude/ledger-stock-search.

1. Home layers (likely cause of "numbers change after load"): bathco_complete.html loads dashboard_pro.js, dashboard_modern.js, dashboard_v2.js and dashboard_breakdown.js. Three of them fetch /api/dashboard-pro. 52 KB, 4 scripts, one job. Smallest change: keep dashboard_pro.js, stop loading the other three one by one, check Home after each.
2. Styling fights: 8 CSS files carry 40 to 82 !important each (pos-look 82, grn-compact 76, pos-onepage 64, compact-all 58, pos-space 55, grn-onescreen 46). Each new fix adds another override. Smallest change: merge POS ones into one file, GRN ones into one file, same rules, no look change.
3. Unused screens (nothing links to them): home-gemini.html, labels_a4.html, modern-demo.html (49 KB), pos-preview.html, sync-review.html, ux-demo.html. cheque_clearing.html and items_import.html have routes but no menu link: keep.
4. Copy-paste helper: ownerOnly is defined 15 times across route files, two versions (session role check vs isOwner). Smallest change: one shared helper, switch files one at a time with tests.
5. Static folder: public/print has 17 receipt PNGs (13 MB of 23 MB) and public/_archive holds an old xlsx.full.min.js; /lib has another copy. Smallest change: confirm unused, move out of public.
6. Timers/watchers: ui_comfort.js (5 observers), logo-pet.js (3 timers, 2 observers), perf-guard.js (2 timers). Smallest change: pause them when the tab is hidden.
7. Daily Ledger: one 276 KB HTML file (daily-entry-v2.html). Do not split now; it works.
