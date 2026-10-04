---
title: Internal Bug Hunt Log
purpose: FINAL_BUILD_2.md Task 3 - bugs found, fixes applied, final clean-pass proof.
date: 2026-07-05
---

# Method

Two passes, both against a fresh `pm2 restart all`:
1. **Browser pass** (headless Chromium, SwiftShader WebGL on) — real login,
   every one of the 16 dashboard pages via the actual nav, the Home date
   navigator (5x prev, 5x next, jump-to-latest), global search (short query,
   no-match query), the Audit page's full report generation, and the
   Settings theme switcher (nature ↔ kim_forest). Captured every
   console.error, pageerror, and any HTTP response ≥400, plus scanned each
   page's rendered text for `NaN`/`undefined`/`[object Object]`.
2. **API fuzz pass** — 32 requests against the endpoints most exposed to bad
   input (date fields, search fields, the WhatsApp webhook, login): invalid
   dates, a 50,000-character string, and SQL-injection-shaped strings
   (`' OR '1'='1`, `'; DROP TABLE daily_summary; --`) both as query params and
   as a raw path segment. Checked that every response was either 2xx/4xx, or
   a 5xx with a clean `{error: "..."}` body — never a raw stack trace or an
   unhandled crash.

# Bugs found and fixed (during Task 1/2 verification, before the formal rounds)

1. **`scripts/daily_reconciliation_check.js` hardcoded `user: 'postgres'`**
   instead of reading `process.env.DB_USER`. Broke `/api/audit/flags` (500,
   "password authentication failed for user postgres") the moment last
   session's Phase 2 DB-credential rotation to `bathco_app` landed - this
   script kept trying to log in as `postgres` with the new account's
   password. Fixed: reads `process.env.DB_USER || 'postgres'` like every
   other pool config in the codebase. Verified via a full page-by-page pass
   (zero errors) and a direct `/api/audit/flags` call.

2. **`themes/kim_forest.js` shader precision mismatch.** The water and
   particle fragment shaders declared `precision mediump float;` while their
   paired vertex shaders used GLSL ES's implicit `highp` default for the
   same `uTime` uniform - a genuine WebGL shader-link error (not just a
   warning), thrown every time the kim_forest theme initialized. Fixed:
   fragment shaders now declare `precision highp float;` to match. Verified
   by switching to kim_forest and back to nature in a browser with WebGL
   actually enabled (SwiftShader) - zero console errors either way.

**Not fixed - flagged only:** 13 other `scripts/*.js` one-off historical
files have the same hardcoded `user: 'postgres'` pattern (found via
`grep -r "user:\s*'postgres'"`). None of them are `require()`'d by the live
server (`daily_reconciliation_check.js` was the only one that is), so
they're dormant until someone runs one manually - per `MODULE_REGISTRY.md`
§10 these are point-in-time patches, not a reusable tool, and a blanket
sweep across all of them is out of scope here. Whoever runs one of these
scripts next should expect this exact failure mode and know the fix.

# Formal rounds (post-fix, fresh restart)

**Round 1 — browser pass: 0 findings.** All 16 pages loaded clean via their
real nav entries, date navigator survived 10 rapid clicks + jump-to-latest,
global search handled both a real and a nonsense query, Audit "Generate"
produced a complete report, theme switch both directions - zero
console.error, zero pageerror, zero HTTP ≥400, no NaN/undefined/[object
Object] found in any page's rendered text.

**Round 1 — API fuzz: 0 failures out of 32 requests.** Notable results,
spot-checked directly (not just status code):
- SQL-injection strings (as a query param and as a URL path segment) all
  came back as Postgres's own type-parsing rejection -
  `{"error":"invalid input syntax for type date: \"...\""}" - proving the
  parameterized queries throughout are doing their job; the malicious string
  is never treated as SQL, only ever as a literal (and invalid) date value.
- A 50,000-character query value got a `431 Request Header Fields Too
  Large` straight from Node's HTTP server, before it even reached Express -
  built-in protection, not a bug.
- Every 500 response body was a clean `{"error": "..."}` with a genuine
  Postgres error message - never a stack trace, never a table/column name
  beyond what the API's own parameter names already imply.
- `audit/summary?granularity=<sql-injection-string>` returned 200 -
  `granularityBounds()` maps granularity through a hardcoded 4-value lookup
  object with a safe fallback, so attacker input can't reach the SQL
  `date_trunc()` call at all regardless of what string is sent.
- A reversed date range (`from` after `to`) returns 200 with an empty
  result set rather than a validation error - not a crash, but worth a
  friendlier 400 someday; noting it here rather than silently fixing it
  mid-log, since it's a UX nicety and not a Task 3 "clean errors, never
  crashes" violation.
- `pm2` confirmed `bathco-server`'s PID and restart count were unchanged
  before and after the entire fuzz pass - nothing crashed the process.

**Result: clean pass achieved on round 1 of the allotted 5** - no further
rounds needed.

# Out of scope, observed in passing

- `whatsapp-bridge` logged its known "browser is already running" race
  immediately after `pm2 restart all` (Puppeteer's session lock hadn't
  released before the new process tried to launch its own), then
  self-recovered and reconnected within the same restart cycle. Pre-existing
  behavior, unrelated to any change made this session, and `whatsapp-bridge.js`
  itself wasn't touched by Tasks 1-5 - not chased further.
