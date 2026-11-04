# Auth and users

- Session-based (express-session, Postgres store). Login: POST /api/login.
- users table: username, password_hash (bcrypt cost 12), role (admin/owner/staff/customer),
  staff_id, optional TOTP 2FA.
- Roles: admin = everything; owner = view-heavy; staff = restricted pages; customer = none.
- Create users from Settings -> User Management (admin only) — not by SQL insert.
- Passwords are never stored plain. Never log them. Min length enforced in UI (12) and
  wizard admin (8).
