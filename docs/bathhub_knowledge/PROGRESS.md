# Progress

Overall: 50 of 50 things done.

## 1) Daily Ledger Fixes — 27 of 27 done

1. When you scroll down the sales list, the column titles (Receipt No, Sales, Cash, etc.) now stay at the top instead of disappearing. — DONE
2. The daily totals (Sales, Cash, Card, Online, Cheque, Credit, Cash In Hand) now stay visible at the top of the screen no matter which tab you're on or how far you scroll. — DONE
3. Cash In Hand — the number that matters most at the end of the day — is now the biggest and clearest number on the screen. — DONE
4. The floating "Cash Given" button no longer covers up other numbers on the screen. — DONE
5. Removed the "Quick add" box from the Expenses list, as you asked. — DONE
6. Expense descriptions and amounts now line up neatly in their own columns. — DONE
7. The Payouts description box is wider now, so long entries aren't cut off. — DONE
8. You can now type in any staff name for salary, including temporary or casual staff — not just pick from a fixed list. — DONE
9. Fixed a bug where the salary amount box would only let you type one digit. — DONE
10. Salary amounts now add up correctly into the Total Salary figure. — DONE
11. Staff salary is now correctly subtracted from Cash In Hand. — DONE
12. Uploading a cheque spreadsheet now correctly reads the cheque number and bank name — before, those two often came through blank or wrong. — DONE
13. Cheques marked as cleared now show up in green, just like on your paper sheet. — DONE
14. The "Add cheque" button now properly adds a new blank row — before it looked like nothing happened. — DONE
15. Downloading the cheque list now only downloads the ticked rows, or whatever is currently shown on screen, instead of always downloading everything. — DONE
16. Downloading the cheque list no longer triggers a security warning in Chrome. — DONE
17. The "Send via WhatsApp" button for cheques now actually works, the same way the daily report's WhatsApp button already does. — DONE
18. The "Show due within" dropdown menu is readable now — before, the options were invisible. — DONE
19. Added a running total showing how much money is due for whichever time period you pick. — DONE
20. Cheque clearing dates are now worked out from the date written on the cheque (not when it was typed in), correctly skipping weekends and Sri Lankan bank holidays. The 2026 holiday list you gave me is loaded and there's a clearly marked spot to add 2027 and 2028 next year. If a cheque's date ever falls in a year with no holiday list loaded yet, it still shows a date but flags it in amber so it's never silently wrong. — DONE
21. Made the printed daily report shorter — the summary now prints first, blank rows you never typed anything into no longer print at all, and it now fits on one page for a normal day. Also fixed a background image that was accidentally printing behind the report. — DONE
22. Checked, not touched — the WhatsApp report is confirmed exactly the same as before, byte-for-byte. — DONE
23. Added a way to upload the Lasersoft sales report (as a PDF) so it's automatically compared to your entered sales, and shows Net Profit. See the note below — this one genuinely needs you to try it on a real Lasersoft file before fully trusting it. — DONE
24. You can now pick one date, or a start and end date, and see only the cheques clearing in that window, with the total shown — "what's clearing Monday" is two clicks. — DONE
25. You can now attach a photo to any cheque (like a picture of the actual cheque) and view it again later. — DONE
26. Tick two or more cheques and either download just those, or send just those via WhatsApp — both now show the combined total for what you picked. — DONE
27. Downloading the cheque list no longer triggers a security warning in Chrome (re-checked again after the other cheque changes above). — DONE

**Important extra fix (not one of the 27, but found and fixed this round):** the cheque list was never actually being saved to the server — it was quietly failing every time and only ever living on the one device you typed it into. Cheque photos were at the same risk. This is now fixed with its own proper save location, a clear on-screen warning if it ever can't save, a "Migrate to Server" button that shows you exactly how many rows were found and confirms the same number made it to the server, and a "Backup to File" button so you can always keep your own copy. One step is still needed on the server side before this is fully live — flagged separately, not something you need to do anything about right now.

**Two things worth knowing:**
- Item 20's holiday list should be checked once a year — a reminder is built into the code itself for whoever updates it.
- Item 23's PDF reading was built carefully but has not been tried on one of your actual Lasersoft PDF exports yet (none was available to test with). The first real one you upload should be checked against your own numbers before you rely on it.

## 2) Offline Entry Page (for when there's no internet) — 8 of 8 done

A. Built the Expenses and Payouts screen for the offline entry page. — DONE
B. Built the Cheques screen for the offline entry page. — DONE
C. Set up the top bar on the offline page — date picker, color themes, buttons — to match the main page. — DONE
D. Every entry you make offline is still saved safely and individually, the same reliable way as before. — DONE
E. The offline page keeps things simple — it only saves what you type. It doesn't try to work out cheque dates, profit, or other calculations; those stay on the main system. — DONE
F. Reports that need the internet (like the Accountant Report) are clearly greyed out on the offline page, so it's obvious they're not available there. — DONE
G. The saving system on the server now understands the new kinds of entries (expenses, payouts, salary, cheques), not just sales. — DONE
H. Tested the whole offline page with the internet actually turned off, to make sure every screen saves entries properly. — DONE

## 3) Checked a list of 8 reported problems (2026-07-26) — 8 of 8 checked

1. The staff dropdown in the Payouts list — tested it directly, it does work; it just sits lower on the screen because there are three lists stacked on that tab, so on a phone you may need to scroll down to reach it. — CHECKED, WORKING
2. You can now type any staff name (not just pick from a list) in the Payouts list too, the same as Salary already allowed. — DONE
3. The salary amount box only letting you type one digit — already fixed earlier, re-tested and still fixed. — CHECKED, WORKING
4. Salary being added into the Expenses Total — deliberately NOT done. You confirmed the Expenses list already has its own Salary line, so adding it again would count it twice and make the profit figure look worse than it really is. Left exactly as is. — DECIDED: NO CHANGE
5. Staff salary being subtracted from Cash In Hand — already working, re-tested and confirmed. — CHECKED, WORKING
6. The Total Sales figure at the top updating instantly as you type — already working, re-tested and confirmed. — CHECKED, WORKING
7. Cash/Card/Online/Cheque/Credit totals updating instantly on every tab — already working, re-tested and confirmed. — CHECKED, WORKING
8. The colour theme buttons and the animated background toggle — already working, re-tested and confirmed. — CHECKED, WORKING

**Real bug found and fixed while checking the above:** typing into the description or amount box on the Expenses or Payouts list could wipe out what you'd just typed after the first letter, in some cases — the same "only one letter" problem as the old Salary bug, just never fixed in these two lists. Fixed now and tested.

## 4) Extra polish (2026-07-26) — 7 of 7 done

9. Deleting a row no longer shows a pop-up asking "are you sure" — it deletes right away and shows a small "Undo" button for a few seconds in case you didn't mean to. — DONE
10. Checked whether typing long text shifts the columns around on the main Sales list — tested it directly, it doesn't. Already fine. — CHECKED, WORKING
11. The "Saving..." / "Saved" message at the bottom of the screen is now honest about what's happening, including showing clearly when the device has no internet. — DONE
12. If saving ever fails, there's now a clear red message with a "Retry now" button that stays on screen until it's fixed — before, a failed save could go unnoticed. — DONE
13. The "Save backup file" button now saves everything — Sales, Expenses, Payouts, Salary, AND Cheques — in one file. Before, it left Cheques out. — DONE
14. Checked the printed report — already made to fit one page cleanly from earlier work. Only had to make sure a new on-screen "Undo" button never accidentally shows up on a printout. — CHECKED, WORKING
15. Checked the whole page for anything that needs the internet to even load (fonts, images, code from other websites) — there is none. It already works with no internet connection at all. — CHECKED, WORKING
