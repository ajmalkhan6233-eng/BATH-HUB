# Audit 16 Nov (Gemini's list checked against the real code)
Taken from Gemini: the audit style, the 4 areas, the acceptance checklist. Not taken: claims the code does not support. Evidence = file and line as of commit on claude/ledger-stock-search.

## Gemini claim -> what the code shows
1. "Service worker shows old number first, then live" -> NOT TRUE. public/service-worker.js (line 3, 73): /api is network-first; the saved copy (X-Saved-Copy: 1) is used only when the network fails, and dashboard_pro.js ignores it (`'keep'`). Version is v98, not v34.
2. "Home fires uncoordinated fetches, numbers jump" -> TRUE, FIXED. dashboard_pro.js, dashboard_modern.js, dashboard_v2.js painted separately and repainted every 60 s and on every Home click. Now: same numbers = no repaint (data-h compare); Home hidden until settled (bathco_complete.html ~2829); count-up off; home-calm.css.
3. "Screens reload twice (iframes + hash routing)" -> PARTLY. 4 addFramePage uses; `setInterval(scan,1500)` (bathco_complete.html ~2843) re-scans iframes forever (cheap but needless). Frame styles now applied at first paint (rbh-early.js). Not changed: replacing the scan timer (low gain, shell is Golden Core).
4. "NUMERIC comes back as strings" -> TRUE, NOT CHANGED. server.js 117 sets only the DATE parser. A global NUMERIC parser would change 515 queries; kept as is. Screens already wrap in Number(). Rule: any new total uses Number().
5. "ecosystem.config.js points to bathco-server:3010, live is apex-server:3100" -> TRUE. ecosystem.config.js names bathco-server PORT 3010; apex-server is not in the file. NOT edited (restart risk on the shop PC). PC asked to report how apex-server is really started (task 264).
6. "Big files" -> TRUE: bathco_complete.html 2846 lines, daily-entry-v2.html 4644, server.js 3527 (62 files in public use pool.query heavy server). Not split now: each split risks the Golden Core. Done instead: GRN's five CSS files merged into grn-all.css, POS's four into pos-all.css.
7. "Cart lost on refresh" -> TRUE, FIXED. POS had Hold but no auto-save. New public/pos-draft.js saves the unsaved bill on this device (12 h), restores on open, clears when the screen is cleared/bill generated. Tested: save, reload, restore, clear.
8. "No viewport-fit=cover" -> TRUE, FIXED on the owner shell (bathco_complete.html line 6).
9. "Unpaginated heavy SQL" -> NOT VERIFIED in this pass (needs a query-by-query read; 42 route files mention LIMIT). Left for PC read-only report (task 264).

## Acceptance checks run (test copy)
Server health ok; Home identical after 7.5 s (check 16); POS draft round trip; checks 1-16 GREEN (scripts/qa/rbh_check.sh).
Cashier hides cost/profit: dashboard_pro.js role helpers exist (line 8-9); not re-tested here, listed in task 264.
