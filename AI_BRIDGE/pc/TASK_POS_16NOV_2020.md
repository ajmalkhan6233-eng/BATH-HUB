STATUS: PLAYED
TASK: POS screen update (16 Nov 20:20). Chat built and tested on the copy. PC only RUNS this.
1. git pull origin claude/ledger-stock-search
2. (AJ approved 20:22): the bills he typed today by mistake are old sales; move them to 31 Oct 2026.
   a) node scripts/redate_today_bills.js          (rehearsal: lists today's bills; put the list in LIVE.md)
   b) node scripts/redate_today_bills.js --yes    (AJ's OK is given; run it right after a). If the list shows a bill AJ would not want moved, STOP and put it in QUESTIONS.md.
   Backup first: the usual pg_dump to backups\ must pass before --yes.
3. RENUMBER (AJ 20:26, approved): old BHT- bills become RBH-S001, RBH-S002 ... in date order (first bill = RBH-S001). Run AFTER step 2 and BEFORE the restart.
   a) node scripts/renumber_bills.js          (rehearsal; put the list in LIVE.md)
   b) node scripts/renumber_bills.js --yes    (backup must have passed). If it says an RBH-S bill already exists: STOP, QUESTIONS.md.
4. pm2 restart apex-server --only apex-server  (health http://localhost:3100/health must answer). Restart only AFTER step 3.
5. Report in LIVE.md: DONE only after step 4 health answers.
WHAT CHANGED (tell AJ to Ctrl+F5 twice):
- POS line: no Base column; Item code -> Qty -> Enter -> Selling -> Enter; Selling typed below list fills Discount and Total; live profit number under the bill; bigger close button; small bill window; shop item code shown under the item name.
- Screen fits any window height now: item list scrolls inside, Generate Bill never pushed off, item drop-down opens upward when low, Layla button no longer covers Generate.
- Scan and Bill tools moved beside "+ Add item"; the scan bar is gone.
- No customer name/phone drop-down; no "unsaved bill was put back" banner.
- New numbers: retail RBH-S001.., wholesale RBH-HS001.., quotations RBH-Q001.. (server files, need the restart).
- Bill tools has a new "Wholesale bill" switch: type any Selling price per line, bill is numbered RBH-HS###, switch resets for the next bill.
CHECK: open POS, make a test bill-free look only (do NOT save a test bill). Confirm the page loads and Selling/Discount fill.
