# First-run setup wizard

- public/setup.html (UI) + the /api/setup/* endpoints in server.js (search "FIRST-RUN SETUP WIZARD").
- Trigger: the users table has NO row with role admin/owner -> / redirects to /setup.html.
- It collects business name, logo, currency, admin account, staff accounts; writes
  config/active.branding.json and creates the users.
- It locks itself permanently once an admin exists (403 afterwards).
- To reset a machine for a new client: point .env at a fresh empty DB (see 10) — the wizard
  reappears automatically. Never wipe an existing client's DB to do this.
