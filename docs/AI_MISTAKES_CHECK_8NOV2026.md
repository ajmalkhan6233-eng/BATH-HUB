# App checked against "100 Mistakes AI Makes" (AJ's list, 8 Nov 2026)
Checked in the code. OK = already fine. FIXED = changed today. HEADS-UP = real, planned. N/A = does not fit a one-shop app.

## Phase 1 Architecture
Modular files: OK (one file per screen/route). Hardcoded env: OK (.env). Offline-first: OK (offline queue + service worker). Multi-tenant / i18n: N/A for the shop app, English + Sinhala/Tamil handled by the i18n skill. State chaos: HEADS-UP, plain-JS screens, each isolated.
## Phase 2 Database
SQL injection: OK (parameterised, dynamic columns whitelisted). Password hashing: OK (bcrypt). Connection pool: OK (one shared pool). Migrations: HEADS-UP, tables are created by "IF NOT EXISTS" at start, not numbered files. Backups: OK, now encrypted. Rate limit: OK. Backend validation: OK on POS, FIXED price/payment checks today.
## Phase 3 API
Status codes: OK. Idempotency: OK (offline replays). Hanging external calls: FIXED (Railway and local AI now time out). Raw error text to users: HEADS-UP (many routes). API versioning / OpenAPI: N/A (private app, one client).
## Phase 4 Frontend
Touch targets / loading states / mobile: OK, rules in rbh-ux. XSS: cheque list FIXED, rest uses escaping helpers; HEADS-UP, a full sweep of innerHTML is still queued.
## Phase 5 Security
BOLA/BFLA: OK by role (owner/admin/staff/cashier) at the global gate. Mass assignment: OK (allow-lists). Git secrets: OK (.env never committed; backup now encrypted). CSRF: OK. Login retries: OK (10 per 15 min, PIN 5, login code 5). CORS: OK (only 2 read-only public feeds). Outdated packages: HEADS-UP (npm audit: xlsx has no fix).
## Phase 6 Code quality
Silent catch blocks: HEADS-UP (many "catch (e) {}" keep the app running; errors go to the error log for the important ones). Dead code: HEADS-UP (old watchdog file, ecosystem.config.js).
## Phase 7 Testing
Automated tests: OK (jest). 10 stale suites FIXED or explained today. Race conditions: OK (advisory locks on bill numbers and item codes). Load test: HEADS-UP, never run.
## Phase 8 Deploy
Process manager: OK (pm2 apex-server). Health check: FIXED (/health/deep checks the database). Log rotation: OK (logtidy task). HTTPS: OK via the Cloudflare tunnel. Manual deploy: HEADS-UP, bridge is semi-manual by design (AJ approves).
## Phase 9 State and caching
Private cache headers: FIXED (every /api answer is private, no-cache). Page-size caps: OK. Transactions: OK on bills, GRN, rename. Sync file reads inside routes: HEADS-UP (a few small ones).
## Phase 10 AI workflow
Spec file / small tasks / frequent commits: OK (CLAUDE.md, bridge tasks, one commit per fix). Uncritical acceptance: that is what the 4-reviewer audit and the real-database tests are for.
