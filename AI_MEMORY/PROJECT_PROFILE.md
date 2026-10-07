# PROJECT_PROFILE (2026-10-01; from CLAUDE.md, package.json, AGENT_GUIDE, docs/V1_START_HERE.md)

## Identity
- Name: bathco_template (Royal Bath Hub / "apex" platform template; folder E:\AI Sttuf\BATHCO_TEMPLATE, CLAUDE.md calls it C:\BATHCO_TEMPLATE)
- Purpose: white-label shop system for a tile/bathware shop: sales, stock, POS, GRN, expenses, cheques, reports, LAYLA AI assistant, WhatsApp draft-only replies, public site
- Stack: Node.js (CommonJS, .nvmrc), Express 5, PostgreSQL (pg), whatsapp-web.js, Jest, plain HTML frontend (public/), Anthropic + OpenAI SDKs
- Git: branch master, remote github.com/ajmalkhan6233-eng/BATH-HUB. Tree clean at inspection.

## Important folders
- server.js (188 KB, main app), layla.js, index.js, whatsapp-bridge.js, grn-watcher.js
- routes/, middleware/, utils/, scripts/ (migrations, seeds, dev/), config/ (branding), public/, frontend/ (AI Studio UI export, now tracked), tests/
- AGENT_GUIDE/ (rules 01-18; READ 09 and 15 before edits), docs/, SESSION_LOG.md

## PROTECTED CONTENT (never read into memory, edit, export, commit, or send)
- Live shop data (live system C:\BATHCO_PHASE1, Railway project bathco-production / alert-cooperation)
- Lasersoft ERP exports in C:\Bathco\AI-Data\ (folder not found from this PC at inspection: UNKNOWN location)
- Any customer or financial records: sales, payments, cheques, supplier, staff salary/loans, customer chats
- Golden core (AGENT_GUIDE/09): financial regions of server.js, routes/purchasing_accounting.js, staff_reports.js, audit.js, scripts/daily_reconciliation_check.js, scripts/layla_answer_engine.js
- Financial tables, never ALTER: daily_summary, expenses, payments, lasersoft_invoices, supplier_*, cheques, staff_salary, staff_loans
- Secrets: .env, .test-login.txt, .pg_test_superpw, TEMP_PASSWORDS.txt, ADMIN_PIN, DASH_* creds, RAILWAY_API_TOKEN (all gitignored)
- Ignored data dirs: data/, uploads/, cheques/, DAY SALE/, DALI/, backups/*.dump|sql, *.pdf

## Never-touch list
- Never touch the live system or Railway project bathco-production. Never use pm2 name bathco-server
- Never start this repo's whatsapp-bridge on the laptop (kills live WhatsApp session)
- Railway apex-platform is PARKED: unpause only on Aj's explicit go-live; never `railway add -d postgres`
- Never point this copy at another client's database
- Nothing sends/posts/prices/pays by itself: agent drafts, Aj approves. Halal only. No cost/margin/loan/commission in public pages or replies
- Don't delete frontend/ or vendor-internal docs without approval

## Commands (from docs)
- Install: `npm install`; syntax check: `node -c <file>`; start: `npm start` (node server.js)
- Tests: `npm test` (jest); unit: `npm run test:unit`; integration: `npm run test:integration`
- Test DB: PostgreSQL port 5433, db bathco_test (UTF8); app on port 3100; rebuild via scripts/dev/load_test_schema.js then seed_test_data.js
- Deploy: unknown for now (Railway recipe in CLAUDE.md task 1; parked)
- Release / production build: UNKNOWN

## Special rules
- Run AGENT_GUIDE/15 checklist before every edit; verify with `node -c` and page load after
- One client per copy; branding via config, not hardcoded
- Client-copy exclusions: SESSION_LOG.md, AISTUDIO_HANDOFF/, CLAUDE.md, backups/, frontend/, local_ops/
- Jest baseline: 17 known integration failures; must never grow (per CLAUDE.md, UNVERIFIED now)
- Sinhala/Tamil text needs a native speaker check
