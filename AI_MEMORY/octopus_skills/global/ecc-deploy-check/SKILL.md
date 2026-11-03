---
name: ecc-deploy-check
description: Pre-deploy and release checklist: tests, secrets, health check, config, migrations, rollback, one live check.
---
# Deploy / release check
Before: tests pass; no secrets in code; env vars documented and validated at start; DB migrations backward-compatible; previous version tagged/available; rollback steps written; health endpoint exists; HTTPS, CORS and rate limits set; logs hold no personal data; dependencies audited.
Strategy: rolling by default; blue-green if instant rollback matters; canary for risky changes.
Docker: multi-stage, pinned versions, non-root user, small image.
Mobile app release (Flutter): bump version+build number, release build runs on a real device, signing keys kept off the repo, permissions list matches features, store text/privacy answers match what the app really does, test update-over-old-version.
After: ONE manual pass — health OK, key page loads, key API answers, no new errors. Record result. Fail = say BLOCKED and follow rollback.
Never deploy to or test against a live system without Aj's explicit go.
