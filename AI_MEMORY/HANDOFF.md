# HANDOFF (2026-10-11, tasks 21 + 22 done on branch work)
- Branch `work` = Royal Bath Hub output (never master). Latest report: AI_MEMORY/LATEST_REPORT.md. I worked on local branch work-tasks and pushed it to origin work (git push origin work-tasks:work).
- New this round: cheque alerts (utils/chequeAlerts.js, wired in layla_owner/boot.js), GRN/cheque photo draft (layla_owner/paperIntake.js + paperDeps.js), supplier price alerts (utils/supplierPriceAlerts.js, hooked in routes/grn_manual.js), catalogue feed with category + in_stock (routes/catalogue_feed.js), website health check (scripts/website_health_check.js, Windows task RBH_Website_Health 08:30), dynamic SQL ratchet test, vendor CLEARED number, public/sync-review.html.
- The running shop app (pm2 apex-server, port 3100, runs from E:\AI Sttuf\BATHCO_TEMPLATE on master) does NOT have these changes. MERGE TO LIVE is Aj's call.
- The scheduled task points into the temporary worktree path; re-point it after merge.
- Website: E:\AI Sttuf\bathhub-website branch work (5eb5178 logo, ad382c1 live catalogue). shopApiUrl is blank (needs an https address).
- Aj next physical action: look at the draft link in AI_BRIDGE/LIVE.md, say publish / change; paste the one blocked line from LIVE.md.
