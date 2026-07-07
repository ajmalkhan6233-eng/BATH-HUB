# Pre-edit safety checklist — run through this EVERY time

[ ] Read 01_file_map.md — am I editing the right file?
[ ] Read 09_golden_core.md — is this file/region forbidden? If yes: STOP.
[ ] Is there a config/flag way instead of a code change? (03, 05, 08)
[ ] No secrets hardcoded — everything sensitive comes from .env.
[ ] No business name/details hardcoded — branding comes from config (03).
[ ] This machine is ONE client's copy — no edits that assume another client's data,
    and never point it at another client's database (tenant isolation).
[ ] After edit: node -c on changed files, restart, load the page (02).
[ ] If broken and not fixed in 2 attempts: revert to the previous working state.
