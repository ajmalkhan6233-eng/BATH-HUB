# BATH HUB MASTER — Session Reference File
## Read this at the start of EVERY session. Update task queue when tasks are done.

**Owner:** Ajmal Khan | **Email:** [REDACTED]
**Business:** Bath Hub, Kandy Road, Thihariya, Sri Lanka
**Opened:** 21 December 2025 | **Software:** Lasersoft POS + Accounting
**Last updated:** 31 May 2026

---

## STANDING INSTRUCTIONS (apply every session unless told otherwise)

- GP margin ~18% is ACCEPTED — it is Sri Lanka tile market reality. DO NOT flag it.
- Answer in plain English. Rs. amounts. Direct yes/no first.
- Read this file at session start. Update task queue as work is completed.
- Main data drop zone: `C:\Users\1st Choice\Desktop\bathco-data\`
- Session memory: `C:\Users\1st Choice\Desktop\bathco-data\SESSION_MEMORY.md`

---

## RESOLVED ALERTS — NEVER REPEAT THESE

- Code 1676 (2X2 FLOOR TILE) below-cost pricing: **FIXED 31 May 2026**
- Cheque #760329 Rs.355,070 duplicate to ISURU PRINTING: **VERIFIED AND RESOLVED**
- GP margin below target: **ACCEPTED — Sri Lanka tile market reality**

---

## ACTIVE ALERTS (still open)

- May 25 date error in Lasersoft (recorded as 2026-04-25, should be 2026-05-25)
- Code 1478 (2X1 TILE) shows 97% GP — verify cost entry in Lasersoft
- GRN.xlsx — reported corrupt May 2026 but file now exists at 261 KB (last modified 2026-06-17); verify by opening in Excel to confirm contents are intact
- 7 unreadable export files in `bathco-data\extracted\URGENT\URGENT\` (AFDAS, BFNH, CFBDF, FNGJN, SFSGS, TOTAL, VGNGF) — open in Excel manually

---

## TASK QUEUE (update this as things get done)

### INFRASTRUCTURE
- [x] Pull Ollama models: llama3.2 — IN PROGRESS (downloading in background terminal window)
- [ ] Pull Ollama models: mistral, nomic-embed-text — not yet started
- [ ] Start Docker Desktop and verify running (start from taskbar shortcut — needs manual action)
- [ ] Import n8n workflows from `C:\Users\1st Choice\AI-EMPIRE\` — needs Docker or standalone n8n running

### BATH HUB BUSINESS MANAGEMENT SOFTWARE (Phase 1 — COMPLETE)
- [x] Scaffold Bath Hub Business OS folder structure — `C:\Users\1st Choice\bathco-software\`
- [x] Build database schema in PostgreSQL — 6 tables created (daily_sales, products, sales_transactions, cheques, suppliers, import_log)
- [x] Build Daily Sales Dashboard (Module 1) — live at localhost:8000
- [x] Build Supplier Payment Tracker / PDC Cheques (Module 2) — live at localhost:8000/cheques
- [x] Build Inventory Monitor (Module 3) — live at localhost:8000/inventory
- [x] Build GP% Monitor (Module 4) — live at localhost:8000 (GP Monitor tab)
- [x] Build Cash Flow Forecast (Module 5) — live at localhost:8000/cashflow
- [x] Build AI Chat Assistant (Module 6) — live at localhost:8000/assistant (needs ANTHROPIC_API_KEY)
- [x] Deploy Bath Hub OS locally — server running on localhost:8000

### NEXT PHASE
- [ ] Import all historical data into the software (run `python backend\bulk_import.py`)
- [ ] Add ANTHROPIC_API_KEY to `.env` to activate AI Assistant
- [ ] Import cheque register (OUTBOUND_CHEQ_CLEAN.xlsx) via Import tab
- [ ] Import product/stock data into products table
- [ ] Connect Gmail MCP OAuth (in Claude Code — run /connect gmail)
- [ ] Pull remaining Ollama models (mistral, nomic-embed-text)
- [ ] Start Docker + import n8n workflows

---

## SOFTWARE BUILT — 1ST CHOICE BATH HUB BUSINESS MANAGEMENT

**Status:** RUNNING at `http://localhost:8000`
**Start command:** Double-click `C:\Users\1st Choice\bathco-software\START_BATHCO.bat`

### Files Created
```
C:\Users\1st Choice\bathco-software\
├── START_BATHCO.bat                    ← double-click to start
├── .env                                ← database + API keys (edit ANTHROPIC_API_KEY)
├── requirements.txt
├── backend\
│   ├── main.py                         ← FastAPI app entry point
│   ├── database.py                     ← PostgreSQL connection
│   ├── models.py                       ← all 6 database tables
│   ├── schemas.py                      ← data validation
│   ├── init_db.py                      ← run once to create tables
│   ├── bulk_import.py                  ← imports all files from DAY SALE folder
│   └── routers\
│       ├── sales.py                    ← /sales/* endpoints
│       ├── cheques.py                  ← /cheques/* endpoints
│       ├── inventory.py               ← /inventory/* endpoints
│       ├── cashflow.py                 ← /cashflow/* endpoints
│       ├── assistant.py               ← /assistant/ask (Claude API)
│       └── importer.py                ← /import/* (file upload)
└── frontend\
    └── index.html                      ← full dashboard UI (7 tabs)
```

### What Each Tab Does
| Tab | URL | What it shows |
|---|---|---|
| Dashboard | localhost:8000 | KPIs, monthly chart, cheque chart, top products, upcoming cheques |
| Sales | localhost:8000 | Daily sales last 30 days with payment breakdown |
| Cheques | localhost:8000 | Pending cheques calendar, mark-as-cleared button |
| Inventory | localhost:8000 | Stock by category, slow movers (90+ days no sale) |
| Cash Flow | localhost:8000 | 3-month forecast: projected sales vs cheques due |
| GP Monitor | localhost:8000 | All products below 25% GP — colour-coded by severity |
| AI Assistant | localhost:8000 | Chat with Claude about live Bath Hub data |
| Import Data | localhost:8000 | Upload Lasersoft Excel files |

### Database
- Host: localhost:5432 | DB: bathco | User: postgres | Password: [REDACTED]
- Tables: daily_sales, products, sales_transactions, cheques, suppliers, import_log

---

## AI STACK STATUS (31 May 2026)

| Tool | Installed | Running | Notes |
|---|---|---|---|
| PostgreSQL 17.10 | YES | YES | Auto-starts, port 5432 |
| Ollama 0.24.0 | YES | YES (process) | No models downloaded yet |
| llama3.2 | NO | NO | Downloading in background |
| mistral | NO | NO | Not started |
| nomic-embed-text | NO | NO | Not started |
| n8n 2.22.5 | YES | NO | Run: n8n start → localhost:5678 |
| Docker Desktop 29.5.2 | YES | NO | Start from Desktop shortcut |
| Bath Hub Business Software | YES | YES | localhost:8000 |

---

## KEY FILE PATHS

| What | Path |
|---|---|
| This file | `C:\Users\1st Choice\BATHCO_MASTER.md` |
| Claude instructions | `C:\Users\1st Choice\CLAUDE.md` |
| Session memory | `C:\Users\1st Choice\Desktop\bathco-data\SESSION_MEMORY.md` |
| Business software | `C:\Users\1st Choice\bathco-software\` |
| Start software | `C:\Users\1st Choice\bathco-software\START_BATHCO.bat` |
| AI Empire (Docker) | `C:\Users\1st Choice\AI-EMPIRE\` |
| Daily sales files | `C:\Users\1st Choice\Desktop\DAY SALE\` |
| Data drop zone | `C:\Users\1st Choice\Desktop\bathco-data\` |
| Cheque tracker HTML | `C:\Users\1st Choice\Desktop\PDC_CHEQUE_TRACKER.html` |
| Cheque register Excel | `C:\Users\1st Choice\bathco-data\extracted\URGENT\URGENT\OUTBOUND_CHEQ_CLEAN.xlsx` |

---

## CUSTOM CLAUDE SKILLS

- `/bathco-council` — 8-agent AI board meeting (8 department heads, peer review, Chairman resolution)
- `/llm-council` — 5-advisor generic council for any decision

---

## DIGITAL INCOME STREAMS (not started)

1. Gumroad — PDC Cheque Tracker at USD 9 (file ready: `Desktop\PDC_CHEQUE_TRACKER.html`)
2. YouTube — first video: "My AI Found a Pricing Mistake Worth Rs.55,000"
3. WhatsApp consulting, mini course, agency — not started
