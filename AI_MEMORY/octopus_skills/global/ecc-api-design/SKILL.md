---
name: ecc-api-design
description: REST API design rules: names, methods, status codes, error shape, pagination, versioning, auth, rate limits.
---
# API design
- URLs: plural nouns, kebab-case, no verbs (/orders/{id}). Nest max 2 levels.
- Methods: GET read, POST create/action, PUT replace, PATCH partial, DELETE remove. GET never changes data.
- Status: 200 ok, 201 created, 204 no body, 400 bad input, 401 not signed in, 403 not allowed, 404 missing, 409 conflict, 422 invalid, 429 rate limit, 5xx ours. Never 200 for errors.
- Error shape: { error: { code, message, details? } } same everywhere; no stack traces or SQL.
- Lists: always paginate. Offset for small admin tables; cursor for feeds/large data. Support filter + sort params.
- Version in path (/api/v1) when breaking changes are possible; add fields freely, never silently remove.
- Auth required unless marked public; user sees only own data; rate limit with headers.
- Keep naming style consistent with existing endpoints. Update the API doc.
Checklist before shipping an endpoint: name, method, status, validation, errors, pagination, auth, limits, no leaks, docs.
