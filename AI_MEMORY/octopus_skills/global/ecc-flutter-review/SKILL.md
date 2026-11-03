---
name: ecc-flutter-review
description: Flutter/Dart code-review checklist: structure, Dart pitfalls, widgets, state, performance, a11y, security, l10n, tests.
---
# Flutter review
Go top-down, list only real findings with file:line.
1 Structure: UI / logic / data separated; no logic in widgets; unused packages removed; strict analysis_options (strict-casts, inference, raw-types); no print().
2 Dart: no implicit dynamic; no blind `!`; catch with `on`; don't catch Error; await or unawaited() every Future; final/const; package: imports; return unmodifiable collections.
3 Widgets: build() under ~80 lines; helpers made into classes; const; ValueKey in lists; theme colors/text styles (no hardcoded); dark mode works.
4 State: dependencies injected; one job per manager; immutable state with ==; exhaustive handling of all states; dispose listeners; no BuildContext stored or used after await unchecked.
5 Performance: narrow rebuilds; no sort/filter in build(); cached, sized images; builder lists; avoid Opacity in animation.
6 Accessibility: labels (Semantics), contrast 4.5:1, tap targets 48px, text scaling, no empty onPressed.
7 Platform: SafeArea, back button, permissions declared, responsive layout.
8 Security: secure storage for tokens, no keys in source, validate deep links, HTTPS.
9 Packages: check pub points, last update, licence, publisher; caret versions; no leftover overrides.
10 Errors: friendly messages, offline handling, retry on transient failures.
11 l10n: no hardcoded strings, locale-aware dates/numbers, RTL ready where needed.
12 Tests: unit + widget for each state change, edge cases (empty, error, loading); flutter analyze clean.
