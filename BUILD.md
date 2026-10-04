# BATH HUB BUILD PLAN (read this one file)

**OWNER SAID GO on 2026-10-04.** This file replaces "no code changes until Aj says GO". Owner: Ajmal. Repo: `E:\AI Sttuf\BATHCO_TEMPLATE` (GitHub `ajmalkhan6233-eng/BATH-HUB`, branch `master`). App name in pm2: `apex-server` (port 3010). Time zone Asia/Colombo.

## 0. How to work (usage is tight: about 15% left)
1. **Stop rule:** run `/usage` (or `/cost`) before each build. At about 8% left, finish and commit the current step. At **5% left, stop**, write `AI_MEMORY/RESUME.md` (what is done, the next exact step, the commands) and tell the owner. Continue after the limit resets.
2. **Spend little:** switch to the lighter model with `/model` for builds if available. Do not read big files in full (use `grep`, `sed -n`). No screenshots unless a UI bug needs one. Run only the touched test files during a build, the full suite once at the end. Reports: 5 one-line bullets.
3. **Most code is already written and tested** in this pack (`root/`). Copy it, wire it, test it. Do not rewrite it.
4. **Per build:** branch `build/NN-name` -> tests green -> `git merge --no-ff` into master -> `git push origin master` -> `pm2 restart apex-server --only apex-server` -> check `/health` returns ok -> append one line to `AI_MEMORY/BUILD_LOG.md` and update `AI_MEMORY/HANDOFF.md` and `OPEN_ITEMS.md` -> log the rollback command (`git revert -m 1 <merge>`).
5. If a check fails: do not merge, log it, move to the next build.
6. Take a DB backup (the existing encrypted backup script) before any migration.

## 1. Hard rules (unchanged)
- Never touch the live shop (`C:\BATHCO_PHASE1`, Railway project `alert-cooperation`). pm2 names `bathco-server`, `grn-watcher`, `whatsapp-bridge` belong to the live shop: always `--only apex-server`. Never start this repo's whatsapp-bridge on this laptop.
- **Golden core** (read only, never edit): financial math in `server.js`, `routes/purchasing_accounting.js`, `routes/staff_reports.js`, `routes/audit.js`, `scripts/daily_reconciliation_check.js`, `scripts/layla_answer_engine.js`, and tables `daily_summary, expenses, payments, lasersoft_invoices, supplier_*, cheques, staff_salary, staff_loans`. New modules sit beside them and read them only. If a build needs a change there, list it in `OPEN_ITEMS.md`.
- Modular rule: every feature is its own module, tested alone, changes scoped to it.
- Sandbox: you can write only inside the repo and reach only allowed domains (GitHub works). If a build needs another domain (for example `openrouter.ai`), log "NEEDS ALLOWLIST" and skip that step.
- Never read `.env` values. Secrets only in `.env`. No new secrets in code. Never change repo visibility. Do **not** rotate the live DB password (owner decision: leave as is, accepted risk).
- Free first: no paid AI, no paid WhatsApp API. The WhatsApp Business app is used by hand.

## 2. What the business needs (so you can decide small things)
Bath Hub, Kandy Road, Thihariya. Bathroom accessories, fittings, ceramics (commodes, basins). **No tiles for now.** Cash is tight (start about 200,000). Stock comes on vendor credit paid by post-dated cheques (cheques written Saturdays, cleared Monday if another bank). Prices are flexible, owner enters the real sold price, no approval steps.
- Running cost without owner pay: **316,000/month** (~10,500/day). Daily all-in cost target 15,000, hard ceiling 18,000.
- Pricing: accessories list = cost x 1.8 + 150, red line = cost x 1.3. Ceramics: red line = cost + minimum profit, list = red line x 1.25 (25,000 commode: red line 30,000, list 37,500, safe discount 20%). Tiles: percent of cost (First Choice Bathco gross margin is about 18% of price, about 22% on cost).
- Commission: percent of profit, default **2%** (owner decision 2026-10-04; editable in settings; First Choice Bathco pays 1% of gross profit). Zero on a bill with no profit.
- Net profit split, phase 1 until shop cash reaches one month of costs: shop 50, commitments 30, savings 10, owner 10. Phase 2: 30, 40, 10, 20. Editable. Deposit set-aside 200,000 / 24 = 8,333 a month before any split.
- Languages for customer messages: English and Sinhala.
- Real commode costs (RK Trading, Dec 2025): economy round 21,000; eco SQ 26,500; SQ set 35,000; back-to-wall 36,000; 1-unit SQ 39,000; round 45,000; round black 49,500. **Package price list (owner accepted 2026-10-04, replaces the old bands 40-60k / 60-80k / 80-100k / 100k+):** A 52,900; B 85,400; C 115,400; D 172,400, built from real commode costs 21,000 / 26,500 / 35,000 / 49,500. Use `packageQuote()` to test.

## 3. Pack contents (copy from `root/`, already tested: 45 tests)
| File | What it is |
|---|---|
| `utils/slBankHolidays.js` | 2026 Sri Lankan bank holidays from BATHCO (warns for years not loaded) |
| `utils/vendorLedger.js` | BATHCO clearing rule (other bank = next business day after the rolled date), bill state (payable stays until a cheque CLEARS), vendor totals, cheque calendar (today, tomorrow, Monday, 7/14/30 days, overdue, bulk days), cash gap, amount in words, cheque checks (payee CASH, words mismatch, stale date), duplicate finder |
| `scripts/migrate_vendor_ledger.js`, `scripts/vendor_ledger_down.sql` | 4 new tables with `branch_id`: `vendor_bills`, `vendor_bill_cheques`, `vendor_payments`, `vendor_credit_notes`. Idempotent. Rollback SQL |
| `routes/vendor_ledger.js` | router factory `createVendorLedgerRouter({ pool, requireAuth })`, 15 endpoints, validated, tested with pg-mem |
| `public/vendor-ledger.html` | phone-first page: payable, covered, cash gap, cheque calendar, bills, add bill, add cheque, clear, bounce, warnings, CSV |
| `utils/pricingEngine.js` | accessory, ceramic, tile rules, real shelf markups by category (`categoryPrice`), `marginInfo`, `packageQuote` |
| `utils/profitWaterfall.js` | commission, deposit set-aside, phase, split, weekly waterfall |
| `utils/billChecks.js` | Sri Lanka phone normaliser, bill draft checks (item maths, total, phone, date) |
| `utils/morningBrief.js` | `buildBrief()` and `toText()` for the 5:30 brief |
| `apply.ps1` | copies the pack, runs the new tests, commits on `build/01-vendor-ledger` (no AI usage) |

## 4. BUILDS (run in this order)

**Owner's instruction (2026-10-04): bring everything necessary from the nine months of First Choice Bathco work into BATH-HUB.** The earlier scan only wrote reports (`audit/REPOS_SCAN.md`, `audit/repos_reports/`). Nothing was copied yet. Builds 0, 2 and 3 do the copying. The three repos are BATHCO (live shop app), bathco-vault (rulebook), Universal-project- (unrelated, skip). The scan's temporary clones are reused: do **not** re-clone or re-read whole repos.
**Never copy:** credentials of any kind (API keys, DB passwords, PINs, plain-text logins, `.env`), customer names and phones, staff pay, `DALI/` and `data/` spreadsheets into git. After each copy run a grep for `password|passwd|secret|api[_-]?key|token|PIN` on the new files and abort that item if anything matches.
**Keep the books separate:** First Choice Bathco is a different business. Its cheques, stock count and sales are used for **study and seeding only**, never loaded into Bath Hub's payables, stock or sales tables.

### VERIFIED HARVEST MAP (Claude chat opened the three archives the owner uploaded: BATHCO.rar, BATHCO_TEMPLATE.rar, bathco-vault.rar)
Paths are inside the BATHCO clone (`BATHCO/BATHCO/...`) unless stated. Use the scan's temporary clones; do not re-read whole repos.

**Already in the pack (do not redo):** the cheque clearing rule and the 2026 Sri Lankan bank holiday list (`utils/slBankHolidays.js`, `nextClearingInfo()`), real shelf markups by category (`DEFAULT_CATEGORY_MARKUP` in `utils/pricingEngine.js`).
**Real findings to respect:**
- BATHCO clearing rule: same bank = cheque date rolled to the next business day; **another bank = the next business day after that** (Friday -> Monday, Saturday -> Tuesday). The ledger page's `OUR_BANK` was "NDB Bank": make our bank a setting.
- 27% of the cheque dates in the old Excel register fall on Saturday or Sunday: the register holds written dates, not bank dates. Always compute the clearing date.
- Real shelf markups on cost (First Choice Bathco, 22 April 2026, 1,256 items): angle and conceal valves 157%, waste/trap/gully 186%, accessory sets 138%, hoses 128%, basin taps 121%, bidet sprays 102%, showers 98%; **commodes only 24%** (profit Rs. 8,000 to 15,500), basins 43%, vanity cabinets 65%, tiles 35%. So `cost x 1.8 + 150` is lower than First Choice Bathco's own accessory prices, but a commode at red line + 25% (about +50% on cost) is far above its commode prices. **Both shops are on Kandy Road, Thihariya.** Keep commodes and basins near shelf prices; take the profit on accessories.
- Eskema Ceramic is paid in weekly cheques capped at Rs. 500,000 over many weeks (about 11 weeks for a 5.5M balance); typical cheque size across suppliers Rs. 500,000. Use 500,000 as the default bulk-day threshold lower bound.

**TAKE (code, port as modules with tests, no data in git):**
1. `public/daily-entry-v2.html` (4,629 lines, branch `origin/ledger-fixes-2026-07-25`) with `routes/daily_entry_sync.js`, `routes/cheque_register.js`, `tests/unit/cheque-register.test.js` (164 lines), `public/lib/pdf.min.mjs` + `pdf.worker.min.mjs` (Lasersoft PDF reader, flag off). Built with no login: add login, `branch_id`, role checks first. Keep its offline UUID sync, the "never let an empty server response overwrite local data" rule, and the holiday-year warning.
2. `scripts/daily_reconciliation_check.js` (10 checks: sales arithmetic, net profit arithmetic, GP status gaps, high expense ratio, negative profit, cash shortfall, missing expenses, pending reconciliation, sales conflict, invoice gap). Golden core: **copy as a new file `scripts/day_checks.js`**, do not overwrite the golden one.
3. `scripts/ocr_expense_photos.py`, `ocr_retry_loop.py`, `ocr_photo.js`, `import_ocr_expenses.js` and the OCR honesty rules (uncertain field -> red and manual check; line items must sum to the handwritten total, else amber). Feeds Build 4.
4. `scripts/import_product_costs.js` (Lasersoft "Item Price List" xlsx: CODE, DESCRIPTION, COST, PRICE, UOM, TOTALQTY; dry run flag exists). Feeds Build 3.
5. `scripts/import_item_level_sales.js` (honest cost_source labelling), `scripts/migrate_payments.js`, `scripts/seed_feature_flags.js`, `scripts/create_instance.js` (new branch or client), `routes/cheque_tracking.js`.
6. `reports/PDC_CHEQUE_TRACKER.html` (cheque tracker report layout) as a design reference for the vendor ledger print view.

**TAKE (knowledge, cleaned: no staff names, phones, emails, shop figures):** `CLAUDE.md` sections 1-7 and 13 (surgical edits, verification loop, dry-run before money writes, blocker logging, RBAC, formula chain, field rules, PENDING/VERIFY display standards, data hierarchy, manual bill rules, OCR rules, alert triggers, audit log, Conflict Review Ledger); `GOLDEN_CORE.md` (reusable engine list and the extraction checklist); `RECONCILIATION_RULES.md` (truth hierarchy, VERIFIED / ESTIMATED / INCOMPLETE day tags, quarantine table pattern); `HONESTY_AUDIT.md` (every number traces to a source; aggregates say PARTIAL x of y); `DECISIONS_LOG.md`, `MODULE_REGISTRY.md`, `PHASE_ROADMAP.md`, `REFINEMENT_50.md`, `BUG_HUNT_LOG.md`, `PENDING_FROM_AJMAL.md`; `DEFAULT_DAYS.md` and `SUPPLIER_CLEANUP.md` as patterns only (the "defaulted days" list and the KEEP / MERGE / CHECK supplier classification); bathco-vault rulebook and NOOR_DIGITAL go-live rules.

**TAKE (agents and commands):** `agents/BATHCO_MASTER.md` (strip the email and the `Password: postgres` line), `agents/bathco-council.md` (8-head council prompt), `agents/llm-council.md`, `agents/BATHCO_ASSISTANT_MODE.md`; the 12 `.claude/commands/*.md` and 93 `claude-commands/*.md` slash commands. Rewrite paths: `localhost:3000` -> the BATH-HUB port, `C:\Bathco\AI-Data\run_agents.py` -> remove or replace; keep the daily-close, credit-aging, supplier-check, vera-alerts, cashflow, margin-check, reorder-alert, stock-alert, quote-gen, customer-credit, whatsapp-reply, instagram-cap, product-desc, eod, morning, estimate, debt commands. LAYLA protocol: Sinhala primary, then Tamil and English; price ranges only; invite to the showroom; collect name, need, phone, area; escalate hard questions.

**DATA (never in git; reference folder `E:\AI Sttuf\fcb-reference\`, gitignored):** the files live in BATHCO's git history, not the working tree: `data/QUANTITY AND PRICE.xlsx` (1,256 items), `data/PRICE LIST.xlsx`, `data/STOCK FAST.xlsx`, `data/OUTBOUND_CHEQ_CLEAN.xlsx` (249 cheques, 2025-12-20 to 2026-08-30), `DALI/STOCK_COUNT_REPORT_20_04_2026.xlsx`, `DALI/DAY SALE/*.xlsx`. Recover with `git show <commit>:<path>`. These workbooks have a styles fault: read them with a raw XML reader (or SheetJS), not openpyxl.
**SKIP:** `software/` (the old Python app), `bathco-mobile/`, `11111.pdf`, `server.err`, `.env`, anything with passwords: `HANDOVER.md` and `SECURITY_LOG.md` (take only their lessons), `agents/BATHCO_MASTER.md` password line, `end_session.py`, `import_dali_master.py` (hard-coded database password), `backup_*.json` files (customer and supplier data), `credit_customers_*.csv`.
**Personal, never copied:** supplier "AZMI" and every personal payable; staff pay; customer names and phones.

### BUILD 0: HARVEST A (rules, brain, safety; quick)
1. Write `audit/HARVEST_MAP.md` from the map above (add the paths you confirm).
2. Write `AI_MEMORY/KNOWLEDGE.md` and `AI_MEMORY/skills/` from the TAKE (knowledge) and TAKE (agents and commands) lists. Do not mount any agent. Keep LAYLA's honesty clause. Note the live shop pays 1% of gross profit as commission; Bath Hub's default is 2% of profit (owner decision) and is editable in settings.
3. **Test guard** in the jest setup: abort unless `DB_NAME` is a test database; tests use a fixed fake date, never the real day (20 July 2026 lesson: tests ran against a real date and wiped a day). Port the cross-tenant leak test from bathco-vault, adapted to `branch_id`.
4. List in `OPEN_ITEMS.md` every place BATH-HUB shows 0 for a missing figure (rule: PENDING, never 0).

### BUILD 1: Vendor ledger with cheques (owner's #1). The pack does most of it.
- **A.** Copy `root/*` into the repo (or the owner ran `apply.ps1`). `npx jest tests/vendorLedger`. Back up the DB, then `node scripts/migrate_vendor_ledger.js`.
- **W1 wiring:** open `routes/cheque_register.js` (top 30 lines) and `server.js`. One line after the session middleware: `app.use('/api/vendor-ledger', require('./routes/vendor_ledger')({ pool, requireAuth: <same auth middleware cheque_register uses>, branchOf: () => 1 }))`. Use the shared pool in `utils/pool.js`; make `userOf` read the same session field the other routes use.
- **W2 menu:** a "Vendor ledger" button on the owner dashboard opening `/vendor-ledger.html`. If the feature-flag registry hides new pages, register `vendor_ledger` as a built core flag.
- **W3 GRN link:** after a manual GRN is saved, offer "Create vendor bill" (`POST /api/vendor-ledger/bills` with `vendor_name`, `total`, `bill_date`, `due_date`, `grn_id`).
- **W4 photos:** reuse the website editor's upload helper (jpg/png/webp, 5 MB, random names) for bill and cheque photos (`photo_path` columns exist). Bill as PDF via the documents module.
- **W5 import (dry run first):** `scripts/import_cheque_register.js` reads the owner's Excel register (Cheque Date, Cheque Number, Bank, Issued To/By, Purpose, Amount, Issued/Received, Pending/Cleared, Clearing Date, Reference/Invoice No), groups by invoice reference into bills, prints duplicates (`findDuplicates`) and warnings, writes nothing without `--commit`. Never commit the file.
- **W6:** make the bank name a setting (`OUR_BANK`) and pass `sameBank` from it; compare `nextClearingInfo()` against the BATHCO tests ported in Build 2 item 1.
- **Done when:** page works at 390 px with no sideways scroll; payable stays after a cheque is written and drops only when cleared; full suite green.

### BUILD 2: HARVEST B (code)
Copy with `git show <branch>:<path> > <dest>`. Each item: own module, own test, behind login, `branch_id`. Do the TAKE (code) list in order 1 to 6. For item 1 start by porting `tests/unit/cheque-register.test.js`.

### BUILD 3: HARVEST C (data: seed and study)
1. **Item list:** run `import_product_costs.js --dry-run` against the recovered xlsx, then load into a NEW staging table `item_candidates` (code, name, category, cost, price, source). Keep bathroom fittings, accessories and ceramics (categories: basin tap/mixer, shower, bidet, valves, waste/trap/gully, hose, accessory sets, commode, basin, cabinet); drop tiles, adhesive, grout. "Catalogue review" page: the owner ticks items to move into the real catalogue. Prices there are First Choice Bathco's: re-price with Bath Hub's rules.
2. **Vendor list** -> `vendor_directory` (name, business phone, categories, typical cheque size, typical weeks to pay). Business vendors only (not AZMI or any personal payable).
3. **Credit pattern** from the 249-cheque register per vendor into `vendor_directory`. Do not import the cheques.
4. **Study only:** daily sales sheets, invoice exports, purchases and the 20 April stock count. Output `audit/DATA_STUDY.md` (max 60 lines, no names or phones): sales and gross profit by weekday, month, week of month; best and worst days; festival and holiday effects; average bill and discount; fast and slow items; cheque timing; 10 lines on what it means for a small accessories shop.
5. Delete the scan's temporary clones when finished.

### BUILD 4: Bill photo to bill (owner's #2)
- Tables `bill_drafts` (id, branch_id, image_path, ai_json, final_json, status DRAFT/CONFIRMED, created_at) and `bill_draft_edits` (field, ai_value, final_value) to measure accuracy.
- Page: photo on one side, editable form on the other (customer, phone, date, items qty/rate/amount, total). Use `validateBillDraft` live; show flags in plain words. **Always review first.**
- Reader: reuse the OCR pipeline and `openrouter.config.js` plus the OCR rules from Build 2. Needs `openrouter.ai` on the allowlist and a key in `.env`. If either is missing, ship manual mode only and log NEEDS ALLOWLIST.
- Confirm creates the bill through the existing POS billing route (find it in `routes/shop_operations.js`, do not duplicate logic) and stores `normalisePhone()`.
- Later: when 95% of fields are unchanged over 100 drafts, offer "summary only" mode. Fixture: the 158,080 bill in `tests/billChecks.test.js`.

### BUILD 5: One-tap WhatsApp receipts (owner's #3, free)
- `customers`: name, phone (+94), `whatsapp_optin`, `optin_at`. A "May we send offers on WhatsApp?" checkbox on the bill (receipts go to any number on a bill, offers only to opted-in).
- After a bill is saved render the receipt PNG with the existing template (`public/brand/receipt-template`) and show **Send on WhatsApp**: on a phone `navigator.share({ files:[png], text })`; fallback `https://wa.me/<phone>?text=<encoded>` plus image download. No API.
- "Send payment details" button (account name, bank, number, QR from settings; blank until the BR and bank account exist).
- Export opted-in contacts as CSV for WhatsApp Business broadcast lists. Messages in English and Sinhala. Do not mount LAYLA, do not start the bridge, keep `WHATSAPP_LIVE` off.

### BUILD 6: Money engine (pricing, packages, waterfall)
- Settings table (key, value, branch_id): pricing multipliers, ceramic minimum-profit table, tile percent, commission %, split tables, deposit 200,000 / 24, monthly running cost 316,000, daily cost target 15,000 / ceiling 18,000. Defaults from `pricingEngine.js` and `profitWaterfall.js`.
- Endpoints `GET /api/pricing/quote?cost=&kind=`, `POST /api/pricing/package`, `GET /api/money/waterfall?from=&to=` (reads existing daily summary tables, read only).
- Auto-pricing on GRN save: red line, list and safe discount into a NEW table `item_prices` (not golden core). Green/amber/red dot on the bill screen, information only. The weekly report lists below-cost sales.
- Page "Money plan": weekly waterfall, phase, month-to-date vs target.

### BUILD 7: Morning brief (owner's #4)
- `GET /api/morning-brief` gathers yesterday's sales and gross profit, `chequeCalendar()`, `cashGap()` (cash from money control), receivables due, savings progress, targets; `buildBrief()` and `toText()`. Page with a "Copy text" button. Save to `uploads/briefs/YYYY-MM-DD.txt`. Generate at server start and on demand.
- `local_ops/morning_brief.ps1` and a Task Scheduler task "BathHub-MorningBrief" at 05:25 with "wake the computer to run".
- `festivals` table seeded with FIXED dates only (1 Jan, 4 Feb, 13-14 Apr, 1 May, 25 Dec, 31 Dec); the owner adds Vesak, Poson, Eid, Deepavali. The brief shows the next festival within 21 days with a post idea line.
- Competitor prices and exchange rate need network: log NEEDS ALLOWLIST, skip. Do not scrape.

### BUILD 8: Website Publish snapshot (owner's #5)
- "Publish website" button: exports a static snapshot (`index.html`, `data.json`, photos) from visible tiles and site text and pushes it to the `gh-pages` branch of a **separate clean repo** `bathhub-site`. The owner enables GitHub Pages once. Keep the sample-tile fallback. Add `sitemap.xml`, `robots.txt`, canonical and Open Graph tags.

### BUILD 9: Branches and roles
- `branch_id` on all new tables. Roles: owner (all branches), branch manager (own), sales staff (own branch, **cost and profit hidden**). Cross-tenant leak test passes for every new endpoint. New-branch script: creates a branch, default settings, empty catalogue.

### BUILD 10: Social helper (owner's #6, no network)
- `post_ideas` table and a content calendar page: festival list, 3 English and 3 Sinhala caption templates per festival, hashtag list, posting-day reminder. No auto-posting.

## 5. After all builds
Update `AI_MEMORY/HANDOFF.md` with: what exists, what is pending, the next 5 steps. Write `audit/BUILD_REPORT.md` (one line per build: status, merge commit, rollback command, tests passed). Final chat reply: 8 one-line bullets.

## 6. Owner will do by hand (not Claude Code's job)
Create Gmail, Facebook Page, Instagram, TikTok, WhatsApp Business, Google Business Profile, Meta Business (reminders are set). Business registration. Shop bank accounts. Supplier credit calls. Enable GitHub Pages. Revoke the old API key. Phone-check cheques against the Excel (possible duplicates 641103/6411103 and 499904).
