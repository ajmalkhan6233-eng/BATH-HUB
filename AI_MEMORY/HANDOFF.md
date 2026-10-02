# HANDOFF (2026-10-02)

- Owner server is LIVE ON THIS LAPTOP: pm2 app apex-server, port 3100, run from this folder (local_ops/ecosystem.local.config.js, gitignored). Always `pm2 ... --only apex-server`.
- DB: PostgreSQL 18 Windows service (5432), database bathco_owner, own user. Credentials only in .env + .pg_owner_superpw (both gitignored). Zero data; only structure rows (feature flags, agent rules, salary settings, chart of accounts).
- Aj has not yet created his owner login: /owner redirects to /setup.html until he does. ADMIN_PIN was shown to Aj once (not stored here).
- Backups: local_ops/backup_owner_db.ps1 (PG18 pg_dump) -> backups/, task Apex_Owner_DB_Backup daily 23:00, keeps 14. Logon start: task Apex_Owner_Server_Start (pm2 resurrect).
- bathco_test (port 5433, temp embedded process) was wiped 2026-10-02 with NO backup (pg_dump v16 mismatch); it is throwaway, rebuild via scripts/dev.
- Sidebar now links Investor Loans, Money Control, Sale Commissions, Settings. Bridge fix from investor branch merged.
- Tests: 17 failed / 1319 passed (baseline 17, not grown).
- Next: Aj restarts laptop -> check /health and /owner return by themselves; Aj completes setup wizard.
- UNVERIFIED: reboot survival, real WhatsApp send, website not online.
