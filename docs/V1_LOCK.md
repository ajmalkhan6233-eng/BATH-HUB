# VERSION 1.0 LOCK (AJ, 24 Nov 2026)
The app as it runs today is locked as **Version 1.0** (file `VERSION`). Alhamdulillah.

- `docs/LOCK_MANIFEST.json` holds a fingerprint of every app file (public, routes, utils, pocket, cloudflare, middleware, server.js).
- `tests/unit/v1_lock.test.js` FAILS if any of them changes while VERSION still says 1.0.0.
- To change the app on purpose: (1) bump `VERSION` (1.0.1, 1.1.0, ...), (2) make the change, (3) run `node scripts/lock_version.js` to lock the new state, (4) commit.
- No feature, restyle or "quick fix" goes in without a new version number. Fixes for a real bug are version 1.0.x.
- Git tag `v1.0.0-locked` marks this exact state; `git checkout v1.0.0-locked` brings it back.
