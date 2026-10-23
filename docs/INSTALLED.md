# INSTALLED AND ADDED (easy-access list; read this first in any new window or bridge)
Rule (AJ 23 Oct): whenever anything is installed or added (tool, plugin, skill, connector, branch, website change), add ONE line here in the same task and push. Newest on top. State is one of: PLANNED, QUEUED, INSTALLED (with version/date), UNVERIFIED.
| What | Where | State | Note |
|---|---|---|---|
| Command Centre breakdowns (click any number, see what it is made of; search, sort, download, copy) | routes/dashboard_breakdown.js, public/dashboard_breakdown.js, tests/dashboardBreakdown.test.js; branch claude/command-centre | QUEUED (Task 109) | Read-only. 28 cards clickable. Tested on the cloud test copy at phone width; live UNVERIFIED |
| rtk (shrinks command output, saves usage) | PC, winget rtk-ai.rtk, then rtk init -g | INSTALLED v1.0.1 (winget, 23 Oct); VERIFIED 23 Oct: hook active, rtk gain shows savings; proxy line removed, telemetry on | Apache-2.0. Only touches Bash commands. Check with rtk gain |
| claude-usage monitor | PC, C:\Users\Sony\claude-usage, http://localhost:8080 | INSTALLED 23 Oct, cloned; dashboard returned HTTP 200 | MIT. Watch the 40% weekly limit |
| Ponytail plugin (minimal-code rules) | Claude Code plugin | QUEUED: AJ types /plugin marketplace add DietrichGebert/ponytail then /plugin install ponytail@ponytail | MIT. Its ideas are already in rbh-blocks |
| Website SEO pass | repo bathhub-website, branch claude/seo-pass (ce40e24) | DONE, NOT PUBLISHED | 9 of 20 checks done; table in SEO_20_CHECKS.md; waiting for the web address. Publish only on AJ's word |
| 23 skills | .claude/skills (6 app: ux qa pos erp i18n fullstack; 17 workflow: method blocks reply wrapup sync gemini-prompt papers price-learner ship-check triage plan research security commit-push usage decision halal) | DONE, arrive on work with Task 107 | Block-by-block rule is in CLAUDE.md |
| Shared notes | AI_BRIDGE/LIVE.md (PC) and AI_BRIDGE/CHAT_LOG.md (chat) | DONE | top 8 lines, heartbeat 10 to 15 min |
| Cloud test copy | scripts/dev/cloud_rig.sh | DONE | test only, never live |
| Session record | docs/SESSION_22OCT_RECORD.md | DONE | rules, built, open items |
| Skipped on purpose | caveman, code-review-graph, Supabase, n8n, Dify, Langflow, LangChain | NOT NEEDED | duplicates what we have |
