---
title: BATHCO COMMAND — Claude Code Autonomous Agent Contract
version: 3.0
updated: 2026-06-29
status: ACTIVE — LOCKED
project: First Choice Bathco (Pvt) Ltd
finans and oparation manager: Ajmal Khan
environment: C:\BATHCO_PHASE1\
tags: [claude-code, master-rules, bathco, autonomous-agent]
---

# ⚡ BATHCO COMMAND — Claude Code Autonomous Agent Contract v3.0

> **MANDATORY FIRST ACTION — EVERY SESSION:**
> Read `C:\Users\DELL\Documents\project 1\BATHCO\BATHCO_MASTER_INDEX.md` before touching any file.
> Also read `C:\BATHCO_PHASE1\BATHCO_HISTORICAL_DATA.md` at every session start — it holds historical daily sales/expense figures referenced across reconciliation work.
> It is the map. Individual files only when the index points to them.
> Do NOT claim to be "initialized" or "locked" — read the live index each session; state does not persist between Claude Code sessions.

---

## 🔒 FINAL_V1 (tagged 2026-07-05, see FINAL_BUILD.md Phase 3)
> **FINAL_V1 is protected. No edits to core files without Ajmal's explicit
> "unlock" instruction. New work goes in new files/themes/modules only.**

---

## 🔗 Linked Knowledge Nodes
[[BATHCO_MASTER_INDEX]] · [[RECONCILIATION_RULES]] · [[GOLDEN_CORE]] · [[DECISIONS_LOG]] · [[HONESTY_AUDIT]] · [[BATHCO_BLUEPRINT]] · [[PHASE_ROADMAP]] · [[PHASE2_STATUS]] · [[HANDOVER]] · [[CLOUD_DEPLOY_GUIDE]] · [[PENDING_FROM_AJMAL]] · [[NOOR_DIGITAL_MASTER_INDEX]] · [[server.js]] · [[grn-watcher.js]]

---

## SECTION 1 — CODE CHANGE DISCIPLINE

### 1.1 Surgical Edits Only
- Never rewrite a full file for a minor tweak. Use precise diff patches.
- If the task is "fix a dropdown", touch the dropdown only — not adjacent tabs, routes, colors, or navigation.
- No cosmetic drift: fonts, colors, spacing, and theme (gold/black PWA) are frozen unless Ajmal explicitly unlocks them.
- Output complete, ready-to-paste files — never partial snippets that break the build.

### 1.1a Domain-Scoped Changes (MODULE_REGISTRY.md)
- For any change request naming a domain, read `MODULE_REGISTRY.md` first and touch ONLY that domain's files — never full-project scans.
- If a request doesn't map cleanly onto one listed domain, say so rather than guessing wide across the repo.
- Keep `MODULE_REGISTRY.md` current: when a new top-level module/domain is added, add an entry for it in the same session.

### 1.2 Verification Loop Protocol
```
1. State measurable pass/fail criteria BEFORE making the change.
2. Apply the targeted fix.
3. Check the live rendered page (not just the saved file).
4. If failed → fix and recheck. Max 5 cycles.
5. After 5 failed cycles → STOP. Log the blocker to file. Flag to Ajmal. Do not push broken code.
```

### 1.3 Dry-Run Checkpoint (NON-NEGOTIABLE)
- Required before: any live DB write, any DELETE, any DROP, any financial record mutation.
- Log what WOULD happen. Show Ajmal. Wait for explicit "YES PROCEED" before execution.
- Past permission is not current permission. Each destructive action needs fresh approval.

### 1.4 Blocker Logging (No Silent Failures)
- When stuck, do NOT pause the session asking for input.
- Log blocker details to `C:\BATHCO_PHASE1\logs\blockers.log` with timestamp and context.
- Continue with remaining non-blocked tasks. Flag summary at end of session.

---

## SECTION 2 — SECURITY & ENVIRONMENT INTEGRITY

### 2.1 API Keys & Secrets
- All keys live **exclusively** in `C:\BATHCO_PHASE1\.env`. Never in chat. Never in code blocks. Never in logs.
- If a key is accidentally output → immediately flag: "⚠️ KEY EXPOSED — REVOKE NOW at console.anthropic.com"
- OpenRouter key (OCR): in `.env` as `OPENROUTER_API_KEY`
- Ollama runs locally — no external API key required

### 2.2 Environment Separation (CRITICAL)
```
BATHCO COMMAND     → C:\BATHCO_PHASE1\          (port 3000)
NOOR DIGITAL SaaS  → C:\NOOR_DIGITAL_PHASE1\    (own .env, own DB role, own git repo)
Dubai Imports      → C:\DUBAI_IMPORTS_FLUTTER\  (Flutter app + Express port 3002)
NOOR Islamic App   → C:\Users\DELL\StudioProjects\noor_app\noor_final\
```
**NOOR DIGITAL shares ZERO code, ZERO schema, ZERO secrets with BATHCO. Absolute isolation.**

### 2.3 Role-Based Access Control (RBAC)

| Role | Person | Access Scope | Enforcement |
|------|--------|-------------|-------------|
| Admin | Ajmal Khan | Full — all configs, routes, salary, financials | Unrestricted |
| Investor | Azmi (uncle) | Read-only daily reports only | `blockIfReadOnly()` on all write paths |
| Manager | Imran | Operational — no salary data, no cost structures | Role-gated routes |
| Staff | Gimhani, others | Own stats only: commission, own tasks | Staff-scoped API endpoints |

- `blockIfReadOnly()` must be enforced on every unauthorized frontend action — not just hidden in UI.
- Backend route-level guards, not just frontend visibility toggles.
- Cheque and supplier payment data: Admin + Manager only, never staff.

### 2.4 Autonomy Boundaries

| Situation | Action |
|-----------|--------|
| Code edits, UI fixes, route additions | Full autonomy — no pause |
| New file creation | Full autonomy — no pause |
| Reading/querying database | Full autonomy — no pause |
| INSERT new records | Full autonomy — no pause |
| UPDATE financial records | Dry-run → log → pause for Ajmal confirmation |
| DELETE any record | Hard stop → dry-run → explicit "YES PROCEED" from Ajmal |
| DROP table / schema change | Hard stop → full impact report → explicit "YES PROCEED" |
| Pushing to Railway (production) | Hard stop → stage review → explicit "YES PROCEED" |

---

## SECTION 3 — FINANCIAL MATH & HONESTY ENGINE

### 3.1 Locked Formula Chain (IMMUTABLE)
```javascript
// ══════════════════════════════════════════════════════
// BATHCO CORE FORMULA CHAIN — DO NOT MODIFY WITHOUT
// EXPLICIT WRITTEN INSTRUCTION FROM AJMAL KHAN
// ══════════════════════════════════════════════════════

cash_out_total  = expenses_total + payments_total
cash_in_hand    = total_cash_sale - cash_out_total
net_profit      = gross_profit_total - expenses_total

// ⚠️  CRITICAL: payments_total is EXCLUDED from P&L
// ⚠️  payments_total = supplier cheque payments (not expenses)
// ⚠️  gross_profit source = Lasersoft (for synced invoices)
//                         + estimated at avg GP% (for manual/unsynced invoices)
```

### 3.2 Gross Profit Blending Formula
```javascript
// For any given day:
gp_from_lasersoft   = sum of GP from Lasersoft profit-by-invoice CSV
avg_gp_percent      = gp_from_lasersoft / lasersoft_total_sales * 100
manual_invoice_gp   = manual_invoice_total * (avg_gp_percent / 100)
gross_profit_total  = gp_from_lasersoft + manual_invoice_gp

// Only when NO item-level detail exists in manual bill (lump total only).
// If item codes ARE specified → look up exact cost from inventory/item cost list.
```

### 3.3 Field-Level Rules

| Field | Rule |
|-------|------|
| CARD / ONLINE | Match Excel exactly. Blank = render `0`. No legacy offsets. No math fallbacks. The hardcoded `5,630` legacy value is permanently dead. |
| CASH | Cross-check: cash_in_hand must equal total_cash_sale − cash_out_total |
| NET PROFIT | Show `PENDING` if any required cost input is absent. Never calculate from incomplete data. |
| EXPENSES | Source: handwritten petty cash sheet only |
| PAYMENTS | Source: handwritten petty cash sheet right column (supplier payments) |
| CHEQUE | Source: Excel cheque column. Card/online settlement creates expected day-shift |
| CREDIT | Source: Excel credit column. Tracked in credit customer ledger |

### 3.4 Honesty / Pending Rules
- Every displayed number must trace to a **verified real source**. No guesses. No interpolation.
- Missing data → display `PENDING` or `NOT AVAILABLE` — never a calculated estimate.
- Variance > **LKR 10** between Excel total and dashboard total → immediately isolate to **Conflict Review Ledger**. Log the specific invoice. Never auto-override.
- Show conflict count as a badge on dashboard header.

### 3.5 Petty Cash Float
- Permanent float: **Rs. 25,000** — always.
- Any entry that breaks this balance must be flagged immediately in red.
- Top-up entries on handwritten sheet restore it to 25,000 — log the top-up date and amount.

### 3.6 Staff Commission
```javascript
commission_per_staff = staff_individual_gross_profit * 0.01  // 1% of GP they generated

// Cycle: 25th of month → 24th of following month
// Source: Lasersoft profit-by-invoice report filtered by staff member
// Staff report: pg1 = summary + leaderboard, pg2-3 = full invoice detail
```

---

## SECTION 4 — DATA AUTHORITY HIERARCHY

```
PRIORITY 1 → Excel Day Sheet (Master Transaction Truth)
             Columns: Invoice No, Total Sale, Cash, Card, Online, Cheque, Credit
             Manual bills exist ONLY here — not in Lasersoft

PRIORITY 2 → Handwritten Petty Cash Sheet (Expense & Payment Truth)
             Left column  = Expenses (petty cash spend)
             Right column = Payments (supplier cheque payments)
             Top entry    = petty cash top-up date and amount
             Source: handwritten photo → OCR pipeline

PRIORITY 3 → Lasersoft ERP Export (Cross-Check & GP Source ONLY)
             Never primary. Used for: GP calculation, invoice cross-check, staff reports.
             Lasersoft total < Excel total = manual bill gap (EXPECTED — not an error)
```

### 4.1 Manual / After-Hours Bills
- Manual bills (paper, not in Lasersoft) → enter as fresh sale in **next day's Excel** — never backdate.
- Excel total exceeding Lasersoft on same day = pending-reconciliation gap → **name the specific invoice** in logs.
- Card/online payment settling on day after sale → creates expected day-shift variance → document, do not flag as error.
- GP estimation for manual bills: use that day's Lasersoft average GP% unless Ajmal specifies otherwise.

### 4.2 Daily Input Files (~3 per day)
1. Lasersoft profit-by-invoice + staff CSV / Excel export
2. Transactions Excel (Invoice No, Total, Cash, Card, Cheque, Credit columns)
3. Handwritten expense/petty cash photo → OCR pipeline

---

## SECTION 5 — FILE PROCESSING PIPELINE

### 5.1 OCR Pipeline (Handwritten Expense Photos)
```
Engine  : OpenRouter → nvidia/nemotron-nano-12b-vl:free (vision model)
Fallback: ocr_retry_loop.py (automatic retry on parse failure)
Output  : ocr_expense_results.json
Archive : C:\BATHCO_PHASE1\archive\YYYY\YYYY-MM\ (PERMANENT — zero deletion)
```

**OCR Honesty Rules:**
- Value uncertain (cannot parse 100%) → flag field in **red** on UI → request manual verification.
- Never guess. Never fill with a fallback number. Flag and wait.
- Legible fields: validate by confirming all line items sum to handwritten grand total.
- If sums don't match → flag discrepancy in amber on UI.

### 5.2 LLM Role (Ollama / llama3.2 — LOCAL)
```
ALLOWED  : Interpret natural language date ranges from user queries
FORBIDDEN: Touch, interpret, modify, or estimate any financial figures
           This is a hard architectural rule — enforced by BUG-002 fix
           (Previous bug: Anthropic API was used here — replaced with local Ollama)
```

### 5.3 GRN Watcher (`grn-watcher.js`)
- Scans **exactly 4 levels** of subfolders inside upload directories.
- Date extraction order:
  1. Cell values (Excel serial numbers, DD-MM-YYYY, YYYY-MM-DD strings)
  2. Filename patterns as fallback only
- **NEVER uses today's computer system date** for historical entries.
- Pre-2025-12-21 rows → **permanently quarantined**. Never process. Never display.
- New files in drop folder (`C:\BATHCO_DROP\inbox`) → auto-ingested via watcher.

### 5.4 Calibration Engine (`server.js`)
- Groups every transaction row by true `rowDate` (extracted, not system date).
- `recalculateDate()` runs **idempotently** in background — calling it twice produces same result.
- Frontend responses must return instantly — no blocking recalculation on request thread.
- Use worker thread or queue for heavy recalculation operations.

### 5.5 Time Travel Query Pathway
```
User input  → date range (voice note / text parse / date-picker)
             e.g. "From 2 months ago, the 13th to the 15th"
Backend     → compile matching financial summaries for range
Output      → fully downloadable PDF dashboard snapshot
             Page 1: Summary + staff leaderboard
             Page 2-3: Full invoice detail
```

### 5.6 Archival Policy
```
Path     : C:\BATHCO_PHASE1\archive\YYYY\YYYY-MM\
Retention: PERMANENT (zero deletion policy — ever)
Scope    : All OCR results, processed expense photos, daily snapshots
```

---

## SECTION 6 — FRONTEND UI REQUIREMENTS

### 6.1 Interactive Dashboard Cards
These 5 cards **must** have click event listeners:
- TOTAL SALE
- CASH PAYMENT
- CARD / ONLINE / CHEQUE
- EXPENSES
- NET PROFIT

**On click behavior:**
- Toggle inline sub-panel directly below the card (not a modal).
- Fetch live row-by-row data from server: `invoice_no`, `total_sale`, `payment_mode`.
- If data exists → show it. Never render "No breakdown available" when data is present.
- Loading state → show spinner inline, not blank panel.

### 6.2 Export / Download
- Active PDF download button: Dashboard screen AND Daily Entry screen.
- Active CSV download button: same locations.
- Export scope: selected date's complete dashboard data.
- PDF format: Page 1 = Summary + staff leaderboard | Pages 2-3 = Full invoice detail.

### 6.3 PWA Theme (FROZEN)
- Gold/black luxury theme — DO NOT touch without explicit instruction.
- Served via `npx serve -s dist` at LAN IP `192.168.1.5:5173` (accessible on iPhone).
- React 18 + Vite + Tailwind — no framework migrations without Ajmal sign-off.

### 6.4 PENDING / ERROR Display Standards
```
Data missing    → display "PENDING" in amber
Data error      → display "⚠️ VERIFY" in red
Conflict found  → display "⚡ CONFLICT — SEE LEDGER" in red
Calculation OK  → display value in white/gold
```

---

## SECTION 7 — ALERTS & MONITORING

### 7.1 Permanently Suppressed (Never Re-Flag)

| Item | Status |
|------|--------|
| Code 1676 pricing logic | ✅ Fixed 2026-05-31 — suppress |
| Cheque #760329 duplicate | ✅ Resolved — suppress |
| Tile Gross Profit ~18% | ✅ Normal Sri Lanka market — suppress forever |

### 7.2 Active Alert Triggers (Admin Only)

| Trigger | Threshold | Action |
|---------|-----------|--------|
| Missing invoices | Any | Red badge on dashboard |
| Negative profit margin | Any day | Immediate alert to Ajmal |
| Unbalanced petty cash | Any deviation from Rs. 25,000 float | Red flag |
| Credit terms exceeded | > 45 days outstanding | Alert Imran + Ajmal |
| Cheque due soon | Within 7 days of realize date | Amber alert → badge on Cheque Tracker |
| Manual invoice gap spike | Sudden large gap vs Lasersoft | Log invoice name + gap amount |
| Conflict Review Ledger | New entry added | Badge count on header |

### 7.3 Cheque Tracker Rules
- Alert triggers **7 days** before realize/clear date.
- Cheque Tracker screen: separate tab in PWA.
- SQL migration for cheques table: already prepared — apply before enabling screen.
- Supplier: Eskema Ceramic (major tile supplier) — primary cheque-based payment relationship.

---

## SECTION 8 — AGENT ARCHITECTURE (AI COUNCIL)

### 8.1 Internal BATHCO Agents

| Agent | Role | Trigger |
|-------|------|---------|
| **LAYLA** | OCR ingestion + WhatsApp receptionist | Incoming files + WhatsApp messages |
| **CHECKER** | Validation — verifies extracted data | Post-OCR, pre-database |
| **QUINN** | Inventory sync | GRN / stock updates |
| **VERA / NOVA** | Financial reporting | Daily report generation |
| **COMMAND** | Orchestrator | Routes tasks to all other agents |

### 8.2 LAYLA WhatsApp Receptionist Protocol
```
Languages  : Sinhala (primary), Tamil, English
Quotes     : Price RANGES only — never exact prices
Objective  : Invite customer to showroom
Collect    : Name, need/product, phone number, area
Escalate   : Difficult queries → forward to Ajmal immediately
Forbidden  : Never quote exact invoice prices, never commit to stock availability
```

### 8.3 External AI Council (Roles)

| Agent | Primary Role in BATHCO |
|-------|----------------------|
| Claude (you) | Chief Builder — architecture, code, logic |
| Claude Code | Dev Execution — runs on Dell, edits files |
| Grok | Research Scout |
| ChatGPT | Copy / Customer Voice |
| Gemini | Google Ecosystem tasks |
| Perplexity | Deep Research |
| n8n AI | Automation workflows (pm2, port varies) |

---

## SECTION 9 — SYSTEM TOPOLOGY

### 9.1 Port & Path Map

| Service | Path | Port | Status |
|---------|------|------|--------|
| BATHCO COMMAND backend | `C:\BATHCO_PHASE1\` | 3000 | Running |
| Dubai Imports backend | — | 3002 | Running |
| BATHCO PWA (React/Vite/Tailwind) | `C:\BATHCO_PHASE1\bathco-app\` | 5173 | LAN: 192.168.1.5 |
| Ollama (llama3.2 local LLM) | localhost | 11434 | Running |
| n8n automation | pm2 managed | — | Running |
| Drop folder (LAYLA inbox) | `C:\BATHCO_DROP\inbox` | — | Watched |
| Archive | `C:\BATHCO_PHASE1\archive\` | — | Permanent |
| Railway (cloud target) | railway.app | — | NEXT DEPLOYMENT STEP |

### 9.2 Database

| Database | Role |
|----------|------|
| `bathco` (PostgreSQL 16) | BATHCO COMMAND — all financial, inventory, staff |
| `dubai_imports` (PostgreSQL 16) | Dubai Imports — stock, customers, payments, shipments |
| NOOR DIGITAL DB | Isolated — separate role, separate schema |

### 9.3 Dev Environment (Dell Inspiron)
- Node.js v24 | Flutter 3.44.2 | PostgreSQL 16 | Ollama | Claude Code 2.1.195
- Agent-Reach 1.5.0 | Railway CLI v5.23.1 | Scoop v0.5.3
- Android SDK + AVD on F: drive (junction link) | API 30, Pixel 4a, swiftshader_indirect
- Flutter at `C:\flutter\flutter\bin\` (double-nested — always use full path)
- Flutter build command: `C:\flutter\flutter\bin\flutter.bat build apk --release`

### 9.4 Skills & Plugins Available
- **Ruflo** skill pack: `npx ruvflo init` (full) or `/plugin install ruflo-core@ruflo` (lite)
  - 100+ agents, 60+ commands, 30 skills, MCP server
  - Key dirs: `.agents/skills/`, `.claude/skills/`, `plugins/`
- **obsidian-skills** (kepano): Install via `/plugin marketplace add kepano/obsidian-skills`
  - Provides: obsidian-markdown, obsidian-bases, obsidian-cli, json-canvas, defuddle

---

## SECTION 10 — DUBAI IMPORTS (SECONDARY PROJECT)

### 10.1 Flutter App
- Path: `C:\DUBAI_IMPORTS_FLUTTER\`
- 5 screens: Dashboard, Products, Customers, Payments, Shipments
- Connects to Express backend port 3002 + PostgreSQL `dubai_imports`
- Managed by: Ajmal's wife (stock tracking, customer payment tracking)

### 10.2 Business Context
- Sources perfume / beauty products from Kuwait and Dubai
- Contact: Mrs. Nushra
- 5 categories: Beauty, Food/Beverages, Fashion, Household, Snacks
- Website: React 18 + Tailwind, WhatsApp order flow
- Islamic/halal compliance required for all product assessments

---

## SECTION 11 — NOOR DIGITAL SAAS (TERTIARY PROJECT)

### 11.1 Business Model
- White-label version of BATHCO COMMAND for Sri Lankan retailers
- Target market: 15,000+ retail shops, 87% Android dominance
- Pricing: Rs. 3,000–8,000/month SaaS OR Rs. 75,000 one-time local installation

### 11.2 Isolation Rules (HARD)
```
Code       : C:\NOOR_DIGITAL_PHASE1\    ← OWN directory
Config     : Own .env                   ← NEVER shared with BATHCO
Database   : Own PostgreSQL role        ← NEVER shares bathco DB
Git        : Own repository             ← NEVER mixed commits
```

---

## SECTION 12 — NOOR ISLAMIC APP

### 12.1 Status
- Flutter app at: `C:\Users\DELL\StudioProjects\noor_app\noor_final\`
- Release APK built successfully — ready for Google Play submission
- Free, ad-free, Sharia-compliant (this is sadaqah jariyah — ongoing charity)

### 12.2 Features
Prayer Times, Quran, Duas, Qibla, Tasbih, 99 Names, Hajj/Umrah Guides, Zakat Calculator, Islamic Calendar

### 12.3 Planned: Kids Corner
Surah memorization, Dua flashcards, 99 Names matching game, Wudu steps, Islamic alphabet

### 12.4 Competitor Research Done
Muslim Pro, Quran Majeed, islamtics — all researched and differentiation documented.

---

## SECTION 13 — FUTURE-PROOFING & AUDIT

### 13.1 Multi-User Audit Log
- Every manual edit via Daily Entry form must log:
  - Timestamp of change
  - Account/role that made the change
  - Previous value
  - New value
  - Reason field (optional but prompted)
- Log is hidden from staff, visible to Admin only.

### 13.2 Phase 2 Schema Placeholders (Ready Now)
Add these dummy fields now to avoid future migrations:
- `item_quantity` — for stock tracking integration
- `damage_log` — breakage/damage records
- `min_stock_alert` — minimum stock threshold
- `supplier_id` — FK to supplier table (Eskema Ceramic etc.)

### 13.3 Conflict Review Ledger
- Auto-populated when Excel vs dashboard variance > LKR 10.
- Fields: date, invoice_no, excel_amount, dashboard_amount, gap, status (OPEN/RESOLVED)
- Resolved only by Admin after manual verification.
- Never auto-close. Never auto-override source data.

### 13.4 BATHCO Specific Business Rules
- Supplier: Eskema Ceramic — primary tile supplier, cheque-based payments
- Business ethics: Halal-only, honest record-keeping, no riba (interest) — core value
- All financial decisions must be reviewable and traceable to source document

---

## SECTION 14 — DEPLOYMENT PIPELINE

### 14.1 Current State
- BATHCO PWA: ✅ Built and running on iPhone over LAN (192.168.1.5:5173)
- BATHCO Backend: ⏳ Running locally only (port 3000)
- Cloud target: Railway.app — **NEXT STEP is deploying backend to Railway**

### 14.2 Railway Deployment Checklist (When Ready)
```
□ Review all hardcoded localhost references → replace with env vars
□ Confirm all secrets are in .env (not hardcoded)
□ Test DB connection string works with Railway PostgreSQL
□ Run dry-run migration on Railway staging
□ Get Ajmal's "YES PROCEED" before first live push
□ Update PWA API base URL to Railway URL
□ Test PWA on iPhone against Railway backend
```

### 14.3 CLOUD_DEPLOY_GUIDE
See → [[CLOUD_DEPLOY_GUIDE]] for complete Railway deployment steps.

---

## SECTION 15 — MISTAKES FOUND & CORRECTED FROM PRIOR AGENT OUTPUT

> This section documents 50 errors found in the previous agent initialization output (GLM 5.2 session).
> Retained here as a learning record to prevent regression.

| # | Mistake | Correction Applied |
|---|---------|-------------------|
| 1 | "Legacy text at bottom has been superseded" — hallucination, no such text exists | Removed fabricated claim |
| 2 | No mention that session state does NOT persist between Claude Code sessions | Added explicit warning in header |
| 3 | Missing petty cash float amount (Rs. 25,000) | Added Section 3.5 |
| 4 | Missing staff commission rate and cycle (1%, 25th–24th) | Added Section 3.6 |
| 5 | Missing Gimhani as named staff member | Added to RBAC table |
| 6 | Missing Eskema Ceramic supplier relationship | Added Sections 7.3 & 13.4 |
| 7 | payments_total explanation incomplete — not clear it means supplier cheques | Clarified in formula chain comments |
| 8 | Missing BUG-002 documentation (Anthropic API → Ollama replacement) | Added Section 5.2 |
| 9 | Missing OCR engine specification (nvidia/nemotron-nano-12b-vl:free) | Added Section 5.1 |
| 10 | Missing archival path and zero-deletion policy | Added Section 5.6 |
| 11 | Missing n8n mention entirely | Added to topology and AI Council |
| 12 | Missing Railway deployment status and next steps | Added Section 14 |
| 13 | Missing BATHCO PWA LAN IP (192.168.1.5:5173) | Added Section 9.1 |
| 14 | Missing drop folder path (C:\BATHCO_DROP\inbox) | Added Section 9.1 |
| 15 | Missing credit customer tracking | Added to field rules table |
| 16 | Missing cheque alert 7-day rule | Added Section 7.2 |
| 17 | "Financial Exception" incomplete — missing DROP/schema change boundary | Added full autonomy boundaries table |
| 18 | Missing gross profit blending formula | Added Section 3.2 |
| 19 | Missing item-code lookup rule for manual bills with codes | Added Section 3.2 |
| 20 | "Suppressed alerts" listed without explicit "never re-flag" language | Clarified in Section 7.1 |
| 21 | Missing LAYLA agent protocol details (languages, behavior rules) | Added Section 8.2 |
| 22 | Missing agent names: CHECKER, QUINN, VERA, NOVA, COMMAND | Added Section 8.1 |
| 23 | Missing Dubai Imports project context | Added Section 10 |
| 24 | Missing Dubai Imports Flutter screen list (5 screens) | Added Section 10.1 |
| 25 | Missing Mrs. Nushra contact reference | Added Section 10.2 |
| 26 | Missing NOOR Islamic app status (Play Store ready) | Added Section 12.1 |
| 27 | Missing NOOR Kids Corner planned features | Added Section 12.3 |
| 28 | Missing NOOR competitor research mention | Added Section 12.4 |
| 29 | Missing NOOR DIGITAL pricing model (Rs. 3,000–8,000/mo or Rs. 75,000) | Added Section 11.1 |
| 30 | Missing NOOR DIGITAL target market (15,000+ shops, 87% Android) | Added Section 11.1 |
| 31 | Missing NOOR DIGITAL isolation declared only loosely | Hardened in Section 11.2 |
| 32 | Missing Ruflo skill pack installation commands | Added Section 9.4 |
| 33 | Missing obsidian-skills integration | Added Section 9.4 |
| 34 | Missing multi-user audit log specification | Added Section 13.1 |
| 35 | Missing Conflict Review Ledger field structure | Added Section 13.3 |
| 36 | Missing Phase 2 schema placeholder fields | Added Section 13.2 |
| 37 | Missing connected Obsidian nodes / wiki-links | Added at top |
| 38 | Missing PDF output format specification (pg1/pg2-pg3) | Added Sections 5.5 & 6.2 |
| 39 | Missing dashboard PENDING display standard for cards | Added Section 6.4 |
| 40 | Missing loading state spec for dropdown panels | Added Section 6.1 |
| 41 | Missing PWA gold/black theme freeze rule | Added Section 6.3 |
| 42 | Missing blocker logging rule (log to file, not pause session) | Added Section 1.4 |
| 43 | Missing manual bill gap naming convention | Added Section 4.1 |
| 44 | Missing card/online settlement day-shift explanation | Added Section 4.1 |
| 45 | `recalculateDate()` described but idempotency not enforced in spec | Hardened in Section 5.4 |
| 46 | Missing worker thread / queue recommendation for heavy recalculation | Added Section 5.4 |
| 47 | Missing halal/Islamic ethics business rule | Added Section 13.4 |
| 48 | Missing `dubai_imports` database name | Added Section 9.2 |
| 49 | Missing Claude Code version (2.1.195) and Agent-Reach version | Added Section 9.3 |
| 50 | Missing Railway CLI and Scoop versions | Added Section 9.3 |

---

## SECTION 16 — SESSION START CHECKLIST

```
□ Read BATHCO_MASTER_INDEX.md first
□ Check PENDING_FROM_AJMAL for any outstanding tasks
□ Check blockers.log for unresolved items from prior sessions
□ Confirm which environment (BATHCO / Dubai Imports / NOOR DIGITAL)
□ Confirm task scope — get file paths from index before scanning
□ State pass/fail criteria before first code change
□ Never claim to be "initialized" — re-read the index every session
```

---

## SECTION 17 — BATHCO NATURE MODULE MAP

`public/BATHCO_NATURE.html` (served at `GET /nature`) is a separate frontend from `public/dashboard.html` — never edit both for the same fix, they are intentionally independent. Nature is organized into labeled modules; **an edit to one module should only touch that module's block** (its `<div class="page" id="page-X">` section plus its matching JS functions, grouped under a `// ═══ MODULE NAME ═══` comment banner in the `<script>`).

| Module | HTML block(s) | JS functions | Notes |
|---|---|---|---|
| THEME | `<style>` block, CSS custom properties in `:root` | `spawnNatureFx()` | Divine Nature design system: emerald/earth/gold, frosted glass, Allah watermark (excluded via `body.no-watermark` on POS/billing pages) |
| 3D | (Three.js, when added — keep to dashboard/login/transition only, never data pages) | — | Graceful degradation required if WebGL unavailable |
| POS | `#page-pos` | `posAddByCode`, `renderPosCart`, `posRecalc*`, `posPrintReceipt` | Feature flag `pos_billing` |
| INVENTORY | `#page-grn`, `#page-labels` | `loadGrn`, `addGrn`, `renderBarcodeSVG`, `encodeCode128B` | GRN is CORE (`core_grn`); barcode labels is flagged (`inv_barcode_labels`) |
| REPORTS | `#page-home`, `#page-daily`, `#page-credit`, `#page-cheques`, `#page-quotations` | `loadHome`, `loadDaily`, `loadCredit`, `loadCheques`, `loadQuotations`, `kpiCard`, `animateCounter` | All CORE, wired to existing `/api/*` report endpoints |
| AI | `#page-assistant` | `sendChat` | Feature flag `ai_assistant_chat`, calls `/api/nl-query` (separate system from LAYLA's WhatsApp chat — see SECTION 8) |
| AUTH | `#login-screen` | `doLogin`, `doLogout`, `checkAuth`, `api()` | Reuses the same session-based auth as dashboard.html (`/api/login`, `/api/me`) |
| DATA-API | (none — Nature has no server routes of its own) | `api()` wrapper | All data comes from existing `server.js` routes; Nature never talks to Postgres directly |
| SETTINGS | `#page-settings` | `loadSettings`, `loadFlags`, `toggleFlag`, `applyFlags` | Feature flags are DB-backed (`feature_flags` table + `/api/feature-flags`), NOT localStorage |

### White-label architecture

- **ENGINE** = the code (`server.js`, `BATHCO_NATURE.html`, `scripts/*`) — customer-agnostic, never hardcode a company name/color in logic.
- **CONFIG** = `config/<instance>.branding.json` (name, logo, colors, currency, language) — the *active* one is always `config/active.branding.json`, served via `GET /api/branding`. Swap it to rebrand without touching code.
- **DATA** = one Postgres database per customer instance (e.g. `bathco`).
- **New instance**: `node scripts/create_instance.js "Company Name" [db_slug]` — clones the live schema (via `pg_dump --schema-only`, not the stale `schema.sql`) into a new DB with zero business data, seeds the `feature_flags` registry, and writes `config/<slug>.branding.json`. Verified working 2026-07-02 (34 tables cloned, 0 rows). Does not provision new hosting — this is a single-machine deployment; running a second instance means a second `server.js` process on a different port with `DB_NAME` and `config/active.branding.json` pointed at the new instance.

### Feature flag registry

`feature_flags` table: `module_key, category, label, description, is_core, enabled, built`. CORE modules (`is_core=true`) are always on and cannot be toggled off (enforced in `PATCH /api/feature-flags/:key`). Dormant modules ship `enabled=false`; `built=false` means it's registered in the catalog but has no real implementation yet — the Settings page shows these as "NOT YET BUILT" with a disabled toggle rather than a working-looking control that does nothing. Never flip `built=true` without an actual DB table + API route + UI panel behind it.

### Testing safety — NEVER test against live/today's data

**Incident (2026-07-20):** puppeteer tests for daily-entry.html ran against `localhost:3000`
using the page's own `localToday()` date. Its server-first `load()` design (by design: any
computer sees today's real entries) pulled the day's real 9-invoice, Rs. 414,205 data into
the test session, test rows were typed into the same positionally-indexed table, `save()`
synced the merged/contaminated result back to `daily_entry_live`, and a cleanup
`DELETE FROM daily_entry_live WHERE entry_date = CURRENT_DATE` erased the entire day's row —
real data included. No server-side backup existed yet at the time to recover from.

**Rule — no exceptions:** puppeteer/automated tests for daily-entry.html (or any page whose
`load()`/save() touches `daily_entry_live`, `daily_summary`, or any other live business table)
must NEVER run against today's actual date or any date that might hold real entries.
- Use a clearly-fake test date (e.g. `2099-01-01`) hardcoded in the test, never the page's
  own `localToday()`/date-picker default.
- If a real server must be hit (not a static-file check), point it at a disposable test
  database or, at minimum, verify `SELECT COUNT(*) FROM daily_entry_live WHERE entry_date = <test date>`
  is empty before the run and clean up only that exact test date afterward — never a
  `CURRENT_DATE`-relative delete.
- Never call `.click('#saveBtn')` or trigger a real sync in a test without confirming first
  which date the page is currently loaded on.

---

## SECTION 18 — PROGRESS TRACKING

Two files track progress on any multi-item body of work (a numbered fix list, a lettered
phase list, etc.): **`PROGRESS.md`** (project root) and **`public/progress.html`** (same
content as a simple webpage). Update both **immediately after finishing each numbered item
or lettered phase** — not batched at end of session, not skipped because a chat summary
already covered it.

**Audience is Ajmal, not a programmer.** Every line in these two files must be written for
him specifically:
- No jargon, no file paths, no code terms — nothing like "CSS", "API", "commit", "render",
  "sticky", "database", "endpoint", "backend", "deploy".
- Describe each item in one plain sentence, in terms of what he sees or does on screen —
  not what changed in the code.
- Never mark something DONE that hasn't actually been verified working. If it's blocked or
  waiting on a decision from Ajmal, say so in the sentence and use IN PROGRESS, not DONE.

**Format (both files, same content):**
- One summary line at the very top of each tracked list: `X of Y done`. If more than one
  list is active at once, also add one combined total above them.
- Each item: its number or letter, one plain sentence, and a status of exactly one of
  `DONE`, `IN PROGRESS`, `NOT STARTED`.
- `public/progress.html`: plain layout, large readable text, color-coded status (e.g.
  green/amber/grey), no login required, mobile-friendly — Ajmal may check it from his phone.

---

*Contract v3.0 — Owner: Ajmal Khan — First Choice Bathco (Pvt) Ltd — Thihariya, Kandy Road, Sri Lanka*
*Operates under Islamic business ethics: halal-only, honest record-keeping, no riba.*

