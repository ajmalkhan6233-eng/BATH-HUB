# .env variables

DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD — Postgres connection (10).
PORT — web server port.
SESSION_SECRET — cookie signing; random hex, unique per install, never reuse.
ADMIN_PIN — extra PIN some admin actions ask for.
DASH_USER/DASH_PASS, NGROK_* — basic auth when tunneled to the internet.
ANTHROPIC_API_KEY / OPENROUTER_API_KEY / DEFAULT_MODEL — AI models (12).
OLLAMA_URL / OLLAMA_MODEL — local model (optional).
WHATSAPP_TEST_WHITELIST — bridge test mode (13).
PETTY_CASH_FLOAT — the business's fixed petty-cash/opening float (audit Cash Proof + Petty Cash). 0 = not configured.
COMMISSION_RATE_PCT — default commission % for newly created staff (POST /api/staff). 0 = not configured.
DROP_ROOT — file-drop ingestion root (GRN watcher, inbox uploads); defaults to <install>\data\drop.
ENABLE_LOCAL_INGEST + LOCAL_INGEST_SCRIPT — optional external OCR/ingest pipeline; both must be set for /api/process-inbox.

Rules: never commit .env; never print secret values; generate fresh secrets per client;
after changing .env restart with pm2 restart <app> --update-env.
