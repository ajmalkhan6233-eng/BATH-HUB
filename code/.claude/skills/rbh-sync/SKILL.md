---
name: rbh-sync
description: Use at the start and end of any work that chat and Claude Code share: read the other side's last lines, write your own last lines or exact error.
---
# Shared sync (bridge repo Universal-project-, folder AI_BRIDGE)
- Two writers, two files, no conflicts. Claude Code writes the top of AI_BRIDGE/LIVE.md. Chat writes the top of AI_BRIDGE/CHAT_LOG.md. Newest line on top.
- Line format: HH:MM | CHAT or PC | task | state | last 8 lines of output, or the EXACT error (max 8 lines, secrets removed).
- Claude Code: pull and read the top 8 lines of CHAT_LOG.md at session start and at every heartbeat. Heartbeat every 10 to 15 minutes on long jobs and at the end of every task. (Every couple of minutes would cost usage and loops are not allowed.)
- Chat cannot wake itself. At the start of every reply that touches work: pull the bridge, read the top 8 lines of LIVE.md. At the end of any turn that changed something: push one CHAT_LOG.md line.
- Errors are pasted exactly, never summarised. Never paste secrets, .env values or tokens.
- If the top LIVE line is older than 30 minutes while a task is PLAYED, say so in the next reply.
