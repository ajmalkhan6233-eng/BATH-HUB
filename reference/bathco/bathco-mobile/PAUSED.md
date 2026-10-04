# PAUSED — superseded by PWA pivot (15 June 2026)

This Expo/React Native app is **paused, not deleted**. Phase 2 of BATHCO COMMAND
pivoted from a native mobile app to converting the existing dashboard
(`C:\BATHCO_PHASE1\public\dashboard.html`, served from `server.js`) into a
Progressive Web App (PWA) instead. Reasons: one codebase to maintain, no app
store distribution needed, and the dashboard already has the full UI built.

## Reference this code when building PWA auth

The session-cookie auth flow here was debugged and works correctly — reuse
the same approach in the PWA (which is even simpler since a PWA runs inside
the browser and shares cookies natively, no `credentials: 'include'` workaround
needed):

- `src/context/AuthContext.tsx` — login/logout state machine, calls
  `/api/login`, `/api/logout`, stores the returned `{id, username, name, role}`
  user object in memory.
- `src/screens/LoginScreen.tsx` — login form UI/UX (username + password,
  error display, loading state) — good visual reference for the PWA's
  `#login-overlay` (dashboard.html already has an equivalent login overlay,
  see lines ~184-192 and `doLogin()`/`showLogin()` around line 1711+).
- `src/api.ts` — `request()` wrapper: `credentials: 'include'`, JSON
  content-type, `ApiError` with `.status`. The PWA's existing `api()` helper
  in dashboard.html already does the cookie-based equivalent (same-origin, so
  cookies just work) — `/api/me` returns 401 when not logged in, which both
  this app and the dashboard use to decide whether to show the login screen.

No code from `bathco-mobile/` needs to be ported as-is — the dashboard already
implements the same admin/owner/staff role logic
(`server.js` lines 30-63, `dashboard.html` `CURRENT_USER.role` checks). This
note exists so the auth debugging effort isn't re-done if native mobile is
revisited later.

## Status

- Do not delete `node_modules`, source, or config — left in place for future
  reference or revival.
- Not run, not built upon, until explicitly un-paused.
