# COMMANDS (all slash commands in .claude/commands, merged from the old BATHCO repo)

Type `/name` in Claude Code. Shop commands (marked *) were adapted to Royal Bath Hub's API; the rest are copied as they were and may need checking against server.js. Never let a command start the live server.

| Command | What it does |
|---|---|
| /agent-design | /agent-design |
| /api-test | /api-test |
| /architect | /architect |
| /backup-plan | /backup-plan |
| /bathco-daily | /bathco-daily |
| /bug-hunt | /bug-hunt |
| /build | /build |
| /cashflow | /cashflow |
| /chain-build | /chain-build |
| /checker-run* | Run CHECKER agent to verify all daily records for $ARGUMENTS (optional date range YYYY-MM-DD:YYYY-MM-DD). |
| /checker | /checker |
| /ci-setup | /ci-setup |
| /clean | /clean |
| /commit | /commit |
| /compare | /compare |
| /cost-audit | /cost-audit |
| /create* | description: Build strictly to the spec saved in a brief by /plan, then self-check against it. |
| /credit-aging* | Show credit aging report for all credit customers. |
| /customer-credit | /customer-credit |
| /daily-close* | Enter the daily close figures for $ARGUMENTS. |
| /daraz-list | /daraz-list |
| /dashboard-refresh* | Refresh the Royal Bath Hub dashboard at localhost:3000 with latest data. |
| /db-backup | /db-backup |
| /db-check | /db-check |
| /db-query | /db-query |
| /debt | /debt |
| /dep-audit | /dep-audit |
| /deploy-check | /deploy-check |
| /docker-gen | /docker-gen |
| /dream | /dream |
| /dubai-status | /dubai-status |
| /email-draft | /email-draft |
| /env-check | /env-check |
| /env-setup | /env-setup |
| /eod | /eod |
| /estimate | /estimate |
| /eval | /eval |
| /expense-log | /expense-log |
| /explain | /explain |
| /fix | /fix |
| /full-audit | /full-audit |
| /git-branch | /git-branch |
| /git-log | /git-log |
| /git-undo | /git-undo |
| /gp-report | /gp-report |
| /hallucination-check | /hallucination-check |
| /handoff | /handoff |
| /health-check | /health-check |
| /help | /help |
| /instagram-cap | /instagram-cap |
| /invoice-check | /invoice-check |
| /layla | /layla |
| /log-check | /log-check |
| /margin-check | /margin-check |
| /master-report* | Generate the master all-time report. |
| /mcp-setup | /mcp-setup |
| /meeting-prep | /meeting-prep |
| /migrate | /migrate |
| /monitor-setup | /monitor-setup |
| /monthly-report* | Generate the monthly report for $ARGUMENTS (YYYY-MM format, or leave blank for current month). |
| /morning | /morning |
| /n8n-build | /n8n-build |
| /n8n-status | /n8n-status |
| /nova | /nova |
| /ollama-chat | /ollama-chat |
| /optimize | /optimize |
| /persona | /persona |
| /plan* | description: Interview the user one question at a time to build a structured project brief before any code is written. |
| /port-check | /port-check |
| /product-desc | /product-desc |
| /prompt-improve | /prompt-improve |
| /quinn | /quinn |
| /quote-gen | /quote-gen |
| /react-doctor | /react-doctor |
| /readme | /readme |
| /refactor | /refactor |
| /regex-gen | /regex-gen |
| /release-notes | /release-notes |
| /remember | /remember |
| /reorder-alert | /reorder-alert |
| /report-gen | /report-gen - Generate Report |
| /risk | /risk |
| /rollback | /rollback |
| /security-audit | /security-audit |
| /seed | /seed |
| /spin-bug | /spin-bug |
| /spin-feature | /spin-feature |
| /spin-publish | /spin-publish |
| /spin-status | /spin-status |
| /staff-summary* | Show staff summary and salary history for $ARGUMENTS (optional staff name or leave blank for all). |
| /standup | /standup |
| /status | /status |
| /stock-alert | /stock-alert |
| /supplier-alert | /supplier-alert |
| /supplier-check* | Check supplier payment status for $ARGUMENTS (optional supplier name or leave blank for all). |
| /test-gen | /test-gen |
| /todo | /todo |
| /tool-gen | /tool-gen |
| /translate-code | /translate-code |
| /vera-alerts* | Run VERA agent to check all anomalies, overdue suppliers, credit customers, cash shortfalls. |
| /vera | /vera |
| /version | /version |
| /weekly-report* | Generate the weekly report for $ARGUMENTS (week start date YYYY-MM-DD, or leave blank for current week). |
| /whatsapp-reply | /whatsapp-reply |
| /workflow | /workflow |

Council skills: `company-council` (8 departments) and `llm-council` (5 advisors) in .claude/skills.
