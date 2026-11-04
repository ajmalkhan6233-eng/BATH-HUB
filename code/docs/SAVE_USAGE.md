# SAVE USAGE: 50 rules (Ajmal's number one rule, 22 Oct 2026)
Goal: every step costs as little as possible. Cheapest, shortest, free way first. A little extra thinking to find that way is fine.

## A. Before starting
1. Read the task, not the repo. The task text has what you need.
2. Do not read START_HERE.md, HANDOFF files or old reports unless the task says so.
3. Know the layout: AGENT_GUIDE/01 is the file map. Do not explore folders to find things.
4. One task per window. Finish, report, stop.
5. Never start subagents or agents unless AJ asks. Each one starts cold and repeats work.
6. Write the weekly /usage percent on the first line of a report only when you can see it for free.
7. If a task is unclear, ask ONE short question with the exact answer to paste; do not guess and rebuild.
8. If the same thing was already proved in LIVE.md, do not prove it again.

## B. While working
9. Grep first, then Read only the lines you need (offset and limit).
10. Never cat big files or logs. Use tail -n 20 or grep -c.
11. Never print .env, DB dumps, backups or whole tables. Print counts.
12. Batch independent commands into one call.
13. Run only the test file for the module you touched. The full suite only before a merge.
14. Never re-run a test that already passed and nothing changed.
15. Use git diff --stat, not full diffs.
16. No sleep loops or polling. Start in the background, check once.
17. No screenshots unless the task needs visual proof; one per page, not ten.
18. Do not search the web for things the repo or a script already answers.
19. No prose between tool calls. The task list and LIVE.md show progress.
20. First failure: write the exact error to LIVE.md and stop. At most 2 retries, and only with a different idea.
21. Do not refactor, rename, reformat or "improve" anything outside the task.
22. Do not write feature code (Rule 13). Chat does that cheaper and tested.
23. Use the existing script for repeated work. If there is no script, ask chat to write one.
24. Dry run first (--dry or rehearsal), then the real run once.
25. Idempotent scripts only: running twice must not double anything.
26. Do not open the browser or computer-use for something curl or a script can check.

## C. Context hygiene
27. /compact at about 50 percent. Keep: task numbers, hard rules, file paths, UNVERIFIED items.
28. Send big outputs to a file and read the tail, not the whole thing.
29. Summarise long outputs into counts and one line.
30. Keep CLAUDE.md under 90 lines. Move history to docs/ARCHIVE_*.
31. Do not load plugins, MCP servers or skills a task does not name.
32. No heavy hooks. Plain skills only, no SessionStart hooks.
33. Do not re-read CLAUDE.md or files you already read this session.
34. Prefer the cheaper model for runs. A bigger model only when AJ chooses it for a hard bug.

## D. Chat side
35. Chat reads LIVE.md top lines and greps BRIDGE.md; it does not re-read whole files.
36. Shallow clone only. Fetch history only when blame is needed.
37. Build every task of a request in one go, then give AJ one paste.
38. Do not ask AJ what a file or a log can answer.
39. Ask AJ for 1 or 2 photos, not 10, unless he is sending a batch on purpose.
40. Reuse existing modules and scripts before writing new ones.
41. Do not regenerate files that did not change.
42. Keep the handoff in the Project doc (claude/START_HERE_CHAT.md) so a new chat starts warm.

## E. Automation
43. Recurring checks are plain scripts (watchdog, health check, backup), not Claude.
44. Claude starts only for a PLAYED task, at most 3 starts a day.
45. Pre-approve safe commands in .claude/settings.json, so a run never stalls waiting for approval and gets repeated.
46. One combined 06:00 notification, never many.
47. Logs write only on events; rotate them (rbh_logrotate.js).
48. Prune backups to the kept number; never keep endless copies.
49. Do not create duplicate tasks; close old ones in BRIDGE.md.
50. Review these 50 rules on the 1st of each month (with the automation ideas review). Remove what is not helping, add what AJ found.

51. Rule 14: end every report with the 5-line SUMMARY (done, not done, Aj's action, save usage note, status word). Short summaries also save his reading time.
