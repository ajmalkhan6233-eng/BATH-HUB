# OPEN_ITEMS

- Aj: 2-minute offline test on a phone/Chrome: open /owner on the Wi-Fi, use it once, turn the laptop server off (pm2 stop apex-server) or phone to airplane mode, reload /owner (page must still open), save a bill or vendor (chip says OFFLINE, bill gets OFF-xxxx-n), turn back on, chip goes ONLINE and the entry appears once
- Aj: decide small_daily (Rs 3,200 now, default 3,000: small daily shop costs in the daily cost target) -> change in Salary & Costs > Settings, or say "keep"
- Aj: save ADMIN_PIN + .pg_owner_superpw password in a password manager; laptop Sleep = Never when plugged in
- Aj: look at the 10 ported screens with real data (Customers, Credit & Aging, Quotations, Purchasing, Accounting, Audit & Accounting, Reports, Staff, Labels, Assistant); say what is missing before the old file is deleted from git
- Offline edits/voids wait in "needs review" (never auto-applied): there is no review screen yet (API: /api/sync/review); add a small screen
- /api/staff `outstanding`/`total_loans` count repayments as loans (server.js): fix with Aj's rule; the Staff screen's Advances tab computes it correctly
- dev schema (scripts/dev/test_schema.sql) misses columns the live code needs (quotations.quote_no is now auto-added at start-up): audit other tables before building another instance from it
- Platform/tenant/fleet admin (old Platform Admin, PIN only) is not in the new menu: port or drop
- competitors table holds 13 default rows seeded by routes/competitors.js (not Aj's data): keep or clear
- Railway go-live (parked): CLAUDE.md task 1; scripts/railway_harden_db.js at unpause; Phase B = docs/SYNC_PHASE_B.md
- Native speaker check of Sinhala/Tamil website text; Bath Hub public site still loads Google Fonts (owner app does not)
- Remote GitHub branches still exist (overnight, claude/*, octopus-memory): delete when Aj agrees
- Before shipping a client copy: exclude SESSION_LOG.md, AISTUDIO_HANDOFF/, CLAUDE.md, backups/, frontend/, local_ops/