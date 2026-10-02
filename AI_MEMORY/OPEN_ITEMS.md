# OPEN_ITEMS

- Aj: save ADMIN_PIN + .pg_owner_superpw password in a password manager; laptop Sleep = Never when plugged in
- Offline mode (next build, lead only), then docs/SYNC_PHASE_B.md (design only; Railway stays parked until "go-live Railway")
- Port the Legacy screens into /owner, then delete public/BATHCO_NATURE.html: Customers, Credit & Aging, Quotations, Purchasing, Accounting, Audit & Accounting, Reports, Staff, Labels, Assistant
- Platform/tenant/fleet admin (old Platform Admin): hidden, PIN only, not in shop menu
- Reports and lists do not hide VOIDED vendors/commissions/etc. yet (only POS bills do): add record_voids joins
- A verify-totp step does not re-check users.active (login does): add check in server.js
- Salary settings endpoint also accepts the read-only 'owner' role: make it admin-only
- Sale commissions: commission % typed per sale; staff can be added/edited (Edit & Void) but pay rules live in Salary Settings
- sal_settings has small_daily=3200 copied from the test setup: confirm or change in Salary > Settings
- competitors table holds 13 default rows seeded by routes/competitors.js (not Aj's data): decide keep or clear
- Railway go-live (parked): see CLAUDE.md task 1; set real DASH_* creds; scripts/railway_harden_db.js at unpause
- Native speaker check of Sinhala/Tamil website text
- Remote GitHub branches still exist (overnight, claude/*, octopus-memory): delete when Aj agrees
- Before shipping a client copy: exclude SESSION_LOG.md, AISTUDIO_HANDOFF/, CLAUDE.md, backups/, frontend/, local_ops/