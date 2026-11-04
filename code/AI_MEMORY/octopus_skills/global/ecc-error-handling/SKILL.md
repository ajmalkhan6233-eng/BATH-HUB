---
name: ecc-error-handling
description: Consistent error handling: typed errors, friendly user text, full server logs, safe retries, no silent catches.
---
# Error handling
1. Fail fast at the boundary; never swallow: every catch handles, rethrows or logs.
2. Typed errors with a code (AppError subclasses); API uses one shape { error: { code, message } }.
3. Users get friendly text; logs get full context; never show stack traces or raw exceptions.
4. Retry only transient failures (timeouts, 5xx) with growing delay and a cap; never retry 4xx.
5. Async code must surface errors to callers; no fire-and-forget without a fallback.
6. UI: error boundary (React) / global error hooks (Flutter); show retry + offline states.
7. Python: custom exception base class and a global handler. Node/Express: central error middleware.
Check before merge: no empty catch, no leaks, codes documented.
