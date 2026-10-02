# HANDOFF (2026-10-02, evening)

- Owner server LIVE on this laptop: pm2 apex-server :3100 (always `--only apex-server`). DB = PostgreSQL 18 service, db bathco_owner. Secrets only in .env + .pg_owner_superpw (gitignored). Zero data except structure rows.
- Aj has NOT yet created his owner login (/owner -> /setup.html). ADMIN_PIN was shown once in chat.
- DONE this round (pushed, master e2b218c): sidebar fits + scrolls, all 26 links open in-shell (tested 1366x768); POS bill correction (owner-only Void/Edit, history + voids tables, VOID excluded from totals; API 24/24 + UI checked).
- QUEUED (Aj approved, not started): Salary key-money/target 18,000 + dashboard savings card; verify Loans page; attachments widget (photo/upload/download, table attachments); OFFLINE mode (read docs OFFLINE_LEDGER_V2_RESUME.md first; queue + sync_log; Phase B doc only).
- Backups: local_ops/backup_owner_db.ps1, daily 23:00 task, keeps 14. Test instance (port 3199, DB bathco_test on 5433 temp process) is for testing only; it rewrites config/active.branding.json -> always `git checkout -- config/active.branding.json` after.
- Tests: top-level tests = only rotating flaky failures under load; whole-repo count 17-20 varies (worktree copies under .claude/ are counted too).
- UNVERIFIED: non-owner gets 403 on void/edit (code only), reboot survival of pm2 (screenshot showed resurrect worked), real WhatsApp.