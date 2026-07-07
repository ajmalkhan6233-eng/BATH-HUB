# Database

- PostgreSQL. Connection comes ONLY from .env (DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD).
- Key tables: users (logins), staff, daily_summary (one row per business day — the heart
  of the system), expenses, payments, lasersoft_invoices (POS import), suppliers,
  customers, conversations (LAYLA chats), feature_flags, login_audit.
- New client = new empty DB with same schema:
    node scripts/create_instance.js "Client Name" client_slug
  then set DB_NAME=client_slug in .env and restart — the setup wizard appears.
- NEVER run UPDATE/DELETE on financial tables by hand. NEVER connect a template/dev
  copy to a live client database.
