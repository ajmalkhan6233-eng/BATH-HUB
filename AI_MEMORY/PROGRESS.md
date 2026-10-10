# PROGRESS (updated 2026-10-10). App branch work (never master). Per-part detail: LATEST_REPORT.md
SETTLED earlier: Design 2 reskin (black, ash, gold) on all app screens; POS Part A-C (scan, hold, reprint, cheque/credit/split, load quotation); new RBH logo.
QUEUE 4 (Aj said GO):
- Part 1 website: 3D tour removed, WhatsApp in top bar (no floating button), 390/360 checks. PUBLISHED to the main link with Aj's OK; live link checked: RBH logo yes, tour gone, orange 0, no console errors. Rollback deploy 6ac36cf61280a91d37342917. Tags before-final4 (website).
- Part 2 cleanup: DONE. Old owner app (BATHCO_NATURE) + 7 themes + 4 old/navy pictures git rm'd (history keeps them); 3 duplicate logo zips to the Recycle Bin. Tag before-cleanup. List: CLEANUP_LIST.md. Dashboard, POS, Daily Sales, Stock, Reports open at 390px: audit/cleanup/.
- Part 3 POS cheque + credit bills: DONE (read side). Cheques page has "From POS bills (not in the register yet)" + "Register this cheque" (existing POST /api/cheques, claim link stops a second registration). Credit & Aging has a separate read-only "POS credit bills" section. Merge into credit totals NOT done. Plan: POS_LEDGER_PLAN.md. Screens: audit/pos/{credit,cheques-before,cheques-after}-390.png. 7 new tests pass.
- Part 4 quotation billed twice: DONE. The bill keeps the quotation id (new table pos_quotation_billed); POS "Load quotation" shows "Already billed (BHT-...)" and asks before loading again; a voided bill frees it.
- Part 5 security gates: DONE (see SECURITY_GATES.md). Egress gate (drafts only, owner approves), public-data allowlist, untrusted-text wrapper, audit log. 10 new red-team tests + the old ones pass. LAYLA model switch stays OFF.
- Part 6 record: this file, HANDOFF, OPEN_ITEMS.
JEST: after 125 suites pass, 10 fail (env: Chromium, PDF, receipt image, browser CSP, reference/, brain.test.js known). Before-run was killed: UNVERIFIED pair.
