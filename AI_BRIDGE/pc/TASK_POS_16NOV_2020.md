STATUS: PLAYED
TASK: POS screen update (16 Nov 20:20). Chat built and tested on the copy. PC only RUNS this.
1. git pull origin claude/ledger-stock-search
2. pm2 restart apex-server --only apex-server  (health http://localhost:3100/health must answer)
3. BEFORE the restart is fine, any order. AJ approved (20:22): the bills he typed today by mistake are old sales; move them to 31 Oct 2026.
   a) node scripts/redate_today_bills.js          (rehearsal: lists today's bills; put the list in LIVE.md)
   b) node scripts/redate_today_bills.js --yes    (AJ's OK is given; run it right after a). If the list shows a bill AJ would not want moved, STOP and put it in QUESTIONS.md.
   Backup first: the usual pg_dump to backups\ must pass before --yes.
4. Report in LIVE.md: DONE only after step 2 health answers.
WHAT CHANGED (tell AJ to Ctrl+F5 twice):
- POS line: no Base column; Item code -> Qty -> Enter -> Selling -> Enter; Selling typed below list fills Discount and Total; live profit number under the bill; bigger close button; small bill window; shop item code shown under the item name.
- Scan and Bill tools moved beside "+ Add item"; the scan bar is gone.
- No customer name/phone drop-down; no "unsaved bill was put back" banner.
- New bill numbers: RBH-S301, RBH-S302 ... (server file routes/pos_bills.js, needs the restart). Old BHT- numbers stay.
CHECK: open POS, make a test bill-free look only (do NOT save a test bill). Confirm the page loads and Selling/Discount fill.
HEADS-UP for chat: first bill is still BHT-20261029-0001; if AJ wants it renamed RBH-S301 say so in QUESTIONS.md.
