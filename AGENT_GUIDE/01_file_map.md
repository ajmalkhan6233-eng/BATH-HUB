# File map — who owns what

ROOT
- server.js .......... THE backend. All /api routes, Excel upload parsing, reports, auth. 3200+ lines. Edit with care; never touch its financial math (see 09).
- layla.js ........... LAYLA AI assistant core: system prompt, model fallback chain (Ollama -> OpenRouter), reply parsing/safety.
- whatsapp-bridge.js .. WhatsApp connection (whatsapp-web.js). Receives customer messages, posts to server webhook, sends replies.
- grn-watcher.js ...... Watches for GRN photos and OCRs them.
- index.js ........... legacy entry (WhatsApp bot standalone). Normal start is server.js.
- shop_config.json .... LAYLA's business knowledge (showroom info, packages, rules). Safe to edit per client.
- ecosystem.config.js . pm2 process definitions (server, grn-watcher, whatsapp-bridge).
- .env ............... secrets + DB name + PORT. Never hardcode these anywhere else.

FOLDERS
- public/BATHCO_NATURE.html .. THE frontend. Single file: all pages, styles, JS. Login, dashboard, sales, expenses, reports, settings live here.
- public/setup.html .......... first-run setup wizard (runs when DB has no admin user).
- public/themes/ ............. background themes (see 06).
- config/active.branding.json  business name, logo, colors, currency (see 03).
- routes/purchasing_accounting.js  purchasing + supplier/accounting APIs (golden core).
- routes/staff_reports.js ....... staff attendance/commission APIs (golden core).
- routes/audit.js ............... audit report generation (golden core).
- scripts/ ...................... maintenance tools: create_instance.js (new client DB), seed_feature_flags.js, migrations.
- tests/ ........................ jest tests. Run with: npm test

WHICH FILE OWNS WHICH SCREEN: every visible page is a `<div class="page" id="page-XXX">`
inside public/BATHCO_NATURE.html. Find a screen by grepping that file for its title text.
