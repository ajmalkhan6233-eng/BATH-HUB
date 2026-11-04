# Database

- PostgreSQL. Connection comes ONLY from .env (DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD).
- Key tables: users (logins), staff, daily_summary (one row per business day — the heart
  of the system), expenses, payments, lasersoft_invoices (POS import), suppliers,
  customers, conversations (LAYLA chats), feature_flags, login_audit.
- APEX control-plane tables (scripts/migrate_apex.js, seeded by scripts/seed_demo_tenant.js):
  tenants, client_payments, audit_log (INSERT/SELECT only — UPDATE/DELETE revoked from the app
  role), layla_configs, package_config (prices are ALWAYS read from this table, never hardcoded).
  Tenant isolation stays one-DB-per-client — the apex RLS script was audited and skipped (owner decision).
- New client = new empty DB with same schema:
    node scripts/create_instance.js "Client Name" client_slug
  then set DB_NAME=client_slug in .env and restart — the setup wizard appears.
- NEVER run UPDATE/DELETE on financial tables by hand. NEVER connect a template/dev
  copy to a live client database.

- Encoding: the database MUST be UTF8 (Sinhala and Tamil customer messages and item names). A Windows-default WIN1252
  database rejects them with "has no equivalent in encoding WIN1252". Create new databases with:
  CREATE DATABASE name ENCODING 'UTF8' TEMPLATE template0;  (check with: SELECT pg_encoding_to_char(encoding) FROM pg_database;)
