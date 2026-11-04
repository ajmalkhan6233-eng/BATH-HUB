---
name: rbh-commit-push
description: Use for every commit and push: branch names, short messages, checks, handover.
---
# Commit and push
Branch claude/<topic>. Never push main or work unless the task says so. One short commit line saying what changed. Run only the tests for what changed (full suite before a merge). Keep stray files out (a node_modules link is not committed). After pushing run git log -1 to confirm. Report branch and commit in a 3-line handover. Split commands: append, commit, push.
