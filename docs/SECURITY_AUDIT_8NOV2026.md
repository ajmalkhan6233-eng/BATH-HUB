# Security + safety audit, 8 Nov 2026 (read-only audit, then fixes on branch claude/layla-chat-8nov)
Method: 4 read-only reviewers (screens, vendors/GRN, POS/stock, server/security). Every item below was checked in code or by a small test. No real data touched.

## FIXED in this branch
- /API/... (capital letters) skipped the login gate (CRITICAL). Gate now lower-cases the path.
- Fake X-Forwarded-For let anyone dodge login limits (trust proxy now "loopback" only).
- 6-digit login code had no failed-try limit (now 5 per 15 min).
- Backup to GitHub sent .env, DB dump and data unencrypted (now AES-256-GCM; refuses to run without BACKUP_PASSPHRASE; old plain history squashed on first run).
- Restore on a new laptop decrypts and loads everything (scripts/pc/restore_from_backup.js, tested on a copy).
- autoUpdate did not restart the app after middleware/ or migrations/ changes (now does).
- Photos over ~750 KB failed to save (global 1 MB parser ran first). Fixed for GRN, item photo, Layla media, sync, setup.
- Item-code rename now follows into GRN lines (live + archive), names, with locks. Tested on a copy database.
- Dashboard hid held (postponed) cheques. Fixed.
- morningFix could renumber every item to TBD-n on a fresh PC. That step is switched off.
- LOGIN_DISABLED refuses to start in production. dbGuard also protects bathco_owner. /api/branding no longer shows db names. Public viewer-request form has length caps and a 50-open limit.
- /health/deep added (proves the database answers).

## OPEN (heads-up, none are internet-open doors)
HIGH
1. POS trusts unit_price from the browser (cashier can sell at 0). Fix: check against products.selling_price.
2. POS bill edit can switch cash to credit with no debt created. Fix: refuse, "void and re-enter".
3. Vendor bill edit/void ignores payments and cleared cheques; voided bills' cheques still count.
4. Owner role has full admin unless OWNER_READ_ONLY=true in .env (check the shop PC).
5. WEBHOOK_SECRET must be set in .env (otherwise fake WhatsApp messages from the same PC are accepted).
MEDIUM
6. Void leaves oversold rows and registered POS cheques open.
7. Void/edit use today's POS_DEDUCT_STOCK flag, not the flag at sale time.
8. 322 places return raw error text to the browser.
9. Uploads allow 200 MB per file; no type filter on daily upload (disk fill).
10. Auto-deploy has no health check or rollback.
11. xlsx 0.18.5 (no fix) and 24 npm audit items. Run npm audit fix on the PC.
12. Two cheque systems never reconcile. Cheque status can move backward.
LOW: GRN number uses COUNT+1, no duplicate-bill check, stored XSS in cheque_register notes, CSV formula injection, service worker keeps cached API answers after logout, session not regenerated on login, ecosystem.config.js names a second server (do not use), old watchdog file.

## Your PC (Windows 11)
Windows Defender Firewall is on by default and is enough. The app listens on 3100; only the Cloudflare tunnel should reach it from outside. Do not open port 3100 on the router. Floods are slowed by the app limits (300 requests per 15 min per address, 10 failed logins) and by Cloudflare in front.
