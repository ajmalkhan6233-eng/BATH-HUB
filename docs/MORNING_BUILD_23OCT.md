# MORNING BUILD 23 OCT 2026 (one queue for Claude Code on the PC; AJ pastes one line)
Handover: branch claude/rbh-ux-skill. Adds 6 skills (.claude/skills: rbh-ux, rbh-qa, rbh-pos, rbh-erp, rbh-i18n, rbh-fullstack), docs/UX_CHECKLIST.md, docs/qa/QA_AUDIT_REPORT.md, scripts/dev/cloud_rig.sh, pointer lines in CLAUDE.md. Docs, skills and a test script only: no app code, no live data, NO restart.

1. In E:\AI Sttuf\BATHCO_TEMPLATE: git fetch origin, merge origin/claude/rbh-ux-skill into work. Must merge clean; else the exact error to LIVE.md. Check: the 6 skill folders exist.
2. Read-only free check: npm audit --omit=dev. Put only the counts by severity in LIVE.md. Fix nothing.
3. Check that a NEW Claude Code session lists the 6 rbh-* skills. Report yes or no.
4. Push work. Top LIVE line and the 5-line SUMMARY.

After this, chat's next builds (cloud, AJ says "go N"): 1 customer return screen, 2 cash in/out/leftover report, 3 one POS instead of two, 4 hold/recall bills, 5 low-stock warning at POS. Full list: docs/UX_CHECKLIST.md.
