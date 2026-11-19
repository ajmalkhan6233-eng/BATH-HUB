# QA AUDIT REPORT: shop app pages at phone width (22 Oct 2026, first run of the rbh-qa skill)
Handover: branch claude/rbh-ux-skill. Test copy only (cloud, port 3199, empty test database, test admin). Nothing live was touched. Read-only crawl: pages opened, no buttons pressed.

## Counts
Pages in public/*.html: 42. Opened: 41. Phone 390x844. Sideways scroll: 0. Raw text (undefined, NaN, null, KEY_MISSING): 0. Languages: only bathhub.html and the website have a switch; not run (bathhub.html redirects to the public website, not reachable from the cloud).

## Real findings (fix later, small)
| # | Page | What | Why it matters |
|---|---|---|---|
| 1 | daily-entry-v2.html | 523 controls under 40 px, 462 inputs under 16 px | Hard to tap on an iPhone and the screen zooms on every field |
| 2 | admin_settings, admin_audit, admin_system | inputs under 16 px (9, 4, 3) | iPhone zooms in on tap |
| 3 | about 20 pages (accounting, customers, POS billing, staff and others) | two image tags with an empty src | Wasted request and a broken-image flash |
| 4 | labels_a4, layla-owner, prices, stickers | 3 to 9 small tap targets each | Minor |

## Test-copy artefacts (NOT bugs on the live shop)
- 500 on vendor-ledger, vendor-credit, vendors_overview, morning-brief, dashboard vendor lists: the test database has no vendor_bills table yet (it appears after the first GRN save). Optional later: show an empty state instead of a 500 on a fresh install.
- 404 on /api/daily-summary/DATE (22 pages) and /api/daily-entry/sync/DATE: the route answers 404 when that day has no entry yet. Works as designed, but it prints a red console error on every page. Optional later: answer 200 with an empty marker (needs care: screens depend on the 404).

## Not covered (next run)
Click flows (sale, GRN, void, return, edge inputs) on a test copy that already has a GRN; desktop width for the POS; the public website languages (EN, SI, TA).

## Likely fixes (plain words)
1: let the daily entry grid stack as cards under 640 px and use 16 px inputs. 2: set 16 px on inputs in the shared admin CSS. 3: remove the empty image tags or set them from script only when there is a logo.

SUMMARY: done = first QA run, report written; not done = click flows, website languages; AJ action = none; save usage = one headless run, no screenshots needed; status = GREEN.
