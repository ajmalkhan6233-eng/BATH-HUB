require('dotenv').config();
require('./utils/timezone');   // Sri Lanka time for JS dates and Postgres sessions
require('./utils/startupChecks').run();   // prints warnings for PETTY_CASH_FLOAT / backup-copy settings that are missing
const { todayLK } = require('./utils/lkTime');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bodyParser = require('body-parser');
const path = require('path');
const { execFile } = require('child_process');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const XLSX = require('xlsx');
const { fromBuffer: fileTypeFromBuffer } = require('file-type');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const axios = require('axios');
const { processMessage, alertOwner, getOrCreateCustomer, pool } = require('./layla');
const { ensureVoids, notVoided } = require('./utils/voids');
const { registerLogin } = require('./utils/sessionCap');
const { runCheck: runReconCheck } = require('./scripts/daily_reconciliation_check');

// Idempotent schema migrations
// NOTE: these silently no-op via .catch(()=>{}) if the pool's connected role
// isn't the table owner - if you rotate to a least-privilege DB role, move
// table ownership (or ALTER privileges) with it, otherwise every line below
// fails invisibly.
pool.query(`ALTER TABLE cheques ADD COLUMN IF NOT EXISTS payee VARCHAR(150)`).catch(()=>{});
pool.query(`ALTER TABLE feature_flags ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`).catch(()=>{});
pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS quote_no VARCHAR(20)`).catch(()=>{});
pool.query(`ALTER TABLE daily_summary ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb`).catch(()=>{});
pool.query(`ALTER TABLE daily_summary ADD COLUMN IF NOT EXISTS cheq_payment NUMERIC(14,2) DEFAULT 0`).catch(()=>{});
pool.query(`ALTER TABLE daily_summary ADD COLUMN IF NOT EXISTS photo_data JSONB DEFAULT NULL`).catch(()=>{});
pool.query(`ALTER TABLE daily_summary ADD COLUMN IF NOT EXISTS cash_received NUMERIC(14,2) DEFAULT 0`).catch(()=>{});
pool.query(`ALTER TABLE grn_records ADD COLUMN IF NOT EXISTS caveat_flag BOOLEAN DEFAULT false`).catch(()=>{});
pool.query(`ALTER TABLE grn_records ADD COLUMN IF NOT EXISTS caveat_note TEXT`).catch(()=>{});
pool.query(`ALTER TABLE daily_summary ADD COLUMN IF NOT EXISTS sales_source VARCHAR(30) DEFAULT 'unknown'`).catch(()=>{});
pool.query(`ALTER TABLE daily_summary ADD COLUMN IF NOT EXISTS expenses_source VARCHAR(30) DEFAULT 'unknown'`).catch(()=>{});
pool.query(`ALTER TABLE daily_summary ADD COLUMN IF NOT EXISTS sales_conflict BOOLEAN DEFAULT FALSE`).catch(()=>{});
pool.query(`ALTER TABLE daily_summary ADD COLUMN IF NOT EXISTS sales_conflict_excel NUMERIC(14,2) DEFAULT NULL`).catch(()=>{});
pool.query(`ALTER TABLE daily_summary ADD COLUMN IF NOT EXISTS manual_sale_total NUMERIC(14,2) DEFAULT NULL`).catch(()=>{});
pool.query(`ALTER TABLE daily_summary ADD COLUMN IF NOT EXISTS manual_gp_estimate NUMERIC(14,2) DEFAULT NULL`).catch(()=>{});
pool.query(`ALTER TABLE daily_summary ADD COLUMN IF NOT EXISTS gp_blend_note TEXT DEFAULT NULL`).catch(()=>{});
pool.query(`ALTER TABLE daily_summary ADD COLUMN IF NOT EXISTS override_log JSONB DEFAULT '[]'::jsonb`).catch(()=>{});
pool.query(`CREATE TABLE IF NOT EXISTS grn_records (
    id               SERIAL PRIMARY KEY,
    grn_number       VARCHAR(100),
    supplier_id      INT,
    supplier_name    VARCHAR(200),
    grn_date         DATE,
    item_description TEXT,
    quantity         NUMERIC(12,3),
    unit_cost        NUMERIC(12,2),
    total_amount     NUMERIC(14,2),
    source_file_path TEXT,
    status           VARCHAR(20) DEFAULT 'PENDING_REVIEW',
    ocr_raw          JSONB,
    notes            TEXT,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`).catch(()=>{});

// ─── FILE UPLOAD (local storage) ─────────────────────────────────────────────
const UPLOAD_DIR         = path.join(__dirname, 'uploads');
const PENDING_REVIEW_DIR = path.join(UPLOAD_DIR, '_pending_review');
if (!fs.existsSync(UPLOAD_DIR))         fs.mkdirSync(UPLOAD_DIR,         { recursive: true });
if (!fs.existsSync(PENDING_REVIEW_DIR)) fs.mkdirSync(PENDING_REVIEW_DIR, { recursive: true });

// Delete uploads/_pending_review files older than 48 h (runs once on startup)
;(function cleanupPendingReview() {
    const cutoff = Date.now() - 48 * 60 * 60 * 1000;
    try {
        fs.readdirSync(PENDING_REVIEW_DIR).forEach(f => {
            const fp = path.join(PENDING_REVIEW_DIR, f);
            try { if (fs.statSync(fp).mtimeMs < cutoff) fs.unlinkSync(fp); } catch {}
        });
    } catch {}
})();

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
        const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, `${Date.now()}-${safe}`);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 200 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (/\.(jpg|jpeg|png|xlsx|xls|pdf|zip)$/i.test(file.originalname)) cb(null, true);
        else cb(new Error('Only .jpg .jpeg .png .xlsx .xls .pdf .zip files are allowed'));
    }
});

const ALLOWED_MIME_EXTS = new Set(['jpg','jpeg','png','xlsx','xls','pdf','zip']);
async function validateMimeType(file) {
    try {
        const buf = fs.readFileSync(file.path);
        const type = await fileTypeFromBuffer(buf);
        if (!type || !ALLOWED_MIME_EXTS.has(type.ext)) {
            fs.unlinkSync(file.path);
            return `File content does not match an allowed type (got: ${type?.mime || 'unknown'})`;
        }
        return null;
    } catch (e) {
        try { fs.unlinkSync(file.path); } catch {}
        return `MIME check failed: ${e.message}`;
    }
}

// Return DATE columns as plain 'YYYY-MM-DD' strings instead of JS Date objects
// (avoids UTC-offset day-shift when JSON-serialized in a UTC+5:30 server timezone)
const { types: pgTypes } = require('pg');
pgTypes.setTypeParser(1082, val => val);

const app = express();
const PORT = process.env.PORT || 3000;

// Must be first — bypasses all middleware so Railway's health probe always gets 200
app.get('/health', (req, res) => res.json({ ok: true }));

// ─── SESSION-BASED LOGIN (per-user accounts, role-based access) ───────────────
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const bcrypt = require('bcryptjs');

if (!process.env.SESSION_SECRET) {
    console.error('[FATAL] SESSION_SECRET env var is not set — server cannot start');
    process.exit(1);
}
// Production deployments must never ship the 0000 placeholder PIN — the Admin
// tab (and the apex Platform Admin page) sit behind it. Local dev keeps 0000.
if (process.env.NODE_ENV === 'production' && (!process.env.ADMIN_PIN || process.env.ADMIN_PIN === '0000')) {
    console.error('[FATAL] ADMIN_PIN is unset or still the 0000 placeholder — set a real PIN before deploying to production.');
    process.exit(1);
}

// Trusts ngrok's X-Forwarded-Proto so cookie.secure:'auto' below marks the
// session cookie HTTPS-only when reached via the ngrok tunnel, while still
// allowing plain http://localhost access for local dev.
app.set('trust proxy', 1);

// ─── SECURITY HARDENING ───────────────────────────────────────────────────────
// CSP intentionally left off: BATHCO_NATURE.html and dashboard.html rely on
// large inline <script>/<style> blocks throughout (no build step) — a default
// or strict CSP would break the live app. The rest of helmet's headers
// (X-Frame-Options, X-Content-Type-Options, HSTS, Referrer-Policy, etc.) are
// same-origin/heuristic and safe to enable as-is. Tightening CSP to nonces
// would require rewriting every inline script/style — out of scope here.
// HARDENING (utils/hardening): everything logged has phone numbers cut to the last 3 digits and tokens/keys/passwords removed. HARDENING_LOG_REDACT=off disables.
require('./utils/hardening').installConsoleRedaction();
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

// 100 requests / 15 min / IP across the whole app.
// /health is registered above this and returns before middleware runs, so
// Railway's health probe is unaffected.
app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests — please try again later.' },
    // Loopback traffic (local testing, health/monitoring tools running on this
    // box) is exempt - an external attacker cannot spoof a 127.0.0.1/::1
    // source, so this doesn't weaken what the limit is actually for (the
    // public ngrok/Railway-facing surface). Added after local automated test
    // traffic tripped the limit.
    // 2026-10-02: a phone on the shop Wi-Fi loads dozens of files and screens per visit and was locked out (429 on everything,
    // login included). Devices on the shop's own network (private addresses) are not counted, and neither are plain
    // files (scripts, styles, fonts, pages). Public addresses (e.g. through a tunnel) are still limited, per API call.
    // The failed-login (10) and PIN (5) limits below are NOT affected.
    skip: (req) => /^(::ffff:)?(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(req.ip || '') || req.ip === '::1' || /^fe80:/i.test(req.ip || '')
        || (req.method === 'GET' && !req.path.startsWith('/api/')),
}));

app.use(session({
    store: new PgSession({ pool, tableName: 'session' }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, secure: 'auto', maxAge: 12 * 60 * 60 * 1000 },
}));

// Brute-force limits on the two guessable secrets (password, 4-digit admin PIN). Only FAILED
// attempts count; a correct login/PIN does not use up the allowance. Loopback is not exempt here.
const failedAuthLimiter = (max) => rateLimit({
    windowMs: 15 * 60 * 1000, limit: max, skipSuccessfulRequests: true,
    standardHeaders: true, legacyHeaders: false,
    message: { error: 'Too many failed attempts — please wait 15 minutes and try again.' },
});
app.use('/api/login', failedAuthLimiter(10));
app.use('/api/admin/verify', failedAuthLimiter(5));
// HARDENING: per-IP limits on the public website API (shop-network devices are not counted) + strict security headers (CSP with hashes) on the public site.
app.use('/api/site/public', require('./utils/hardening').publicApiLimiter({ skipPrivate: true }));
app.use('/api/public/catalogue', require('./utils/hardening').publicApiLimiter({ skipPrivate: true }));
app.use('/api/site/photo', require('./utils/hardening').publicFileLimiter({ skipPrivate: true }));
app.use(['/site', '/api/site'], require('./utils/hardening').siteSecurityHeaders());

app.use(bodyParser.json({ limit: '1mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '1mb' }));
app.use(require('./utils/pgInputErrors'));   // bad dates/numbers/ids that reach Postgres answer 400 with a plain message instead of 500 (bugcheck)
app.use(['/api/public', '/api/site', '/api/sync'], require('./utils/hardening').jsonDepthGuard());   // HARDENING: refuse absurdly nested/huge JSON on public + sync endpoints

// APEX tenant-status gate (control plane). No-op unless
// APEX_ENFORCE_TENANT_STATUS=true in .env — see middleware/tenantStatusMiddleware.js.
app.use(require('./middleware/tenantStatusMiddleware'));

// ─── AUTH + ROLE-BASED AUTHORIZATION ──────────────────────────────────────────
// DB enum (user_role) uses admin/owner/staff. These map 1:1 onto the
// PHASE 2 role spec admin / uncle_readonly / staff — 'owner' IS
// uncle_readonly (an investor, view-only). No new accounts
// needed; 'uncle' (role='owner') and the 9 staff accounts already exist
// (see scripts/seed_accounts.js).
// admin  : full access
// owner  : same access as admin in this white-label template (the read-only
//          'uncle_readonly' role belonged to the original live system)
// staff  : only their own /api/staff/:id/salary and /api/staff/:id/loans
const STAFF_OWN_DATA = /^\/api\/staff\/(\d+)\/(salary|loans)$/;

// ─── LOGIN BYPASS (owner-requested, reversible, env-gated) ────────────────────
// Set LOGIN_DISABLED=true in .env (local only — .env is gitignored, never
// committed/deployed by this flag) to skip the login screen entirely: every
// request is auto-authenticated as the first admin user, "until further
// notice." To restore normal login, remove the var or set it to false — no
// code needs to change back. This does NOT touch the auth code itself
// (login/logout/RBAC all still work if someone hits them directly).
const LOGIN_DISABLED = process.env.LOGIN_DISABLED === 'true';
let _bypassUserCache = null;
async function getBypassUser() {
    if (_bypassUserCache) return _bypassUserCache;
    try {
        const r = await pool.query(`SELECT id, username, name, role, staff_id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1`);
        _bypassUserCache = r.rows[0] || null;
    } catch (e) { _bypassUserCache = null; }
    return _bypassUserCache;
}

app.use(async (req, res, next) => {
    if (req.path.startsWith('/webhook/')) return next();
    if (req.path === '/api/login') return next();
    if (req.path === '/api/auth/verify-totp') return next();
    if (req.path.startsWith('/api/setup/')) return next(); // first-run wizard (self-locks once an admin exists)
    if (req.path === '/api/branding') return next();       // branding is public chrome (name/logo/colors)
    if (req.path === '/api/money-control/viewer-requests' && req.method === 'POST') return next(); // investor/friend has no login — public request-access form
    if (req.method === 'POST' && req.path === '/api/public/enquiry') return next();                // website enquiry form: add-only, rate-limited (routes/enquiries.js)
    if (req.method === 'GET' && req.path === '/api/public/catalogue') return next();                // M5 website feed: whitelisted fields only (routes/catalogue_feed.js)
if (req.method === 'GET' && (req.path === '/api/site/public' || /^\/api\/site\/photo\/[a-f0-9]{24}\.(webp|jpg)$/.test(req.path))) return next();   // website editor: public read-only feed + tile photos
    if (req.method === 'GET' && req.path === '/api/site/catalogue.pdf') return next();                 // website: public catalogue PDF (routes/site_catalogue.js), visible tiles only, rate-limited
    if (req.method === 'GET' && req.path.startsWith('/api/item-photos/')) return next();            // product photos shown on the public website (random file names)
    if (req.path === '/api/money-control/viewer-dashboard') return next();                        // investor/friend's token-gated limited view — no login either

    if (LOGIN_DISABLED && !req.session.user) {
        const bypassUser = await getBypassUser();
        if (bypassUser) req.session.user = bypassUser;
    }

    const user = req.session.user;
    const isApi = req.path.startsWith('/api/');

    if (!user) {
        if (isApi) return res.status(401).json({ error: 'Not logged in' });
        return next(); // serve dashboard shell; frontend shows login screen on 401 from /api/me
    }

    // OWNER_READ_ONLY=true (this shop's .env): the 'owner' role is a read-only viewer. It may read everything but change nothing.
    // Off by default, because the white-label template gives 'owner' the same rights as 'admin'.
    if (user.role === 'owner' && String(process.env.OWNER_READ_ONLY).toLowerCase() === 'true') {
        const readOnlyOk = req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS'
            || req.path === '/api/logout' || req.path === '/api/dashboard-assistant/chat' || (req.method === 'POST' && req.path === '/api/assistant/chat');
        if (!readOnlyOk) return res.status(403).json({ error: 'This account is read-only.' });
    }
    if (user.role === 'admin' || user.role === 'owner') return next();

    if (user.role === 'staff') {
        if (!isApi) return next();
        if (req.path === '/api/me' || req.path === '/api/logout') return next();
        const m = req.path.match(STAFF_OWN_DATA);
        if (req.method === 'GET' && m && Number(m[1]) === user.staff_id) return next();
        return res.status(403).json({ error: 'Forbidden' });
    }

    return res.status(403).json({ error: 'Forbidden' });
});

// ─── DATA TIER CLASSIFICATION (Phase 1 Final — period segregation) ────────────
// Per-day tier, computed from what's actually in daily_summary (not assumed
// from calendar date ranges).
//   FULL       — real POS GP (gp_status='ACTUAL') + real expense breakdown
//                 -> sales, GP, expenses, NET PROFIT all trustworthy
//   CASHFLOW   — Excel payment-method split present (cash/card/online/credit>0)
//                 but GP missing/estimate -> revenue + cash movement only, no NP
//   FOUNDATION — neither of the above -> only the total_sale figure is known
const TIER_EXPR = `CASE
    WHEN gp_status IN ('ACTUAL','BLENDED','ESTIMATE') AND total_expenses>0 THEN 'FULL'
    WHEN (cash_sale+card_sale+online_sale+credit_sale)>0 THEN 'CASHFLOW'
    ELSE 'FOUNDATION'
  END`;
// Cash flow: works for every tier because total_sale (Excel) is always present.
// cash_in falls back to total_sale when no payment-method split exists yet.
const CASH_IN_EXPR  = `CASE WHEN (cash_sale+card_sale+online_sale+credit_sale)>0
    THEN (cash_sale+card_sale+online_sale+credit_sale) ELSE total_sale END`;
const CASH_OUT_EXPR = `(total_expenses+payments+salary+cash_out-COALESCE(cash_received,0))`;

app.get(['/BATHCO_NATURE.html', '/dashboard.html'], (req, res) => res.redirect(302, '/owner'));   // the old owner app is retired (public/_archive)
// Public website: no login, no owner data, no link to the owner app. Its only data comes from GET /api/site/public.
app.use(require('./routes/site_catalogue'));   // website extras: /robots.txt, /sitemap.xml, /site with absolute links when SITE_URL is set, /api/site/catalogue.pdf (public)
app.get('/site', (req, res) => res.sendFile('public/website/index.html', { root: __dirname }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── LOGIN / LOGOUT / SESSION ─────────────────────────────────────────────────
const logLoginAttempt = (username, success, ip, reason) =>
    pool.query('INSERT INTO login_audit(username,success,ip,reason) VALUES($1,$2,$3,$4)',
               [username, success, ip || null, reason || null]).catch(() => {});

app.post('/api/login', async (req, res) => {
    const { username, password, remember } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    try {
        const r = await pool.query('SELECT * FROM users WHERE username=$1', [username || '']);
        const user = r.rows[0];
        if (!user || !(await bcrypt.compare(password || '', user.password_hash))) {
            logLoginAttempt(username || '?', false, ip, 'bad_credentials');
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        // A disabled account (users.active = false) must not get in, even with the right password.
        if (user.active === false) {
            logLoginAttempt(username, false, ip, 'account_disabled');
            return res.status(403).json({ error: 'This account has been disabled' });
        }
        // "Remember this device" — extends the session cookie from 12h to 1 year on
        // THIS browser only (still an httpOnly signed cookie). A different browser/
        // device with no cookie still needs the real password; this is not a
        // password-less/no-auth mode for the app.
        if (remember) req.session.cookie.maxAge = 365 * 24 * 60 * 60 * 1000;
        if (user.totp_enabled) {
            req.session.partial_auth = { id: user.id, username: user.username, name: user.name, role: user.role, staff_id: user.staff_id };
            logLoginAttempt(username, false, ip, 'totp_pending');
            return res.json({ ok: true, needs_totp: true });
        }
        req.session.user = { id: user.id, username: user.username, name: user.name, role: user.role, staff_id: user.staff_id };
        await registerLogin(req, pool, user.id);           // several devices at once: keep the newest 5, quietly drop older ones
        logLoginAttempt(username, true, ip, null);
        res.json({ ok: true, user: req.session.user });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/verify-totp', async (req, res) => {
    const { code } = req.body || {};
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const pa = req.session.partial_auth;
    if (!pa) return res.status(401).json({ error: 'No pending authentication' });
    try {
        const r = await pool.query('SELECT totp_secret, active, role FROM users WHERE id=$1', [pa.id]);
        // Step 2 must re-check the account: it may have been disabled (or removed) since step 1.
        if (!r.rows[0] || r.rows[0].active === false) {
            delete req.session.partial_auth;
            logLoginAttempt(pa.username, false, ip, 'account_disabled');
            return res.status(403).json({ error: 'This account has been disabled' });
        }
        if (r.rows[0].role) pa.role = r.rows[0].role;
        const secret = r.rows[0]?.totp_secret;
        if (!secret || !speakeasy.totp.verify({ secret, encoding: 'base32', token: code || '', window: 1 })) {
            logLoginAttempt(pa.username, false, ip, 'bad_totp');
            return res.status(401).json({ error: 'Invalid authenticator code' });
        }
        req.session.user = pa;
        delete req.session.partial_auth;
        await registerLogin(req, pool, pa.id);
        logLoginAttempt(pa.username, true, ip, null);
        res.json({ ok: true, user: req.session.user });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Admin-only: generate TOTP secret and QR code (call once to start setup)
app.get('/api/auth/totp-setup', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin')
        return res.status(403).json({ error: 'Admin only' });
    try {
        const generated = speakeasy.generateSecret({
            name: `BATHCO COMMAND (${req.session.user.username})`,
            length: 32
        });
        const qrDataUrl = await QRCode.toDataURL(generated.otpauth_url);
        req.session.totp_pending_secret = generated.base32;
        res.json({ qr: qrDataUrl });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Admin-only: verify first code to confirm setup, then enable + return recovery code (shown once, not stored)
app.post('/api/auth/totp-setup', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin')
        return res.status(403).json({ error: 'Admin only' });
    const { code } = req.body || {};
    const secret = req.session.totp_pending_secret;
    if (!secret) return res.status(400).json({ error: 'Start setup first with GET /api/auth/totp-setup' });
    if (!speakeasy.totp.verify({ secret, encoding: 'base32', token: code || '', window: 1 }))
        return res.status(401).json({ error: 'Code incorrect — try again' });
    try {
        await pool.query('UPDATE users SET totp_secret=$1, totp_enabled=TRUE WHERE id=$2',
                         [secret, req.session.user.id]);
        delete req.session.totp_pending_secret;
        const recoveryCode = crypto.randomBytes(12).toString('hex').toUpperCase()
                                   .match(/.{4}/g).join('-'); // XXXX-XXXX-XXXX-XXXX-XXXX-XXXX
        // Recovery code is shown once only — not stored anywhere
        res.json({ ok: true, recovery_code: recoveryCode,
                   message: 'TOTP enabled. Save this recovery code now — it will never be shown again.' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get current 2FA status
app.get('/api/auth/totp-status', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });
    try {
        const r = await pool.query('SELECT totp_enabled FROM users WHERE id=$1', [req.session.user.id]);
        res.json({ totp_enabled: !!r.rows[0]?.totp_enabled });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Disable 2FA (admin only)
app.post('/api/auth/totp-disable', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin')
        return res.status(403).json({ error: 'Admin only' });
    try {
        await pool.query('UPDATE users SET totp_secret=NULL, totp_enabled=FALSE WHERE id=$1', [req.session.user.id]);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Change own password (min 12 chars)
app.post('/api/auth/change-password', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });
    const { current, newPassword } = req.body || {};
    if (!current || !newPassword || newPassword.length < 12)
        return res.status(400).json({ error: 'Invalid input' });
    try {
        const r = await pool.query('SELECT password_hash FROM users WHERE id=$1', [req.session.user.id]);
        const user = r.rows[0];
        if (!user || !(await bcrypt.compare(current, user.password_hash)))
            return res.status(401).json({ error: 'Current password is incorrect' });
        const newHash = await bcrypt.hash(newPassword, 12);
        await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [newHash, req.session.user.id]);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/me', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
    res.json({ ...req.session.user, login_disabled: LOGIN_DISABLED });
});

// Serve GSAP from node_modules (no CDN dependency)
app.get('/vendor/gsap.min.js', (req, res) =>
    res.sendFile('node_modules/gsap/dist/gsap.min.js', { root: __dirname }));
app.get('/vendor/three.module.min.js', (req, res) =>
    res.sendFile('node_modules/three/build/three.module.min.js', { root: __dirname }));
// three.module.min.js internally imports ./three.core.min.js as a peer chunk
// (split since three's newer builds) - without this route the browser's
// dynamic import() of three.module.min.js 404s on the chunk and the whole
// module graph fails, silently killing core_3d (caught by its try/catch,
// falls back to the CSS nature effect with no visible error).
app.get('/vendor/three.core.min.js', (req, res) =>
    res.sendFile('node_modules/three/build/three.core.min.js', { root: __dirname }));

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
// 2026-07-04: owner decision - BATHCO_NATURE.html at /nature is the ONE
// official app. dashboard.html and /app (never built) are retired.
// ─── FIRST-RUN SETUP WIZARD ───────────────────────────────────────────────────
// A fresh instance has zero admin users; until one exists the wizard owns the
// entry routes and /api/setup/complete is open. The moment an admin exists the
// wizard endpoints lock (403) and normal routing resumes.
let SETUP_DONE = false; // sticky cache — once done, never re-check
async function setupNeeded() {
    if (SETUP_DONE) return false;
    const r = await pool.query(`SELECT 1 FROM users WHERE role IN ('admin','owner') AND active IS NOT FALSE LIMIT 1`);
    if (r.rows.length) SETUP_DONE = true;
    return !SETUP_DONE;
}

app.get('/api/setup/status', async (req, res) => {
    try { res.json({ setup_needed: await setupNeeded() }); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/setup/complete', async (req, res) => {
    try {
        if (!(await setupNeeded())) return res.status(403).json({ error: 'Setup already completed' });
        const { company_name, legal_name, tagline, currency, currency_symbol, logo_data, admin, staff } = req.body || {};
        if (!company_name || !admin?.username || !admin?.password)
            return res.status(400).json({ error: 'company_name, admin.username and admin.password are required' });
        if (String(admin.password).length < 8)
            return res.status(400).json({ error: 'Admin password must be at least 8 characters' });

        // 1. Logo (optional): data URL → public/vendor/logo.<ext>
        let logoUrl = '/vendor/default-logo.png';
        if (logo_data) {
            const m = String(logo_data).match(/^data:image\/(png|jpe?g|webp|svg\+xml);base64,(.+)$/);
            if (!m) return res.status(400).json({ error: 'logo_data must be a png/jpg/webp/svg data URL' });
            const ext = m[1] === 'svg+xml' ? 'svg' : (m[1] === 'jpeg' ? 'jpg' : m[1]);
            const buf = Buffer.from(m[2], 'base64');
            if (buf.length > 2 * 1024 * 1024) return res.status(400).json({ error: 'Logo must be under 2MB' });
            fs.mkdirSync(path.join(__dirname, 'public', 'vendor'), { recursive: true });
            fs.writeFileSync(path.join(__dirname, 'public', 'vendor', `logo.${ext}`), buf);
            logoUrl = `/vendor/logo.${ext}`;
        }

        // 2. Branding config
        const cfgPath = path.join(__dirname, 'config', 'active.branding.json');
        const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
        cfg.company_name = company_name;
        cfg.legal_name = legal_name || company_name;
        cfg.tagline = tagline || '';
        cfg.currency = currency || cfg.currency;
        cfg.currency_symbol = currency_symbol || cfg.currency_symbol;
        cfg.logo_url = logoUrl;
        cfg.instance_id = company_name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || cfg.instance_id;
        fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));

        // 3. Admin account
        const adminHash = await bcrypt.hash(admin.password, 12);
        const adminRow = await pool.query(
            `INSERT INTO users (username, name, password_hash, role) VALUES ($1,$2,$3,'admin') RETURNING id, username, name, role, staff_id`,
            [String(admin.username).toLowerCase().trim(), admin.name || admin.username, adminHash]);

        // 4. Staff accounts (optional)
        const created = [];
        for (const s of Array.isArray(staff) ? staff : []) {
            if (!s?.name || !s?.username || !s?.password) continue;
            const st = await pool.query(
                `INSERT INTO staff (name, role, active) VALUES ($1, $2, true) RETURNING id`,
                [s.name, s.role || 'sales']);
            const h = await bcrypt.hash(s.password, 12);
            await pool.query(
                `INSERT INTO users (username, name, password_hash, role, staff_id) VALUES ($1,$2,$3,'staff',$4)`,
                [String(s.username).toLowerCase().trim(), s.name, h, st.rows[0].id]);
            created.push(s.username);
        }

        SETUP_DONE = true;
        req.session.user = adminRow.rows[0]; // auto-login the new admin
        res.json({ ok: true, admin: adminRow.rows[0].username, staff_created: created, logo_url: logoUrl });
    } catch (e) {
        if (e.code === '23505') return res.status(400).json({ error: 'That username already exists' });
        res.status(500).json({ error: e.message });
    }
});

const setupGate = (handler) => async (req, res) => {
    try { if (await setupNeeded()) return res.redirect(302, '/setup.html'); } catch {}
    return handler(req, res);
};
// One site: Bath Hub is the front door; the owner's business screens live at /owner (sign-in required for every private API).
app.get('/', setupGate((req, res) => res.redirect(302, '/bathhub.html')));
app.get('/app', setupGate((req, res) => res.redirect(302, '/owner')));
app.get('/owner', setupGate((req, res) => res.sendFile('public/bathco_complete.html', { root: __dirname })));

// ─── NATURE (new frontend, parallel to the existing dashboard) ───────────────
app.get('/nature', setupGate((req, res) => res.redirect(302, '/owner')));   // old address kept so bookmarks still work; the old screen file is not deleted yet

// ─── FEATURE FLAGS (DB-backed registry, not localStorage) ─────────────────────
app.get('/api/feature-flags', async (req, res) => {
    try {
        const r = await pool.query(`SELECT module_key, category, label, description, is_core, enabled, built FROM feature_flags ORDER BY category, label`);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});
app.patch('/api/feature-flags/:key', async (req, res) => {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'enabled (boolean) required' });
    try {
        const check = await pool.query(`SELECT is_core, built FROM feature_flags WHERE module_key=$1`, [req.params.key]);
        if (!check.rows.length) return res.status(404).json({ error: 'Unknown module_key' });
        if (check.rows[0].is_core) return res.status(400).json({ error: 'CORE modules cannot be toggled off' });
        if (!check.rows[0].built && enabled) return res.status(409).json({ error: 'Module is registered but not yet built — cannot enable' });
        const r = await pool.query(`UPDATE feature_flags SET enabled=$1, updated_at=NOW() WHERE module_key=$2 RETURNING *`, [enabled, req.params.key]);
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── DORMANT MODULE ROUTERS (feature-flagged, own pool each) ──────────────────
const sync = require('./routes/sync');
app.use('/api', sync.idempotency());   // same key twice = one record (offline queue replays)
app.use('/api', sync);                 // /api/sync/status, needs-review, review
app.use('/', require('./routes/purchasing_accounting')); // routes already prefixed /api/...
app.use('/api', require('./routes/staff_reports'));       // routes are relative (/attendance etc)
app.use('/', require('./routes/audit'));                  // routes already prefixed /api/audit/...
app.use('/', require('./routes/apex_admin'));             // APEX control plane, /api/apex/* (admin + PIN gated)
app.use('/api', require('./routes/investor_loans'));      // routes are relative (/investor-loans etc) -> /api/investor-loans*
app.use('/api', require('./routes/sale_commissions'));    // routes are relative (/sale-commissions etc) -> /api/sale-commissions*
app.use('/api', require('./routes/shop_operations'));     // routes are relative (/discount-* /stock-* /receipt-queue*) -> /api/discount-*, /api/stock-*, /api/receipt-queue*
app.use('/api', require('./routes/pos_bill_corrections')); // owner-only void/edit of a POS bill: PUT /pos-bills/:id, POST /pos-bills/:id/void
app.use('/api', require('./routes/attachments'));           // photo / upload / download for any record: /api/attachments*
app.use('/api', require('./routes/site_editor'));             // website editor: public feed /api/site/public, owner-only edits /api/site/*
app.use('/api/corrections', require('./routes/corrections'));   // admin-only edit + void-with-reason, history: /api/corrections/*
app.use('/api/admin-core', require('./routes/admin_core'));   // admin-only users (add/disable/role/reset/force logout/history) + audit log
app.use('/api/system', require('./routes/backup_status'));      // admin-only: backups (now/list/download), RESTORE (typed word + PIN + safety backup), status
app.use('/api', require('./routes/app_settings'));      // /api/app-settings* (shop, targets, WhatsApp switch), /api/menu-config*
app.use('/api', require('./routes/pos_bills'));            // routes are relative (/pos-bills etc) -> /api/pos-bills*
app.use('/api', require('./routes/cheque_register'));      // routes are relative (/cheque-register etc) -> /api/cheque-register*
app.use('/api/vendor-ledger', require('./middleware/idempotency')({ pool: require('./utils/pool') }), require('./routes/vendor_ledger')({ pool: require('./utils/pool'), branchOf: () => 1 })); // vendor bills + cheques ledger (Build 1); login enforced by the global /api auth gate
app.use('/api', require('./routes/money_plan')({ pool: require('./utils/pool'), branchOf: () => 1 })); // money plan + morning brief (Builds 6-7): /api/money/*, /api/morning-brief; read-only on finance tables
const laylaOwner = require('./layla_owner/boot')({ pool: require('./utils/pool') });   // owner assistant (Build 2; router is routes/layla_owner' built inside layla_owner/boot): login enforced by the global /api gate
app.use('/api/layla-owner', require('./middleware/idempotency')({ pool: require('./utils/pool') }), laylaOwner.router);
app.use('/', require('./routes/daily_entry_sync'));         // daily ledger sync (ported from BATHCO): /api/daily-entry/sync, /meta, /range (behind login)
app.use('/api', require('./routes/business_intelligence')); // routes are relative (/cash-position-forecast /non-moving-stock) -> /api/cash-position-forecast, /api/non-moving-stock
app.use('/api/money-control', require('./routes/money_control')); // Money control dashboard backend, /api/money-control/*
app.use('/api', require('./routes/item_catalog'));       // routes are relative (/items /item-photos) -> /api/items*, /api/item-photos/*
app.use('/api', require('./routes/grn_manual'));         // routes are relative (/grn-manual) -> /api/grn-manual
app.use('/api', require('./routes/invoice_receipts'));   // routes are relative (/invoice-receipts*) -> /api/invoice-receipts*
app.use('/api', require('./routes/agent_rulebook'));       // M1 agent rulebook (owner-only) -> /api/agent/rules*, /api/agent/rulebook
app.use('/api', require('./routes/enquiries'));            // M2 enquiry tracker (owner-only) -> /api/enquiries*
app.use('/api', require('./routes/content_calendar'));     // M3 content calendar (owner-only, manual posting) -> /api/content-posts*
app.use('/api', require('./routes/competitors'));          // M4 competitor watch (owner-only) -> /api/competitors*
app.use('/api', require('./routes/catalogue_feed'));       // M5 website catalogue feed -> /api/public/catalogue (public, whitelisted), /api/catalogue-web* (owner)
app.use('/api', require('./routes/reply_drafts'));         // M6 reply drafts (owner-only, drafts only, never sends) -> /api/reply-drafts*
app.use('/api', require('./routes/policy_notes'));         // M7 policy watch (owner-only) -> /api/policy-notes*
app.use('/api', require('./routes/branches'));             // M8 branch profile (owner-only, new branches read-only) -> /api/branches*
app.use('/api', require('./routes/tile_tools'));           // counter tools: tile estimate, price per sqm (no DB) -> /api/tools/*
app.use('/api', require('./routes/agent_brain'));           // M9 agent brain: LAYLA drafts replies for review, never sends -> /api/agent-brain/*
app.use('/api', require('./routes/salary'));              // SALARY module (isolated): daily cost target, monthly profit split, cheque set-aside -> /api/salary* (owner only)
app.use('/api', require('./routes/document_inbox'));       // Document Inbox: photos of papers (bill / GRN / cheque / sheets), checked by Aj, then filed -> /api/document-inbox*
app.use('/api', require('./routes/documents'));          // DOCUMENTS & REPORTS (owner only): PDF/CSV reports, allow-listed WhatsApp send (dry run unless live), inbound-file quarantine -> /api/documents*
app.use('/api', require('./routes/notifications'));       // routes are relative (/notifications etc) -> /api/notifications*
app.use('/api/assistant', require('./routes/assistant'));   // floating owner assistant (text only, owner/admin only, Gemini) -> /api/assistant/whoami, /chat

// Hourly check for due-soon cheques/loans -> WhatsApp Business API (no-op,
// $0, until WHATSAPP_API_TOKEN/PHONE_NUMBER_ID/TO_NUMBER are set in .env —
// see utils/whatsappBusinessApi.js). The in-app bell (routes/notifications.js)
// works immediately either way.
require('./scripts/notify_due_soon').start();

// ─── GENERIC INBOX UPLOAD (Daily Entry / Audit / Expenses upload buttons) ─────
// Saves to <DROP_ROOT>\inbox\YYYY-MM-DD\ with date-tagged names, then runs OCR
// for images (jpg/png). PDFs are saved but not OCR'd here (no PDF-to-image step
// wired up) - queued for the existing pipeline. Does NOT auto-commit to
// daily_summary - shows the extracted numbers on screen for the user to act on.
const INBOX_ROOT = path.join(process.env.DROP_ROOT || path.join(__dirname, 'data', 'drop'), 'inbox');
app.post('/api/inbox-upload', (req, res) => {
    const todayDir = todayLK(); // upload date, not necessarily the sheet's date
    const destDir = path.join(INBOX_ROOT, todayDir);
    fs.mkdirSync(destDir, { recursive: true });
    const inboxUpload = multer({
        storage: multer.diskStorage({
            destination: (req, file, cb) => cb(null, destDir),
            filename: (req, file, cb) => {
                const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
                cb(null, `${Date.now()}-${safe}`);
            },
        }),
        limits: { fileSize: 50 * 1024 * 1024 },
        fileFilter: (req, file, cb) => {
            if (/\.(jpg|jpeg|png|pdf)$/i.test(file.originalname)) cb(null, true);
            else cb(new Error('Only jpg/png/pdf accepted'));
        },
    }).single('file');
    inboxUpload(req, res, async (err) => {
        if (err) return res.status(400).json({ error: err.message });
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        console.log('[INBOX-UPLOAD] file saved:', req.file.path);
        const result = { saved_to: req.file.path, filename: req.file.filename };
        if (/\.(jpg|jpeg)$/i.test(req.file.filename) || /\.png$/i.test(req.file.filename)) {
            try {
                console.log('[INBOX-UPLOAD] starting OCR...');
                const { ocrPhoto } = require('./scripts/ocr_photo');
                result.ocr = await ocrPhoto(req.file.path);
                console.log('[INBOX-UPLOAD] OCR done.');
            } catch (e) {
                console.log('[INBOX-UPLOAD] OCR error:', e.message);
                result.ocr_error = e.message;
            }
        } else {
            result.note = 'PDF saved, not auto-OCR\'d (no PDF-to-image step wired up yet) - queued for manual/existing pipeline review.';
        }
        res.json(result);
    });
});

// ─── SMALL DORMANT MODULES: reorder alerts, audit log, error log ──────────────
app.get('/api/reorder-alerts', async (req, res) => {
    try {
        const r = await pool.query(`SELECT item_code, name, category, stock_level, reorder_threshold
            FROM products WHERE active=true AND stock_level <= reorder_threshold ORDER BY stock_level ASC`);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/audit-log', async (req, res) => {
    try {
        const r = await pool.query(`SELECT id, username, success, ip, reason,
            TO_CHAR(attempted_at,'YYYY-MM-DD HH24:MI:SS') as attempted_at_str
            FROM login_audit ORDER BY attempted_at DESC LIMIT 200`);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/error-log', (req, res) => {
    try {
        const logPath = path.join(__dirname, 'server_err-0.log');
        if (!fs.existsSync(logPath)) return res.json({ lines: [], note: 'server_err-0.log not found' });
        const content = fs.readFileSync(logPath, 'utf8');
        const lines = content.split('\n').filter(Boolean).slice(-150);
        res.json({ lines });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── BRANDING (white-label CONFIG, separate from ENGINE code) ─────────────────
app.get('/api/branding', (req, res) => {
    try {
        const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'config', 'active.branding.json'), 'utf8'));
        res.json(cfg);
    } catch (e) { res.status(500).json({ error: 'branding config missing or invalid: ' + e.message }); }
});

// ─── USER MANAGEMENT (owner/admin, via the generic role gate above) ───────────
app.get('/api/users', async (req, res) => {
    try {
        const r = await pool.query(`SELECT id, username, name, role, staff_id, created_at FROM users ORDER BY role, username`);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/users', async (req, res) => {
    const { username, name, password, role, staff_id } = req.body || {};
    if (!username || !name || !password || !role) return res.status(400).json({ error: 'username, name, password, role required' });
    if (!['admin','owner','staff','customer'].includes(role)) return res.status(400).json({ error: 'invalid role' });
    if (password.length < 12) return res.status(400).json({ error: 'password must be at least 12 characters' });
    try {
        const hash = await bcrypt.hash(password, 12);
        const r = await pool.query(
            `INSERT INTO users (username, name, password_hash, role, staff_id) VALUES ($1,$2,$3,$4,$5) RETURNING id, username, name, role, staff_id, created_at`,
            [username, name, hash, role, staff_id || null]);
        res.status(201).json(r.rows[0]);
    } catch (e) {
        if (e.code === '23505') return res.status(409).json({ error: 'username already exists' });
        res.status(500).json({ error: e.message });
    }
});
app.patch('/api/users/:id', async (req, res) => {
    const { name, role, active } = req.body || {};
    const updates = [], vals = [];
    if (name !== undefined) { vals.push(name); updates.push(`name=$${vals.length}`); }
    if (role !== undefined) {
        if (!['admin','owner','staff','customer'].includes(role)) return res.status(400).json({ error: 'invalid role' });
        vals.push(role); updates.push(`role=$${vals.length}`);
    }
    if (active !== undefined) { vals.push(active); updates.push(`active=$${vals.length}`); }
    if (!updates.length) return res.status(400).json({ error: 'nothing to update' });
    // Nobody can lock themselves (and possibly the whole business) out by disabling or demoting their own account.
    const me = req.session.user;
    if (me && String(me.id) === String(req.params.id) && (active === false || (role !== undefined && role !== me.role))) {
        return res.status(400).json({ error: "You can't disable or change the role of your own account" });
    }
    vals.push(req.params.id);
    try {
        const r = await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id=$${vals.length} RETURNING id, username, name, role, staff_id`, vals);
        if (!r.rowCount) return res.status(404).json({ error: 'user not found' });
        // Disabling, or changing someone's role, signs them out everywhere: a session keeps the role it was
        // created with and can last up to a year, so a demoted user would otherwise keep their old access.
        if ((active === false || role !== undefined) && !(me && String(me.id) === String(req.params.id))) {
            await pool.query(`DELETE FROM session WHERE (sess::jsonb)->'user'->>'id' = $1`, [String(req.params.id)])
                .catch(e => console.warn('[users] could not clear sessions for disabled user:', e.message));
        }
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Strips control/null chars (keeps normal whitespace) and caps length -
// applied to untrusted free-text (WhatsApp messages) before it reaches the
// DB, the AI prompt, or any dashboard view that might render it.
function sanitizeText(input, maxLen = 4000) {
    return String(input || '')
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        .slice(0, maxLen);
}

// ─── WHATSAPP WEBHOOK (incoming) ──────────────────────────────────────────────
const { webhookAuth, safeInboxPath } = require('./middleware/webhookAuth');
const agentWhatsapp = require('./utils/agentWhatsapp');
agentWhatsapp.watchDbSwitch(pool);   // the Admin Settings switch (app_settings.whatsapp_draft_only) overrides AGENT_DRAFT_ONLY
const documentInbox = require('./routes/document_inbox');
const getInbox = documentInbox.getInbox;
// Filing a daily/expense sheet from the Document Inbox goes through exactly the same careful merge as the WhatsApp YES reply
// (it never overwrites figures that are already there). A throw-away sender number lets us reuse that code unchanged.
documentInbox.configure({
    fileDaySheet: async ex => {
        const fake = String(9000000000000 + Math.floor(Math.random() * 999999));
        await pool.query(
            `INSERT INTO whatsapp_draft_entries (from_number, photo_path, report_date, total_sale, cash_sale, card_sale, online_sale, credit_sale, total_expenses, expense_items, confidence, ocr_raw)
             VALUES ($1,'',$2,$3,$4,$5,$6,$7,$8,$9,'checked by owner',$10)`,
            [fake, ex.date, ex.total_sale, ex.cash_sale, ex.card_sale, ex.online_sale, ex.credit_sale, ex.total_expenses, ex.expense_items || null, JSON.stringify({ document_type: 'day_sheet' })]);
        const out = await handlePendingDraftReply(fake, 'YES');
        if (out && /^Can't save|^Discarded/.test(out.message)) { const e = new Error(out.message); e.status = 400; throw e; }
        return out;
    },
});
// Same folder whatsapp-bridge.js saves incoming photos to.
const WA_INBOX_ROOT = path.join(process.env.DROP_ROOT || path.join(__dirname, 'data', 'drop'), 'inbox');
app.post('/webhook/whatsapp', webhookAuth, async (req, res) => {
    try {
        const body = req.body;

        // Support Meta Cloud API format and direct POST format
        const entry = body.entry?.[0]?.changes?.[0]?.value;
        const messageObj = entry?.messages?.[0] || body;

        const phone = messageObj.from || body.from;
        const msgType = messageObj.type || 'text';
        const isVoiceNote = msgType === 'audio';
        const text = sanitizeText(messageObj.text?.body || body.message || '');

        if (!phone) {
            return res.status(400).json({ error: 'Missing phone number' });
        }

        console.log(`[WEBHOOK] ${phone} → ${isVoiceNote ? '[Voice Note]' : text}`);

        // A pending day-sheet-photo draft awaiting YES/NO takes priority over
        // normal LAYLA chat — see /webhook/whatsapp-photo below (audit.md item 3).
        const draftReply = await handlePendingDraftReply(phone, text);
        if (draftReply) {
            console.log(`[LAYLA] → ${phone}: ${draftReply.message}`);
            return res.json({ success: true, reply: draftReply.message, escalated: false });
        }

        // DRAFT-ONLY MODE (AGENT_DRAFT_ONLY=true): a customer's message becomes a checked draft for Aj (Agent Review tab)
        // and NO reply goes back, so the bridge sends nothing. The owner's own number is unaffected. See utils/agentWhatsapp.js.
        if (agentWhatsapp.isDraftOnly() && !agentWhatsapp.isOwner(phone)) {
            const out = await agentWhatsapp.draftOnly({
                phone, text, isVoiceNote, brain: require('./routes/agent_brain').getBrain(),
                notify: msg => pool.query(`INSERT INTO alerts (type, message, priority) VALUES ('agent_draft', $1, 'normal')`, [msg]),
            });
            console.log(`[AGENT-DRAFT-ONLY] ${phone}: ${out.drafted ? 'draft #' + out.draft_id + ' saved for review' : 'not drafted (' + out.reason + ')'}; nothing sent`);
            return res.json({ success: true, reply: '', escalated: false, drafted: out.drafted, draft_id: out.draft_id || null });
        }

        const result = await processMessage(phone, text, isVoiceNote);

        console.log(`[LAYLA] → ${phone}: ${result.message}`);
        recordAgentRun('LAYLA');

        res.json({ success: true, reply: result.message, escalated: result.escalate });
    } catch (err) {
        console.error('[WEBHOOK] Error:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── WHATSAPP PHOTO → OCR → DRAFT PIPELINE (audit.md item 3) ─────────────────
// Bridge saves the photo to disk and posts here with the path. We OCR it, stage
// a draft row (NEVER write straight to daily_summary - a rejected/abandoned
// draft must never look like real data), and reply asking for YES/NO.
function draftReplyText(draft) {
    const o = draft;
    // manual_bill / grn: read back the headline and send Aj to the Document Inbox, where the photo sits beside the fields.
    if (o.document_type === 'manual_bill' || o.document_type === 'grn') {
        const isBill = o.document_type === 'manual_bill';
        const lines = [`*Read from your photo — ${isBill ? 'manual bill' : 'GRN'}* (confidence: ${o.confidence || 'unknown'}):`];
        if (isBill ? o.bill_number : o.grn_number) lines.push(`${isBill ? 'Bill' : 'GRN'} No: ${isBill ? o.bill_number : o.grn_number}`);
        if (o.date) lines.push(`Date: ${o.date}`);
        if (isBill && o.customer_name) lines.push(`Customer: ${o.customer_name}`);
        if (!isBill && o.supplier_name) lines.push(`Supplier: ${o.supplier_name}`);
        lines.push(`Items read: ${Array.isArray(o.items) ? o.items.length : 0}`);
        if (o.total != null) lines.push(`Total: LKR ${Number(o.total).toLocaleString()}`);
        if (o.confidence === 'low' || o.notes) lines.push(``, `⚠ ${o.notes || 'Low confidence — some fields may be wrong.'}`);
        lines.push(``, `It is in the *Document Inbox* in the app: check the fields against the photo and press Confirm to file it. Nothing is filed until you do.`);
        return lines.join('\n');
    }
    // cheque_note / invoice (Item 3B, 2026-07-04) — distinct read-back per type,
    // same YES/NO confirmation pattern as the original day-sheet flow.
    if (o.document_type === 'cheque_note') {
        const lines = [`*Read from your photo — cheque note* (confidence: ${o.confidence || 'unknown'}):`];
        if (o.cheque_number) lines.push(`Cheque No: ${o.cheque_number}`);
        if (o.bank) lines.push(`Bank: ${o.bank}`);
        if (o.amount != null) lines.push(`Amount: LKR ${Number(o.amount).toLocaleString()}`);
        if (o.payee) lines.push(`Payee: ${o.payee}`);
        if (o.due_date) lines.push(`Due Date: ${o.due_date}`);
        if (o.confidence === 'low' || o.notes) lines.push(``, `⚠ ${o.notes || 'Low confidence — some fields may be wrong.'}`);
        lines.push(``, `Reply *YES* to confirm, or *NO* to discard and retake. Note: cheque tracking isn't fully wired into the dashboard yet — a confirmed cheque note is saved and verified, but still needs manual entry into the cheque register until that's built.`);
        return lines.join('\n');
    }
    if (o.document_type === 'invoice') {
        const lines = [`*Read from your photo — invoice* (confidence: ${o.confidence || 'unknown'}):`];
        if (o.invoice_number) lines.push(`Invoice No: ${o.invoice_number}`);
        if (o.payee) lines.push(`Supplier: ${o.payee}`);
        if (o.amount != null) lines.push(`Amount: LKR ${Number(o.amount).toLocaleString()}`);
        if (o.date) lines.push(`Date: ${o.date}`);
        if (o.confidence === 'low' || o.notes) lines.push(``, `⚠ ${o.notes || 'Low confidence — some fields may be wrong.'}`);
        lines.push(``, `Reply *YES* to confirm, or *NO* to discard and retake. Note: invoice tracking isn't fully wired into the dashboard yet — a confirmed invoice is saved and verified, but still needs manual entry until that's built.`);
        return lines.join('\n');
    }
    const lines = [`*Read from your photo* (confidence: ${o.confidence || 'unknown'}):`];
    if (o.report_date || o.date) lines.push(`Date: ${o.report_date || o.date}`);
    if (o.total_sale != null) lines.push(`Total Sale: LKR ${Number(o.total_sale).toLocaleString()}`);
    if (o.total_expenses != null) lines.push(`Expenses: LKR ${Number(o.total_expenses).toLocaleString()}`);
    if (o.cash_sale != null) lines.push(`Cash: LKR ${Number(o.cash_sale).toLocaleString()}`);
    if (o.card_sale != null) lines.push(`Card: LKR ${Number(o.card_sale).toLocaleString()}`);
    if (o.online_sale != null) lines.push(`Online: LKR ${Number(o.online_sale).toLocaleString()}`);
    if (o.credit_sale != null) lines.push(`Credit: LKR ${Number(o.credit_sale).toLocaleString()}`);
    if (o.expense_items) lines.push(`Expense items: ${o.expense_items}`);
    if (!o.report_date && !o.date && o.total_sale == null && o.total_expenses == null) {
        lines.push(`Nothing usable was read from this photo.`);
    }
    if (o.confidence === 'low' || o.ocr_notes || o.notes) {
        lines.push(``, `⚠ ${o.ocr_notes || o.notes || 'Low confidence — some fields may be wrong.'}`);
        lines.push(`For a clearer read: flat surface, good light, no shadows/glare, whole sheet in frame, hold the phone steady and directly above the page (not at an angle).`);
    }
    lines.push(``, `Reply *YES* to save this, or *NO* to discard and retake the photo.`);
    return lines.join('\n');
}

app.post('/webhook/whatsapp-photo', webhookAuth, async (req, res) => {
    const { from } = req.body;
    if (!from || !req.body.filePath) return res.status(400).json({ error: 'from and filePath required' });
    // Only images the bridge saved in its own inbox folder may be read (no arbitrary server paths).
    const filePath = safeInboxPath(req.body.filePath, WA_INBOX_ROOT);
    if (!filePath) return res.status(400).json({ error: 'filePath must be an image inside the WhatsApp inbox folder' });
    try {
        // Draft-only mode: a photo from anyone who is not the owner / a staff number is kept for Aj to look at (no reading, no reply).
        if (agentWhatsapp.isDraftOnly() && !agentWhatsapp.canSendPapers(from)) {
            await getInbox().record({ source: 'whatsapp', from_ref: String(from), file_path: filePath, doc_type: 'customer_photo', reader_note: 'Photo from a customer number. Not read; nothing was sent back.' }).catch(e => console.error('[document_inbox] could not record:', e.message));
            return res.json({ reply: '' });
        }
        const { ocrPhoto } = require('./scripts/ocr_photo');
        const o = await ocrPhoto(filePath);
        // document_type replaces the old boolean is_document (Item 3B, 2026-07-04) —
        // day_sheet/expense_sheet keep the existing dedicated columns; cheque_note/
        // invoice reuse the same table's flexible ocr_raw JSONB (no schema change),
        // leaving the day-sheet-specific columns NULL for those types.
        // Every photo is also listed in the Document Inbox (with the photo beside what was read), recognised or not.
        await getInbox().record({ source: 'whatsapp', from_ref: String(from), file_path: filePath, ocr_result: o }).catch(e => console.error('[document_inbox] could not record:', e.message));
        if (!o.document_type || o.document_type === 'unknown') {
            console.log(`[WHATSAPP-PHOTO] not a recognized document, saved for review only: ${filePath}`);
            return res.json({ reply: `Photo saved for review. Thanks!` });
        }
        const relevantDate = o.date || o.due_date || null;
        const ins = await pool.query(
            `INSERT INTO whatsapp_draft_entries
                (from_number, photo_path, report_date, total_sale, cash_sale, card_sale, online_sale,
                 credit_sale, total_expenses, expense_items, confidence, ocr_notes, ocr_raw)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
            [from, filePath, relevantDate, o.total_sale ?? null, o.cash_sale ?? null, o.card_sale ?? null,
             o.online_sale ?? null, o.credit_sale ?? null, o.total_expenses ?? null, o.expense_items || null,
             o.confidence || null, o.notes || null, JSON.stringify(o)]
        );
        console.log(`[WHATSAPP-PHOTO] draft #${ins.rows[0].id} (${o.document_type}) staged for ${from} (${filePath})`);
        res.json({ reply: draftReplyText(o) });
    } catch (e) {
        console.error('[WHATSAPP-PHOTO] OCR/staging failed:', e.message);
        // keep the photo for Aj to type in by hand, even though the reader failed
        await getInbox().record({ source: 'whatsapp', from_ref: String(from), file_path: filePath, reader_note: `Could not read the photo (${String(e.message).slice(0, 160)}). Choose the type and type the details in.` }).catch(() => {});
        res.json({ reply: `Couldn't read that photo (${e.message}). Please retake it — flat, well-lit, whole sheet in frame — and resend.` });
    }
});

// Checks for a PENDING_CONFIRM draft for this sender and, if the message is a
// YES/NO reply, resolves it. Returns null (not a draft reply) otherwise, so the
// caller falls through to normal LAYLA chat.
async function handlePendingDraftReply(phone, text) {
    const digits = String(phone).replace(/\D/g, '');
    const pending = await pool.query(
        `SELECT * FROM whatsapp_draft_entries WHERE from_number=$1 AND status='PENDING_CONFIRM'
         ORDER BY created_at DESC LIMIT 1`, [digits]);
    if (!pending.rows.length) return null;
    const draft = pending.rows[0];
    const answer = String(text || '').trim().toUpperCase();

    if (['NO', 'N', 'CANCEL', 'DISCARD'].includes(answer)) {
        await pool.query(`UPDATE whatsapp_draft_entries SET status='REJECTED' WHERE id=$1`, [draft.id]);
        return { message: `Discarded. Please retake the photo — flat surface, good light, no glare, whole sheet in frame — and resend.` };
    }
    if (!['YES', 'Y', 'CONFIRM', 'OK'].includes(answer)) {
        return null; // not a yes/no reply — leave the draft pending, let LAYLA answer whatever they actually asked
    }

    // cheque_note / invoice (Item 3B, 2026-07-04): deliberately does NOT write
    // into daily_summary (wrong table) or guess which of the two existing,
    // mostly-unused cheque tables (cheques has a customer_id FK for inbound/
    // receivable cheques; cheque_payments has the right shape for outbound
    // payments but isn't wired into any live route) is the correct destination
    // for an outbound supplier cheque. Confirms the OCR'd data as verified and
    // keeps it queryable, but stops short of auto-filing until a human decides
    // the real destination table/schema — that's a schema/financial-routing
    // decision, not something to guess through.
    const docType = draft.ocr_raw?.document_type;
    if (docType === 'manual_bill' || docType === 'grn') {
        await pool.query(`UPDATE whatsapp_draft_entries SET status='CONFIRMED_UNFILED' WHERE id=$1`, [draft.id]);
        return { message: `Kept. Open the *Document Inbox* in the app to check the ${docType === 'grn' ? 'GRN' : 'bill'} against the photo and file it. Nothing is filed until you press Confirm there.` };
    }
    if (docType === 'cheque_note' || docType === 'invoice') {
        await pool.query(`UPDATE whatsapp_draft_entries SET status='CONFIRMED_UNFILED' WHERE id=$1`, [draft.id]);
        return {
            message: `Confirmed and saved (verified, not yet auto-filed). ${docType === 'cheque_note' ? 'Cheque' : 'Invoice'} tracking isn't fully wired into the dashboard database yet, so this still needs manual entry into the register for now — the photo and the numbers you confirmed are safely kept either way.`,
        };
    }

    if (!draft.report_date) {
        return { message: `Can't save this — no date was readable on the photo. Reply NO to discard and retake with the date clearly visible, or send a fresh photo.` };
    }

    const existing = await pool.query(
        `SELECT total_sale, total_expenses, sales_source, expenses_source FROM daily_summary WHERE report_date=$1`,
        [draft.report_date]);

    const setParts = [];
    const params = [draft.report_date];
    let p = (v) => { params.push(v); return `$${params.length}`; };
    const conflicts = [];

    if (existing.rows.length) {
        const ex = existing.rows[0];
        if (draft.total_sale != null) {
            if (Number(ex.total_sale) > 0) conflicts.push(`total_sale already ${Number(ex.total_sale).toLocaleString()} from ${ex.sales_source || 'another source'} — not overwritten`);
            else setParts.push(`total_sale=${p(draft.total_sale)}`, `sales_source='whatsapp_ocr'`);
        }
        if (draft.total_expenses != null) {
            if (Number(ex.total_expenses) > 0) conflicts.push(`total_expenses already ${Number(ex.total_expenses).toLocaleString()} from ${ex.expenses_source || 'another source'} — not overwritten`);
            else setParts.push(`total_expenses=${p(draft.total_expenses)}`, `expenses_source='whatsapp_ocr'`, `day_status='ESTIMATED'`);
        }
        if (draft.cash_sale != null) setParts.push(`cash_sale=COALESCE(NULLIF(cash_sale,0),${p(draft.cash_sale)})`);
        if (draft.card_sale != null) setParts.push(`card_sale=COALESCE(NULLIF(card_sale,0),${p(draft.card_sale)})`);
        if (draft.online_sale != null) setParts.push(`online_sale=COALESCE(NULLIF(online_sale,0),${p(draft.online_sale)})`);
        if (draft.credit_sale != null) setParts.push(`credit_sale=COALESCE(NULLIF(credit_sale,0),${p(draft.credit_sale)})`);
        if (setParts.length) {
            await pool.query(`UPDATE daily_summary SET ${setParts.join(', ')}, updated_at=NOW() WHERE report_date=$1`, params);
        }
    } else {
        await pool.query(
            `INSERT INTO daily_summary (report_date, total_sale, cash_sale, card_sale, online_sale, credit_sale,
                total_expenses, sales_source, expenses_source, day_status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,'whatsapp_ocr','whatsapp_ocr','ESTIMATED')`,
            [draft.report_date, draft.total_sale || 0, draft.cash_sale || 0, draft.card_sale || 0,
             draft.online_sale || 0, draft.credit_sale || 0, draft.total_expenses || 0]);
    }

    await pool.query(`UPDATE whatsapp_draft_entries SET status='CONFIRMED', confirmed_at=NOW() WHERE id=$1`, [draft.id]);
    // the same photo may also be waiting in the Document Inbox: it is filed now
    await pool.query(`UPDATE document_inbox SET status='filed', filed_to='daily_summary', filed_id=$1, filed_note='Filed by the WhatsApp YES reply', filed_at=NOW() WHERE file_path=$2 AND status='to_check'`,
        [draft.report_date ? String(draft.report_date).slice(0, 10) : null, draft.photo_path]).catch(() => {});

    let msg = `Saved for ${draft.report_date}.`;
    if (conflicts.length) msg += ` Note: ${conflicts.join('; ')}.`;
    msg += ` Net profit will auto-calculate once Gross Profit for that day is available from the POS system.`;
    return { message: msg };
}

// ─── SEND MESSAGE (outbound) ──────────────────────────────────────────────────
app.post('/send', async (req, res) => {
    const { to, message } = req.body;
    if (!to || !message) return res.status(400).json({ error: 'to and message required' });

    console.log(`[SEND] To: ${to} | Message: ${message}`);
    try {
        const bridgeUrl = process.env.WHATSAPP_API_URL || 'http://localhost:3001/send';
        const r = await axios.post(bridgeUrl, { to, message }, { timeout: 10000 });
        res.json({ success: true, to, message, bridge: r.data });
    } catch (err) {
        res.status(502).json({ error: 'WhatsApp bridge unavailable', detail: err.message });
    }
});

// ─── SIMULATE (test Layla without WhatsApp) ───────────────────────────────────
app.post('/simulate', async (req, res) => {
    const { phone, message } = req.body;
    if (!phone || !message) return res.status(400).json({ error: 'phone and message required' });

    try {
        const result = await processMessage(phone, message, false);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── CUSTOMERS ────────────────────────────────────────────────────────────────
app.get('/api/customers', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM customers ORDER BY last_contact DESC LIMIT 100'
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/customers/:phone', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM customers WHERE phone = $1',
            [req.params.phone]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/customers', async (req, res) => {
    const { name, phone, whatsapp, location, notes } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone is required' });
    try {
        const r = await pool.query(
            `INSERT INTO customers (name,phone,whatsapp,location,source,notes)
             VALUES ($1,$2,$3,$4,'walk_in',$5) RETURNING *`,
            [name||null, phone, whatsapp||null, location||null, notes||null]);
        res.status(201).json(r.rows[0]);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/customers/:id', async (req, res) => {
    const { name, phone, whatsapp, location, notes } = req.body;
    try {
        const r = await pool.query(
            `UPDATE customers SET name=$1, phone=$2, whatsapp=$3, location=$4, notes=$5
             WHERE id=$6 RETURNING *`,
            [name||null, phone, whatsapp||null, location||null, notes||null, req.params.id]);
        if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
        res.json(r.rows[0]);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── LEADS ────────────────────────────────────────────────────────────────────
app.get('/api/leads', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT l.*, c.name, c.phone, c.location
            FROM leads l
            LEFT JOIN customers c ON l.customer_id = c.id
            ORDER BY l.created_at DESC LIMIT 100
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/leads/:id/status', async (req, res) => {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'status required' });
    try {
        const result = await pool.query(
            `UPDATE leads SET status = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2 RETURNING *`,
            [status, req.params.id]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Lead not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── CONVERSATIONS ────────────────────────────────────────────────────────────
app.get('/api/conversations/:phone', async (req, res) => {
    try {
        const customer = await pool.query(
            'SELECT id FROM customers WHERE phone = $1',
            [req.params.phone]
        );
        if (!customer.rows.length) return res.status(404).json({ error: 'Customer not found' });

        const result = await pool.query(
            `SELECT * FROM conversations WHERE customer_id = $1
             ORDER BY updated_at DESC LIMIT 10`,
            [customer.rows[0].id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── DAILY REPORTS ────────────────────────────────────────────────────────────
app.get('/api/reports', async (req, res) => {
    const { date } = req.query;
    try {
        const query = date
            ? 'SELECT * FROM daily_reports WHERE report_date = $1 ORDER BY created_at DESC'
            : 'SELECT * FROM daily_reports ORDER BY report_date DESC LIMIT 50';
        const result = await pool.query(query, date ? [date] : []);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Itemized expense paper rows for a given date — for Home page "Today's Expenses" breakdown
app.get('/api/expenses-detail', async (req, res) => {
    const { date } = req.query;
    if (!date) return res.json([]);
    try {
        const r = await pool.query('SELECT * FROM expenses_detail WHERE report_date=$1 ORDER BY amount DESC', [date]);
        res.json(r.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/reports', async (req, res) => {
    const {
        report_date, invoice_no, total_sale,
        cash_amount, card_amount, online_amount,
        cheque_amount, credit_amount, is_refund, notes,
    } = req.body;
    if (!report_date || !total_sale) {
        return res.status(400).json({ error: 'report_date and total_sale required' });
    }
    try {
        const result = await pool.query(`
            INSERT INTO daily_reports
              (report_date, invoice_no, total_sale, cash_amount, card_amount,
               online_amount, cheque_amount, credit_amount, is_refund, notes)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
            RETURNING *`,
            [
                report_date, invoice_no, total_sale,
                cash_amount || 0, card_amount || 0,
                online_amount || 0, cheque_amount || 0,
                credit_amount || 0, is_refund || false, notes,
            ]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── CHEQUES ──────────────────────────────────────────────────────────────────
app.get('/api/cheques', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT ch.*, c.name, c.phone
            FROM cheques ch
            LEFT JOIN customers c ON ch.customer_id = c.id
            ORDER BY ch.due_date ASC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/cheques', async (req, res) => {
    const { customer_id, amount, due_date, bank, cheque_no, notes } = req.body;
    if (!customer_id || !amount || !due_date) {
        return res.status(400).json({ error: 'customer_id, amount, due_date required' });
    }
    try {
        const result = await pool.query(
            `INSERT INTO cheques (customer_id, amount, due_date, bank, cheque_no, notes)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [customer_id, amount, due_date, bank, cheque_no, notes]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/cheques/:id/status', async (req, res) => {
    const { status } = req.body;
    try {
        const result = await pool.query(
            `UPDATE cheques SET status = $1
             WHERE id = $2 RETURNING *`,
            [status, req.params.id]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Cheque not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── ALERTS ───────────────────────────────────────────────────────────────────
// invoice_gap alerts (invoice sequence gaps) are quiet — admin (owner) only
app.get('/api/alerts', async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM alerts WHERE read = false ORDER BY created_at DESC"
        );
        let rows = result.rows;
        if (req.session.user.role !== 'admin') {
            rows = rows.filter(r => r.type !== 'invoice_gap');
        }
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/alerts/:id/read', async (req, res) => {
    try {
        await pool.query('UPDATE alerts SET read = true WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── DROP FOLDER / FILE LEDGER ────────────────────────────────────────────────
app.post('/api/process-inbox', (req, res) => {
    if (process.env.ENABLE_LOCAL_INGEST !== 'true') {
        return res.status(503).json({ error: 'Local ingest not available on this instance.' });
    }
    const ingestScript = process.env.LOCAL_INGEST_SCRIPT;
    if (!ingestScript) {
        return res.status(503).json({ error: 'LOCAL_INGEST_SCRIPT is not configured on this instance.' });
    }
    execFile('python', [ingestScript], { timeout: 120000 }, (err, stdout, stderr) => {
        if (err) return res.status(500).json({ error: err.message, stderr });
        try {
            const lastLine = stdout.trim().split('\n').pop();
            res.json(JSON.parse(lastLine));
        } catch (e) {
            res.status(500).json({ error: 'Could not parse process_inbox output', raw: stdout });
        }
    });
});

app.get('/api/file-ledger', async (req, res) => {
    try {
        const r = await pool.query('SELECT * FROM file_ledger ORDER BY created_at DESC LIMIT 50');
        res.json(r.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// For 'photo_pending' alerts — admin types the total for an expense photo,
// added to that date's total_expenses (creates the day's row if missing).
app.post('/api/alerts/:id/set-amount', async (req, res) => {
    const { report_date, amount } = req.body;
    if (!report_date || amount == null) return res.status(400).json({ error: 'report_date and amount required' });
    try {
        await pool.query(`
            INSERT INTO daily_summary (report_date, total_expenses, source, day_status)
            VALUES ($1, $2, 'photo_expense', 'ESTIMATED')
            ON CONFLICT (report_date) DO UPDATE SET
              total_expenses = daily_summary.total_expenses + EXCLUDED.total_expenses,
              net_profit = ROUND(daily_summary.gross_profit - (daily_summary.total_expenses + EXCLUDED.total_expenses), 2),
              updated_at = NOW()
        `, [report_date, amount]);
        await pool.query('UPDATE alerts SET read = true WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── PRODUCTS ─────────────────────────────────────────────────────────────────
app.get('/api/products', async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM products WHERE active = true ORDER BY category, name"
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── QUOTATIONS ───────────────────────────────────────────────────────────────
app.get('/api/quotations', async (req, res) => {
    try {
        const r = await pool.query(`
            SELECT q.*, c.name as customer_name, c.phone as customer_phone,
                   (SELECT COUNT(*) FROM quotation_items WHERE quotation_id=q.id) as item_count
            FROM quotations q
            LEFT JOIN customers c ON c.id=q.customer_id
            ORDER BY q.created_at DESC`);
        res.json(r.rows);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/quotations/:id', async (req, res) => {
    try {
        const [q, items] = await Promise.all([
            pool.query(`SELECT q.*, c.name as customer_name, c.phone as customer_phone, c.location as customer_location
                         FROM quotations q LEFT JOIN customers c ON c.id=q.customer_id WHERE q.id=$1`, [req.params.id]),
            pool.query(`SELECT * FROM quotation_items WHERE quotation_id=$1 ORDER BY sort_order, id`, [req.params.id]),
        ]);
        if (!q.rows.length) return res.status(404).json({ error: 'Not found' });
        res.json({ ...q.rows[0], items: items.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/quotations', async (req, res) => {
    const { customer_id, quote_date, valid_until, discount, notes, items } = req.body;
    if (!customer_id) return res.status(400).json({ error: 'customer_id is required' });
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'At least one line item is required' });
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const subtotal = items.reduce((a,it) => a + (+it.qty||0)*(+it.unit_price||0), 0);
        const disc = +discount || 0;
        const total = Math.max(0, subtotal - disc);
        const qr = await client.query(
            `INSERT INTO quotations (customer_id,quote_date,valid_until,status,subtotal,discount,total,notes,created_by)
             VALUES ($1,$2,$3,'draft',$4,$5,$6,$7,$8) RETURNING *`,
            [customer_id, quote_date||todayLK(), valid_until||null,
             subtotal, disc, total, notes||null, req.session.user.id]);
        const quotation = qr.rows[0];
        await client.query(`UPDATE quotations SET quote_no='Q-'||LPAD(id::text,4,'0') WHERE id=$1`, [quotation.id]);
        for (const [i, it] of items.entries()) {
            const lineTotal = (+it.qty||0)*(+it.unit_price||0);
            await client.query(
                `INSERT INTO quotation_items (quotation_id,product_id,item_code,description,qty,unit_price,line_total,sort_order)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
                [quotation.id, it.product_id||null, it.item_code||null, it.description, it.qty||1, it.unit_price||0, lineTotal, i]);
        }
        await client.query('COMMIT');
        const full = await pool.query(`SELECT q.*, c.name as customer_name FROM quotations q LEFT JOIN customers c ON c.id=q.customer_id WHERE q.id=$1`, [quotation.id]);
        res.status(201).json(full.rows[0]);
    } catch(e) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally { client.release(); }
});

app.put('/api/quotations/:id/status', async (req, res) => {
    const { status } = req.body;
    if (!['draft','sent','accepted','rejected'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    try {
        const r = await pool.query(`UPDATE quotations SET status=$1 WHERE id=$2 RETURNING *`, [status, req.params.id]);
        if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
        res.json(r.rows[0]);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── STATS ────────────────────────────────────────────────────────────────────
app.get('/api/stats', async (req, res) => {
    try {
        const [customers, leads, alerts, cheques] = await Promise.all([
            pool.query('SELECT COUNT(*) FROM customers'),
            pool.query("SELECT COUNT(*) FROM leads WHERE status NOT IN ('converted','lost')"),
            pool.query("SELECT COUNT(*) FROM alerts WHERE read = false"),
            pool.query("SELECT COUNT(*) FROM cheques WHERE status = 'pending'"),
        ]);
        res.json({
            total_customers: parseInt(customers.rows[0].count),
            open_leads:      parseInt(leads.rows[0].count),
            unread_alerts:   parseInt(alerts.rows[0].count),
            pending_cheques: parseInt(cheques.rows[0].count),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── PACKAGES ─────────────────────────────────────────────────────────────────
app.get('/api/packages', async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM packages WHERE active = true ORDER BY id"
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── DAILY SUMMARY ────────────────────────────────────────────────────────────
app.get('/api/daily-summary', async (req, res) => {
    const { date, month, limit = 10, latest, from, to } = req.query;
    try {
        const tierCols = `, TO_CHAR(report_date,'YYYY-MM-DD') as date_str, ${TIER_EXPR} as data_tier, ${CASH_IN_EXPR} as cash_in_total,
                 ${CASH_OUT_EXPR} as cash_out_total, ${CASH_OUT_EXPR} > 0 as cash_out_recorded,
                 ${CASH_IN_EXPR} - ${CASH_OUT_EXPR} as net_cash_movement`;
        if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date))
            return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
        if (from && !/^\d{4}-\d{2}-\d{2}$/.test(from))
            return res.status(400).json({ error: 'from must be YYYY-MM-DD' });
        if (to && !/^\d{4}-\d{2}-\d{2}$/.test(to))
            return res.status(400).json({ error: 'to must be YYYY-MM-DD' });
        let q, p;
        if (latest) {
            if (req.query.before) {
                // Most recent day with data strictly before the given date
                q = `SELECT * ${tierCols} FROM daily_summary
                     WHERE report_date < $1 ORDER BY report_date DESC LIMIT 1`;
                p = [req.query.before];
            } else {
                // Most recent day with data, on or before today (skips bad future-dated rows)
                q = `SELECT * ${tierCols} FROM daily_summary
                     WHERE report_date <= CURRENT_DATE ORDER BY report_date DESC LIMIT 1`;
                p = [];
            }
        } else if (date) {
            q = `SELECT * ${tierCols} FROM daily_summary WHERE report_date = $1`;
            p = [date];
        } else if (from && to) {
            q = `SELECT * ${tierCols} FROM daily_summary WHERE report_date BETWEEN $1 AND $2 ORDER BY report_date`;
            p = [from, to];
        } else if (month) {
            q = `SELECT * ${tierCols} FROM daily_summary WHERE TO_CHAR(report_date,'YYYY-MM') = $1 ORDER BY report_date`;
            p = [month];
        } else {
            // Exclude future-dated rows (bad OCR entries) from "recent" lists
            q = `SELECT * ${tierCols} FROM daily_summary WHERE report_date <= CURRENT_DATE ORDER BY report_date DESC LIMIT $1`;
            p = [parseInt(limit)];
        }
        const r = await pool.query(q, p);
        res.json(r.rows);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/daily-summary/:date', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT *, TO_CHAR(report_date,'YYYY-MM-DD') as date_str, ${TIER_EXPR} as data_tier
             FROM daily_summary WHERE report_date = $1`,
            [req.params.date]
        );
        if (result.rows.length > 0) {
            const row = result.rows[0];
            if (row.gp_status === 'NOT_AVAILABLE') row.net_profit = null;
            res.json(row);
        } else {
            res.status(404).json({ error: 'Not found' });
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/daily-summary', async (req, res) => {
    const f = req.body;
    const salesSrc    = f.sales_source    || 'manual_entry';
    const expensesSrc = f.expenses_source || salesSrc;
    try {
        const r = await pool.query(`
            INSERT INTO daily_summary
              (report_date,total_sale,cash_sale,card_sale,online_sale,credit_sale,
               total_expenses,payments,salary,cash_in,cash_out,cash_in_hand,
               gross_profit,net_profit,source,checker_flags,notes,details,cheq_payment,cash_received,
               sales_source,expenses_source,sales_conflict,sales_conflict_excel)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,FALSE,NULL)
            ON CONFLICT (report_date) DO UPDATE SET
              total_sale=EXCLUDED.total_sale, cash_sale=EXCLUDED.cash_sale,
              card_sale=EXCLUDED.card_sale, online_sale=EXCLUDED.online_sale,
              credit_sale=EXCLUDED.credit_sale,
              total_expenses=EXCLUDED.total_expenses, payments=EXCLUDED.payments,
              cash_in_hand=EXCLUDED.cash_in_hand, net_profit=EXCLUDED.net_profit,
              checker_flags=EXCLUDED.checker_flags, details=EXCLUDED.details,
              cheq_payment=EXCLUDED.cheq_payment, cash_received=EXCLUDED.cash_received,
              sales_source=EXCLUDED.sales_source, expenses_source=EXCLUDED.expenses_source,
              sales_conflict=FALSE, sales_conflict_excel=NULL,
              updated_at=NOW()
            RETURNING *`,
            [f.report_date, f.total_sale||0, f.cash_sale||0, f.card_sale||0,
             f.online_sale||0, f.credit_sale||0, f.total_expenses||0, f.payments||0,
             f.salary||0, f.cash_in||0, f.cash_out||0, f.cash_in_hand||0,
             f.gross_profit||0, f.net_profit||0, f.source||'manual_entry',
             JSON.stringify(f.checker_flags||[]), f.notes||'',
             JSON.stringify(f.details||{}), f.cheq_payment||0, f.cash_received||0,
             salesSrc, expensesSrc]);
        const r2 = await pool.query(
            `UPDATE daily_summary SET net_profit=ROUND(gross_profit-total_expenses,2)
             WHERE report_date=$1 AND gp_status='ACTUAL' AND total_expenses>0 RETURNING *`, [f.report_date]);
        res.status(201).json(r2.rows[0] || r.rows[0]);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── DAILY SUMMARY FILE ATTACHMENTS ──────────────────────────────────────────
app.post('/api/daily-summary/:date/files', (req, res) => {
    const dateStr = req.params.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return res.status(400).json({ error: 'Invalid date format' });
    const dateDir = path.join(UPLOAD_DIR, 'daily', dateStr);
    fs.mkdirSync(dateDir, { recursive: true });
    const dailyUpload = multer({
        storage: multer.diskStorage({
            destination: (req, file, cb) => cb(null, dateDir),
            filename: (req, file, cb) => {
                const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
                cb(null, `${Date.now()}-${safe}`);
            }
        }),
        limits: { fileSize: 200 * 1024 * 1024 }
    }).array('files', 20);
    dailyUpload(req, res, async (err) => {
        if (err) return res.status(400).json({ error: err.message });
        try {
            const rejected = [];
            const validFiles = [];
            for (const f of (req.files || [])) {
                const mimeErr = await validateMimeType(f);
                if (mimeErr) rejected.push(`${f.originalname}: ${mimeErr}`);
                else validFiles.push(f);
            }
            req.files = validFiles;
            if (rejected.length && !validFiles.length)
                return res.status(400).json({ error: `Invalid file(s): ${rejected.join('; ')}` });

            const photoFiles = validFiles.filter(f => /\.(jpg|jpeg|png)$/i.test(f.originalname));
            const photoResults = await Promise.all(photoFiles.map(f =>
                processPhotoFile(dateStr, f.filename, f.path).catch(e => ({ _error: e.message || String(e) }))
            ));

            // Dispose source images after extraction (going-forward rule — never touches historical files)
            photoFiles.forEach((f, idx) => {
                const r = photoResults[idx];
                try {
                    if (r && r.type && !r._error) {
                        // Successful extraction → delete source (data is now in DB photo_data JSONB)
                        fs.unlinkSync(f.path);
                    } else if (r && r._error) {
                        // Failed extraction → hold in _pending_review for 48-h manual window
                        const dest = path.join(PENDING_REVIEW_DIR, `${Date.now()}-${f.filename}`);
                        fs.renameSync(f.path, dest);
                    }
                    // r === null means not a classifiable photo (kept as-is: plain attachment)
                } catch (disposeErr) {
                    console.warn('[photo-dispose] Warning:', disposeErr.message);
                }
            });

            const visionError = photoFiles.length > 0 && photoResults.every(r => r && r._error)
                ? (photoResults[0]._error.includes('401') || photoResults[0]._error.toLowerCase().includes('unauthorized')
                    ? 'VISION_API_KEY_INVALID'
                    : 'VISION_API_ERROR')
                : null;
            const result = await recalculateDate(dateStr);
            // Run reconciliation check in background — updates checker_flags for this date
            runReconCheck({ since: dateStr, until: dateStr, quiet: true })
                .then(() => recordAgentRun('CHECKER')).catch(() => {});
            res.json({
                files: (req.files||[]).map(f => ({ filename: f.filename, originalname: f.originalname, size: f.size })),
                visionError,
                ...result,
            });
        } catch(e) { res.status(500).json({ error: e.message }); }
    });
});

app.get('/api/daily-summary/:date/files', (req, res) => {
    const dateStr = req.params.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return res.status(400).json({ error: 'Invalid date format' });
    const dateDir = path.join(UPLOAD_DIR, 'daily', dateStr);
    try {
        if (!fs.existsSync(dateDir)) return res.json([]);
        const files = fs.readdirSync(dateDir).map(filename => {
            const stat = fs.statSync(path.join(dateDir, filename));
            return { filename, originalname: filename.replace(/^\d+-/, ''), size: stat.size, date: stat.mtime };
        }).sort((a, b) => new Date(b.date) - new Date(a.date));
        res.json(files);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/daily-summary/:date/files/:filename/download', (req, res) => {
    const dateStr = req.params.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return res.status(400).json({ error: 'Invalid date format' });
    const filePath = path.join(UPLOAD_DIR, 'daily', dateStr, path.basename(req.params.filename));
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    res.download(filePath, req.params.filename.replace(/^\d+-/, ''));
});

// ─── PHOTO VISION PROCESSING (Type C / Type D) ────────────────────────────────
async function storePhotoData(dateStr, filename, photoType, data) {
    const ex = await pool.query(`SELECT photo_data FROM daily_summary WHERE report_date=$1`, [dateStr]);
    const row = ex.rows[0];
    const pd = row?.photo_data
        ? (typeof row.photo_data === 'string' ? JSON.parse(row.photo_data) : { ...row.photo_data })
        : {};
    pd[filename] = { type: photoType, data, ts: Date.now() };
    if (row) {
        await pool.query(`UPDATE daily_summary SET photo_data=$1 WHERE report_date=$2`, [JSON.stringify(pd), dateStr]);
    } else {
        await pool.query(`INSERT INTO daily_summary (report_date,photo_data,source) VALUES ($1,$2,'photo_scan')
            ON CONFLICT (report_date) DO UPDATE SET photo_data=$2`, [dateStr, JSON.stringify(pd)]);
    }
}

async function processPhotoFile(dateStr, filename, filePath) {
    const stat = fs.statSync(filePath);
    if (stat.size > 4 * 1024 * 1024) return null; // >4MB: skip, store as plain attachment

    const base64   = fs.readFileSync(filePath).toString('base64');
    const mimeType = /\.png$/i.test(filename) ? 'image/png' : 'image/jpeg';

    const OR_KEY = process.env.OPENROUTER_API_KEY;
    const callModel = async (model, prompt, maxTokens) => {
        const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${OR_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                max_tokens: maxTokens,
                messages: [{ role: 'user', content: [
                    { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
                    { type: 'text', text: prompt }
                ]}]
            })
        });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            const e = new Error(err?.error?.message || resp.statusText);
            e.status = resp.status;
            throw e;
        }
        const data = await resp.json();
        return (data.choices[0].message.content || '').trim();
    };

    const visionCall = async (prompt, maxTokens) => {
        try {
            return await callModel('google/gemma-4-26b-a4b-it:free', prompt, maxTokens);
        } catch (e) {
            if (e.status === 429) {
                // Rate-limited: wait 10s and retry via the free router
                await new Promise(r => setTimeout(r, 10000));
                return await callModel('openrouter/free', prompt, maxTokens);
            }
            throw e;
        }
    };

    // Step 1: classify
    let cls;
    try {
        cls = (await visionCall(
            'Is this image (A) a screenshot of accounting or billing software on a screen, ' +
            '(B) a handwritten paper ledger or expense sheet, or (C) neither? ' +
            'Reply with ONLY the single letter A, B, or C.',
            4
        )).replace(/[^ABCabc]/g,'').toUpperCase()[0];
    } catch(e) { return null; }

    if (!cls || cls === 'C') return null;

    let extracted;
    if (cls === 'A') {
        // Type C — POS software screenshot
        try {
            const raw = await visionCall(
                'This is a POS/accounting software screenshot (Profit by Sales or invoice list). ' +
                'Extract every visible row. Return ONLY valid JSON, no markdown:\n' +
                '{"invoices":[{"invoice_no":"","customer":"","amount":0,"cost":0,"gp":0}],' +
                '"totals":{"amount":0,"cost":0,"gp":0}}\n' +
                'Use 0 for any value you cannot read.',
                2048
            );
            extracted = JSON.parse(raw.replace(/^```json?\s*/,'').replace(/```\s*$/,'').trim());
        } catch(e) { extracted = { invoices: [], totals: { amount: 0, cost: 0, gp: 0 } }; }
        await storePhotoData(dateStr, filename, 'C', extracted);
        return { type: 'C', data: extracted };

    } else {
        // Type D — handwritten daily expense ledger
        try {
            const raw = await visionCall(
                'This is a photo of a handwritten daily business expense ledger sheet. ' +
                'Extract all visible data. Return ONLY valid JSON, no markdown:\n' +
                '{"petty_cash_float":0,' +
                '"expenses":[{"description":"","amount":0}],' +
                '"payments":[{"description":"","amount":0}],' +
                '"printed_totals":{"total_sale":0,"total_card":0,"total_online":0,' +
                '"total_cash":0,"cash_in":0,"cash_out":0,"cash_in_hand":0}}\n' +
                '"expenses" = left column ("Expences"), "payments" = right column ("Payment"). ' +
                'petty_cash_float = the float amount at the top of the sheet. Use 0 for unreadable values.',
                2048
            );
            extracted = JSON.parse(raw.replace(/^```json?\s*/,'').replace(/```\s*$/,'').trim());
        } catch(e) { extracted = { petty_cash_float: 0, expenses: [], payments: [], printed_totals: {} }; }
        await storePhotoData(dateStr, filename, 'D', extracted);
        return { type: 'D', data: extracted };
    }
}

// ── Converts an Excel cell value (serial number or date string) to YYYY-MM-DD ─
function parseCellDate(val) {
    if (val === null || val === undefined || val === '') return null;
    if (typeof val === 'number' && val > 40000 && val < 60000) {
        const d = new Date(Math.round((val - 25569) * 86400 * 1000));
        const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1, day = d.getUTCDate();
        if (y >= 2020 && y <= 2035)
            return `${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    }
    const s = String(val).trim();
    let m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;
    m2 = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
    if (m2) return `${m2[3]}-${m2[2].padStart(2,'0')}-${m2[1].padStart(2,'0')}`;
    const ts = Date.parse(s);
    if (!isNaN(ts)) {
        const dt = new Date(ts);
        if (dt.getFullYear() >= 2020 && dt.getFullYear() <= 2035)
            return dt.toISOString().slice(0, 10);
    }
    return null;
}

// ─── AUTO-RECALCULATE FROM UPLOADED EXCEL FILES ───────────────────────────────
async function recalculateDate(dateStr) {
    const dateDir = path.join(UPLOAD_DIR, 'daily', dateStr);
    const xlFiles = fs.existsSync(dateDir)
        ? fs.readdirSync(dateDir).filter(f => /\.(xlsx|xls)$/i.test(f))
        : [];

    let saleA = 0, cardA = 0, onlineA = 0, cheqA = 0, creditA = 0;
    let hasTypeA = false, hasTypeB = false, gpTotal = 0, lasersoftSaleTotal = 0;
    const typeALineItems = []; // {no, sale, card, online, cheq, credit} per Excel row
    const lsInvoiceRows  = []; // per-invoice rows from the POS Profit-by-Sales format

    for (const fname of xlFiles) {
        try {
            const wb = XLSX.read(fs.readFileSync(path.join(dateDir, fname)), { type: 'buffer' });
            const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: 0 });
            if (!rows.length) continue;
            const headers = Object.keys(rows[0]).map(k => String(k).trim().toUpperCase());
            const has = (...c) => c.some(h => headers.includes(h));
            const col = (row, ...cands) => {
                for (const c of cands) {
                    const k = Object.keys(row).find(k => String(k).trim().toUpperCase() === c);
                    if (k !== undefined) return parseFloat(row[k]) || 0;
                }
                return 0;
            };
            const strCol = (row, ...cands) => {
                for (const c of cands) {
                    const k = Object.keys(row).find(k => String(k).trim().toUpperCase() === c);
                    if (k !== undefined) return String(row[k]).trim();
                }
                return '';
            };
            if (has('SALES', 'SALE', 'CASH PAYMENT', 'CARD PAYMENT') || has('RECEPT NO', 'RECEIPT NO')) {
                hasTypeA = true;
                // Detect a DATE column so multi-day or historical Excels can be routed to the right date
                const rawRowsForDate = XLSX.utils.sheet_to_json(
                    wb.Sheets[wb.SheetNames[0]], { defval: '', raw: true });
                const dateColKey = rows[0]
                    ? Object.keys(rows[0]).find(k => /^date$/i.test(String(k).trim()))
                    : null;
                rows.forEach((r, i) => {
                    const sale   = col(r, 'SALES', 'SALE');
                    const card   = col(r, 'CARD PAYMENT', 'CARD');
                    const online = col(r, 'ONLINE PAYMENT', 'ONLINE');
                    const cheq   = col(r, 'CHEQ PAYMENT', 'CHEQUE PAYMENT', 'CHECK PAYMENT');
                    const credit = col(r, 'CREDIT');
                    const inv    = strCol(r, 'RECEPT NO', 'RECEIPT NO', 'RECEIPT NUMBER', 'RECPT NO');
                    // Prefer raw cell value for date serial parsing; fall back to string column
                    const rawVal = dateColKey && rawRowsForDate[i] ? rawRowsForDate[i][dateColKey] : null;
                    const rowDate = dateColKey
                        ? (parseCellDate(rawVal) || parseCellDate(r[dateColKey]) || null)
                        : null;
                    saleA   += sale;
                    cardA   += card;
                    onlineA += online;
                    cheqA   += cheq;
                    creditA += credit;
                    if (sale || card || online || cheq || credit) {
                        typeALineItems.push({ no: inv, sale, card, online, cheq, credit, rowDate });
                    }
                });
            } else if (has('COST') && has('AMOUNT', 'NETSLS', 'GPA', 'NETPRO')) {
                hasTypeB = true;
                const useGpa = has('GPA');
                rows.forEach(r => {
                    const amt = col(r, 'AMOUNT', 'NETSLS');
                    const cst = col(r, 'COST');
                    gpTotal            += useGpa ? col(r, 'GPA') : (amt - cst);
                    lasersoftSaleTotal += amt;
                });
            } else {
                // POS "Profit by Sales" report — header is not at row 0, scan for it.
                // Detected by finding a row containing NUMBER + AMOUNT + COST + GPA headers.
                const rawPBS = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '', header: 1 });
                let pbsHdrIdx = -1, pbsHdrMap = {};
                for (let i = 0; i < Math.min(rawPBS.length, 15); i++) {
                    const cells = rawPBS[i].map(c => String(c).trim().toUpperCase());
                    if (cells.includes('NUMBER') && cells.includes('AMOUNT') &&
                        cells.includes('COST')   && cells.includes('GPA')) {
                        pbsHdrIdx = i;
                        cells.forEach((c, j) => { if (c) pbsHdrMap[c] = j; });
                        break;
                    }
                }
                if (pbsHdrIdx >= 0) {
                    hasTypeB = true;
                    for (let i = pbsHdrIdx + 1; i < rawPBS.length; i++) {
                        const row  = rawPBS[i];
                        const num  = String(row[pbsHdrMap['NUMBER']] || '').trim();
                        if (!num || /^(TOTAL|GRAND|SUB)/i.test(num)) continue;
                        const amt  = parseFloat(row[pbsHdrMap['AMOUNT']]) || 0;
                        if (amt <= 0) continue;
                        // Date-filter when the file covers a range wider than one day
                        if ('DATE' in pbsHdrMap) {
                            const rowDate = parseCellDate(row[pbsHdrMap['DATE']]);
                            if (rowDate && rowDate !== dateStr) continue;
                        }
                        const cst  = parseFloat(row[pbsHdrMap['COST']]) || 0;
                        const gpa  = parseFloat(row[pbsHdrMap['GPA']]) || 0;
                        const cust = String(row[pbsHdrMap['CUSTOMER']] || '').trim();
                        const bal  = parseFloat(row[pbsHdrMap['BALANCE']]) || 0;
                        gpTotal           += gpa || (amt - cst);
                        lasersoftSaleTotal += amt;
                        lsInvoiceRows.push({
                            number:   num,
                            customer: cust || 'CASH',
                            amount:   amt,
                            cost:     Math.round(cst * 100) / 100,
                            gpa:      Math.round(gpa * 100) / 100,
                            payment:  bal > 0 ? 'CREDIT' : 'CASH'
                        });
                    }
                }
            }
        } catch(e) { /* skip unparseable file */ }
    }

    // ── Historical back-fill: rows whose date column ≠ dateStr → write to the correct past date ──
    // Groups by rowDate; any date != dateStr is a historical entry from a different day.
    // Excel-import = master truth for Sales; existing manual_entry rows get the conflict flag.
    const histGroups = {};
    for (const item of typeALineItems) {
        const target = (item.rowDate && item.rowDate !== dateStr) ? item.rowDate : dateStr;
        if (target === dateStr) continue; // handled by the main recalc block below
        if (!histGroups[target]) histGroups[target] = { saleA:0, cardA:0, onlineA:0, cheqA:0, creditA:0 };
        histGroups[target].saleA   += item.sale;
        histGroups[target].cardA   += item.card;
        histGroups[target].onlineA += item.online;
        histGroups[target].cheqA   += item.cheq;
        histGroups[target].creditA += item.credit;
    }
    for (const [targetDate, g] of Object.entries(histGroups)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) continue; // sanity check
        const cashSaleG = Math.max(0, g.saleA - g.cardA - g.onlineA - g.cheqA - g.creditA);
        const exG = await pool.query(`SELECT sales_source, total_sale FROM daily_summary WHERE report_date=$1`, [targetDate]);
        const exRow = exG.rows[0];
        if (exRow) {
            const isManual = exRow.sales_source === 'manual_entry';
            const diff = Math.abs(g.saleA - parseFloat(exRow.total_sale || 0));
            if (isManual && diff > 10) {
                await pool.query(
                    `UPDATE daily_summary SET sales_conflict=TRUE, sales_conflict_excel=$1, updated_at=NOW() WHERE report_date=$2`,
                    [g.saleA, targetDate]);
            } else {
                await pool.query(
                    `UPDATE daily_summary SET
                       total_sale=$1, cash_sale=$2, card_sale=$3, online_sale=$4,
                       cheq_payment=$5, credit_sale=$6,
                       sales_source='excel_import', sales_conflict=FALSE, sales_conflict_excel=NULL,
                       updated_at=NOW()
                     WHERE report_date=$7`,
                    [g.saleA, cashSaleG, g.cardA, g.onlineA, g.cheqA, g.creditA, targetDate]);
            }
        } else {
            await pool.query(`
                INSERT INTO daily_summary
                  (report_date,total_sale,cash_sale,card_sale,online_sale,credit_sale,
                   total_expenses,cash_out,cash_in_hand,cheq_payment,
                   gross_profit,net_profit,gp_status,source,sales_source,expenses_source)
                VALUES ($1,$2,$3,$4,$5,$6,0,0,0,$7,0,0,'NOT_AVAILABLE','file_auto','excel_import','unknown')
                ON CONFLICT (report_date) DO NOTHING`,
                [targetDate, g.saleA, cashSaleG, g.cardA, g.onlineA, g.creditA, g.cheqA]);
        }
        console.log(`[recalc] Historical write → ${targetDate}: sale=${g.saleA} (from file in ${dateStr} folder)`);
    }

    // Invoice list for Type C cross-check (invoice_no → sale amount)
    const typeAInvoices = typeALineItems
        .filter(i => i.no && /\d/.test(i.no))
        .map(i => ({ no: i.no, amount: i.sale }));

    const existing = await pool.query(`SELECT * FROM daily_summary WHERE report_date=$1`, [dateStr]);
    const ex = existing.rows[0];

    // Read stored photo_data for Type C (GP fallback) and Type D (petty float)
    const photoData = ex?.photo_data
        ? (typeof ex.photo_data === 'string' ? JSON.parse(ex.photo_data) : ex.photo_data)
        : {};
    const photoVals  = Object.values(photoData || {});
    const typeCEntry = photoVals.find(p => p.type === 'C' && +p.data?.totals?.gp > 0);
    const typeDEntry = photoVals.find(p => p.type === 'D');

    // Use Type C photo as GP source when no Type B Excel exists
    if (!hasTypeB && typeCEntry) {
        hasTypeB = true;
        gpTotal   = typeCEntry.data.totals.gp || 0;
    }

    const manualExpenses   = ex ? +ex.total_expenses : 0;
    const manualCashOut    = ex ? +ex.cash_out : 0;
    const cashSale         = hasTypeA ? Math.max(0, saleA - cardA - onlineA - cheqA - creditA) : (ex ? +ex.cash_sale : 0);
    let gpStatus      = hasTypeB ? 'ACTUAL' : (ex ? ex.gp_status : 'NOT_AVAILABLE');
    let grossProfit   = hasTypeB ? gpTotal : (ex ? +ex.gross_profit : 0);

    // ── GP BLEND: add estimated GP for manual/unsynced bills ──────────────────
    // Applies when: POS GP is known AND total Excel sale > POS sale total
    // Rule: estimate manual bill GP using that same day's POS avg GP%
    let manualSaleTotal  = null, manualGpEstimate = null, gpBlendNote = null;
    const lsTotalForBlend = hasTypeB && lasersoftSaleTotal > 0 ? lasersoftSaleTotal : 0;
    if (hasTypeB && lsTotalForBlend > 0 && saleA > lsTotalForBlend + 1) {
        manualSaleTotal  = Math.round((saleA - lsTotalForBlend) * 100) / 100;
        const lsGpPct    = gpTotal / lsTotalForBlend;
        manualGpEstimate = Math.round(manualSaleTotal * lsGpPct * 100) / 100;
        grossProfit      = Math.round((gpTotal + manualGpEstimate) * 100) / 100;
        gpStatus         = 'BLENDED';
        gpBlendNote      = `LS GP ${gpTotal.toFixed(2)} on sale ${lsTotalForBlend}; est. ${manualGpEstimate.toFixed(2)} on manual sale ${manualSaleTotal} at ${(lsGpPct*100).toFixed(2)}% avg GP`;
    }
    // ─────────────────────────────────────────────────────────────────────────

    const netProfit = (gpStatus !== 'NOT_AVAILABLE' && manualExpenses > 0)
        ? Math.round((grossProfit - manualExpenses) * 100) / 100 : 0;

    // Build file-extracted detail rows to persist to DB
    // Only overwrite a section if it's currently empty (preserve manual entries)
    const existingDetails = ex?.details
        ? (typeof ex.details === 'string' ? JSON.parse(ex.details) : ex.details)
        : {};
    const fileDetails = {};
    if (hasTypeA && typeALineItems.length) {
        const mk = (key, field) => {
            const items = typeALineItems.filter(i => i[field] > 0).map(i => ({ desc: i.no || field, amount: i[field] }));
            if (items.length && (!existingDetails[key] || !existingDetails[key].length)) fileDetails[key] = items;
        };
        mk('total-sale',   'sale');
        mk('card-sale',    'card');
        mk('online-sale',  'online');
        mk('cheq-total',   'cheq');
        mk('credit-total', 'credit');
    }
    if (typeDEntry) {
        const expItems = (typeDEntry.data.expenses || []).filter(r => +r.amount > 0);
        const payItems = (typeDEntry.data.payments || []).filter(r => +r.amount > 0);
        if (expItems.length && (!existingDetails['total-expenses'] || !existingDetails['total-expenses'].length))
            fileDetails['total-expenses'] = expItems.map(r => ({ desc: r.description || 'Expense', amount: +r.amount }));
        if (payItems.length && (!existingDetails['payments'] || !existingDetails['payments'].length))
            fileDetails['payments'] = payItems.map(r => ({ desc: r.description || 'Payment', amount: +r.amount }));
    }
    // Persist POS per-invoice rows from Profit-by-Sales format → details.lasersoft_invoices
    if (lsInvoiceRows.length && !existingDetails.lasersoft_invoices?.length)
        fileDetails['lasersoft_invoices'] = lsInvoiceRows;
    const mergedDetails = Object.keys(fileDetails).length
        ? { ...existingDetails, ...fileDetails }
        : existingDetails;

    // Right column of handwritten sheet = Payments (cash OUT for cash flow; excluded from P&L net_profit)
    const photoPayments = (typeDEntry?.data?.payments || []).reduce((s, p) => s + (+p.amount || 0), 0);

    if (ex) {
        const parts = [], params = [dateStr];
        const p = v => { params.push(v); return `$${params.length}`; };
        if (hasTypeA) {
            const isManualSales = ex.sales_source === 'manual_entry';
            const saleDiff = Math.abs(saleA - parseFloat(ex.total_sale || 0));
            if (isManualSales && saleDiff > 10) {
                parts.push(`sales_conflict=${p(true)}`, `sales_conflict_excel=${p(saleA)}`);
            } else {
                parts.push(`total_sale=${p(saleA)}`,`cash_sale=${p(cashSale)}`,`card_sale=${p(cardA)}`,
                           `online_sale=${p(onlineA)}`,`cheq_payment=${p(cheqA)}`,`credit_sale=${p(creditA)}`,
                           `sales_source='excel_import'`,`sales_conflict=${p(false)}`,`sales_conflict_excel=${p(null)}`);
            }
        }
        if (typeDEntry) parts.push(`expenses_source='handwritten_log'`);
        if (photoPayments > 0) parts.push(`payments=${p(photoPayments)}`);
        if (Object.keys(fileDetails).length) parts.push(`details=${p(JSON.stringify(mergedDetails))}`);
        parts.push(
            `gp_status=${p(gpStatus)}`, `gross_profit=${p(grossProfit)}`, `net_profit=${p(netProfit)}`,
            `source='file_auto'`,
            `lasersoft_total=${p(lsTotalForBlend > 0 ? lsTotalForBlend : null)}`,
            `manual_sale_total=${p(manualSaleTotal)}`,
            `manual_gp_estimate=${p(manualGpEstimate)}`,
            `gp_blend_note=${p(gpBlendNote)}`
        );
        await pool.query(`UPDATE daily_summary SET ${parts.join(',')} WHERE report_date=$1`, params);
    } else if (hasTypeA || hasTypeB) {
        await pool.query(`
            INSERT INTO daily_summary
              (report_date,total_sale,cash_sale,card_sale,online_sale,credit_sale,
               total_expenses,cash_out,cash_in_hand,cheq_payment,gross_profit,net_profit,gp_status,source,
               payments,details,sales_source,expenses_source,
               lasersoft_total,manual_sale_total,manual_gp_estimate,gp_blend_note)
            VALUES ($1,$2,$3,$4,$5,$6,0,0,0,$7,$8,$9,$10,'file_auto',$11,$12,'excel_import','unknown',$13,$14,$15,$16)
            ON CONFLICT (report_date) DO NOTHING`,
            [dateStr, hasTypeA?saleA:0, hasTypeA?cashSale:0, hasTypeA?cardA:0, hasTypeA?onlineA:0,
             hasTypeA?creditA:0, hasTypeA?cheqA:0, grossProfit, netProfit, gpStatus,
             photoPayments, JSON.stringify(mergedDetails),
             lsTotalForBlend > 0 ? lsTotalForBlend : null,
             manualSaleTotal, manualGpEstimate, gpBlendNote]);
    }

    // Type C invoice cross-check: identify specific Excel invoices not confirmed in the POS
    let typeCRecon = null;
    if (typeCEntry && typeCEntry.data?.invoices?.length) {
        const photoInvoices = typeCEntry.data.invoices
            .filter(i => i.invoice_no)
            .map(i => ({ no: String(i.invoice_no).trim(), amount: +(i.amount||0), gp: +(i.gp||0) }));
        const photoNos = photoInvoices.map(i => i.no);
        const excelNos = typeAInvoices.map(i => i.no);
        const match = (a, b) => a === b || a.includes(b) || b.includes(a);
        const matched     = photoNos.filter(n => excelNos.some(r => match(r, n)));
        const inPhotoOnly = photoInvoices.filter(i => !excelNos.some(r => match(r, i.no)));
        const inExcelOnly = typeAInvoices.filter(i => !photoNos.some(n => match(i.no, n)));
        // Zero or negative GP items need review
        const zeroGpItems = photoInvoices.filter(i => i.gp <= 0 && i.amount > 0)
            .map(i => ({ no: i.no, amount: i.amount, gp: i.gp }));
        const photoTotal  = photoInvoices.reduce((s, i) => s + i.amount, 0);
        typeCRecon = {
            matched:       matched.length,
            in_photo_only: inPhotoOnly.length,
            in_excel_only: inExcelOnly.length,
            photo_total:   photoNos.length,
            excel_total:   typeAInvoices.length,
            // Specific pending invoices (in Excel but not confirmed in the POS)
            pending_items: inExcelOnly.map(i => ({ no: i.no, amount: i.amount })),
            gap_amount:    Math.round((saleA - photoTotal) * 100) / 100,
            zero_gp_items: zeroGpItems,
            excel_total_amount: saleA,
            photo_confirmed_amount: photoTotal,
        };
    }

    // Cash reconciliation: Cash Received (loan repayments etc.) = cash IN, netted with cash out
    const pettyFloat     = +(typeDEntry?.data?.petty_cash_float || 0);
    const cashPaymentAmt = hasTypeA ? cashSale : (ex ? +ex.cash_sale : 0);
    const expensesAmt    = ex ? +ex.total_expenses : 0;
    const cashOutAmt     = manualCashOut;
    const cashReceivedAmt = ex ? +ex.cash_received : 0;
    const cashInHandAmt  = ex ? +ex.cash_in_hand : 0;
    const expectedCash   = pettyFloat + cashPaymentAmt + cashReceivedAmt - expensesAmt - cashOutAmt - photoPayments;
    const cashRecon = (cashInHandAmt > 0 || pettyFloat > 0 || cashPaymentAmt > 0) ? {
        expected:      Math.round(expectedCash * 100) / 100,
        entered:       cashInHandAmt,
        delta:         Math.round(Math.abs(expectedCash - cashInHandAmt) * 100) / 100,
        flag:          Math.abs(expectedCash - cashInHandAmt) > 10,
        pettyFloat,
        cashReceived:  cashReceivedAmt,
    } : null;

    const updated = await pool.query(
        `SELECT *,TO_CHAR(report_date,'YYYY-MM-DD') as date_str FROM daily_summary WHERE report_date=$1`, [dateStr]);
    return {
        summary:   updated.rows[0] || null,
        detected:  { typeA: hasTypeA, typeB: hasTypeB, typeC: !!typeCEntry, typeD: !!typeDEntry },
        cashRecon,
        typeCRecon,
        typeDData: typeDEntry?.data || null,
    };
}

app.delete('/api/daily-summary/:date/files/:filename', async (req, res) => {
    const dateStr = req.params.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return res.status(400).json({ error: 'Invalid date' });
    const filePath = path.join(UPLOAD_DIR, 'daily', dateStr, path.basename(req.params.filename));
    try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        const result = await recalculateDate(dateStr);
        res.json({ ok: true, ...result });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── ADMIN: RESCAN ALL HISTORICAL UPLOAD FOLDERS ─────────────────────────────
// Walks every uploads/daily/YYYY-MM-DD/ folder and re-runs recalculateDate on it.
// Idempotent: existing DB rows follow the normal update/conflict logic.
// Kicks off in background so the response returns immediately.
app.post('/api/admin/rescan-uploads', async (req, res) => {
    const dailyRoot = path.join(UPLOAD_DIR, 'daily');
    if (!fs.existsSync(dailyRoot)) return res.json({ started: false, reason: 'uploads/daily not found' });
    const dateFolders = fs.readdirSync(dailyRoot)
        .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
        .sort();
    res.json({ started: true, folders: dateFolders.length });
    (async () => {
        for (const folder of dateFolders) {
            const folderPath = path.join(dailyRoot, folder);
            const hasRelevant = fs.readdirSync(folderPath)
                .some(f => /\.(xlsx|xls|jpg|jpeg|png)$/i.test(f));
            if (!hasRelevant) continue;
            try {
                await recalculateDate(folder);
                console.log(`[rescan] ✓ ${folder}`);
            } catch(e) {
                console.error(`[rescan] ✗ ${folder}:`, e.message);
            }
        }
        console.log('[rescan] Historical upload rescan complete.');
    })();
});

// ─── FIELD OVERRIDE — uncertainty-indicator inline edit ──────────────────────
// Global auth middleware (line ~90) already requires login for all /api/ routes.
// Only three numeric fields are overridable; everything else is rejected.
app.patch('/api/daily-summary/:date/field', async (req, res) => {
    const SAFE = new Set(['gross_profit', 'total_expenses', 'total_sale']);
    const { field, value, clearFlag } = req.body || {};
    const date = req.params.date;
    if (!SAFE.has(field))
        return res.status(400).json({ error: `field '${field}' not overridable` });
    const val = parseFloat(value);
    if (isNaN(val) || val < 0)
        return res.status(400).json({ error: 'value must be a non-negative number' });
    try {
        // Read old value before overwriting, for the audit log
        const prev = await pool.query(
            `SELECT ${field}, override_log FROM daily_summary WHERE report_date=$1`, [date]);
        const oldVal = parseFloat(prev.rows[0]?.[field]) || 0;
        const existingLog = prev.rows[0]?.override_log || [];

        await pool.query(
            `UPDATE daily_summary SET ${field}=$1, updated_at=NOW() WHERE report_date=$2`,
            [val, date]);
        if (field === 'gross_profit') {
            await pool.query(
                `UPDATE daily_summary SET gp_status='ACTUAL', day_status=NULL,
                 net_profit=ROUND(gross_profit-total_expenses,2)
                 WHERE report_date=$1 AND total_expenses>0`, [date]);
        }
        if (field === 'total_expenses') {
            await pool.query(
                `UPDATE daily_summary SET net_profit=ROUND(gross_profit-total_expenses,2)
                 WHERE report_date=$1 AND gp_status='ACTUAL'`, [date]);
        }
        if (clearFlag) {
            const r = await pool.query(
                `SELECT checker_flags FROM daily_summary WHERE report_date=$1`, [date]);
            const existing = JSON.parse(r.rows[0]?.checker_flags || '[]');
            await pool.query(
                `UPDATE daily_summary SET checker_flags=$1 WHERE report_date=$2`,
                [JSON.stringify(existing.filter(f => f !== clearFlag)), date]);
        }
        // Append to override_log (admin audit trail)
        const logEntry = {
            ts:      new Date().toISOString(),
            user:    req.session?.user || 'admin',
            field,
            old_val: oldVal,
            new_val: val,
        };
        await pool.query(
            `UPDATE daily_summary SET override_log = COALESCE(override_log,'[]'::jsonb) || $1::jsonb WHERE report_date=$2`,
            [JSON.stringify([logEntry]), date]);

        res.json({ ok: true, logged: logEntry });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── WEEKLY / MONTHLY CHARTS ──────────────────────────────────────────────────
app.get('/api/weekly-chart', async (req, res) => {
    try {
        const r = await pool.query(`
            SELECT TO_CHAR(report_date,'Dy') as label, report_date,
                   SUM(total_sale) as total
            FROM daily_summary
            WHERE report_date >= DATE_TRUNC('week', CURRENT_DATE)
            GROUP BY report_date ORDER BY report_date`);
        res.json(r.rows);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/monthly-chart', async (req, res) => {
    try {
        const r = await pool.query(`
            SELECT 'Wk '||CEIL(EXTRACT(DAY FROM report_date)/7.0)::int as label,
                   SUM(total_sale) as total
            FROM daily_summary
            WHERE TO_CHAR(report_date,'YYYY-MM') = TO_CHAR(CURRENT_DATE,'YYYY-MM')
            GROUP BY 1 ORDER BY 1`);
        res.json(r.rows);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/weekly-detail', async (req, res) => {
    const { start } = req.query;
    if (!start) return res.json({ days: [], totals: {}, payments: [] });
    try {
        const end = new Date(start); end.setDate(end.getDate()+6);
        const endStr = end.toISOString().slice(0,10);
        const [days, totals, payments, salary, supplier] = await Promise.all([
            pool.query(`SELECT *, TO_CHAR(report_date,'YYYY-MM-DD') as date_str, ${TIER_EXPR} as data_tier, ${CASH_IN_EXPR} as cash_in_total,
                        ${CASH_OUT_EXPR} as cash_out_total
                        FROM daily_summary WHERE report_date BETWEEN $1 AND $2 ORDER BY report_date`, [start, endStr]),
            pool.query(`SELECT SUM(total_sale) as total_sale, SUM(total_expenses) as total_expenses,
                        SUM(payments) as payments, SUM(cash_in_hand) as cash_in_hand,
                        SUM(CASE WHEN ${TIER_EXPR}='FULL' THEN gross_profit-total_expenses ELSE 0 END) as net_profit,
                        COUNT(*) FILTER (WHERE gp_status <> 'NOT_AVAILABLE') as gp_days,
                        COUNT(*) as total_days,
                        COUNT(*) FILTER (WHERE ${TIER_EXPR}='FULL') as tier_full_days,
                        COUNT(*) FILTER (WHERE ${TIER_EXPR}='CASHFLOW') as tier_cashflow_days,
                        COUNT(*) FILTER (WHERE ${TIER_EXPR}='FOUNDATION') as tier_foundation_days,
                        SUM(${CASH_IN_EXPR}) as cash_in_total,
                        SUM(${CASH_OUT_EXPR}) as cash_out_total,
                        SUM(cash_sale) as cash_sale_total,
                        SUM(card_sale) as card_sale_total,
                        SUM(online_sale) as online_sale_total,
                        SUM(cheq_payment) as cheq_payment_total,
                        SUM(credit_sale) as credit_sale_total
                        FROM daily_summary WHERE report_date BETWEEN $1 AND $2`, [start, endStr]),
            pool.query('SELECT * FROM payments_detail WHERE report_date BETWEEN $1 AND $2 ORDER BY amount DESC LIMIT 10', [start, endStr]),
            pool.query(`SELECT SUM(amount+commission) FROM staff_salary WHERE pay_date BETWEEN $1 AND $2`, [start, endStr]),
            pool.query(`SELECT SUM(amount) FROM supplier_payments WHERE pay_date BETWEEN $1 AND $2`, [start, endStr]),
        ]);
        res.json({
            days: days.rows, totals: totals.rows[0]||{}, payments: payments.rows,
            salary_total: salary.rows[0]?.sum||0,
            supplier_total: supplier.rows[0]?.sum||0,
        });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/monthly-detail', async (req, res) => {
    const { month } = req.query;
    if (!month) return res.json({ days: [], totals: {} });
    try {
        const [days, totals, salary, supplier] = await Promise.all([
            pool.query(`SELECT *, TO_CHAR(report_date,'YYYY-MM-DD') as date_str, ${TIER_EXPR} as data_tier, ${CASH_IN_EXPR} as cash_in_total,
                        ${CASH_OUT_EXPR} as cash_out_total
                        FROM daily_summary WHERE TO_CHAR(report_date,'YYYY-MM')=$1 ORDER BY report_date`, [month]),
            pool.query(`SELECT SUM(total_sale) as total_sale, SUM(total_expenses) as total_expenses,
                        SUM(payments) as payments, SUM(cash_in_hand) as cash_in_hand,
                        SUM(CASE WHEN ${TIER_EXPR}='FULL' THEN gross_profit-total_expenses ELSE 0 END) as net_profit,
                        COUNT(*) FILTER (WHERE gp_status <> 'NOT_AVAILABLE') as gp_days,
                        COUNT(*) as total_days,
                        COUNT(*) FILTER (WHERE ${TIER_EXPR}='FULL') as tier_full_days,
                        COUNT(*) FILTER (WHERE ${TIER_EXPR}='CASHFLOW') as tier_cashflow_days,
                        COUNT(*) FILTER (WHERE ${TIER_EXPR}='FOUNDATION') as tier_foundation_days,
                        SUM(${CASH_IN_EXPR}) as cash_in_total,
                        SUM(${CASH_OUT_EXPR}) as cash_out_total,
                        SUM(cash_sale) as cash_sale_total,
                        SUM(card_sale) as card_sale_total,
                        SUM(online_sale) as online_sale_total,
                        SUM(cheq_payment) as cheq_payment_total,
                        SUM(credit_sale) as credit_sale_total
                        FROM daily_summary WHERE TO_CHAR(report_date,'YYYY-MM')=$1`, [month]),
            pool.query(`SELECT SUM(amount+commission) FROM staff_salary WHERE TO_CHAR(pay_date,'YYYY-MM')=$1`, [month]),
            pool.query(`SELECT SUM(amount) FROM supplier_payments WHERE TO_CHAR(pay_date,'YYYY-MM')=$1`, [month]),
        ]);
        res.json({
            days: days.rows, totals: totals.rows[0]||{},
            salary_total: salary.rows[0]?.sum||0,
            supplier_total: supplier.rows[0]?.sum||0,
        });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── SIMPLE DATE-RANGE QUERY ───────────────────────────────────────────────────
app.get('/api/query', async (req, res) => {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to are required (YYYY-MM-DD)' });
    try {
        const r = await pool.query(`
            SELECT
                COALESCE(SUM(total_sale),0) as total_revenue,
                COALESCE(SUM(gross_profit),0) as total_gp,
                COALESCE(SUM(total_expenses),0) as total_expenses,
                COALESCE(SUM(CASE WHEN gp_status IN ('ACTUAL','ESTIMATE') AND total_expenses > 0 THEN gross_profit-total_expenses ELSE 0 END),0) as net_profit,
                COUNT(*) as days_count,
                CASE
                    WHEN COUNT(*) FILTER (WHERE ${TIER_EXPR}='FOUNDATION') > 0 THEN 'FOUNDATION'
                    WHEN COUNT(*) FILTER (WHERE ${TIER_EXPR}='CASHFLOW') > 0 THEN 'CASHFLOW'
                    WHEN COUNT(*) > 0 THEN 'FULL'
                    ELSE 'NONE'
                END as data_tier
            FROM daily_summary WHERE report_date BETWEEN $1 AND $2`, [from, to]);
        res.json(r.rows[0]);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── STAFF ────────────────────────────────────────────────────────────────────
app.get('/api/staff', async (req, res) => {
    try {
        // Use scalar subqueries (not LEFT JOINs) for the salary and loans
        // aggregates — joining both staff_salary and staff_loans in one query
        // creates a cross product per staff_id, multiplying every SUM() by the
        // row count of the other table (e.g. a staff member with 4 loan rows made
        // his salary/commission totals come out 4x too high).
        const r = await pool.query(`
            SELECT s.*,
                (SELECT COALESCE(SUM(amount),0) FROM staff_salary WHERE staff_id=s.id) as total_salary,
                (SELECT COALESCE(SUM(commission),0) FROM staff_salary WHERE staff_id=s.id) as total_commission,
                (SELECT COALESCE(SUM(amount),0) FROM staff_loans WHERE staff_id=s.id) as total_loans,
                (SELECT COALESCE(SUM(amount)-SUM(repaid),0) FROM staff_loans WHERE staff_id=s.id) as outstanding
            FROM staff s
            WHERE s.active=true ORDER BY s.name`);
        res.json(r.rows);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/staff', async (req, res) => {
    const { name, phone, role, base_salary, commission_pct, join_date } = req.body;
    try {
        const r = await pool.query(
            `INSERT INTO staff (name,phone,role,base_salary,commission_pct,join_date)
             VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
            [name, phone, role||'sales', base_salary||0, commission_pct || parseFloat(process.env.COMMISSION_RATE_PCT || 0), join_date||null]);
        res.status(201).json(r.rows[0]);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/staff/:id/salary', async (req, res) => {
    try {
        const r = await pool.query('SELECT * FROM staff_salary WHERE staff_id=$1 ORDER BY pay_date DESC', [req.params.id]);
        res.json(r.rows);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/staff/:id/salary', async (req, res) => {
    const { pay_date, amount, commission, notes } = req.body;
    try {
        const r = await pool.query(
            `INSERT INTO staff_salary (staff_id,pay_date,amount,commission,notes)
             VALUES ($1,$2,$3,$4,$5) RETURNING *`,
            [req.params.id, pay_date, amount, commission||0, notes]);
        res.status(201).json(r.rows[0]);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/staff/:id/loans', async (req, res) => {
    try {
        const r = await pool.query('SELECT * FROM staff_loans WHERE staff_id=$1 ORDER BY loan_date DESC', [req.params.id]);
        res.json(r.rows);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── SUPPLIERS ────────────────────────────────────────────────────────────────
app.get('/api/suppliers', async (req, res) => {
    try {
        await ensureVoids(pool);
        const r = await pool.query(`
            SELECT s.*, COALESCE(SUM(p.amount),0) as total_paid,
                   TO_CHAR(MAX(p.pay_date),'YYYY-MM-DD') as last_payment,
                   COALESCE(CURRENT_DATE - MAX(p.pay_date), -1) as days_since_payment,
                   COALESCE(SUM(CASE WHEN ch.status='pending' THEN ch.amount END),0) as pending_cheques
            FROM suppliers s
            LEFT JOIN supplier_payments p ON p.supplier_id=s.id
            LEFT JOIN cheques ch ON ch.notes ILIKE '%'||s.name||'%'
            WHERE s.active=true AND ${notVoided('suppliers', 's.id')} GROUP BY s.id ORDER BY s.name`);
        res.json(r.rows);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/suppliers', async (req, res) => {
    const { name, phone, category, notes } = req.body;
    try {
        const r = await pool.query(
            `INSERT INTO suppliers (name,phone,category,notes) VALUES ($1,$2,$3,$4) RETURNING *`,
            [name, phone, category, notes]);
        res.status(201).json(r.rows[0]);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/suppliers/:id/payments', async (req, res) => {
    try {
        const r = await pool.query('SELECT * FROM supplier_payments WHERE supplier_id=$1 ORDER BY pay_date DESC', [req.params.id]);
        res.json(r.rows);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// Today's purchases (supplier payments made today) — for Home page "Purchases Today" card
app.get('/api/purchases-today', async (req, res) => {
    try {
        const r = await pool.query(`
            SELECT p.*, s.name as supplier_name
            FROM supplier_payments p
            JOIN suppliers s ON s.id=p.supplier_id
            WHERE p.pay_date = CURRENT_DATE AND ${notVoided('suppliers', 's.id')}
            ORDER BY p.amount DESC`);
        const total = r.rows.reduce((a,row)=>a+(+row.amount||0),0);
        res.json({ date: todayLK(), total, count: r.rows.length, rows: r.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── REPORT DOWNLOAD (Excel / summary) ───────────────────────────────────────
app.get('/api/report-download', async (req, res) => {
    const { date, detail } = req.query;
    if (!date) return res.status(400).json({ error: 'date required' });
    try {
        const XLSX = require('xlsx');
        const ds = await pool.query(`
            SELECT *, TO_CHAR(report_date,'YYYY-MM-DD') as date_str,
              ${TIER_EXPR} as data_tier
            FROM daily_summary WHERE report_date=$1`, [date]);
        if (!ds.rowCount) return res.status(404).json({ error: 'No data for date' });
        const s = ds.rows[0];
        const inv = await pool.query(`SELECT * FROM daily_reports WHERE report_date=$1 ORDER BY created_at`, [date]);
        const det = s.details ? (typeof s.details === 'string' ? JSON.parse(s.details) : s.details) : {};

        const wb = XLSX.utils.book_new();

        // Sheet 1 — Summary
        const summaryRows = [
            ['YOUR BUSINESS NAME (PVT) LTD — DAILY REPORT'],
            [`Date: ${s.date_str}`],
            [''],
            ['SALES SUMMARY', '', '', ''],
            ['Total Sale (incl. pending)',       +s.total_sale || 0],
            ['POS Confirmed Total',               +s.lasersoft_total || 0],
            ['Cash Collected',                    +s.cash_sale || 0],
            ['Card',                              +s.card_sale || 0],
            ['Online',                            +s.online_sale || 0],
            ['Cheque',                            +s.cheq_payment || 0],
            ['Credit',                            +s.credit_sale || 0],
            [''],
            ['PROFITABILITY', '', '', ''],
            ['Gross Profit (POS)',                +s.gross_profit || 0],
            ['Total Expenses (non-salary)',        +s.total_expenses || 0],
            ['Salary',                             +s.salary || 0],
            ['Other Payments',                     +s.payments || 0],
            ['Net Profit',                         +s.net_profit || 0],
            [''],
            ['CASH FLOW', '', '', ''],
            ['Cash In (from customers)',           +s.cash_in || 0],
            ['Cash Out (expenses+salary)',         +s.cash_out || 0],
            ['Cash In Hand (end of day)',          +s.cash_in_hand || 0],
            [''],
            ['STAFF PAYMENTS', '', '', ''],
            ['Staff Payments Total',               +s.staff_payments_total || 0],
            ['Commission Note',                    det.staff_commission_note ? +det.staff_commission_note.total : 0],
            ['Salary Note',                        det.staff_salary_note ? +det.staff_salary_note.total : 0],
            [''],
            ['Data Quality',                       s.data_tier],
            ['Reconciliation Status',              s.reconciliation_status || ''],
        ];
        const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
        wsSummary['!cols'] = [{ wch: 35 }, { wch: 18 }];
        XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

        if (detail === 'full') {
            // Sheet 2 — Invoices
            const invHeaders = ['Invoice #', 'Total Sale', 'Cash', 'Card', 'Online', 'Cheque', 'Credit', 'Notes'];
            const invRows = inv.rows.map(r => [r.invoice_no||'', +r.total_sale||0, +r.cash_amount||0,
                +r.card_amount||0, +r.online_amount||0, +r.cheque_amount||0, +r.credit_amount||0, r.notes||'']);
            // Also add POS invoices from details if available
            const lsInv = det.lasersoft_invoices || [];
            const lsRows = lsInv.map(i => {
                const pay = (i.payment || '').toUpperCase();
                return [i.number||'', +i.amount||0, pay==='CASH'?+i.amount||0:0,
                        0, pay.includes('ONLINE')?+i.amount||0:0, 0, 0, i.customer||''];
            });
            const wsInv = XLSX.utils.aoa_to_sheet([invHeaders, ...(invRows.length ? invRows : lsRows)]);
            wsInv['!cols'] = [{wch:15},{wch:14},{wch:12},{wch:12},{wch:12},{wch:12},{wch:12},{wch:25}];
            XLSX.utils.book_append_sheet(wb, wsInv, 'Invoices');

            // Sheet 3 — Expenses
            const expDet = det.expenses_breakdown || {};
            const expRows = Object.entries(expDet)
                .filter(([k]) => !['total','note'].includes(k))
                .map(([k, v]) => [k.replace(/_/g,' '), v]);
            const wsExp = XLSX.utils.aoa_to_sheet([['Item','Amount'], ...expRows, ['TOTAL', +s.total_expenses + +s.salary]]);
            XLSX.utils.book_append_sheet(wb, wsExp, 'Expenses');

            // Sheet 4 — Staff Payments
            const commBk = det.staff_commission_note ? Object.entries(det.staff_commission_note.breakdown||{}).map(([n,v])=>[n, typeof v==='object'?v.net:v,'Commission']) : [];
            const salBk  = det.staff_salary_note     ? Object.entries(det.staff_salary_note.breakdown||{}).map(([n,v])=>[n, v, 'Salary']) : [];
            const wsStaff = XLSX.utils.aoa_to_sheet([['Name','Amount','Type'], ...commBk, ...salBk, ['TOTAL', +s.staff_payments_total||0, '']]);
            XLSX.utils.book_append_sheet(wb, wsStaff, 'Staff Payments');
        }

        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Disposition', `attachment; filename="BATHCO_Report_${date}_${detail||'summary'}.xlsx"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buf);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── REPORT DOWNLOAD — DATE RANGE (Excel) ─────────────────────────────────────
app.get('/api/report-download-range', async (req, res) => {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to dates required' });
    try {
        const result = await pool.query(`
            SELECT TO_CHAR(report_date,'YYYY-MM-DD') as date_str,
                   total_sale, cash_sale, card_sale, online_sale, cheq_payment, credit_sale,
                   total_expenses, payments, salary, cash_out, cash_received,
                   net_profit, gross_profit, cash_in_hand,
                   gp_status,
                   CASE WHEN gp_status='ACTUAL' AND total_expenses>0 THEN 'FULL'
                        WHEN (cash_sale+card_sale+online_sale+credit_sale)>0 THEN 'CASHFLOW'
                        ELSE 'FOUNDATION' END as data_tier
            FROM daily_summary
            WHERE report_date BETWEEN $1 AND $2
            ORDER BY report_date`, [from, to]);

        // Build full date spine — every calendar day in range, not just DB rows
        const spine = [];
        const cur = new Date(from + 'T00:00:00');
        const end = new Date(to   + 'T00:00:00');
        while (cur <= end) {
            const ds = cur.toISOString().slice(0, 10);
            const row = result.rows.find(r => r.date_str === ds);
            spine.push(row || { date_str: ds, _missing: true });
            cur.setDate(cur.getDate() + 1);
        }

        const XLSX = require('xlsx');
        const headers = ['Date','Total Sale','Cash','Card','Online','Cheque','Credit','Expenses','Cash Out','Net Profit','Status'];
        const dataRows = spine.map(r => {
            if (r._missing) return [r.date_str,'PENDING — not entered','','','','','','','','','NO DATA'];
            const cashOut = (+r.total_expenses||0) + (+r.payments||0) + (+r.salary||0) + (+r.cash_out||0) - (+r.cash_received||0);
            const npVal   = r.data_tier === 'FULL' ? +r.net_profit||0 : 'PENDING';
            return [r.date_str,
                +r.total_sale||0, +r.cash_sale||0, +r.card_sale||0,
                +r.online_sale||0, +r.cheq_payment||0, +r.credit_sale||0,
                +r.total_expenses||0, cashOut, npVal, r.data_tier];
        });

        // Totals row — numeric days only
        const numDays = spine.filter(r => !r._missing);
        const sum = col => numDays.reduce((a, r) => a + (+r[col]||0), 0);
        const npDays = numDays.filter(r => r.data_tier === 'FULL');
        const totalCashOut = numDays.reduce((a, r) =>
            a + (+r.total_expenses||0) + (+r.payments||0) + (+r.salary||0) + (+r.cash_out||0) - (+r.cash_received||0), 0);
        const totalRow = [
            `TOTALS (${numDays.length} of ${spine.length} days entered)`,
            sum('total_sale'), sum('cash_sale'), sum('card_sale'),
            sum('online_sale'), sum('cheq_payment'), sum('credit_sale'),
            sum('total_expenses'), totalCashOut,
            npDays.reduce((a, r) => a + (+r.net_profit||0), 0),
            `${npDays.length} FULL days`
        ];

        const wb  = XLSX.utils.book_new();
        const ws  = XLSX.utils.aoa_to_sheet([headers, ...dataRows, [], totalRow]);
        ws['!cols'] = [{wch:13},{wch:14},{wch:12},{wch:12},{wch:12},{wch:12},{wch:12},{wch:14},{wch:12},{wch:14},{wch:13}];
        XLSX.utils.book_append_sheet(wb, ws, 'Range Report');

        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Disposition', `attachment; filename="BATHCO_Range_${from}_to_${to}.xlsx"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buf);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── NATURAL LANGUAGE RANGE QUERY ────────────────────────────────────────────
app.post('/api/nl-query', async (req, res) => {
    const { question } = req.body;
    if (!question) return res.status(400).json({ error: 'question required' });
    try {
        // 1. Parse date range from question using local Ollama (free, no API cost)
        // Uses llama3.2:1b — ~6s warm, ~45s cold (first load after server restart).
        const today = todayLK();
        const OLLAMA_BASE  = process.env.OLLAMA_URL        || 'http://localhost:11434';
        const OLLAMA_MODEL = process.env.NL_OLLAMA_MODEL   || 'llama3.2:1b';
        const ollamaMessages = (q) => ([
            { role: 'system', content: 'You output only valid JSON, nothing else. No markdown, no backticks, no explanation.' },
            { role: 'user',   content: `Today is ${today}. Parse this business question and return ONLY this JSON:\n{"date_from":"YYYY-MM-DD","date_to":"YYYY-MM-DD","metrics":["net_profit"],"compare":false}\n\nQuestion: "${q}"\n\nRules:\n- date_from / date_to: exact YYYY-MM-DD bounds of the period (null if unclear)\n- metrics: array of strings from [total_sale, gross_profit, net_profit, total_expenses, cash_in_hand, staff_payments_total, cash_sale, card_sale, online_sale]\n- compare: true only if question compares two separate periods\n- Output raw JSON only` }
        ]);

        const callOllamaNL = async () => {
            const resp = await fetch(`${OLLAMA_BASE}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // keep_alive: '30m' — Ollama's default unloads the model after 5 min idle,
                // so any question asked after a quiet gap pays a ~40s cold-load penalty.
                // Keeping it resident for 30 min covers realistic gaps between shop questions.
                body: JSON.stringify({ model: OLLAMA_MODEL, stream: false, messages: ollamaMessages(question), keep_alive: '30m' }),
                signal: AbortSignal.timeout(90000)   // 90s: covers cold model load (~40s) + generation
            });
            if (!resp.ok) throw new Error(`Ollama HTTP ${resp.status}`);
            const data = await resp.json();
            let raw = data.message?.content || data.response || '';
            if (raw.includes('%7B') || raw.includes('%7b'))
                try { raw = decodeURIComponent(raw); } catch {}
            return raw;
        };

        const extractParsed = (raw) => {
            const m = raw.match(/\{[\s\S]*\}/);   // greedy — captures outermost object
            if (!m) throw new Error('no JSON object in response');
            const p = JSON.parse(m[0]);
            if (Array.isArray(p.metrics))
                p.metrics = p.metrics.map(x => (typeof x === 'string' ? x : (x.key||x.name||x.metric||''))).filter(Boolean);
            return p;
        };

        let ollamaRaw, parsed = {};
        try {
            ollamaRaw = await callOllamaNL();
            try {
                parsed = extractParsed(ollamaRaw);
            } catch {
                // One retry on bad JSON — model occasionally garbles output on cold start
                console.warn('[nl-query] JSON parse failed on first attempt, retrying once. Raw:', ollamaRaw.slice(0,200));
                ollamaRaw = await callOllamaNL();
                parsed = extractParsed(ollamaRaw);
            }
        } catch(aiErr) {
            if (aiErr.message?.includes('Ollama HTTP') || aiErr.message?.includes('aborted') || aiErr.message?.includes('fetch'))
                return res.status(503).json({ error: `AI service unavailable — ensure Ollama is running on localhost:11434 with model ${OLLAMA_MODEL}.` });
            console.error('[nl-query] parse error after retry:', aiErr.message, '| raw:', String(ollamaRaw).slice(0,200));
            return res.status(400).json({ error: 'Could not parse date range from question — try rephrasing (e.g. "net profit last week" or "total sales June 2026").' });
        }

        if (!parsed.date_from || !parsed.date_to) return res.status(400).json({ error: 'Could not extract date range', parsed });

        // 2. Query DB — only CONFIRMED/FULL tier days
        const metrics = (parsed.metrics || ['net_profit']).filter(m =>
            ['total_sale','gross_profit','net_profit','total_expenses','cash_in_hand',
             'staff_payments_total','cash_sale','card_sale','online_sale'].includes(m));
        const metricSQL = metrics.map(m => `COALESCE(SUM(${m}) FILTER (WHERE gp_status='ACTUAL' AND total_expenses>0), 0) as ${m}`).join(',');

        const q = await pool.query(`
            SELECT
                COUNT(*) as total_days,
                COUNT(*) FILTER (WHERE gp_status='ACTUAL' AND total_expenses>0) as confirmed_days,
                COUNT(*) FILTER (WHERE gp_status IS NULL OR total_expenses=0) as unverified_days,
                MIN(report_date) as first_date, MAX(report_date) as last_date,
                ${metricSQL}
            FROM daily_summary
            WHERE report_date BETWEEN $1 AND $2`, [parsed.date_from, parsed.date_to]);

        const detail = await pool.query(`
            SELECT TO_CHAR(report_date,'YYYY-MM-DD') as date,
                   CASE WHEN gp_status='ACTUAL' AND total_expenses>0 THEN 'CONFIRMED' ELSE 'UNVERIFIED' END as status,
                   ${metrics.join(',')}
            FROM daily_summary
            WHERE report_date BETWEEN $1 AND $2
            ORDER BY report_date`, [parsed.date_from, parsed.date_to]);

        const agg = q.rows[0];
        const warnings = [];
        if (+agg.unverified_days > 0) warnings.push(`${agg.unverified_days} of ${agg.total_days} days in this range are unverified — results only include confirmed days`);
        if (+agg.confirmed_days === 0) warnings.push('No fully confirmed days in this range — no results to show');

        const summary = {};
        metrics.forEach(m => { summary[m] = +agg[m] || 0; });

        res.json({ date_from: parsed.date_from, date_to: parsed.date_to,
                   confirmed_days: +agg.confirmed_days, total_days: +agg.total_days,
                   summary, warnings, detail: detail.rows });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── GRN (GOODS RECEIVED NOTES) ───────────────────────────────────────────────
app.get('/api/grn', async (req, res) => {
    const { supplier, from, to } = req.query;
    let where = ['1=1'];
    const params = [];
    if (supplier) { params.push(`%${supplier}%`); where.push(`supplier_name ILIKE $${params.length}`); }
    if (from)     { params.push(from);             where.push(`grn_date >= $${params.length}`); }
    if (to)       { params.push(to);               where.push(`grn_date <= $${params.length}`); }
    try {
        const r = await pool.query(
            `SELECT id, grn_number, supplier_id, supplier_name,
                    TO_CHAR(grn_date,'YYYY-MM-DD') as grn_date,
                    item_description, quantity, unit_cost, total_amount,
                    source_file_path, status, notes, caveat_flag, caveat_note,
                    TO_CHAR(created_at,'YYYY-MM-DD HH24:MI') as created_at
             FROM grn_records WHERE ${where.join(' AND ')} ORDER BY created_at DESC`,
            params);
        res.json(r.rows);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/grn', async (req, res) => {
    const { grn_number, supplier_id, supplier_name, grn_date, item_description,
            quantity, unit_cost, total_amount, notes } = req.body;
    try {
        const r = await pool.query(
            `INSERT INTO grn_records (grn_number,supplier_id,supplier_name,grn_date,
             item_description,quantity,unit_cost,total_amount,notes,status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'PENDING_REVIEW') RETURNING *`,
            [grn_number||null, supplier_id||null, supplier_name||null, grn_date||null,
             item_description||null, quantity||null, unit_cost||null, total_amount||null, notes||null]);
        res.status(201).json(r.rows[0]);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/grn/:id', async (req, res) => {
    const allowed = ['grn_number','supplier_id','supplier_name','grn_date','item_description',
                     'quantity','unit_cost','total_amount','status','notes','caveat_flag','caveat_note'];
    const updates = Object.keys(req.body).filter(k => allowed.includes(k));
    if (!updates.length) return res.status(400).json({ error: 'No valid fields' });
    const params = updates.map((k,i) => `${k}=$${i+1}`).join(', ');
    const vals   = updates.map(k => req.body[k]);
    vals.push(req.params.id);
    try {
        const r = await pool.query(
            `UPDATE grn_records SET ${params}, updated_at=NOW() WHERE id=$${vals.length} RETURNING *`, vals);
        if (!r.rowCount) return res.status(404).json({ error: 'GRN not found' });
        res.json(r.rows[0]);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/grn/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM grn_records WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── CREDIT CUSTOMERS ─────────────────────────────────────────────────────────
app.get('/api/credit-customers', async (req, res) => {
    try {
        const r = await pool.query(`
            SELECT cc.*, c.name as customer_name, c.phone,
                   TO_CHAR(cc.invoice_date,'YYYY-MM-DD') as invoice_date_str,
                   TO_CHAR(cc.due_date,'YYYY-MM-DD') as due_date_str
            FROM credit_customers cc
            LEFT JOIN customers c ON c.id=cc.customer_id
            WHERE cc.quarantined IS NOT TRUE
            ORDER BY cc.invoice_date DESC`);
        res.json(r.rows);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/credit-customers', async (req, res) => {
    const { customer_id, invoice_date, invoice_no, amount, paid, due_date, notes } = req.body;
    try {
        const r = await pool.query(
            `INSERT INTO credit_customers (customer_id,invoice_date,invoice_no,amount,paid,due_date,notes)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [customer_id, invoice_date, invoice_no, amount, paid||0, due_date, notes]);
        res.status(201).json(r.rows[0]);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── HOME STATS (enhanced) ────────────────────────────────────────────────────
app.get('/api/home-stats', async (req, res) => {
    try {
        const now = new Date(); const mn = String(now.getMonth()+1).padStart(2,'0'); const yr = now.getFullYear();
        const month = `${yr}-${mn}`;
        const [today, mtd, allTime, alerts] = await Promise.all([
            pool.query(`SELECT COALESCE(SUM(total_sale),0) as sale, COALESCE(SUM(gross_profit),0) as gp,
                        COALESCE(SUM(CASE WHEN gp_status='NOT_AVAILABLE' THEN NULL ELSE net_profit END),0) as np, COALESCE(SUM(total_expenses),0) as exp
                        FROM daily_summary WHERE report_date=CURRENT_DATE`),
            pool.query(`SELECT COALESCE(SUM(total_sale),0) as sale, COALESCE(SUM(gross_profit),0) as gp,
                        COALESCE(SUM(CASE WHEN gp_status='NOT_AVAILABLE' THEN NULL ELSE net_profit END),0) as np, COALESCE(SUM(total_expenses),0) as exp,
                        COUNT(*) as days FROM daily_summary WHERE TO_CHAR(report_date,'YYYY-MM')=$1`, [month]),
            pool.query(`SELECT COALESCE(SUM(total_sale),0) as sale, COALESCE(SUM(gross_profit),0) as gp,
                        COALESCE(SUM(CASE WHEN gp_status='NOT_AVAILABLE' THEN NULL ELSE net_profit END),0) as np, COUNT(*) as days FROM daily_summary`),
            pool.query(`SELECT COUNT(*) FROM alerts WHERE read=false`),
        ]);
        res.json({
            today:    today.rows[0],
            mtd:      mtd.rows[0],
            all_time: allTime.rows[0],
            unread_alerts: parseInt(alerts.rows[0].count),
        });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── PAY PERIOD SUMMARY (25th of one month → 24th of next) ───────────────────
app.get('/api/pay-period-summary', async (req, res) => {
    try {
        const now = new Date();
        let fromY = now.getFullYear(), fromM = now.getMonth(); // 0-indexed
        if (now.getDate() < 25) fromM -= 1; // before the 25th -> period started last month
        // Build YYYY-MM-DD strings from local components directly (avoid
        // toISOString(), which converts to UTC and shifts the date back
        // a day in the server's +5:30 timezone).
        const pad = n => String(n).padStart(2,'0');
        let toY = fromY, toM = fromM + 1;
        if (toM > 11) { toM = 0; toY += 1; }
        const fromStr = `${fromY}-${pad(fromM+1)}-25`;
        const toStr = `${toY}-${pad(toM+1)}-24`;

        const r = await pool.query(`
            SELECT COUNT(*) as total_days,
                   COUNT(*) FILTER (WHERE ${TIER_EXPR} = 'FULL') as full_days,
                   COALESCE(SUM(total_sale),0) as total_sale,
                   COALESCE(SUM(net_profit) FILTER (WHERE ${TIER_EXPR} = 'FULL'),0) as net_profit
            FROM daily_summary
            WHERE report_date BETWEEN $1 AND $2`, [fromStr, toStr]);

        res.json({ from: fromStr, to: toStr, ...r.rows[0] });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── ALL-TIME STATS (21/12/2025 – 09/06/2026 business range) ─────────────────
app.get('/api/all-time-stats', async (req, res) => {
    try {
        const RANGE_FROM = '2025-12-21';
        // Upper bound = most recent real day on or before today (avoids stale
        // hardcoded dates and any bad future-dated rows)
        const maxDateR = await pool.query(
            `SELECT MAX(report_date) as max_date FROM daily_summary WHERE report_date <= CURRENT_DATE`);
        const RANGE_TO = maxDateR.rows[0].max_date || RANGE_FROM;
        const [totals, gpTotals, bestDay, credit, tiers] = await Promise.all([
            pool.query(`SELECT
                    COUNT(*) as days,
                    COALESCE(SUM(total_sale),0) as total_sale,
                    COALESCE(SUM(gross_profit),0) as total_gp,
                    COALESCE(SUM(CASE WHEN gp_status='NOT_AVAILABLE' THEN NULL ELSE net_profit END),0) as total_np,
                    COALESCE(SUM(total_expenses),0) as total_exp,
                    COALESCE(AVG(total_sale),0) as avg_sale
                 FROM daily_summary
                 WHERE report_date BETWEEN $1 AND $2`, [RANGE_FROM, RANGE_TO]),
            // GP% and net profit computed only over days where GP is actually known
            // (ACTUAL or ESTIMATE); most days have gp_status='NOT_AVAILABLE'
            // (gross_profit=0, not yet from the POS) and are excluded here so
            // their unmatched expenses don't drag net profit into a false loss.
            pool.query(`SELECT
                    COUNT(*) as gp_days,
                    COALESCE(SUM(total_sale),0) as gp_sale,
                    COALESCE(SUM(gross_profit),0) as gp_sum,
                    COALESCE(SUM(CASE WHEN total_expenses > 0 THEN gross_profit-total_expenses ELSE NULL END),0) as gp_net_profit
                 FROM daily_summary
                 WHERE report_date BETWEEN $1 AND $2 AND gp_status IN ('ACTUAL','ESTIMATE')`, [RANGE_FROM, RANGE_TO]),
            pool.query(`SELECT TO_CHAR(report_date,'YYYY-MM-DD') as date_str, total_sale
                 FROM daily_summary
                 WHERE report_date BETWEEN $1 AND $2
                 ORDER BY total_sale DESC LIMIT 1`, [RANGE_FROM, RANGE_TO]),
            pool.query(`SELECT COALESCE(SUM(amount-paid),0) as outstanding
                 FROM credit_customers WHERE amount > paid`),
            pool.query(`SELECT
                    COUNT(*) FILTER (WHERE ${TIER_EXPR}='FULL') as tier_full_days,
                    COUNT(*) FILTER (WHERE ${TIER_EXPR}='CASHFLOW') as tier_cashflow_days,
                    COUNT(*) FILTER (WHERE ${TIER_EXPR}='FOUNDATION') as tier_foundation_days,
                    COALESCE(SUM(${CASH_IN_EXPR}),0) as cash_in_total,
                    COALESCE(SUM(${CASH_OUT_EXPR}),0) as cash_out_total,
                    COALESCE(SUM(total_sale) FILTER (WHERE ${TIER_EXPR}='FULL'),0) as sale_full,
                    COALESCE(SUM(gross_profit-total_expenses) FILTER (WHERE ${TIER_EXPR}='FULL'),0) as np_full
                 FROM daily_summary WHERE report_date BETWEEN $1 AND $2`, [RANGE_FROM, RANGE_TO]),
        ]);
        const t = totals.rows[0];
        const totalSale = parseFloat(t.total_sale);
        const totalGp   = parseFloat(t.total_gp);
        const g = gpTotals.rows[0];
        const gpSale = parseFloat(g.gp_sale);
        const gpSum  = parseFloat(g.gp_sum);
        const tr = tiers.rows[0];
        const npFull   = parseFloat(tr.np_full);
        const saleFull = parseFloat(tr.sale_full);
        res.json({
            range: { from: RANGE_FROM, to: RANGE_TO },
            days: parseInt(t.days),
            total_sale: totalSale,
            total_gross_profit: totalGp,
            // Net profit summed ONLY over TIER 1 FULL days (real POS GP +
            // real expense breakdown both present). Every other day either has no
            // expense data (would overstate profit = full GP) or no GP at all.
            total_net_profit: npFull,
            total_expenses: parseFloat(t.total_exp),
            avg_daily_sale: parseFloat(t.avg_sale),
            avg_gp_pct: gpSale > 0 ? (gpSum / gpSale * 100) : 0,
            gp_days: parseInt(g.gp_days),
            avg_np_pct: saleFull > 0 ? (npFull / saleFull * 100) : 0,
            // "profit from X of Y days" — X = tier_full_days, Y = days
            net_profit_days: parseInt(tr.tier_full_days),
            best_day: bestDay.rows[0] || null,
            credit_outstanding: parseFloat(credit.rows[0].outstanding),
            // Period segregation — per-day data-quality tiers (see TIER_EXPR)
            tier_full_days:       parseInt(tr.tier_full_days),
            tier_cashflow_days:   parseInt(tr.tier_cashflow_days),
            tier_foundation_days: parseInt(tr.tier_foundation_days),
            cash_in_total:  parseFloat(tr.cash_in_total),
            cash_out_total: parseFloat(tr.cash_out_total),
        });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── FINANCIAL HEALTH (cash flow, receivables, payables, profit trend, stock value) ──
app.get('/api/financial-health', async (req, res) => {
    try {
        const [cashFlow, receivables, payables, profitTrend, stock] = await Promise.all([
            pool.query(`SELECT TO_CHAR(report_date,'YYYY-MM-DD') as date_str,
                    ${CASH_IN_EXPR} as cash_in, ${CASH_OUT_EXPR} as cash_out, cash_in_hand
                 FROM daily_summary WHERE report_date >= CURRENT_DATE - INTERVAL '30 days'
                 ORDER BY report_date`),
            pool.query(`SELECT
                    COALESCE(SUM(amount-paid) FILTER (WHERE due_date IS NULL OR CURRENT_DATE-due_date<=30),0) as b_0_30,
                    COALESCE(SUM(amount-paid) FILTER (WHERE CURRENT_DATE-due_date BETWEEN 31 AND 60),0) as b_31_60,
                    COALESCE(SUM(amount-paid) FILTER (WHERE CURRENT_DATE-due_date BETWEEN 61 AND 90),0) as b_61_90,
                    COALESCE(SUM(amount-paid) FILTER (WHERE CURRENT_DATE-due_date>90),0) as b_90_plus,
                    COALESCE(SUM(amount-paid),0) as total_outstanding
                 FROM credit_customers WHERE amount > paid AND NOT COALESCE(quarantined,false)`),
            pool.query(`WITH received AS (
                    SELECT supplier_id, SUM(total_amount) as total_received
                    FROM grn_records WHERE supplier_id IS NOT NULL GROUP BY supplier_id
                 ), paid AS (
                    SELECT supplier_id, SUM(amount) as total_paid FROM supplier_payments GROUP BY supplier_id
                 )
                 SELECT COALESCE(SUM(GREATEST(COALESCE(rc.total_received,0)-COALESCE(p.total_paid,0),0)),0) as total_payable
                 FROM suppliers s
                 LEFT JOIN received rc ON rc.supplier_id = s.id
                 LEFT JOIN paid p ON p.supplier_id = s.id
                 WHERE ${notVoided('suppliers', 's.id')}`),
            pool.query(`SELECT TO_CHAR(report_date,'YYYY-MM') as month,
                    SUM(total_sale) as total_sale, SUM(gross_profit) as gross_profit,
                    SUM(total_expenses) as total_expenses,
                    SUM(gross_profit-total_expenses) FILTER (WHERE gp_status IN ('ACTUAL','BLENDED','ESTIMATE')) as net_profit
                 FROM daily_summary
                 WHERE report_date >= CURRENT_DATE - INTERVAL '12 months'
                 GROUP BY 1 ORDER BY 1`),
            pool.query(`SELECT COALESCE(SUM(stock_level*avg_cost),0) as stock_value,
                    COUNT(*) FILTER (WHERE active) as active_items,
                    COUNT(*) FILTER (WHERE stock_level <= reorder_threshold AND active) as low_stock_items
                 FROM products`),
        ]);
        res.json({
            cash_flow: cashFlow.rows,
            receivables: receivables.rows[0],
            payables: { total_payable: parseFloat(payables.rows[0].total_payable) },
            profit_trend: profitTrend.rows,
            stock: stock.rows[0],
        });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── CALENDAR DATA ────────────────────────────────────────────────────────────
app.get('/api/calendar', async (req, res) => {
    const { month } = req.query;
    if (!month) return res.json([]);
    try {
        const r = await pool.query(`
            SELECT report_date, total_sale, cash_in_hand, gross_profit,
                   total_expenses, checker_flags, source
            FROM daily_summary
            WHERE TO_CHAR(report_date,'YYYY-MM')=$1
            ORDER BY report_date`, [month]);
        res.json(r.rows);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── ALL-MONTHS CHART ─────────────────────────────────────────────────────────
app.get('/api/all-monthly-chart', async (req, res) => {
    try {
        const r = await pool.query(`
            SELECT TO_CHAR(report_date,'YYYY-MM') as month,
                   SUM(total_sale) as total_sale,
                   SUM(gross_profit) as gross_profit,
                   SUM(CASE WHEN gp_status='NOT_AVAILABLE' THEN NULL ELSE net_profit END) as net_profit,
                   SUM(total_expenses) as total_expenses,
                   COUNT(*) as days
            FROM daily_summary
            GROUP BY 1 ORDER BY 1`);
        res.json(r.rows);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── VERA ALERTS (real-time anomaly checks) ───────────────────────────────────
app.get('/api/vera-alerts', async (req, res) => {
    try {
        const [avg7, recent, overdue, lowStock] = await Promise.all([
            pool.query(`SELECT AVG(total_sale) as avg7 FROM daily_summary
                        WHERE report_date >= CURRENT_DATE - INTERVAL '7 days'`),
            pool.query(`SELECT * FROM daily_summary ORDER BY report_date DESC LIMIT 30`),
            pool.query(`SELECT * FROM credit_customers
                        WHERE due_date IS NOT NULL AND due_date < CURRENT_DATE ORDER BY due_date`),
            pool.query(`SELECT * FROM alerts WHERE read=false ORDER BY created_at DESC LIMIT 20`),
        ]);

        const avg = parseFloat(avg7.rows[0]?.avg7||0);
        const vera = [];

        // Check recent days for anomalies
        recent.rows.forEach(r => {
            const sale = parseFloat(r.total_sale);
            if (avg > 0 && sale < avg * 0.5) {
                vera.push({ type:'low_sale', date:r.report_date, value:sale, avg, message:`Sale ${fmt(sale)} is 50% below 7-day avg ${fmt(avg)}` });
            }
            if (avg > 0 && sale > avg * 2.5) {
                vera.push({ type:'spike', date:r.report_date, value:sale, message:`Unusual spike: ${fmt(sale)}` });
            }
            const cih = parseFloat(r.cash_in_hand);
            if (cih < 0) {
                vera.push({ type:'cash_short', date:r.report_date, value:cih, message:`Cash shortfall: ${fmt(cih)}` });
            }
        });

        // Overdue credit
        overdue.rows.forEach(c => {
            vera.push({ type:'overdue_credit', customer:c.name, due_date:c.due_date, amount:c.amount-c.paid, message:`Credit overdue: ${c.name} owes LKR ${parseFloat(c.amount-c.paid).toLocaleString()}` });
        });

        res.json({ alerts: vera, saved_alerts: lowStock.rows, avg_daily: avg });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

function fmt(n) { return 'LKR '+(parseFloat(n)||0).toLocaleString('en',{maximumFractionDigits:0}); }

// ─── CHECKER RUN ──────────────────────────────────────────────────────────────
app.post('/api/checker-run', async (req, res) => {
    try {
        const days = await pool.query(`SELECT * FROM daily_summary ORDER BY report_date DESC LIMIT 60`);
        const flags = [];
        for (const r of days.rows) {
            const dayFlags = [];
            const ts = parseFloat(r.total_sale)||0;
            const cs = parseFloat(r.cash_sale)||0;
            const ks = parseFloat(r.card_sale)||0;
            const os = parseFloat(r.online_sale)||0;
            const cr = parseFloat(r.credit_sale)||0;
            // "Overpayment with cash refund" pattern: customer overpays via a non-cash
            // method (e.g. online) and the shop returns the difference as a NEGATIVE
            // cash_sale entry. cash+card+online+credit still nets to total_sale, so
            // this is a recognized, valid breakdown and must NOT be flagged below.
            const cheq = parseFloat(r.cheq_payment)||0;
            const breakdown = cs + ks + os + cr + cheq;
            if (ts > 0 && breakdown > 0 && Math.abs(ts - breakdown) > ts * 0.1) {
                dayFlags.push('breakdown_mismatch');
            }
            const exp = parseFloat(r.total_expenses)||0;
            if (exp > ts * 0.5 && ts > 0) dayFlags.push('high_expenses');
            const cih = parseFloat(r.cash_in_hand)||0;
            if (cih < -50000) dayFlags.push('cash_shortfall');
            // Always write flags (even empty) so corrected days have stale flags cleared
            const existing = r.checker_flags || [];
            if (dayFlags.length || existing.length) {
                flags.push({ date: r.report_date, flags: dayFlags });
                await pool.query(`UPDATE daily_summary SET checker_flags=$1, updated_at=NOW() WHERE report_date=$2`,
                    [JSON.stringify(dayFlags), r.report_date]);
            }
        }
        res.json({ checked: days.rows.length, flagged: flags.length, flags });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── RECONCILIATION CHECK (comprehensive, replaces legacy checker-run) ────────
app.post('/api/recon-check', async (req, res) => {
    try {
        const { since, until, date } = req.body || {};
        const result = await runReconCheck({ since: date||since, until: date||until });
        res.json(result);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── NOVA WEEKLY SUMMARIES ────────────────────────────────────────────────────
app.get('/api/nova-weekly', async (req, res) => {
    try {
        const r = await pool.query(`
            SELECT DATE_TRUNC('week', report_date) as week_start,
                   SUM(total_sale) as total_sale, SUM(gross_profit) as gp,
                   SUM(net_profit) FILTER (WHERE gp_status='ACTUAL' AND total_expenses>0) as np,
                   SUM(total_expenses) as expenses,
                   SUM(payments) as payments, COUNT(*) as days,
                   AVG(total_sale) as avg_daily
            FROM daily_summary GROUP BY 1 ORDER BY 1 DESC LIMIT 12`);
        res.json(r.rows);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── QUINN GP ANALYSIS ────────────────────────────────────────────────────────
app.get('/api/quinn-gp', async (req, res) => {
    try {
        const r = await pool.query(`
            SELECT report_date, total_sale, gross_profit, net_profit,
                   CASE WHEN total_sale>0 THEN ROUND(gross_profit/total_sale*100,1) ELSE 0 END as gp_pct,
                   CASE WHEN total_sale>0 THEN ROUND(net_profit/total_sale*100,1) ELSE 0 END as np_pct
            FROM daily_summary WHERE total_sale > 0
            ORDER BY report_date DESC LIMIT 60`);
        const avg_gp = r.rows.reduce((a,x)=>a+parseFloat(x.gp_pct||0),0)/(r.rows.length||1);
        const avg_np = r.rows.reduce((a,x)=>a+parseFloat(x.np_pct||0),0)/(r.rows.length||1);
        res.json({ days: r.rows, avg_gp_pct: avg_gp.toFixed(1), avg_np_pct: avg_np.toFixed(1) });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── LAYLA WHATSAPP SUMMARY ───────────────────────────────────────────────────
app.get('/api/layla-summary', async (req, res) => {
    const { date } = req.query; const d = date || todayLK();
    try {
        const [summary, alerts, credit] = await Promise.all([
            pool.query(`SELECT * FROM daily_summary WHERE report_date=$1`, [d]),
            pool.query(`SELECT COUNT(*) FROM alerts WHERE read=false`),
            pool.query(`SELECT SUM(amount-paid) FROM credit_customers WHERE due_date < CURRENT_DATE + INTERVAL '7 days'`),
        ]);
        const s = summary.rows[0] || {};
        res.json({ date: d, summary: s, unread_alerts: alerts.rows[0].count, credit_due: credit.rows[0].sum||0 });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── DAILY CLOSE (manual entry) ──────────────────────────────────────────────
app.post('/api/daily-close', async (req, res) => {
    const f = req.body;
    if (!f.report_date) return res.status(400).json({ error: 'report_date required' });
    try {
        const total = (f.cash_sale||0)+(f.card_sale||0)+(f.online_sale||0)+(f.credit_sale||0) || f.total_sale||0;
        const r = await pool.query(`
            INSERT INTO daily_summary
              (report_date,total_sale,cash_sale,card_sale,online_sale,credit_sale,
               total_expenses,payments,salary,cash_in,cash_out,cash_in_hand,source,notes)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'manual',$13)
            ON CONFLICT (report_date) DO UPDATE SET
              total_sale=EXCLUDED.total_sale, cash_sale=EXCLUDED.cash_sale,
              card_sale=EXCLUDED.card_sale, online_sale=EXCLUDED.online_sale,
              credit_sale=EXCLUDED.credit_sale, total_expenses=EXCLUDED.total_expenses,
              payments=EXCLUDED.payments, salary=EXCLUDED.salary,
              cash_in_hand=EXCLUDED.cash_in_hand, source='manual',
              notes=EXCLUDED.notes, updated_at=NOW()
            RETURNING *`,
            [f.report_date, total, f.cash_sale||0, f.card_sale||0, f.online_sale||0,
             f.credit_sale||0, f.total_expenses||0, f.payments||0, f.salary||0,
             f.cash_in||0, f.cash_out||0, f.cash_in_hand||0, f.notes||'']);
        const r2 = await pool.query(
            `UPDATE daily_summary SET net_profit=ROUND(gross_profit-total_expenses,2)
             WHERE report_date=$1 AND gp_status='ACTUAL' AND total_expenses>0 RETURNING *`, [f.report_date]);
        res.status(201).json(r2.rows[0] || r.rows[0]);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── CREDIT CUSTOMERS (standalone, no FK) ────────────────────────────────────
app.get('/api/credit-list', async (req, res) => {
    try {
        const r = await pool.query(`
            SELECT *, amount-paid as outstanding,
                   CASE WHEN due_date IS NOT NULL AND due_date < CURRENT_DATE THEN true ELSE false END as overdue
            FROM credit_customers ORDER BY invoice_date DESC`);
        res.json(r.rows);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── ADMIN SECTION ───────────────────────────────────────────────────────────
// Secondary PIN gate (on top of the main session login) for the Admin tab.
// Set ADMIN_PIN in .env — required, no default.
function requireAdminPin(req, res, next) {
    if (!req.session.adminUnlocked) return res.status(403).json({ error: 'Admin PIN required' });
    next();
}

// Retroactively blend GP for all existing days where total_sale > lasersoft_total (manual bills present)
app.post('/api/admin/blend-gp-retroactive', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin')
        return res.status(403).json({ error: 'Admin only' });
    try {
        const rows = await pool.query(`
            SELECT report_date, lasersoft_total, gross_profit, total_sale, total_expenses, net_profit
            FROM daily_summary
            WHERE lasersoft_total > 0
              AND total_sale > lasersoft_total + 1
              AND gp_status = 'ACTUAL'
            ORDER BY report_date`);
        const updated = [];
        for (const row of rows.rows) {
            const lsTotal    = parseFloat(row.lasersoft_total);
            const lsGp       = parseFloat(row.gross_profit);
            const totalSale  = parseFloat(row.total_sale);
            const totalExp   = parseFloat(row.total_expenses || 0);
            const manualSale = Math.round((totalSale - lsTotal) * 100) / 100;
            const lsGpPct    = lsGp / lsTotal;
            const manualEst  = Math.round(manualSale * lsGpPct * 100) / 100;
            const blendedGp  = Math.round((lsGp + manualEst) * 100) / 100;
            const newNp      = totalExp > 0 ? Math.round((blendedGp - totalExp) * 100) / 100 : 0;
            const note       = `LS GP ${lsGp.toFixed(2)} on sale ${lsTotal}; est. ${manualEst.toFixed(2)} on manual sale ${manualSale} at ${(lsGpPct*100).toFixed(2)}% avg GP`;
            await pool.query(`
                UPDATE daily_summary
                SET gross_profit=$1, net_profit=$2, gp_status='BLENDED',
                    manual_sale_total=$3, manual_gp_estimate=$4, gp_blend_note=$5, updated_at=NOW()
                WHERE report_date=$6`,
                [blendedGp, newNp, manualSale, manualEst, note, row.report_date]);
            updated.push({
                date: String(row.report_date).slice(0,10),
                ls_sale: lsTotal, manual_sale: manualSale,
                ls_gp: lsGp, manual_gp_est: manualEst, blended_gp: blendedGp,
                expenses: totalExp, new_net_profit: newNp,
                gp_pct: (lsGpPct*100).toFixed(2) + '%'
            });
        }
        res.json({ updated_count: updated.length, rows: updated });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/verify', (req, res) => {
    const pin = process.env.ADMIN_PIN;
    if (!pin) throw new Error('ADMIN_PIN not set in .env');
    const given = String((req.body || {}).pin == null ? '' : req.body.pin);
    const same = (a, b) => crypto.timingSafeEqual(crypto.createHash('sha256').update(a).digest(), crypto.createHash('sha256').update(b).digest());
    if (same(given, pin)) {
        req.session.adminUnlocked = true;
        res.json({ ok: true });
    } else {
        res.status(401).json({ error: 'Wrong password' });
    }
});

app.post('/api/admin/upload', requireAdminPin, upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file received' });
    const mimeErr = await validateMimeType(req.file);
    if (mimeErr) return res.status(400).json({ error: mimeErr });
    const MB = req.file.size / (1024 * 1024);
    res.json({
        filename: req.file.filename,
        originalname: req.file.originalname,
        size: req.file.size,
        warning: MB > 50 ? `File is ${MB.toFixed(1)} MB — exceeds 50 MB` : null,
    });
});

app.get('/api/admin/files', requireAdminPin, (req, res) => {
    try {
        const files = fs.readdirSync(UPLOAD_DIR)
            .map(filename => {
                const stat = fs.statSync(path.join(UPLOAD_DIR, filename));
                return {
                    filename,
                    originalname: filename.replace(/^\d+-/, ''),
                    size: stat.size,
                    date: stat.mtime,
                };
            })
            .sort((a, b) => new Date(b.date) - new Date(a.date));
        res.json(files);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/files/:filename/download', requireAdminPin, (req, res) => {
    const filePath = path.join(UPLOAD_DIR, path.basename(req.params.filename));
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    res.download(filePath, req.params.filename.replace(/^\d+-/, ''));
});

// ─── AGENT RUN LOG ───────────────────────────────────────────────────────────
const AGENT_LOG = path.join(__dirname, 'agent_run_log.json');

const VALID_AGENTS = new Set(['CHECKER', 'NOVA', 'QUINN', 'VERA', 'LAYLA']);

function recordAgentRun(agent, status = 'ok') {
    try {
        const log = fs.existsSync(AGENT_LOG)
            ? JSON.parse(fs.readFileSync(AGENT_LOG, 'utf8'))
            : {};
        log[agent] = { last_run: new Date().toISOString(), status };
        fs.writeFileSync(AGENT_LOG, JSON.stringify(log, null, 2));
    } catch (e) {
        console.warn(`[agent-log] Failed to write ${agent}: ${e.message}`);
    }
}

app.get('/api/agent-status', (req, res) => {
    try {
        const log = fs.existsSync(AGENT_LOG)
            ? JSON.parse(fs.readFileSync(AGENT_LOG, 'utf8'))
            : {};
        res.json(log);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/agent-status', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin')
        return res.status(403).json({ error: 'Admin only' });
    const { agent, status } = req.body || {};
    if (!agent || !VALID_AGENTS.has(agent))
        return res.status(400).json({ error: `agent must be one of: ${[...VALID_AGENTS].join(', ')}` });
    recordAgentRun(agent, status || 'ok');
    res.json({ ok: true, agent, recorded: new Date().toISOString() });
});

/* ===== M8: AI-ASSISTANT ===== */
// Dashboard chat bubble — a DIFFERENT system from LAYLA (layla.js, the WhatsApp
// bot), but as of 2026-07-04 uses the SAME zero-cost provider chain LAYLA
// already uses: local Ollama first, OpenRouter's free-tier model only if
// Ollama errors or gives a too-short answer. No Anthropic call anywhere in
// this route - own system prompt, own route, still does not import from or
// touch layla.js. Session-auth gated like every other /api route.
const { client: m8OpenRouterClient, DEFAULT_MODEL: M8_OPENROUTER_MODEL } = require('./openrouter.config');

async function m8CallOllama(message, history) {
    const response = await axios.post(
        process.env.OLLAMA_URL || 'http://localhost:11434/api/chat',
        {
            model: process.env.OLLAMA_MODEL || 'llama3.2:1b',
            messages: [
                { role: 'system', content: M8_SYSTEM_PROMPT },
                ...history,
                { role: 'user', content: message },
            ],
            stream: false,
            keep_alive: '30m',
        },
        { timeout: 15000 }
    );
    return response.data.message.content.trim();
}

async function m8CallOpenRouter(message, history) {
    const response = await m8OpenRouterClient.chat.completions.create({
        model: M8_OPENROUTER_MODEL,
        max_tokens: 500,
        messages: [
            { role: 'system', content: M8_SYSTEM_PROMPT },
            ...history,
            { role: 'user', content: message },
        ],
    });
    return response.choices[0].message.content.trim();
}

const M8_SYSTEM_PROMPT = `You are the BATHCO COMMAND dashboard assistant — a help/navigation
assistant embedded in the Your Business Name internal dashboard (a different system from
LAYLA, the customer-facing WhatsApp bot — never confuse the two, and never claim to be LAYLA).

Your job: help the person using this dashboard (the owner or staff) understand and navigate the
dashboard's coverage areas — not to replace it. You can discuss, explain, and help someone
find their way around: sales, inventory/stock management, expenses, staff and salary,
barcode labeling, profitability, cash in hand, purchasing, and day-to-day operations —
always in terms of what the dashboard shows and how to read it, never by inventing figures.

STRICT RULES:
1. Never state a specific financial figure (a sale total, expense total, profit number, cash
   balance, etc.) from memory or by guessing. You do not have live database access in this
   chat. If asked "what was net profit on X" or similar, tell the user to check the Daily/
   Weekly/Monthly view via the date selector, or use the existing "Ask a question" box on the
   Home page (natural-language query feature) which does have real database access.
2. You may explain formulas and definitions freely, using only these confirmed rules:
   - Net Profit = Gross Profit − Expenses (never Total Sale − Expenses)
   - Petty cash float is a fixed amount configured for this business (PETTY_CASH_FLOAT in .env)
   - Owner construction/renovation draws are a separate line, never an operating expense
   - Supplier payments are never deducted from daily net profit
   - Cash In Hand = Cash Sale − Total Expenses − Payments (when there was cash sale that day;
     otherwise the figure is not meaningful for that day)
3. Never suggest editing financial data, the database schema, PM2 processes, or the POS software.
   If asked to do any of those, say that requires the owner directly, not this chat.
4. If you don't know something, say so plainly. Never fabricate a number, date, or status to
   sound more helpful.
5. Keep replies short and practical — this is a working tool, not a conversation.`;

app.post('/api/dashboard-assistant/chat', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });
    const { message, history } = req.body || {};
    if (!message || typeof message !== 'string' || !message.trim())
        return res.status(400).json({ error: 'message is required' });
    const trimmedMessage = message.slice(0, 2000);
    const trimmedHistory = require('./utils/chatHistory').sanitizeChatHistory(history);
    try {
        let reply;
        try {
            reply = await m8CallOllama(trimmedMessage, trimmedHistory);
            if (!reply || reply.trim().length < 5) {
                console.warn('[M8 dashboard-assistant] Ollama answer too short — escalating to OpenRouter');
                reply = await m8CallOpenRouter(trimmedMessage, trimmedHistory);
            }
        } catch (ollamaErr) {
            console.warn('[M8 dashboard-assistant] Ollama error:', ollamaErr.message, '— trying OpenRouter');
            reply = await m8CallOpenRouter(trimmedMessage, trimmedHistory);
        }
        res.json({ reply });
    } catch (err) {
        console.error('[M8 dashboard-assistant] error:', err.message);
        res.status(500).json({ error: 'Assistant is unavailable right now — try again shortly.' });
    }
});
/* ===== END M8 ===== */

// ─── START ────────────────────────────────────────────────────────────────────
if (require.main === module) {
    app.listen(PORT, '0.0.0.0', () => {
        laylaOwner.start();   // reminders every minute; WhatsApp relay only if RELAY_URL is set; DRY RUN unless LAYLA_OWNER_LIVE=true
        console.log(`
╔══════════════════════════════════════════╗
║   BATHCO COMMAND — PHASE 1 ACTIVE       ║
║   Your Business Name (Pvt) Ltd           ║
║   Your City                  ║
║                                          ║
║   LAYLA is ready to receive messages    ║
║   Server : http://localhost:${PORT}         ║
║   Webhook: POST /webhook/whatsapp       ║
║   Test   : POST /simulate               ║
║                                          ║
║   Bismillah — InshAllah                 ║
╚══════════════════════════════════════════╝
        `);
    });
}

module.exports = app;

module.exports = app;
