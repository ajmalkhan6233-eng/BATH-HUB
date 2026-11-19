---
name: ecc-change-impact
description: Before refactors or cross-module changes: list what can break, then compare the real diff to that list.
---
# Change impact
Before: list callers, data/tables, screens, tests, config, deploy steps and rollback; mark guesses "unverified". Use search, not directory-name guesses.
Refactor rules: behaviour stays the same; small steps; tests green after each step; no mixed feature+refactor commits.
After: compare diff to the list; report extra files touched and checks not run.
Migrations or deletes need a rollback line and an "irreversible?" line before starting.
