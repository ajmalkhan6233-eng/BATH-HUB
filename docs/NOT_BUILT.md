# NOT BUILT / NOT FINISHED (4 Nov 2026, from REQUEST_LEDGER, OPEN_ITEMS, START_HERE and tonight's chat)
Rule from Ajmal: anything he must run or press becomes a PLAY button (top bar: Update; GRN tab 2: Backup, Fix double-counted). More play buttons are added when a task needs one.

## A. Never built (asks that were lost or parked)
1. Customer return screen (only void exists)  2. Hold / recall bills in POS  3. One POS instead of POS + daily POS
4. Cash in / out / leftover report  5. Staff PIN login so staff never see cost or profit; Layla live on customer WhatsApp; bill photo to bill
6. GRN barcode button with code entry + bulk print  7. Audit Machine (bill-chain accuracy, daily check) and the "find 20 bugs" sweep
8. Profit screens (daily/weekly/monthly/yearly) only partly built  9. 6 of the 50 small improvements still missing (docs/UX_CHECKLIST.md)
10. Low-stock check (77 flagged)  11. Enquiries page rate-limit error  12. Investor loans entry screen
13. Purchasing screen: Purchase Orders, PO to GRN, Price Comparison, Landed Cost, Shipment Tracker are empty ("Not built yet"); remove or build
14. Category chosen on each GRN line (today: set it afterwards in Stock & items)

## B. Waiting for Ajmal's word (nothing for him to run)
- Fix the Metro double count: press the button (GRN tab 2). Clean the other test data on the live database: say "clean test data" and it becomes a play button with a backup first.
- Selling prices for Fazaal / Maheshan; real opening hours; Lasersoft screenshots; sticker scan test before printing all.
- POS credit bills separate from Credit & Aging, or merged (current: separate).
- OK to install: Tailscale (phone reaches shop app), Tesseract, cut-out photo tool, https address for the website.
- 9 listed bugs (OPEN_ITEMS) wait for his OK. Rename of old BATHCO names waits for his go. Website publish only on his word.

## C. Blocked or left to him before, now handled
- Hourly backup: wired + play button. Needs the bridge repo to be PRIVATE (script refuses a public one).
- "Merge to live" / auto update: top bar ▶ Update does it; if it says blocked, the PC has local edits: tell Claude the line.

## D. Security heads-up
- The app repo BATH-HUB on GitHub is PUBLIC. The database password sits in its history (docs/dubai-status.md): change the DB password, then make the repo private.
- Delete branch rbh-backup in BATH-HUB (a test run pushed test data there).
