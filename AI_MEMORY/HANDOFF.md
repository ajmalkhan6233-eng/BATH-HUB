# HANDOFF (2026-10-02, late): ONE APP v2

- Live: pm2 apex-server :3100 (always `--only apex-server`), PostgreSQL 18 service (localhost only), db bathco_owner. Secrets only in .env + .pg_owner_superpw (gitignored). Real data exists (users ajmal admin, jazeel staff): never wipe.
- `/` = Bath Hub, `/owner` = the one app. Old BATHCO_NATURE.html is archived (public/_archive) and its URL, /nature, /app, /dashboard.html redirect to /owner. All 10 legacy screens now live in /owner.
- Roles: `.env` OWNER_READ_ONLY=true makes the 'owner' role a read-only viewer (GET only). Admin = full. Tests force it off (tests/setup.js); tests/integration/security_gates.test.js covers it. Second login step re-checks disabled accounts.
- Voids: voided vendors/commissions are left out of lists and totals (utils/voids.js, record_voids table).
- Offline: no CDN anywhere (public/fonts, public/vendor/chart.umd.min.js); service worker v5 (precache all screens, last good API answers as "saved copy"); public/offline-queue.js (IndexedDB queue, UUID keys, temp bill numbers OFF-<device>-<n>, status chip) + routes/sync.js (sync_log, idempotency middleware, needs-review for offline edits/voids). Real test: server stopped, 4 writes queued, server back, all arrived once in order, OFF number mapped to the real one.
- Phase B (cloud copy) is design only: docs/SYNC_PHASE_B.md. Railway stays parked.
- Admin group in /owner: Users, Audit Log, Admin Settings, Edit & Void, System & Backups. Backups: daily 23:00 task (14 kept) + screen. Tags: pre-cleanup-2026-10-02, one-app-v1, one-app-v2.
- Tests: 67 suites, 545 pass, 1 skipped (E2E restore), 3 clean runs. Tests never touch a real DB (dead port).
- Test rig only (not the app): temp PG on 5433 (bathco_test, _a.._f), scratchpad scripts. After any setup-wizard test: `git checkout -- config/active.branding.json`.
- UNVERIFIED: service worker offline pages (the in-app browser refuses service workers; test on a phone/Chrome, see OPEN_ITEMS), pm2 reboot survival after these changes, WhatsApp, queued file uploads in a real browser (unit-tested only).
- 2026-10-03 branch feature/audit-high-fixes (NOT merged, not pushed): 4 commits after npm audit fix: shared pool utils/pool.js, phone-width CSS, PETTY_CASH_FLOAT warning + .env.example, encrypted backup copy + scripts/restore_encrypted_backup.js. Golden-core skipped: routes/audit.js, purchasing_accounting.js, staff_reports.js keep their own pools. Report: audit/AUDIT.md.
