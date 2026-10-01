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

WEBHOOK_SECRET — optional. When set, /webhook/whatsapp and /webhook/whatsapp-photo require the header
  `x-webhook-secret: <value>` (the bridge sends it automatically if it has the same value in its .env).
  When unset, only a direct local caller (the bridge on the same machine) is accepted; tunnelled or
  proxied requests are refused. Set it if the bridge runs on a different machine from the server.

AGENT_DRAFT_ONLY — optional, default off. Set to true to put live WhatsApp in DRAFT-ONLY mode: a customer's message is
  not answered by LAYLA. It becomes a checked draft in the Agent Review tab (M9) and the webhook returns an empty reply, so
  the bridge sends nothing. You approve, then send it yourself (the tab has an "Open in WhatsApp" button). The owner's own
  number (WHATSAPP_TEST_WHITELIST) is not affected. Needs a restart to change. Max 30 drafts per customer per hour.
WHATSAPP_TEST_WHITELIST — also decides who may use the owner-only business answers (profit, credit, cheques, item cost).
  If it is empty, nobody gets them over WhatsApp.

POS_DEDUCT_STOCK — optional, default off. Set to true and a POS bill takes catalogue items (picked in the item picker) out of
  stock in the same transaction as the bill. Leave it off if the shop's real stock is kept in another system (Lasersoft):
  deducting here as well would count every sale twice. There is no "void bill" yet, so a deduction can't be undone from the app.
  The POS discount cap uses the owner's discount rule (table discount_rules): over-cap bills are refused unless the owner approves.
