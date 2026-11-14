# SPEED AUDIT (14 Nov 2026, chat). CORRECTED 10:15: item 7 was wrong (the service worker already has an 8 s timeout) and items 16-21 were wrong (no page loads those print pictures, they only sit on disk). Real findings: 21. Fixed in this pack: 8 (items 1-5 and 13-15).
## FIXED in branch claude/speed-pack (task 230)
1. /api answers had no gzip -> middleware/apiGzip.js (built-in zlib, tested 3/3).
2. Big .min.js libraries re-checked every visit -> kept 1 day (staticFast.js).
3. Slow background checkers kept running with the app hidden -> public/perf-guard.js (shell only).
4. Busy tables had no index (13 columns) -> scripts/perf_indexes.js (adds only, dry run first, --undo).
5. No way to see DB slowness -> scripts/perf_report.js (read-only).
## FOUND, NOT YET FIXED (order = biggest win first; each needs its own test)
6. START-UP ~90 s: 61 files run CREATE TABLE/ALTER at every boot. Run them once per schema version.
7. Service worker is network-first with NO timeout: a weak signal freezes screens. Add a 3 s timeout then use the saved copy.
8. Two database pools (utils/db.js in 5 files + utils/pool.js in 78 files): double connections. Use one.
9. Shell loads 35 scripts with no defer (bathco_complete.html). Defer the non-critical ones.
10. 51 separate JS files in public/. Merge the shell ones into 1-2 files.
11. chart.umd.min.js (205 KB) loads at start; load only when a chart opens.
12. 43 blank frames each get 5 injected files (known heads-up). Inject only into frames that have a page.
13. shell-fit.js runs every 1.5 s forever. Run on resize only.
14. logo-pet.js scans frames every 2.5 s forever. Run when a frame is added.
15. frame-diet.js ticks every 8 s (small). Tick every 30 s.
16-21. Receipt pictures in public/print are 0.5 to 2.2 MB each (6 files, about 9 MB). Shrink to about 15% (oxipng / webp). Also public/brand/logo-tile-1024.png 550 KB and public/print/visiting-card-back.png 540 KB: 24 pictures over 100 KB in all.
22. 155 "SELECT *" in routes: name only the needed columns on the hot screens (POS, stock, dashboard).
23. 21 database calls inside loops (one call per row): turn into one call.
24. 12 product list queries without LIMIT.
25. 116 synchronous file calls (readFileSync, existsSync) in routes/server: block every user while they run. Check the hot ones.
26. All /api GET answers are "private, no-cache": allow 10-15 s private cache on read-only lookups (item list, vendor list).
27. 28 console.log calls in hot code. Remove or put behind a debug switch.
28. Needs AJ OK (never touch Postgres settings without it): tune Postgres memory (shared_buffers, work_mem) for this PC.
Not a speed item but noted: public/_archive/xlsx.full.min.js is a 880 KB duplicate (disk only).
