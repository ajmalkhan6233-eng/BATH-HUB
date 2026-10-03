# Hardening review of new code (JOB 5, 2026-10-04)

Scope: code added in the last few days. Severity: H = fix before real use, M = fix soon, L = nice to have.
"Fixed" = fixed on branch `feature/hardening` (file is on master). "NEEDS <branch>" = the owning branch must apply it.
Verified with Chromium: CSP computed from the real page gives 0 violations on master's `/site`.

## A. Files on master (checked, fixed where listed)

### routes/site_editor.js
- Path traversal: photo file name checked with `^[a-f0-9]{24}\.(webp|jpg)$` before every `sendFile`/`unlink`. OK. (L) Could use `safeJoin` as a second wall: one line, not needed.
- MIME sniffing: upload type decided by file-type, re-encoded to webp by Chromium (strips hidden data). OK.
- Size: multer 5 MB, 1 file. OK. JSON body 1 MB global.
- (M) Public `/api/site/public` and `/api/site/photo/*` had no per-IP limit. FIXED: `publicApiLimiter` / `publicFileLimiter` mounted in server.js.
- (L) Several owner routes return `e.message` on 500 (can show DB wording to the owner only). Fix: return a fixed text like documents.js does. Not changed (owner-only).
- Auth: every edit route has `ownerOnly`. Public read returns only whitelisted fields. OK.

### utils/siteImage.js
- (M) Launches a whole Chromium per upload (queued, one at a time). Owner-only and 5 MB, so risk is low; a decompression-bomb image (small file, huge pixels) can make Chromium use lots of memory. Fix: read width/height from the header first and refuse above ~40 megapixels. NOT done (needs header parsing).

### routes/sync.js
- (M) Idempotency waits up to 5 s per duplicate key, polling every 100 ms: many duplicate requests = many pollers. Fix: cap concurrent waiters (e.g. 20), then answer 409 at once. Not changed (touches sync behaviour).
- (M) `/api/sync/needs-review` stores the whole `body` JSON in a JSONB column. Fix: cap stored body at 64 KB. Not changed.
- (L) `express.json({limit:'5mb'})` inside the router is bigger than the global 1 MB; the global parser runs first, so 5 MB is never reached. Lower to 1 MB.
- (L) Errors returned with `e.message` (admin only).
- No secrets or phone numbers logged. Auth: `adminOnly` on all routes. Keys must be UUID. OK.
- The JSON depth guard now also covers `/api/sync` (server.js mount).

### utils/backupCrypto.js, scripts/backup_encrypt.js, scripts/restore_encrypted_backup.js
- Crypto: AES-256-GCM, scrypt key, random salt/iv, tag checked. Passphrase never logged. OK.
- (M) `encryptFile` writes with `out.write` without honouring back-pressure: fine for dumps of tens of MB; memory grows for huge ones. Fix: `stream.pipeline`. Not changed.
- (L) scrypt N=16384 is the minimum sane value; a higher N needs the header to store N so old backups still open. Leave. Passphrase minimum 8: raise to 12.
- `restore_encrypted_backup.js`: throwaway DB name checked by strict regex before it goes into SQL; refuses the real DB name; `execFileSync` with argument arrays (no shell); PGPASSWORD only in the child env. OK.
- (L) Decrypted temp dump sits in the OS temp folder until deleted (deleted in `finally`).

### utils/pool.js
- (L) No `connectionTimeoutMillis`/`statement_timeout`: a stuck query can hold a connection forever. Fix: `connectionTimeoutMillis: 10000, statement_timeout: 30000`. Not changed (a 30 s cap could cut long reports: owner decision).
- (L) No `pool.on('error')` handler: an idle-client error can crash the process. Fix: `pool.on('error', e => console.error('[pool]', e.message))`. Not applied because the file is shared by every module; ask owner.

### utils/startupChecks.js
- Prints warnings only, never values. No findings.

## B. Hardening module added (this branch)
`utils/hardening/*`: rateLimits, guards, safePath, sniff, redact, csp, index. 64 tests (unit and integration) including a real-browser CSP test.
Real bug found by the browser test and fixed: the browser hashes inline blocks after turning CRLF into LF, so hashes must be taken on normalised text (the page file has CRLF).

## C. Branch `feature/documents` (routes/documents.js, utils/documents/*) at 2c7c358
Overall solid: owner-only, random file names, strict stored-path regex, content sniff, quarantine, allow-list, dry run, last-3-digits logging.
Apply on `feature/documents`:
1. (M) `POST /documents/generate` launches Chromium and runs report queries with no rate limit and a free date range. Add `require('../utils/hardening').strictLimiter()` on that route and cap the range (e.g. 366 days) in `parseRange`.
2. (M) `POST /documents/:id/send` and `/inbox/upload`: add `strictLimiter()` (owner-only, but a stolen session could spam WhatsApp sends once live).
3. (L) `utils/documents/quarantine.js` has its own `detectType`; replace with `hardening.sniffAllowed(buf, ['image/jpeg','image/png','application/pdf'])` so there is one place to fix.
4. (L) `inbox/:id/file` is served with `Content-Security-Policy: sandbox` and as attachment (inline for images only): good.
5. (L) `console.error('[documents] ...', e.message)` may contain DB text; use `createLogger('[documents]')`. Phone numbers are already last-3 only.
6. (L) Quarantine dedupe by sha256 is check-then-insert (race): add a partial unique index on `(sha256) WHERE status='quarantined'` in `documents_up.sql`.
7. `render.js` uses `esc()` on all report values, footer and title: no injection found.

## D. Branch `feature/layla-v2` (layla_v2/*) at 25df3d3
Good: dry-run default, 3 gates for live sending, masked logging, HMAC signature check with timing-safe compare, guard on customer replies.
Apply on `feature/layla-v2`:
1. (H, before mounting) `route.js` uses `express.json({verify})` to keep the raw body, but server.js runs `bodyParser.json` first for every request, so `req.rawBody` is empty and every real webhook gets 401 (fails closed, but never works). Mount it BEFORE the global parsers, or keep the raw body for `/layla-v2/webhook` in the global parser. Also the login gate in server.js answers 401 to `/layla-v2/webhook` unless the path is added to its bypass list (it only bypasses `/webhook/`). The one-line mount in the file header is not enough on its own.
2. (M) `GET /webhook` compares the verify token with `===`: use `crypto.timingSafeEqual`. Put `hardening.publicApiLimiter({ windowMs: 60000, limit: 120 })` in front of `/layla-v2` (unsigned requests cost an HMAC each).
3. (M) The background `chain` is an unbounded promise queue: cap its length (e.g. 200) and drop extra messages with a log line.
4. (L) The `seen` message-id set is in memory only (lost on restart, so a Meta retry can be handled twice). Store handled ids in a table with a unique key.
5. (L) `transport.js` cloud API errors include Meta's message cut to 120 chars, never the token: good. Text cut at 4000: good.
6. (L) `store_pg.js` runs the migration by splitting on `;` (breaks if a statement ever has `;` inside a string). Fine now.
7. (L) `lang.js` / `guard.js` regexes are linear (Set lookups, no nested quantifiers): no ReDoS found. Cap incoming text to 2000 characters at the start of `handleIncoming`.

## E. Branch `feature/website-v4` (routes/site_catalogue.js, public/website/index.html) at 366d1cc
Apply on `feature/website-v4`:
1. (H for CSP) `public/website/index.html` has an inline event handler on the Google Fonts link (`onload="this.media='all'"`). Under the new CSP the browser blocks it (1 violation seen in Chromium) and the fonts never switch on. Fix: use a plain `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?...">` (keep the preconnects), or add one line to the existing inline script: `document.querySelectorAll('link[media=print]').forEach(l=>l.media='all')`. Nothing else is blocked: the hash approach covers the v4 page (script and style hashed from the served file).
2. (M) `/api/site/catalogue.pdf` starts Chromium on a cache miss; limiter is 20 per 10 min per IP. Risk low (cache keyed on the visible tiles). (L) Swap its own `rateLimit` for `hardening.strictLimiter({ skipPrivate: true })` for one style.
3. (M) The `app.use(require('./routes/site_catalogue'))` mount defines its own `/site` handler; the hardening header middleware is mounted earlier in server.js, so headers still apply. Re-run `tests/integration/hardening_wiring.test.js` after merging both branches.
4. (L) `originFor(req)` trusts the `Host` header for robots/sitemap when SITE_URL is unset (checked to host characters only). Set SITE_URL in production.
5. (L) `catalogueHtml` escapes text; photo names checked with FILE_RE: OK.
6. Merge note: both branches edit server.js near the `/site` line (different lines; should merge cleanly).

## F. Not changed
- The owner app keeps helmet's CSP off (inline scripts everywhere); only the public site has a CSP.
- Golden-core files untouched. Login (10 failed per 15 min) and PIN (5 failed) limits already exist; tests added to prove them, nothing duplicated.
