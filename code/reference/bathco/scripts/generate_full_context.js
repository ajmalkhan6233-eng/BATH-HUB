'use strict';
require('dotenv').config({ path: 'C:/BATHCO_PHASE1/.env' });
const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ host:'localhost', port:5432, database:'bathco', user:'postgres', password: process.env.DB_PASSWORD });

const fmtInt = n => {
  if (n === null || n === undefined) return 'NOT_AVAILABLE';
  const num = parseFloat(n);
  if (isNaN(num)) return 'NOT_AVAILABLE';
  return Math.round(num).toLocaleString('en-US');
};

async function run() {
  const [daily, flagged, totals] = await Promise.all([
    pool.query(`SELECT TO_CHAR(report_date,'YYYY-MM-DD') as date,
      TRIM(TO_CHAR(report_date,'Day')) as day,
      total_sale, cash_sale, card_sale, online_sale, cheq_payment, credit_sale,
      total_expenses, payments, cash_in_hand, gross_profit, net_profit,
      CASE WHEN total_sale > 0 AND gross_profit > 0
        THEN ROUND((gross_profit/total_sale*100)::numeric,1) ELSE NULL END as gp_pct,
      gp_status, day_status, checker_flags,
      details->>'reconciliation_note' as recon_note
    FROM daily_summary WHERE report_date BETWEEN '2025-12-21' AND '2026-06-22'
    ORDER BY report_date`),
    pool.query(`SELECT TO_CHAR(report_date,'YYYY-MM-DD') as date,
      checker_flags, details->>'reconciliation_note' as recon_note,
      total_sale, gross_profit, net_profit, gp_status, day_status
    FROM daily_summary
    WHERE checker_flags IS NOT NULL AND checker_flags::text != '[]'
    AND report_date BETWEEN '2025-12-21' AND '2026-06-22'
    ORDER BY report_date`),
    pool.query(`SELECT COUNT(*) as total_days,
      SUM(total_sale) as total_sale, SUM(total_expenses) as total_expenses,
      SUM(gross_profit) as total_gp,
      SUM(CASE WHEN gp_status NOT IN ('NOT_AVAILABLE') THEN COALESCE(net_profit,0) ELSE 0 END) as total_np,
      SUM(CASE WHEN gp_status IN ('ACTUAL','BLENDED','ESTIMATE') THEN 1 ELSE 0 END) as full_days,
      SUM(CASE WHEN gp_status='NOT_AVAILABLE' THEN 1 ELSE 0 END) as na_days,
      SUM(CASE WHEN day_status='VERIFIED' THEN 1 ELSE 0 END) as verified,
      SUM(CASE WHEN day_status='ESTIMATED' THEN 1 ELSE 0 END) as estimated
    FROM daily_summary WHERE report_date BETWEEN '2025-12-21' AND '2026-06-22'`)
  ]);

  const rows = daily.rows;
  const t = totals.rows[0];

  const blueprint  = fs.readFileSync('C:/BATHCO_PHASE1/BATHCO_BLUEPRINT.md', 'utf8');
  const statusRpt  = fs.readFileSync('C:/BATHCO_PHASE1/BATHCO_STATUS_REPORT.md', 'utf8');
  const handover   = fs.readFileSync('C:/BATHCO_PHASE1/BATHCO_HANDOVER_FOR_REVIEW.md', 'utf8');

  const L = [];

  L.push(`# BATHCO FULL CONTEXT FOR GLM`);
  L.push(`**1st Choice Bathco (Pvt) Ltd | Generated: 2026-06-22**`);
  L.push(``);
  L.push(`This document is a self-contained briefing for GLM-5.2. It contains everything needed to understand the business, verify the system state, and audit the financial data — with no external references required. Read Section 1 for business rules, Section 2 for current system status, Section 3 for the file inventory, Section 4 for the complete daily data, Section 5 for all open flags and conflicts, and Section 6 for the raw blueprint.`);
  L.push(``);

  // ── SECTION 1: BUSINESS CONTEXT ──────────────────────────────────────────
  L.push(`---`);
  L.push(`## SECTION 1: BUSINESS CONTEXT (from HANDOVER.md + BLUEPRINT)`);
  L.push(``);
  L.push(handover);
  L.push(``);

  // ── SECTION 2: SYSTEM STATUS ─────────────────────────────────────────────
  L.push(`---`);
  L.push(`## SECTION 2: SYSTEM STATUS (from BATHCO_STATUS_REPORT.md)`);
  L.push(``);
  L.push(statusRpt);
  L.push(``);

  // ── SECTION 3: SOURCE FILES INVENTORY ────────────────────────────────────
  L.push(`---`);
  L.push(`## SECTION 3: SOURCE FILES INVENTORY`);
  L.push(``);
  L.push(`All files are under \`C:\\BATHCO_PHASE1\\\` unless otherwise noted.`);
  L.push(``);
  L.push(`### Core Application Files`);
  L.push(`| File | Purpose |`);
  L.push(`|---|---|`);
  L.push(`| \`server.js\` | Main Node.js/Express server (~2,400 lines). All API routes, file upload handlers, CHECKER reconciliation, GP blending logic, NL query, VERA alerts. |`);
  L.push(`| \`public/dashboard.html\` | Single-page dashboard (~3,800 lines). 8 tabs: Home, Daily, Calendar, Suppliers, Credit, Staff, Reports, Settings. |`);
  L.push(`| \`layla.js\` | LAYLA WhatsApp bot. AI fallback chain: Anthropic → OpenRouter → Ollama → hardcoded. |`);
  L.push(`| \`grn-watcher.js\` | PM2 background process. Watches GRN folder for new goods-receipt files. |`);
  L.push(`| \`index.js\` | Entry point / PM2 target. |`);
  L.push(`| \`shop_config.json\` | Shop metadata: name, hours, location, LAYLA greeting templates. |`);
  L.push(`| \`openrouter.config.js\` | OpenRouter model config and fallback order for OCR. |`);
  L.push(`| \`ecosystem.config.js\` | PM2 process definitions (bathco-server + grn-watcher). |`);
  L.push(`| \`.env\` | All secrets: DB password, Anthropic key, OpenRouter key, Twilio creds. Never in git. |`);
  L.push(``);
  L.push(`### Documentation Files`);
  L.push(`| File | Purpose |`);
  L.push(`|---|---|`);
  L.push(`| \`BATHCO_BLUEPRINT.md\` | Business rules, formulas, day lifecycle spec. Source of truth for all financial logic. |`);
  L.push(`| \`CLAUDE.md\` | Agent mesh config, session rules, security constraints. |`);
  L.push(`| \`BATHCO_STATUS_REPORT.md\` | Current session state, open issues, git log. |`);
  L.push(`| \`BATHCO_HANDOVER_FOR_REVIEW.md\` | Plain-English system overview (10 sections). |`);
  L.push(`| \`BATHCO_MASTER_EXPORT_FOR_GLM.md\` | Previous 7-section data export (49KB). |`);
  L.push(`| \`BATHCO_QA_REPORT.md\` | Full QA audit — 80+ endpoints tested. All 6 bugs fixed. |`);
  L.push(`| \`PENDING_FROM_AJMAL.md\` | 17 open items awaiting Ajmal confirmation. |`);
  L.push(`| \`RECONCILIATION_RULES.md\` | Detailed reconciliation rules per data type. |`);
  L.push(`| \`DECISIONS_LOG.md\` | Log of business-rule decisions made during development. |`);
  L.push(`| \`DATA_SOURCES.md\` | Data source authority order and format descriptions. |`);
  L.push(`| \`HONESTY_AUDIT.md\` | Audit of all claims made in the system vs verified truth. |`);
  L.push(`| \`HANDOVER.md\` | Older handover document (superseded by BATHCO_HANDOVER_FOR_REVIEW.md). |`);
  L.push(`| \`GOLDEN_CORE.md\` | Core invariants that must never be changed. |`);
  L.push(`| \`CLOUD_DEPLOY_GUIDE.md\` | Future cloud deployment guide (not yet executed). |`);
  L.push(``);
  L.push(`### Scripts (under \`scripts/\`)`);
  L.push(`| File | Purpose |`);
  L.push(`|---|---|`);
  L.push(`| \`daily_reconciliation_check.js\` | 10-point CHECKER agent. Runs on every upload + manual /api/recon-check. |`);
  L.push(`| \`import_june_xlsx.js\` | Standalone importer: Jun 1–15 xlsx → DB (payment splits only, no GP). |`);
  L.push(`| \`flag_conflict_dates.js\` | Flags Jun 9/10/11/15 conflict dates in checker_flags + details. |`);
  L.push(`| \`dryrun_june_upload.js\` | Dry run: shows per-date file existence, DB total, gp_status, proposed action. |`);
  L.push(`| \`generate_master_export.js\` | Generates BATHCO_MASTER_EXPORT_FOR_GLM.md from live DB. |`);
  L.push(`| \`generate_full_context.js\` | Generates this file (BATHCO_FULL_CONTEXT_FOR_GLM.md). |`);
  L.push(`| \`ocr_expense_photos.py\` | Main OCR pipeline. Sends photos to OpenRouter vision model. Extracts expense/payment line items. |`);
  L.push(`| \`ocr_rerun_may13_may19.py\` | Targeted OCR re-run for May 13/19 (abandoned — model was text-only). |`);
  L.push(`| \`import_ocr_expenses.py\` | Imports OCR results from ocr_expense_results.json into daily_summary. |`);
  L.push(`| \`check_credit.js\` | Audit script: compares credit_customers table vs Ajmal's working figure. |`);
  L.push(`| \`check_0906_1506.js\` | Audit script: confirms Jun 9 and Jun 15 DB state and why GP is blocked. |`);
  L.push(`| \`fix_17jun_expenses.js\` | One-off fix: corrected total_expenses for 2026-06-17 (salary bug). |`);
  L.push(`| \`fix_gp_status.js\` | One-off fix: set gp_status=ACTUAL for Jun 17 after it was NULL. |`);
  L.push(`| \`update_daily_17jun.js\` | One-off: full Jun 17 DB row correction (expenses, salary, cash_out reset). |`);
  L.push(`| \`verify_17jun.js\` | Verification query for Jun 17 after fix. |`);
  L.push(`| \`build_master_data.js\` | Bulk historical data import from BATHCO_MASTER_DATA_REBUILD.xlsx. |`);
  L.push(`| \`seed_accounts.js\` | Creates initial user accounts (admin + investor). |`);
  L.push(`| \`migrate_grn.js\` | DB migration: adds GRN table and indexes. |`);
  L.push(`| \`migrate_payments.js\` | DB migration: adds payments column to daily_summary. |`);
  L.push(``);
  L.push(`### Public Assets (under \`public/\`)`);
  L.push(`| File | Purpose |`);
  L.push(`|---|---|`);
  L.push(`| \`dashboard.html\` | Main UI (served at http://localhost:3000) |`);
  L.push(`| \`service-worker.js\` | PWA service worker for offline support |`);
  L.push(`| \`manifest.json\` | PWA manifest (app name, icons, theme colour) |`);
  L.push(`| \`DATA_INDEX.json\` | Index of all data files for the build script |`);
  L.push(`| \`lib/\` | Client-side libraries (jsPDF, Chart.js etc.) |`);
  L.push(`| \`icons/\` | PWA app icons |`);
  L.push(`| \`BATHCO_MASTER_DATA_REBUILD.xlsx\` | Historical data source (Jan–Mar 2026 bulk import) |`);
  L.push(``);
  L.push(`### Database`);
  L.push(`- Host: localhost:5432 | Database: bathco | User: postgres`);
  L.push(`- Key tables: daily_summary, credit_customers, suppliers, supplier_payments, cheques, staff, staff_salary, users, login_audit`);
  L.push(`- Credentials: C:\\BATHCO_PHASE1\\.env (DB_PASSWORD)`);
  L.push(``);

  // ── SECTION 4: COMPLETE DAILY DATA ───────────────────────────────────────
  L.push(`---`);
  L.push(`## SECTION 4: COMPLETE DAILY DATA (from DB — 2025-12-21 to 2026-06-22)`);
  L.push(``);
  L.push(`*All figures LKR. NOT_AVAILABLE = no data in system for that field.*`);
  L.push(`*Database totals: Total Sale ${fmtInt(t.total_sale)} | Total Expenses ${fmtInt(t.total_expenses)} | Total GP ${fmtInt(t.total_gp)} | Total NP (FULL days) ${fmtInt(t.total_np)}*`);
  L.push(`*Days: ${t.total_days} total | ${t.full_days} FULL (GP known) | ${t.na_days} NOT_AVAILABLE | ${t.verified} VERIFIED | ${t.estimated} ESTIMATED*`);
  L.push(``);
  L.push(`| Date | Day | Total Sale | Cash | Card | Online | Cheq | Credit | Expenses | Payments | Cash In Hand | Gross Profit | Net Profit | GP% | GP Status | Day Status | Flags |`);
  L.push(`|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|---|`);

  for (const r of rows) {
    const flags = (r.checker_flags && r.checker_flags.length) ? r.checker_flags.join(' ') : '—';
    const np    = r.net_profit !== null && r.gp_status !== 'NOT_AVAILABLE'
                  ? fmtInt(r.net_profit) : 'NOT_AVAILABLE';
    const gpPct = r.gp_pct ? r.gp_pct + '%' : 'N/A';
    L.push(`| ${r.date} | ${r.day} | ${fmtInt(r.total_sale)} | ${fmtInt(r.cash_sale)} | ${fmtInt(r.card_sale)} | ${fmtInt(r.online_sale)} | ${fmtInt(r.cheq_payment)} | ${fmtInt(r.credit_sale)} | ${fmtInt(r.total_expenses)} | ${fmtInt(r.payments)} | ${fmtInt(r.cash_in_hand)} | ${fmtInt(r.gross_profit)} | ${np} | ${gpPct} | ${r.gp_status} | ${r.day_status} | ${flags} |`);
  }
  L.push(``);

  // ── SECTION 5: FLAGS AND CONFLICTS ───────────────────────────────────────
  L.push(`---`);
  L.push(`## SECTION 5: FLAGS AND CONFLICTS (all open issues)`);
  L.push(``);
  L.push(`### 5.1 Four June Conflict Dates — Unresolved`);
  L.push(``);
  L.push(`| Date | DB Figure (LKR) | Excel Figure (LKR) | Difference | Flag | Status |`);
  L.push(`|---|---:|---:|---|---|---|`);
  L.push(`| 2026-06-09 | 1,387,300 | 910,300 | DB +477,000 | PENDING_RECONCILIATION | DB kept. HSL000447 (Zuhail, 237,300) is known gap. ~240,000 unexplained. |`);
  L.push(`| 2026-06-10 | 190,540 | 604,190 | Excel +413,650 | MANUAL_REVIEW_REQUIRED | No change. Ajmal to review invoice lists. |`);
  L.push(`| 2026-06-11 | 944,950 | 0 (empty) | — | REUPLOAD_REQUIRED | DB kept. Re-export from Lasersoft needed. |`);
  L.push(`| 2026-06-15 | 418,860 | 95,830 | DB +323,030 | REUPLOAD_REQUIRED | DB kept. Re-export from Lasersoft needed. |`);
  L.push(``);
  L.push(`### 5.2 GP Gap — June 1–15 (highest priority)`);
  L.push(``);
  L.push(`All 15 dates from 2026-06-01 to 2026-06-15 have gp_status=NOT_AVAILABLE. Net profit is null for all of them. Fix: upload Lasersoft daily printout photos via the Daily Entry screen (same method as Jun 16/17).`);
  L.push(``);
  L.push(`### 5.3 All Days With Flags (${flagged.rows.length} days)`);
  L.push(``);
  L.push(`| Date | GP Status | Day Status | Total Sale | Flags | Recon Note |`);
  L.push(`|---|---|---|---:|---|---|`);
  for (const r of flagged.rows) {
    const flags = Array.isArray(r.checker_flags) ? r.checker_flags.join(', ') : (r.checker_flags || '—');
    const note  = (r.recon_note || '').slice(0, 100);
    L.push(`| ${r.date} | ${r.gp_status} | ${r.day_status} | ${fmtInt(r.total_sale)} | ${flags} | ${note || '—'} |`);
  }
  L.push(``);
  L.push(`### 5.4 SALES_ARITHMETIC Dates (payment splits don't add up to total_sale)`);
  L.push(``);
  L.push(`The following dates have SALES_ARITHMETIC flag — cash+card+online+cheque+credit does not equal total_sale. Most are caused by incomplete data entry (missing credit or cheque splits), not actual missing money.`);
  L.push(``);
  const arith = flagged.rows.filter(r =>
    Array.isArray(r.checker_flags) && r.checker_flags.includes('SALES_ARITHMETIC'));
  L.push(`| Date | Total Sale (LKR) | Day Status |`);
  L.push(`|---|---:|---|`);
  for (const r of arith) {
    L.push(`| ${r.date} | ${fmtInt(r.total_sale)} | ${r.day_status} |`);
  }
  L.push(``);
  L.push(`### 5.5 Loss Days (LOSS_DAY flag)`);
  L.push(``);
  const lossDays = flagged.rows.filter(r =>
    Array.isArray(r.checker_flags) && r.checker_flags.includes('LOSS_DAY'));
  L.push(`| Date | Net Profit (LKR) | GP Status | Note |`);
  L.push(`|---|---:|---|---|`);
  for (const r of lossDays) {
    const np = r.net_profit !== null ? fmtInt(r.net_profit) : 'NOT_AVAILABLE';
    const note = r.gp_status === 'NOT_AVAILABLE'
      ? 'No GP data — loss may be false (expenses recorded, GP missing)'
      : 'GP confirmed — genuine loss day';
    L.push(`| ${r.date} | ${np} | ${r.gp_status} | ${note} |`);
  }
  L.push(``);
  L.push(`### 5.6 Open Items from PENDING_FROM_AJMAL.md`);
  L.push(``);
  L.push(`1. Staff daily-wage vs monthly-salary list with amounts`);
  L.push(`2. Shop closing time for LAYLA`);
  L.push(`3. Per-person OT rates`);
  L.push(`4. Zakat hawl date`);
  L.push(`5. Credit total reconciliation: DB 542,300 vs Ajmal figure 385,380 (gap = 156,920 UNRECONCILED)`);
  L.push(`6. Daily-wage staff commission rule`);
  L.push(`7. Lasersoft cutover date confirmation (assumed 2026-04-01)`);
  L.push(`8. Bathco Aromatic removal from shop_config.json + CLAUDE.md`);
  L.push(`9. Full Lasersoft product/price export (products table has only 85 items)`);
  L.push(`10. Daily invoice number range for invoice-gap detection`);
  L.push(`11. ~~May 13 expense mismatch~~ — CLOSED 2026-06-21`);
  L.push(`12. Dec 21 2025 – Jan 30 2026 revenue re-verify vs manual Excel (LKR 17,249,211)`);
  L.push(`13. ADHIL F.R supplier — real supplier or personal payment?`);
  L.push(`14. VOOS (supplier id24) — reclassify as transport expense?`);
  L.push(`15–16. GROHE / IDEAL STANDARD / KOHLER / AMERICAN STANDARD — confirm still active`);
  L.push(`17. Credit outstanding 668,800 — 4 UNVERIFIED entries (305,000 total) need confirmation`);
  L.push(``);
  L.push(`### 5.7 Blueprint Open Flags`);
  L.push(``);
  L.push(`- Receipt 433 (LKR 20,700) — after-hours cash sale on Jun 17. In total_sale but NOT in Lasersoft. PENDING_RECONCILIATION until Lasersoft is updated.`);
  L.push(`- SL001950 value conflict — Lasersoft: 5,630. Excel photo may show 31,630. Ajmal to open 17-06-2026.xlsx and confirm.`);
  L.push(`- Staff commission rule — 1% of individual GP stored in staff_payments_total. NOT deducted from net_profit. Pending Ajmal confirmation.`);
  L.push(`- 2FA disabled — totp_enabled=false for user ajmal. Secret intact; re-enable with one DB UPDATE.`);
  L.push(``);

  // ── SECTION 6: RAW BLUEPRINT ──────────────────────────────────────────────
  L.push(`---`);
  L.push(`## SECTION 6: RAW BLUEPRINT (full BATHCO_BLUEPRINT.md content)`);
  L.push(``);
  L.push(blueprint);
  L.push(``);
  L.push(`---`);
  L.push(`*End of BATHCO_FULL_CONTEXT_FOR_GLM — Generated 2026-06-22*`);

  const content = L.join('\n');
  const outPath = 'C:/BATHCO_PHASE1/BATHCO_FULL_CONTEXT_FOR_GLM.md';
  fs.writeFileSync(outPath, content, 'utf8');
  fs.writeFileSync('C:/Users/DELL/Desktop/BATHCO_FULL_CONTEXT_FOR_GLM.md', content, 'utf8');

  const bytes = Buffer.byteLength(content, 'utf8');
  console.log('Written:', outPath);
  console.log('Desktop copy: C:/Users/DELL/Desktop/BATHCO_FULL_CONTEXT_FOR_GLM.md');
  console.log('Lines:', L.length);
  console.log('Size:', (bytes / 1024).toFixed(1) + ' KB');
  console.log('Daily rows:', rows.length, '| Flagged rows:', flagged.rows.length);
}

run().then(() => pool.end()).catch(e => { console.error(e.message); pool.end(); process.exit(1); });
