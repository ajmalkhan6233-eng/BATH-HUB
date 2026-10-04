# HANDOFF (2026-10-04, cloud session)

- Branches: `claude/gallant-brahmagupta-g6tamb` (pushed: BATHCO knowledge, 105 commands, 2 council skills, shop_config filled with the real shop, daily ledger page + sync route + test). `bathhub-merged-clean` (this one: same plus memory notes). master untouched.
- Verified: full Jest suite 103 suites / 1199 tests pass. Daily ledger page NOT checked in a browser.
- HELD BACK, not committed: `reference/bathco/` (141 files: old Python app, mobile app, scripts, old routes, schema) exists only in the cloud session's working copy. Reason: Bath Hub repo is PUBLIC, BATHCO is PRIVATE; safety check blocked publishing private code there. Aj must set Bath Hub to Private (GitHub > Settings > Danger Zone), then say "done"; then copy it, HANDOVER.md, SECURITY_LOG.md and the sales-history files (BATHCO_HISTORICAL_DATA, MASTER_LEDGER, DATA_INDEX.json), add `/reference/` to jest ignore, run tests, push.
- All commands: see AI_MEMORY/COMMANDS.md. All BATHCO rules: docs/bathhub_knowledge/README.md.
- Not found in any GitHub repo (laptop only): cheque clearing calculator + bank-holiday list, Lasersoft PDF reader, stock-count script, cross-tenant leak test, the ~2,600-item product list.
- Next session action: read OPEN_ITEMS, ask Aj which item, wait for GO.
