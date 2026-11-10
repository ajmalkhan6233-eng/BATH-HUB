# Gemini blueprint answer (10 Nov 2026): verdict per topic
General: sources were page names, not URLs; several numbers have no checkable source. Treat every price as UNSURE until read from the vendor's own page. Blueprint step 1 assumes a new build; we are not greenfield.

1 Offline PWA: idempotency key idea is right and we already use idempotency on money writes. Use for the till queue only after a test with 2 devices. KEEP (small).
2 Stock ledger: a stock_movements ledger plus a proof query is a good idea. Needs opening balances inserted first or the proof shows every item. Compare with utils/auditInvariants.js before adding a table. CHECK FIRST.
3 Bill photo: design right (human confirm beside the image). Prices unsourced: Gemini "$0.075 per million tokens" is not a per-bill cost. No Sinhala/Tamil handwriting accuracy given. DO: test 10 of AJ's real bills before choosing. Paid API needs AJ's OK.
4 Daily job: lock table is for several workers; we have one PC. Its "last_run < CURRENT_DATE" uses the database clock, not Sri Lanka date. Our utils/selfRun.js already does SL day, missed-run recovery and retries. DROP.
5 Hybrid AI: rule right (SQL for numbers, AI only for unstructured input, hard monthly cap). A spend table is needed for the cap. Paid API needs AJ's OK.
6 Alerts: "$0.002 per message" cites blogs (Unecast, Invent), not Meta. UNSURE. Read Meta's own rate card for Sri Lanka and the template category before any build. Template must be Meta-approved first.
7 Self-monitoring: /health and backups exist. Missing and worth building: a monthly restore test of the backup into a throwaway database.
8 Blueprint: ignore the order; our order is in docs/SELF_RUNNING_APP_PLAN_10NOV2026.md.
Gemini's 5 questions: bills per day, till devices (shared or separate), WhatsApp template status, receipt format. Host is the shop PC (pm2 apex-server).
