---
name: ecc-git-workflow
description: Git habits: short branches, clear commits, safe merge vs rebase, small PRs, conflict handling, releases.
---
# Git workflow
- Keep main deployable; work on short branches (feature/…, fix/…); small PRs (<500 lines), one concern each.
- Rebase only your own unpushed branch; merge for shared/pushed branches. Never rewrite someone else's history. Never force-push without Aj's OK.
- Before PR: self-review the diff, tests/lint pass, branch up to date with main.
- Conflicts: read both sides, keep intent of both, re-run tests; resolve early by syncing often.
- Releases: semantic versions (MAJOR.MINOR.PATCH), tag, short changelog from commit subjects.
- Undo safely: `git revert` for pushed commits; `reset --soft` only for local ones.
- Stash with a message. Delete merged branches.
- Commit and push only when Aj asks (his rule), unless a task says "ends with commit + push".
