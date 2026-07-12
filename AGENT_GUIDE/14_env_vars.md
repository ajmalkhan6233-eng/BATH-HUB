# .env variables

DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD — Postgres connection (10).
PORT — web server port.
SESSION_SECRET — cookie signing; random hex, unique per install, never reuse.
ADMIN_PIN — extra PIN some admin actions ask for.
DASH_USER/DASH_PASS, NGROK_* — basic auth when tunneled to the internet.
ANTHROPIC_API_KEY / OPENROUTER_API_KEY / DEFAULT_MODEL — AI models (12).
OLLAMA_URL / OLLAMA_MODEL — local model (optional).
WHATSAPP_TEST_WHITELIST — whitelist numbers for internal mode (13).
WHATSAPP_MODE — 'internal' (default, whitelist-only) or 'public' (replies to everyone) (13).
WHATSAPP_BRIDGE_PORT — bridge HTTP port (3011 on this instance; live systems hold 3001).
APEX_TENANT_ID — this instance's row in the apex tenants table (demo seed = 1).
APEX_ENFORCE_TENANT_STATUS — 'true' gates the app by tenant status (SUSPENDED = read-only,
  TERMINATED = blocked; login/setup/branding/webhook paths always pass). Keep false on the
  template; set true on sold client copies.
RAILWAY_API_TOKEN — Railway public-API token for the Platform Admin fleet Stop/Start/
  Restart/Deploy actions (utils/railwayControl.js). UNSET = actions refuse safely with 501
  and Railway is never called. Health pings work without it.
APEX_FLEET_BLOCKED_PROJECT_IDS — comma-separated Railway project ids the fleet actions must
  refuse (the vendor's apex-platform id is blocked by default in code).
PETTY_CASH_FLOAT — the business's fixed petty-cash/opening float (audit Cash Proof + Petty Cash). 0 = not configured.
COMMISSION_RATE_PCT — default commission % for newly created staff (POST /api/staff). 0 = not configured.
DROP_ROOT — file-drop ingestion root (GRN watcher, inbox uploads); defaults to <install>\data\drop.
ENABLE_LOCAL_INGEST + LOCAL_INGEST_SCRIPT — optional external OCR/ingest pipeline; both must be set for /api/process-inbox.

Rules: never commit .env; never print secret values; generate fresh secrets per client;
after changing .env restart with pm2 restart <app> --update-env.

Safety guards (do not remove):
- utils/dbGuard.js aborts boot if DB_NAME/DATABASE_URL resolves to the live shop database —
  protects against a live .env being copied into a template instance. No override by design.
- NODE_ENV=production refuses to start while ADMIN_PIN is unset or the 0000 placeholder
  (server.js, next to the SESSION_SECRET check). Local dev may keep 0000.
