---
name: rbh-tools-first
description: Use at the start of EVERY task: pick the right skill, connector or script before working, so nothing is forgotten and usage stays low.
---
# Right tool, first time (AJ: "use skills and connectors on time")
Match the job, open ONLY that row, then work.
| Job | Use |
|---|---|
| Bill / GRN / cheque photo | skill rbh-bill-reader; app reader (GRN > Generate) |
| Screen, form, phone layout | rbh-ux, then rbh-ship-check before saying done |
| Stock, GRN, vendor money | rbh-erp; test with scripts/dev/cloud_test.sh --rig-only (db bhtest) |
| POS, discount, receipt | rbh-pos |
| Prices for new items | rbh-price-learner |
| Test / audit | rbh-qa, rbh-audit (test copy only) |
| Any code edit | rbh-blocks (grep the block, edit only it) |
| Any commit | rbh-commit-push + rbh-security |
| Reply to AJ | rbh-reply (short, status word last) |
Connectors (Gmail, Drive, Sheets, Notion): only when AJ names them or a bill/file arrives there. Read-only first. Nothing is sent out without his OK.
Habit: before building, say in one line which skill/script you are using. Before ending, update AI_MEMORY/NOW.md and push.
