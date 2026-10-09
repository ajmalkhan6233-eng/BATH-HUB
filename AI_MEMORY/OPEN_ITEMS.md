# OPEN_ITEMS

- Aj: 2-minute offline test on a phone/Chrome: open /owner on the Wi-Fi, use it once, turn the laptop server off (pm2 stop apex-server) or phone to airplane mode, reload /owner (page must still open), save a bill or vendor (chip says OFFLINE, bill gets OFF-xxxx-n), turn back on, chip goes ONLINE and the entry appears once
- Aj: decide small_daily (Rs 3,200 now, default 3,000: small daily shop costs in the daily cost target) -> change in Salary & Costs > Settings, or say "keep"
- Aj: save ADMIN_PIN + .pg_owner_superpw password in a password manager; laptop Sleep = Never when plugged in
- Aj: look at the 10 ported screens with real data (Customers, Credit & Aging, Quotations, Purchasing, Accounting, Audit & Accounting, Reports, Staff, Labels, Assistant); say what is missing before the old file is deleted from git
- Platform/tenant/fleet admin (old Platform Admin, PIN only) is not in the new menu: port or drop
- competitors table holds 13 default rows seeded by routes/competitors.js (not Aj's data): keep or clear
- Railway go-live (parked): CLAUDE.md task 1; scripts/railway_harden_db.js at unpause; Phase B = docs/SYNC_PHASE_B.md
- Native speaker check of Sinhala/Tamil website text; Royal Bath Hub public site still loads Google Fonts (owner app does not)
- Remote GitHub branches still exist (overnight, claude/*, octopus-memory): delete when Aj agrees
- Before shipping a client copy: exclude SESSION_LOG.md, AISTUDIO_HANDOFF/, CLAUDE.md, backups/, frontend/, local_ops/
- Aj (after merging feature/audit-high-fixes): add to .env: PETTY_CASH_FLOAT=25000, BACKUP_COPY_DIR=<folder>, BACKUP_PASSPHRASE=<8+ chars, also in password manager>; point the 23:00 backup task at scripts\backup_owner_db.ps1; run the restore test once: node scripts\restore_encrypted_backup.js <file.sql.enc>
- Aj: open /daily-entry-v2.html (ported from ROYAL BATH HUB ledger branch) with a fake date and check it saves and reloads; its Cheques tab is local-only on purpose. Decide: wire it to BATH-HUB's cheque register or drop that tab
- Aj: bring the cheque clearing calculator, bank-holiday list, Lasersoft PDF reader and cross-tenant leak test from the laptop (not in any GitHub repo)

- Aj (later): decide renaming BATHCO text in code (~121 files) and the GitHub repo name
- Research items NOT installed (approve one by one if wanted): Agent Skills (agentskills.io, anthropics/skills), awesome list (ComposioHQ, unvetted, reading only), image to code (Figma plugin, needs Figma seat)

- Bugs found by the sweep (offline review screen, /api/staff loans, dev schema drift, hyperspace-theme.js missing, vendor apostrophe, barcode menu, npm audit): see AI_MEMORY/BUG_LIST.md, Aj approves fixes
- Android/Play Store idea: PWA first, decide after the bug sweep. In-app editing agent: skipped for now (Claude Code is always connected)
- Aj: run /login once in Claude Code so claude-mem can process its queued memory