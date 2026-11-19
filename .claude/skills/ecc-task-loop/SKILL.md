---
name: ecc-task-loop
description: The 6-step loop for every build task (restate, locate, check-first, smallest edit, prove, hand off) so work lands right the first time at the lowest usage.
---
# Task loop (use on every build or fix)
1. RESTATE the task in one line. If it changes money/stock math, stop and ask for the YES first.
2. LOCATE: grep for the block; read only those lines. Check AI_MEMORY/CLOUD_PLAYBOOK.md before inventing a way to test.
3. CHECK FIRST: pick the test or curl that will prove it BEFORE editing. A bug gets a failing test first.
4. SMALLEST EDIT: one module, targeted change, batch independent calls in one step. No cleanup outside the task.
5. PROVE: run that check and the neighbours; compare to the 14-failure baseline. Real Postgres copy for money/stock. Not run = UNVERIFIED.
6. HAND OFF: one LIVE.md line, one EFFICIENCY_LOG.md line, commit named files, push. Reply in 5 lines.
Stuck twice on the same error: stop, write the exact error in LIVE.md, say BLOCKED. Never loop.
