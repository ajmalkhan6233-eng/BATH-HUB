# LATEST_REPORT 2026-10-09: POS build queue (Parts A, B, C, D) on branch work
PROBLEMS
- Not done on purpose, needs Aj: cheque bills into the Cheques screen and credit bills into Credit & Aging (golden core / credit totals). Question + answer to paste is in OPEN_ITEMS.
- Small gaps: end-of-day summary shows a split bill as one "split" line; the PDF receipt prints SPLIT without the lines; a loaded quotation is not marked as billed (can be loaded twice).
- UNVERIFIED: a real barcode scanner (tested by typing the code + Enter, which is what scanners send).
- Playwright tool not connected this session: used puppeteer-core with local Chrome at 390px.
- tests/brain.test.js still fails (old date, not mine).
DONE (all VERIFIED: tests and 390px browser checks really ran, dev DB only, nothing published)
- A: scan box (adds qty 1, again +1, unknown code = message), Hold/Held (max 10, browser only, 10 refused at 11), Last bill + Find bill (read only), qty +/- (44px, no sideways scroll). 15/15 browser checks. Commit 2387806.
- B: cheque, credit, split via new table pos_bill_payments (no golden-core change). Payments must equal the total to the cent. Credit is its own bucket, never cash. Void bills left out; discount cap still enforced; bills with payment rows are voided, not edited. 16 server tests + 16/16 browser checks. Commit 35cd52f.
- C: "Load quotation" fills the cart and customer, discount % worked out to match the quote total; quotation unchanged. 7/7 browser checks (Sinhala/Tamil name kept).
- Jest: before 1 failed/1396 passed (128 suites, after A); final 1 failed/1424 passed (129 suites). No growth. 17 + 12 cart tests, 16 payment tests.
- Dev test bills saved from the POS form: BHT-20261009-0008 (A), -0010/-0011/-0012 (cheque/credit/split), -0017 (quotation).
- Screens: audit/pos/*.png. Progress: AI_MEMORY/PROGRESS.md. Plan: AI_MEMORY/POS_PAYMENTS_PLAN.md
NOT DONE: nothing skipped. Website and publishing untouched.
Status: NEEDS YOU
Next: look at audit/pos on the phone (YES/NO per screen) and answer the Cheques / Credit & Aging question in OPEN_ITEMS.
