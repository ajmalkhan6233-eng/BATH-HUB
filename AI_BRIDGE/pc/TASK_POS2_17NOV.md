STATUS: PLAYED
TASK: New POS screen preview (17 Nov 12:50). Chat built and tested on a copy (24 checks passed, DB copy only). PC only RUNS this. Real POS is NOT replaced.
1. git pull origin claude/pos-preview2   (adds public/pos-preview2.html, pos2-api.js, pos2-screen.js; no server file changed, NO restart needed)
2. Open http://localhost:3100/pos-preview2.html (Ctrl+F5 twice). LOOK ONLY: do NOT save a test bill.
   Check: date box shows dd/mm/yyyy; Add item lists real items with stock; 11 item lines fit at 1366x768; Bill tools -> Find bill lists real bills.
3. LIVE.md line: DONE only if the page loads and Add item shows real items. Else paste the last 15 lines of the browser console error.
WHAT IT DOES: item picker = real catalogue + stock; Generate Bill = real POST /api/pos-bills (stock, payments, over-cap approval, back-dating dd/mm/yyyy, +/00 phones); Void, Edit (owner), Find bill, Last bill, Quotation save/load, Held (this device), Wholesale, WhatsApp receipt (auto, as the old POS), profit from /api/sale-profit (owner only).
NOT YET (heads-up): camera scan, customer search. Old POS stays at pos_billing.html until AJ says swap.
