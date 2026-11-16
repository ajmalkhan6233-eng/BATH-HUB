STATUS: PLAYED
TASK: POS screen update (16 Nov 20:20). Chat built and tested on the copy. PC only RUNS this.
1. git pull origin claude/ledger-stock-search
2. pm2 restart apex-server --only apex-server  (health http://localhost:3100/health must answer)
3. Report in LIVE.md: DONE only after step 2 health answers.
WHAT CHANGED (tell AJ to Ctrl+F5 twice):
- POS line: no Base column; Item code -> Qty -> Enter -> Selling -> Enter; Selling typed below list fills Discount and Total; live profit number under the bill; bigger close button; small bill window; shop item code shown under the item name.
- No customer name/phone drop-down; no "unsaved bill was put back" banner.
- New bill numbers: RBH-S301, RBH-S302 ... (server file routes/pos_bills.js, needs the restart). Old BHT- numbers stay.
CHECK: open POS, make a test bill-free look only (do NOT save a test bill). Confirm the page loads and Selling/Discount fill.
HEADS-UP for chat: first bill is still BHT-20261029-0001; if AJ wants it renamed RBH-S301 say so in QUESTIONS.md.
