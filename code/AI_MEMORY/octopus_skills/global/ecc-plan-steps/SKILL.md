---
name: ecc-plan-steps
description: Break a big job into small ordered steps, each with context, check and rollback, so any session can resume it cold.
---
# Plan steps
Use for work spanning several sessions/PRs. Skip for one-PR jobs or when Aj says "just do it".
1. Read project map and memory first. Check git state.
2. Split into 3-12 steps, each one PR/commit size.
3. Per step write: goal, files touched, what to read first, exact check command, done-when, rollback.
4. Mark which steps depend on others and which can run in parallel (no shared files).
5. Re-read the plan once for gaps: missing dependency, step too big, no check. Fix before starting.
6. Changing a plan later: note split/insert/skip/abandon with a reason line.
Save plan as plans/<name>.md only if Aj agrees. Plan only until Aj says "go".
