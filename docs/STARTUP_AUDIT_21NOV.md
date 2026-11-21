# Startup + design audit, 21 Nov 2026 (PC, Claude Code, Opus 5.5 by AJ's choice). No business data in this file.
Goal (AJ): every time the PC starts there is ONE app, ONE design and the CURRENT build, with no old screens, no half-loaded pages and no old saved copies.
Method: read-only map first, then small fixes, one commit each (startup audit 1 to 8 on branch work). I took a backup first (D:\BathHubBackups, 21 Nov 15:31). Screens were checked signed-out: the PC cannot sign in, so layout, files and scripts were checked but the numbers on screens are UNVERIFIED.
Status words: FIXED = changed and checked. OPEN = found, not changed (chat or AJ decides).

## A. Blocks selling (11)
1. FIXED | pm2 held TWO apex-server entries (id 1 and id 2). The new watchdog removed the stopped twin, kept the online one and saved the pm2 list.
2. FIXED | At boot the watchdog ran before pm2 answered and started a second copy. It now waits up to 60 s for pm2 first.
3. FIXED | Restarts BY NAME woke the stopped twin, and the two fought for port 3100. The app gave nothing for about 4 minutes today (14:58 to 15:02), and the watchdog hit the same at 14:26. The watchdog now restarts by id. 3 tests added (tests/rbhWatchdogDup.test.js).
4. FIXED | pm2 resurrect ran TWICE at logon (Windows Run key "PM2" + task Apex_Owner_Server_Start). The task is disabled, the Run key is kept. Undo: Enable-ScheduledTask Apex_Owner_Server_Start.
5. FIXED | The startup shortcut and the desktop "Start Royal Bath Hub" ran rbh_start.ps1 from a temporary worktree folder (old code). Both now run scripts/pc/rbh_boot.ps1 in the main folder.
6. FIXED | Two launchers opened windows at logon (RBH_Open_Chrome.cmd with 2 tabs, plus the auto-start shortcut). Both are set aside as *.off-21nov in the Startup folder. ONE shortcut "Royal Bath Hub (start)" now opens ONE window at /owner.
7. FIXED | There was no single start check. New scripts/pc/rbh_boot.ps1: waits for pm2, runs the watchdog once, checks exactly 1 apex-server + health 200 + build = file on disk, opens one window, and writes logs/boot.log. Last run: OK.
8. OPEN | When port 3100 is taken, server.js keeps running WITHOUT listening, so pm2 shows "online" while the app is dead (seen today on id 2). Suggested fix: exit on EADDRINUSE so pm2 retries.
9. OPEN | Pocket phone app: "[pocket-inbox] inbox HTTP 404" every ~6 s since 19 Nov. The Pocket worker was never updated (task 277 step 4, update_pocket_app.ps1, ended with exit code 4), so phone Sell/Profit/Order do not reach the PC and the log fills up.
10. OPEN | Watchdog auto-update is always "blocked: PC has commits the cloud does not", because the PC merges locally. Auto-update never runs; chat to decide (pull-only or switch it off).
11. OPEN | tests/item_detail_stock.test.js "stock 10 to 8 is saved" returns 500. It fails before and after today's changes, so it is an older fault in the stock edit save.

## B. Looks wrong (old copy, old screen, layout) (50)
12. FIXED | The footer build label was hand-typed ("Build 21 Nov · Stock & menu fixes") and drifted. It now shows the server build (one source: the service worker VERSION, read by /health).
13. FIXED | html/js/css had no cache rule, so Chrome could reuse an old file for hours. They now always revalidate (Cache-Control: no-cache). Pictures and fonts keep 1 day.
14. FIXED | Nothing checked whether the saved copy matched the server. On load, an older saved copy is now cleared and the page reloads ONCE, quietly. Tested: a planted old copy was cleared, one reload, no loop.
15. FIXED | The service worker could keep a saved copy of /health (the build number). It no longer does.
16. FIXED | The build number only changed after a restart. /health now re-reads it when the file changes.
17. FIXED | Old screen pos_billing_old.html could be opened by address. It now goes to POS (/owner#/pos).
18. FIXED | Old screen pos-preview.html goes to POS.
19. FIXED | Old screen home-gemini.html goes to Home.
20. FIXED | Old screen home-hud.html goes to Home.
21. FIXED | Old screen home_simple.html goes to Home.
22. FIXED | Demo screen modern-demo.html goes to Home.
23. FIXED | Demo screen ux-demo.html goes to Home.
24. FIXED | The old "Sale Commissions" page (sale_commissions.html) was still inside the owner app (hidden menu item + frame). It now opens the new Sales Commission page.
25. OPEN | Two installed Chrome apps "Royal Bath Hub Owner" (profiles Default and Profile 1), each with its own saved copy. AJ: keep one (question logged). Item 14 now protects both.
26. PARTLY FIXED | The sign-in box was 360 px fixed and cut off on a phone. It now fits the screen width, but it still sits off-centre because of item 27.
27. OPEN | Owner top bar at phone width is wider than the screen (Sign Out off screen).
28. OPEN | Daily Ledger at phone width: page 1,061 px wide (sideways scroll).
29. OPEN | Stock & items at phone width: page 506 px wide.
30. OPEN | POS at phone width: the form panel and doc line are wider than the screen.
31. OPEN | Investor loans at phone width: table wider than the screen, no scroll box.
32. OPEN | Customers at phone width: table wider than the screen.
33. OPEN | Credit aging at phone width: table wider than the screen.
34. OPEN | Quotations at phone width: table wider than the screen.
35. OPEN | Audit accounting at phone width: table wider than the screen.
36. OPEN | Cheque register at phone width: table wider than the screen.
37. OPEN | Package planner at phone width: table wider than the screen.
38. OPEN | Prices at phone width: table wider than the screen.
39. OPEN | Vendor ledger at phone width: input boxes wider than the screen.
40. OPEN | Vendor credit at phone width: top bar Sign Out off screen.
41. OPEN | Profit (profit.html) at phone width: 3 buttons off screen.
42. OPEN | GRN workbench at 1366 px: the drafts list is wider than the window.
43. OPEN | Investor loans crashes half-loaded when the server sends an error instead of a list (rows.forEach is not a function).
44. OPEN | Money control crashes half-loaded on a server error (cannot read 'find' of undefined).
45. OPEN | Cheque register alerts crash half-loaded on a server error (loadAlerts rows.forEach).
46. OPEN | POS script error "Cannot set properties of null (setting 'onclick')" at pos2-screen.js:227. Seen twice in the framed scan, not on a direct load; chat saw it on the cloud copy too.
47. OPEN | Layla owner page still uses the old style sheet design2_legacy.css.
48. OPEN | Money plan still uses design2_legacy.css.
49. OPEN | Morning brief still uses design2_legacy.css.
50. OPEN | POS ledger still uses design2_legacy.css.
51. OPEN | Vendor ledger still uses design2_legacy.css.
52. OPEN | Package planner does not load the shop font (rbh-font.css), so the text shows in a fallback font first.
53. OPEN | POS (pos-preview2) does not load rbh-font.css.
54. OPEN | pos_billing.html does not load rbh-font.css.
55. OPEN | Two Profit pages in the menu (profit.html and profit_phone.html). Decide one.
56. OPEN | Page outside every menu, not redirected: cheque_clearing.html.
57. OPEN | Page outside every menu: inactive_modules.html.
58. OPEN | Page outside every menu: investor-view.html.
59. OPEN | Page outside every menu: layla_hub.html.
60. OPEN | Page outside every menu: pos_billing.html (the owner app comment still says POS embeds it; the real POS is pos-preview2.html).
61. OPEN | Page outside every menu: sync-review.html.

## C. Load speed (7)
62. OPEN | The owner app loads 57 scripts and style sheets (561 KB) before it is usable.
63. OPEN | 39 of the owner app's scripts load without "defer", so they block the first paint.
64. OPEN | The 200 KB chart library loads at start even when no chart is on screen (load it when a chart opens).
65. OPEN | 110 KB of inline script in the owner app.
66. OPEN | 203 KB of inline script in the Daily Ledger (slow first open).
67. OPEN | 70 KB of inline script in the GRN workbench.
68. OPEN | 65 of 69 pages load bathhub-icons.js in the head without defer (the theme must stay early; the icons can wait).

## D. Housekeeping (14)
69. FIXED | Scheduled task RBH_BridgeWatcher ran from a temporary worktree folder. It now runs from the main folder (same file).
70. FIXED | RBH_LogTidy ran from a worktree folder. Now main folder.
71. FIXED | RBH_Website_Health ran from a worktree folder. Now main folder.
72. OPEN | Duplicate element ids on admin_corrections.html (why, err, cancel).
73. OPEN | Duplicate ids on admin_users.html (f_n, f_r, f_p, fe, f_go).
74. OPEN | Duplicate ids on all-bills.html (q, go).
75. OPEN | Duplicate id on daily-entry-v2.html (saveErrorRetryBtn).
76. OPEN | Duplicate ids on quotations.html (fe, f_x).
77. OPEN | Duplicate id on reports_analytics.html (csv).
78. OPEN | Old "?v=98q" tags on owner-app scripts are no longer needed (files revalidate now).
79. OPEN | Watchdog calls pm2 with shell:true (Node DEP0190 warning in every run).
80. OPEN | The old WhatsApp session folder .wwebjs_auth.old-19nov (466 MB) is still there. Archive after AJ's OK.
81. OPEN | The disabled tasks Apex_Owner_DB_Backup and BathHub-OpenApp are left disabled (RBH_Backup_30min does backups). Keep as they are.
82. OPEN | bathhub.html pulls Google Fonts (a privacy leak). It is redirected to the website, so it is never shown, but the file still holds the link.

## Cold start test (21 Nov 15:51; one more plain restart at 16:05 for the last server fix)
I stopped apex-server and ran rbh_boot.ps1. The watchdog restarted it by id and it was up in 6 s: 1 apex-server in pm2, health 200, build current (v145-loginfit). A clean headless profile shows the current build label. Screenshots: AI_BRIDGE/shots/startup21nov_*.png (private bridge). Old ports 3000 and 3199: nothing listening (good); 3001 = WhatsApp bridge, 3100 = app.
