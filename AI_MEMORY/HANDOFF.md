# HANDOFF (2026-10-09, POS build queue done)
- Branch `work` = Royal Bath Hub output (never master). Report: AI_MEMORY/LATEST_REPORT.md. Per-screen progress: AI_MEMORY/PROGRESS.md.
- POS build queue (Aj GO): Part A DONE (barcode scan, hold/resume, Last bill + Find bill, qty +/- buttons), Part B DONE (cheque, credit, split; new table pos_bill_payments; plan in AI_MEMORY/POS_PAYMENTS_PLAN.md), Part C DONE (Load quotation, read only). Nothing skipped. Stock deduction stays OFF (POS_DEDUCT_STOCK).
- Not done on purpose (needs Aj): cheque bills into the Cheques screen, credit bills into Credit & Aging (golden core / credit totals).
- Held bills live only in the browser of that device (max 10), never in the database.
- Design 2 (black, ash, gold) is live in the app: design2_tokens.css + design2_legacy.css, rollback: git checkout design3-backup. Website: branch work in E:\AI Sttuf\bathhub-website; Netlify preview waits for Aj's Netlify login (preview-site.cmd). Not published.
- Dev setup: throwaway Postgres 5433 (bathco_test) + dev app 3199 from the session scratchpad; never the live DB or app.
- Backups: branches backup-before-pos-build, backup-before-design2, tag design3-backup.
- Aj next physical action: look at audit/pos/*.png on the phone (YES/NO per screen); answer the Cheques / Credit & Aging question in OPEN_ITEMS; Netlify login for the site preview.
- New RBH logo installed in the app and on the website branch (details: LATEST_REPORT). Logo pack: C:\Bathco\Logo. Old logo files kept (public/brand/old-logo for the replaced favicon-32.png). Website publish still waits for Aj.
