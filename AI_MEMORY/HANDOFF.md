# HANDOFF (2026-10-02, night): ONE APP v1

- Live on this laptop: pm2 apex-server :3100 (always `--only apex-server`), PostgreSQL 18 service (localhost only), db bathco_owner. Secrets only in .env + .pg_owner_superpw (gitignored).
- `/` = Bath Hub site, `/owner` = the one owner app (hash routes #/page, phone bottom menu). /nature, /app redirect to /owner; standalone pages (pos, loans, money control, commissions, settings, cheque register) redirect into /owner.
- Aj created his admin (ajmal) + staff (jazeel). Real data has started: do NOT wipe.
- NEW admin group in /owner (admin only): Users, Audit Log, Admin Settings (shop, target, WhatsApp draft-only switch, feature flags, menu hide/order), Edit & Void, System & Backups (backup now/list/download, RESTORE = type RESTORE + PIN + auto safety backup).
- Also done: POS Void/Edit, Salary dashboard card + key money (Rs 500,000 paid, separate), attachments widget on every screen, shared utils/adminAudit.js (admin_audit table).
- Legacy: public/BATHCO_NATURE.html kept, opened inside /owner as "Legacy screens", until these are ported: Customers, Credit & Aging, Quotations, Purchasing, Accounting, Audit & Accounting, Reports, Staff, Labels, Assistant, old Platform Admin (tenants/fleet, PIN only).
- Backups: daily 23:00 task (14 kept) + Admin > System & Backups. Safety set: git tag pre-cleanup-2026-10-02, tag one-app-v1, backups\pre-cleanup.sql, backups\pre-cleanup-folder.zip.
- Tests: 60 suites, 487 pass, 1 skipped (E2E restore, needs E2E_RESTORE=1), 0 failures. Tests can no longer touch a real DB (tests/setup.js dead port).
- Test rig (not part of the app): temp PG on 5433 (bathco_test, bathco_test_a..f) + scratchpad scripts; always `git checkout -- config/active.branding.json` after any setup-wizard test.
- NEXT: OFFLINE MODE (spec in Aj's brief): offline-queue.js, routes/sync.js + sync_log, local fonts/vendor scripts (shell still loads Google Fonts + chart.js from CDN), service worker precache, status chip. Phase B doc docs/SYNC_PHASE_B.md. Lead does it alone.
- UNVERIFIED: reboot survival of pm2 after these changes, WhatsApp, real restore on the live DB (by design never tested).