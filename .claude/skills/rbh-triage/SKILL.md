---
name: rbh-triage
description: Use whenever something fails or looks wrong: find the exact error and make the smallest fix.
---
# Triage
1. Copy the exact error text or the last 8 lines. No summaries.
2. Reproduce the smallest way, on the cloud test copy (scripts/dev/cloud_rig.sh), never the live app.
3. Find the failing block only: grep, then read the lines around it. Do not re-read the app.
4. Smallest fix, plus a test that fails before and passes after.
5. If it does not work: one retry, then take the next cheapest correct method, say what you chose and keep going.
6. Report: cause in one line, fix in one line, the check that ran. Do not narrate fixed bugs unless AJ must act.
