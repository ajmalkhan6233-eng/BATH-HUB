# CURRENT_STATE (2026-10-01)

- Branch: master, in sync with origin/master; working tree clean before AI_MEMORY was added
- Last commit: e1356d9 "Live WhatsApp draft-only mode (AGENT_DRAFT_ONLY=true)..."
- Version: package.json 1.0.0

## What works (per docs; UNVERIFIED by me, no tests/build run)
- v1 shop screens, Shop Tools, Growth tabs, Agent Review (LAYLA drafts, Aj approves), public site /bathhub.html
- Test setup: DB bathco_test port 5433, app port 3100
- WhatsApp draft-only mode built but OFF by default

## Known problems
- 17 pre-existing Jest integration failures (CLAUDE.md; not re-run)
- Railway apex-platform parked; real DASH_* creds still open
- Deferred: rename lasersoft_invoices table (golden core, needs sign-off); BATHCO rebrand decision
- Sinhala/Tamil website text not yet checked by a native speaker
- CLAUDE.md task queue dated 2026-07-11; may be stale vs. recent commits

## Next physical action
- Aj: tell me the goal, or reply "show open items".
