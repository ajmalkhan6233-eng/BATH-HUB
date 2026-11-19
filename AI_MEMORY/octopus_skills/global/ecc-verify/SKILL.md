---
name: ecc-verify
description: Final quality pass before saying done: build, types, lint, tests, secrets scan, diff review, then PASS/FAIL report.
---
# Verify
Run in order, stop at first failure and fix: 1 build, 2 type check, 3 lint, 4 tests (note count + coverage if configured), 5 quick scan of changed files for keys/tokens/debug prints, 6 read `git diff --stat` for unintended files.
Use the project's own commands (flutter analyze/test, npm run build/lint/test, pytest/ruff). Show only the first ~30 lines of noisy output.
Report: Build / Types / Lint / Tests / Secrets / Diff = PASS or FAIL, then READY or NOT READY.
Local PASS is not live PASS: if deploy was involved, say "live check: VERIFIED / NOT DONE", with evidence. Do not touch production without Aj's say.
Not run = UNVERIFIED, never "done".
