# JOB 1 report (branch feature/bugcheck)
- Built: `npm run bugcheck` (scripts/bugcheck.js + scripts/bugcheck_scratch.js): 67 named checks, builds its own scratch Postgres (port 5440) and app (3190) from the newest backup, never the real DB or the real app (refuses port 3100), real .env never loaded. `npm run bugcheck:static` = the 25 offline checks.
- Result on the final code: 67 checks, 64 pass, 0 fail, 1 known (negative stock = your decision), 2 skipped (25th-to-24th cycle has no code; backup-age check needs a backups folder).
- New bugs: audit\BUGS2.md (12 items). Fixed with tests: bad dates/numbers/ids reaching Postgres now answer 400 not 500 (utils/pgInputErrors.js, ONE mounted line in server.js); impossible dates like 2026-02-30 refused in 7 modules (utils/validate.js); flaky test pos_discount_cap fixed.
- Needs your sign-off (golden-core, not touched): B01 server.js:1246 "Mark cheque cleared" always 500 (remove `, updated_at = CURRENT_TIMESTAMP`); B05/B06/B07/B08 in BUGS2.md.
- Decision for you: B04 negative stock allowed; B10 is there a 25th-to-24th pay cycle?
- Risk: the 400-rewrite also applies to golden-core routes (response status only, no file edited): symptom fix of B05/B06.
