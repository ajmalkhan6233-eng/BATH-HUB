---
name: ecc-security-review
description: Security checklist for new endpoints, login, input, secrets, uploads and dependencies in Node, Flutter, React or Python apps.
---
# Security review
Check each, report PASS/FAIL/NA:
- Secrets: none in code or git history; in env/secret store; .env ignored.
- Input: validate every input with a schema; allow-list; limit upload size/type/extension.
- SQL: parameterized queries only, never string joins.
- Auth: check permission on the server for every sensitive action; tokens in httpOnly cookies on web, platform secure storage on mobile.
- XSS/CSRF: escape or sanitize HTML; strict CSP (no unsafe-inline/eval by default); SameSite cookies, CSRF token on state changes.
- Rate limits: all endpoints, stricter on login and costly calls.
- Data exposure: no secrets/PII in logs; generic errors to users, details only in server logs.
- Dependencies: lockfile committed; audit known holes; remove unused packages.
- HTTPS, CORS to named origins only, security headers.
Privacy rule: no analytics or crash-reporting that sends user data out unless Aj approves.
