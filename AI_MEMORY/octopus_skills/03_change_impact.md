# 03 CHANGE IMPACT (before cross-module / DB / API change)
Before: list what could break: callers, tables, screens, tests, deploy steps, rollback. Mark guesses "unverified".
After: compare the real diff to that list. Say any extra file touched, or any item not checked.
Needs a rollback step and an "irreversible?" line for every migration. No rollback written = do not start.
Cost: low; run only for changes touching 2+ modules.
