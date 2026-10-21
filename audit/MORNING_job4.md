job4 step0: plan written
job4 step a: transport done+tested (9 tests), committed
job4 step b1: store+migration done (11 tests)
job4 step c/e/g(part): lang+glossary+catalog+quote+docs adapter done and tested
job4 step c/d: phrases(5 styles)+intent done (73 tests)
job4 step b/d/e/f/g/i: engine, roles, staff cmds, pause, kill switch, honesty, quotation draft: 59 engine tests green
job4 resumed: 228 layla tests green, committed; next: quality set
## JOB 4 FINAL REPORT (LAYLA v2 for WhatsApp)
- Branch feature/layla-v2, last commit 25df3d3. Only NEW files (layla_v2/, tests, audit docs). No edit to server.js, layla.js, scripts/layla_answer_engine.js. No scratch Postgres/app used (pg-mem only), nothing to stop.
- Tests: LAYLA 10 suites / 231 tests green. FULL suite: 93 suites, 986 passed, 2 skipped, 1 FAILED = tests/integration/pos_discount_cap.test.js "lists today's bills (Colombo date)". Not touched by this branch (date/timezone sensitive, ran at the midnight date change); NOT verified on master. Status: READY except that unrelated date-flaky test; re-run it after the date settles.
- Done: a transport (dry run default, simulator, Cloud API adapter behind WHATSAPP_LIVE + keys, media upload, fake-fetch tests); b roles via layla_contacts (empty), documents_adapter.js (stub + simulated); c five language styles + glossary.json; d human style (split 2-3, delay 1-4s, 0 in tests, name, last 20 msgs, emoji mirroring, no repeats); e truth rules + guard.js + layla_tasks; f honesty; g quotation helper (drafts in layla_tasks, never sent); h 200 conversations, 200/200 (safety 125/125) but in-distribution: see audit/LAYLA_REPORT.md; i pause/resume LAYLA + LAYLA_V2_DISABLED.
- Mounted nowhere. Optional route layla_v2/route.js (LAYLA_V2_ENABLED=true, needs WHATSAPP_APP_SECRET, signed requests only).
- Skipped: real AI model (hook exists, guarded), voice/photo reading, price unit (no column), Sinhala "other customers' numbers" probe still goes to "let me check".
- Owner sign-off/hand-done: run layla_v2/migrations/001_layla_v2.sql; add owner/staff numbers to layla_contacts; Meta approved message template for contacting customers outside 24h; set WHATSAPP_LIVE/keys/APP_SECRET/VERIFY_TOKEN; ONE mount line in server.js; native Sinhala/Tamil review of phrases.js, glossary.json.
- After feature/documents merges: implement createDocumentsAdapter({pool}) in layla_v2/documents_adapter.js and pass as `documents` to createDeps.
- Risks: conversation notes (pending quote offer) are in memory (lost on restart); rule brain will miss unseen phrasing (fails safe to "let me check" + task); the owner phone is trusted by number (signature check protects the webhook).
- Merge: git checkout master && git merge feature/layla-v2. Rollback: git revert -m 1 <merge>; DB: run layla_v2/migrations/001_layla_v2_down.sql.
- UPDATE: CRLF fix in store_pg.js (split(/\r?\n/)); LAYLA tests 231/231 green also with all layla_v2 sources, migration and glossary converted to CRLF. Last commit now 12f3eda.
