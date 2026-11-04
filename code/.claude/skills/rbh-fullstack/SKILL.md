---
name: rbh-fullstack
description: Use when changing the Node/Express/PostgreSQL code, routes, queries, env settings, security, images, offline caching or startup and shutdown of the Royal Bath Hub app.
---

# Royal Bath Hub code rules (Gemini list, trimmed to what this app actually uses)
Stack today: Node, Express, PostgreSQL, plain HTML/JS in public/, pm2. No React, Flutter, Redis, Docker, JWT or WebSockets here. Do not add any of them. A new library or paid service needs AJ's OK.

- Errors: one JSON shape {error: "plain words"}. Never send a stack trace to the browser. Log the detail on the server.
- Queries: parameterised always (the dynamic_sql_allowlist test guards this). Check a slow query with EXPLAIN before adding an index. Likely indexes: date, item code, vendor id.
- Input: validate on the server (plain checks). The browser check is only for convenience.
- Settings at launch: warn clearly when a needed .env value is missing (the app already does this). Never print .env values.
- Shutdown: close the database pool and finish running jobs on SIGTERM so a pm2 restart loses nothing.
- Abuse: rate-limit login and the public enquiry form. Security headers and strict CORS on public routes.
- Photos: compress and resize on upload (WebP), keep the original name out of the URL.
- Offline: queue unsent bills on the device (public/offline-queue.js) and retry; every save is idempotent.
- Modular: one feature, one file, tested alone. Jest baseline never grows. Commit messages: one short line saying what changed.
- Free checks that are allowed: npm audit (read-only report), node --check, the Jest files for what changed.
