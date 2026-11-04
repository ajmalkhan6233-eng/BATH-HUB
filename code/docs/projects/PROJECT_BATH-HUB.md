# PROJECT: BATH-HUB (Royal Bath Hub shop app)
## What it is
Shop app (POS, GRN, cheques, vendor ledger, stock, reports, Layla WhatsApp assistant). Repo ajmalkhan6233-eng/BATH-HUB (public on purpose). Local: E:\AI Sttuf\BATHCO_TEMPLATE. Live app: pm2 apex-server, port 3100.
## Status (2026-10-12)
Branch `work`, tag v1.1. Live master already equals work. Automations built via notify queue (utils/notify.js, automations.js, automations2.js). WhatsApp DRY RUN until keys are set. Jest baseline: 17 known failures, must not grow.
## Rules
Branch work only. Never master/live PM2 names (never reuse bathhub-server; use apex-server/apex-tunnel with --only). Golden core never edited (AGENT_GUIDE/09). No secrets in git. Rule 11 (06:00 one message). Never start this repo's whatsapp-bridge on the laptop.
## Next
Open items: AI_MEMORY/OPEN_ITEMS.md. 9 listed bugs wait for Ajmal's OK. 5 quick wins held (usage). Cut-out photos, Sinhala voice test not built.
## Links
CLAUDE.md, AI_MEMORY/HANDOFF.md, AI_MEMORY/OPEN_ITEMS.md, AGENT_GUIDE/README.md, docs/bathhub_knowledge/README.md, docs/LAYLA_PRO_SPEC.md, MD_MAP.md.
