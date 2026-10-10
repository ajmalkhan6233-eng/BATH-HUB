# HANDOFF (2026-10-10, queue 4 done)
- Branch `work` = Royal Bath Hub output (never master). Latest report: AI_MEMORY/LATEST_REPORT.md. Heartbeat: AI_MEMORY/LIVE.md.
- Website (E:\AI Sttuf\bathhub-website, branch work) is LIVE on https://dapper-dieffenbachia-69d038.netlify.app (published 2026-10-10 with Aj's OK). Rollback: deploy 6ac36cf61280a91d37342917 (old orange site) in Netlify > Deploys > Publish. publish-site.cmd uses the site NAME and fails; use the site id 63ef83ec-f6f7-4b2d-a06b-77d7246a5c64 (see website PROGRESS.md).
- POS cheque/credit bills show on the Cheques page and in Credit & Aging (separate, read only). Quotation "Already billed" marker is in. Details: POS_LEDGER_PLAN.md.
- Agents: nothing leaves by itself. layla_v2 sends become drafts (routes/agent_outbox.js, utils/egressGate.js). Details: SECURITY_GATES.md.
- Dev setup (my session only): throwaway Postgres 5434 (bathco_q3_test) + dev app 3299, login in .test-login.txt (gitignored). Never the live app (3100) or live DB.
- Worktree note: branch work-q3 is pushed to origin work (work is checked out in another worktree).
- Aj next physical action: say "MERGE TO LIVE" only when ready to move branch work to the live app on port 3100. Look at audit/pos/*.png. Answer: KEEP SEPARATE or MERGE POS CREDIT (OPEN_ITEMS).
