---
name: ecc-flutter-patterns
description: Idiomatic Dart/Flutter: null safety, immutable state, async safety, small widgets, state management, routing, tests.
---
# Flutter patterns
- Null safety: avoid `!`; use `?.`, `??`, pattern matching. Use `late` rarely.
- State: immutable classes with copyWith; sealed types for loading/success/error instead of bool flags. Pick one manager (Cubit, Riverpod or Provider) and stay with it.
- Async: Future.wait for parallel calls; after any `await` check `context.mounted` before using context; cancel subscriptions/timers in dispose.
- Widgets: extract widget classes (not _build helper methods); `const` wherever possible; keep rebuilds narrow; no network/heavy work in build().
- Lists: ListView.builder for long lists; stable keys.
- Routing: one approach (e.g. go_router), typed args, auth redirect in one place.
- Network: HTTPS only; one client with timeout and one-time token refresh; map raw errors to friendly localized text.
- Errors: set FlutterError.onError and PlatformDispatcher.onError, log locally. Privacy-first: no crash reporter that uploads data unless Aj approves.
- Tests: unit-test state logic, widget-test screens, use fakes over mocks.
- Secrets never in Dart source; use --dart-define or a backend.
