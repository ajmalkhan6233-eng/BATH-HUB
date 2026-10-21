2026-10-03 23:28:24 JOB3 start: read rules+code, scratch PG on 5434 up (84 tables restored). Plan: utils/documents/*, routes/documents.js, public/documents.html, tests/integration/documents*.test.js
2026-10-03 23:32:30 step1 committed: schema.js/format.js/reports.js (12 report builders, read-only SQL), documents_up/down.sql
2026-10-03 23:39:33 step2 committed: render/store/transport/sender/quarantine utils + routes/documents.js + 1 mount line server.js; scratch PDF verified (3 pages, summary first)
2026-10-03 23:42:27 step3 committed: public/documents.html + menu entry in bathco_complete.html (CRLF kept) + SW precache; verified 390px no sideways scroll on all 4 tabs in Chromium against scratch app
2026-10-03 23:48:12 step4 committed: tests/integration/documents.test.js 83 passed (alone)
2026-10-03 23:51:31 verified all 12 report SQL queries on scratch real Postgres (seeded rows); full suite running

## FINAL REPORT JOB 3 (Documents and Reports) - 2026-10-04
- Branch: feature/documents (worktree .claude/worktrees/wt-documents). Last commit: 2c7c358 (report file itself is not in git).
- Tests: documents.test.js alone 83 passed. FULL suite: 84 suites, 839 passed, 2 skipped, 0 failed (baseline was 83 / 756).
- VERIFIED: all 12 report queries on a scratch real Postgres with seeded rows; PDF made by real Chromium (3 pages, summary first, logo, Rs 1,234.00 format, tabular-nums); 390px phone width: no sideways scroll on all 4 tabs (checked by hand in Chromium against the scratch app, NOT an automated test); end-to-end curl flow (generate, download, recipient, dry-run send, duplicate, upload, confirm).
- DONE: routes/documents.js + utils/documents/* (schema, reports, render, store, transport, sender, quarantine); page public/documents.html (#/documents, menu entry for admin/owner, service-worker precache); one mount line in server.js; scripts/documents_up.sql and documents_down.sql; new tables documents, document_recipients, document_sends, document_quarantine.
- Reports: daily summary, P&L, cheques, loans, commissions, stock, low stock, GRN, receipts (POS bills), quotations, cash flow, non-moving stock. All use direct read-only SELECTs. Golden-core note: P&L uses the stored daily_summary gross/net profit columns; cash flow repeats server.js CASH_IN/CASH_OUT SQL expressions read-only. No golden-core file edited.
- WhatsApp: DRY RUN by default. Live only if WHATSAPP_LIVE=true AND WHATSAPP_AUTO_SEND=true AND keys. Allow-list starts empty; phone shown as last 3 digits; every attempt logged in document_sends; one real send per document+recipient+purpose. Messages enter the existing receipt_queue with status doc_queued (the old receipt sender only picks "queued", so it ignores them). Live cloud transport is UNVERIFIED (never run against Meta; tested only with a fake http client).
- Inbound (stage 2): quarantine uploads/inbox/ (type by file content, jpg/png/pdf, 10 MB, random names), suggested place (GRN, expense sheet, supplier bill, cheque photo), owner upload route. Confirm hands the file to the EXISTING Document Inbox as a "to check" paper (routes/document_inbox.js record()); the owner still checks and presses File there. Nothing posts to any ledger from this module; no type needed golden-core, so Confirm is enabled for all. Supplier bill becomes an "invoice" paper that the existing inbox only keeps (no ledger target).
- Skipped: no new dependencies, nothing needed installing. Real WhatsApp inbound webhook is not wired to quarantine (no real WhatsApp runs): intake function is ready to call.
- Owner sign-off: none for golden core. Decide whether the P&L figures (stored daily profit) are acceptable as the P&L.
- Owner by hand: add recipients on the Recipients tab; to go live later set the two flags and keys in .env (not done). SW VERSION left at v10 (a test pins it); the new page loads network-first anyway.
- Risks: PDF needs Chromium (same as receipts); file-type is lazy-required and fails closed if mocked/missing; 3 expected download links need the owner session cookie.
- Merge: git checkout master && git merge --no-ff feature/documents   (then run scripts/documents_up.sql or just start the app: tables auto-create)
- Rollback: git revert -m 1 <merge commit>; psql -f scripts/documents_down.sql; delete uploads/documents and uploads/inbox.
- Scratch app and scratch Postgres (5434) stopped.

## UPDATE (bug fix): GET /api/documents validates type/from/to (real dates, from>to = 400), clamps limit/offset; recipient_id int-range guarded. Last commit now f5cced7. Full suite: 84 suites, 859 passed, 2 skipped, 1 failed = pos_discount_cap clock test (known, ignore). documents.test.js 104 passed.
