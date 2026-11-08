# API top-10 check (AJ's list, 8 Nov 2026). Checked in the code, not guessed.
1 Frontend only: OK. Login gate runs on the server for every /api route (fixed the /API capital-letter bypass).
2 Access control: roles (owner/admin/staff/cashier) enforced by the global gate + cashier allow-list. Heads-up: owner role is full admin unless OWNER_READ_ONLY=true in .env.
3 Business logic: OPEN. POS trusts the price sent by the browser; bill edit can switch cash to credit with no debt; vendor bill edit ignores payments. (Fix queued.)
4 External APIs: OK. WhatsApp webhooks need the secret + phone id. Set WEBHOOK_SECRET in .env.
5 SSRF: none found. No route fetches a URL typed by a user.
6 Sensitive data: heads-up. Raw error text reaches the browser in many routes. /api/branding no longer shows db names. Backups now encrypted.
7 Input validation: SQL is parameterised (no string-built SQL found). Stored XSS in the cheque list: FIXED (fields escaped).
8 Rate limiting: OK. 300 requests / 15 min per address, 10 failed logins, 5 failed PIN or login-code tries. Fake X-Forwarded-For blocked.
9 API inventory: heads-up. 3 route files not mounted on purpose (2 are libraries, 1 is OFF). Old ecosystem.config.js names a second server: do not use.
10 Configuration: helmet on, cookie httpOnly + sameSite, CORS * only on 2 read-only public feeds, weak PINs refused. LOGIN_DISABLED now refuses to run in production.
