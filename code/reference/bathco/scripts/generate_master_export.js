'use strict';
require('dotenv').config({ path: 'C:/BATHCO_PHASE1/.env' });
const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ host:'localhost', port:5432, database:'bathco', user:'postgres', password: process.env.DB_PASSWORD });

const fmt = n => {
  if (n === null || n === undefined) return 'NOT_AVAILABLE';
  const num = parseFloat(n);
  if (isNaN(num)) return 'NOT_AVAILABLE';
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const fmtInt = n => {
  if (n === null || n === undefined) return 'NOT_AVAILABLE';
  const num = parseFloat(n);
  if (isNaN(num)) return 'NOT_AVAILABLE';
  return Math.round(num).toLocaleString('en-US');
};
const pct = (n, total) => {
  if (!n || !total || parseFloat(total) === 0) return 'NOT_AVAILABLE';
  return (parseFloat(n) / parseFloat(total) * 100).toFixed(1) + '%';
};

async function run() {
  const [daily, credits, staff, flagged, totals, lastCommit] = await Promise.all([
    pool.query(`
      SELECT TO_CHAR(report_date,'YYYY-MM-DD') as date,
             TRIM(TO_CHAR(report_date,'Day')) as day,
             total_sale, cash_sale, card_sale, online_sale, cheq_payment, credit_sale,
             total_expenses, cash_out, cash_in_hand, salary, payments,
             gross_profit, net_profit,
             CASE WHEN total_sale > 0 AND gross_profit > 0
               THEN ROUND((gross_profit/total_sale*100)::numeric,1) ELSE NULL END as gp_pct,
             gp_status, day_status, checker_flags, details
      FROM daily_summary
      WHERE report_date BETWEEN '2025-12-21' AND '2026-06-22'
      ORDER BY report_date`),
    pool.query(`
      SELECT name, invoice_no, TO_CHAR(invoice_date,'YYYY-MM-DD') as invoice_date,
             amount, paid, amount-paid as outstanding, notes,
             quarantined, quarantine_reason
      FROM credit_customers ORDER BY invoice_date`),
    pool.query(`
      SELECT s.name, s.role, s.base_salary, s.commission_pct,
             COALESCE(SUM(ss.amount),0) as total_salary_paid,
             COALESCE(SUM(ss.commission),0) as total_commission_paid,
             COUNT(ss.id) as payment_count
      FROM staff s LEFT JOIN staff_salary ss ON s.id=ss.staff_id
      WHERE s.active = true OR s.active IS NULL
      GROUP BY s.id, s.name, s.role, s.base_salary, s.commission_pct
      ORDER BY s.name`),
    pool.query(`
      SELECT TO_CHAR(report_date,'YYYY-MM-DD') as date, total_sale, gp_status, day_status,
             checker_flags, details->>'reconciliation_note' as recon_note,
             gross_profit, net_profit
      FROM daily_summary
      WHERE checker_flags IS NOT NULL AND checker_flags::text != '[]'
      AND report_date BETWEEN '2025-12-21' AND '2026-06-22'
      ORDER BY report_date`),
    pool.query(`
      SELECT COUNT(*) as total_days,
             SUM(CASE WHEN gp_status IN ('ACTUAL','BLENDED','ESTIMATE') THEN 1 ELSE 0 END) as full_days,
             SUM(CASE WHEN gp_status='NOT_AVAILABLE' THEN 1 ELSE 0 END) as not_avail_days,
             SUM(total_sale) as total_sale,
             SUM(total_expenses) as total_expenses,
             SUM(gross_profit) as total_gp,
             SUM(CASE WHEN gp_status NOT IN ('NOT_AVAILABLE') THEN COALESCE(net_profit,0) ELSE 0 END) as total_net_profit,
             SUM(CASE WHEN day_status='VERIFIED' THEN 1 ELSE 0 END) as verified_days,
             SUM(CASE WHEN day_status='ESTIMATED' THEN 1 ELSE 0 END) as estimated_days,
             MIN(report_date) as first_date,
             MAX(report_date) as last_date
      FROM daily_summary WHERE report_date BETWEEN '2025-12-21' AND '2026-06-22'`),
    pool.query(`
      SELECT TO_CHAR(total_sale,'LKR FM999,999,999,990.00') as x FROM daily_summary LIMIT 0`)
      .then(() => null).catch(() => null)
  ]);

  const rows = daily.rows;
  const t = totals.rows[0];

  const lines = [];

  // ── TOP SUMMARY ────────────────────────────────────────────────────────────
  lines.push(`# BATHCO MASTER EXPORT FOR GLM AUDIT`);
  lines.push(`**1st Choice Bathco (Pvt) Ltd | Thihariya, Kandy Road, Sri Lanka**`);
  lines.push(`*Exported: 2026-06-22 | Prepared by BATHCO COMMAND v1.0 for GLM-5.2 financial audit*`);
  lines.push(``);
  lines.push(`## DOCUMENT OVERVIEW`);
  lines.push(``);
  lines.push(`This document is a complete data export from the BATHCO COMMAND financial dashboard for 1st Choice Bathco (Pvt) Ltd, a tiles and bathroom fittings showroom in Thihariya, Sri Lanka. It covers all trading days from 2025-12-21 to 2026-06-22, including sales, payment splits, gross profit, net profit, expenses, and reconciliation status. The reviewer (GLM-5.2) should focus on: (1) verifying that the net profit formula is correctly applied across all FULL-tier days (April onwards); (2) checking whether LOSS_DAY flags in February and March represent genuine loss days or are caused by missing Lasersoft GP data; (3) reviewing the 4 conflict dates in June (9, 10, 11, 15) where Excel and Lasersoft figures disagree; and (4) confirming that the credit customer balances are real debts before they are pursued. All currency values are in Sri Lankan Rupees (LKR).`);
  lines.push(``);

  // ── PART 1: BUSINESS CONTEXT ───────────────────────────────────────────────
  lines.push(`---`);
  lines.push(`## PART 1 — BUSINESS CONTEXT`);
  lines.push(``);
  lines.push(`### 1.1 Identity`);
  lines.push(`- **Business name:** 1st Choice Bathco (Pvt) Ltd`);
  lines.push(`- **Type:** Tiles and bathroom fittings retail showroom`);
  lines.push(`- **Location:** Thihariya, Kandy Road, Sri Lanka`);
  lines.push(`- **Owner:** Ajmal Khan (sole system admin)`);
  lines.push(`- **Investor:** Uncle (read-only access; cannot change data)`);
  lines.push(`- **First invoice on record:** SL000441, dated 2026-01-31`);
  lines.push(`- **Currency:** Sri Lankan Rupees (LKR)`);
  lines.push(`- **ERP:** Lasersoft POS (no API — manual file exports only)`);
  lines.push(`- **Staff count:** 12 active members`);
  lines.push(`- **Ethics:** Islamic business principles — halal transactions only, no interest (riba)`);
  lines.push(``);
  lines.push(`### 1.2 Staff`);
  lines.push(`Imran, Nuzlan, Gimhani, Nilshard, Nimshard, Ali, Ajmal, Jazer, Ahamed Ali, Ahmed, Zaeem, Akashi`);
  lines.push(``);
  lines.push(`### 1.3 Locked Financial Formulas`);
  lines.push(``);
  lines.push(`These formulas are fixed business rules. The system MUST use them exactly as written.`);
  lines.push(``);
  lines.push(`| Formula | Definition |`);
  lines.push(`|---|---|`);
  lines.push(`| Gross Profit | Taken directly from Lasersoft GPA (Gross Profit Amount) column — never estimated from handwritten sheets |`);
  lines.push(`| Net Profit | Gross Profit − Total Expenses |`);
  lines.push(`| Total Expenses | Full left-column total from handwritten daily sheet (includes salary as one line item) |`);
  lines.push(`| Cash Out | Total Expenses + Right-Column Payments + any additional cash_out entries |`);
  lines.push(`| Cash In Hand | Rs. 25,000 (petty float) + Cash Sales − Total Expenses − Right-Column Payments |`);
  lines.push(`| Staff Commission | 1% of individual gross profit per staff member per pay cycle |`);
  lines.push(``);
  lines.push(`**What is NOT in Net Profit:** staff commissions (tracked separately), supplier payments (right-column — cash flow only), credit sales not yet collected.`);
  lines.push(``);
  lines.push(`### 1.4 Business Rules`);
  lines.push(``);
  lines.push(`- **After-hours bills:** Any invoice written after approximately 6pm is entered in the NEXT day's Excel sheet — not backdated. Card/online payments may settle to the original day in the bank. This timing difference is expected and is not an error.`);
  lines.push(`- **Manual bills:** Invoices written by hand (not in Lasersoft) get an estimated GP at the shop's average margin. These appear as BLENDED days.`);
  lines.push(`- **Petty cash float:** Always Rs. 25,000. This is the starting cash in the till every morning and is included in the cash-in-hand calculation.`);
  lines.push(`- **Tile GP:** Standard gross profit margin for tiles is 18%.`);
  lines.push(`- **Staff commission cycle:** 25th of one month to 24th of the next.`);
  lines.push(`- **GP source hierarchy:** (1) Lasersoft Profit-by-Sales export (ACTUAL); (2) Blended with manual bill estimates (BLENDED); (3) Average-margin estimate (ESTIMATE); (4) No GP data at all (NOT_AVAILABLE).`);
  lines.push(`- **Data source authority:** For sales totals — Excel Day Sheet is truth. For GP — Lasersoft is the only valid source.`);
  lines.push(``);
  lines.push(`### 1.5 Day Status Definitions`);
  lines.push(``);
  lines.push(`| Status | Meaning |`);
  lines.push(`|---|---|`);
  lines.push(`| VERIFIED | All data confirmed, no flags |`);
  lines.push(`| CONFIRMED | Manually confirmed by owner |`);
  lines.push(`| ESTIMATED | Data present but GP is estimated or not available |`);
  lines.push(`| PENDING | Incomplete — missing one or more data sources |`);
  lines.push(``);
  lines.push(`### 1.6 GP Status Definitions`);
  lines.push(``);
  lines.push(`| GP Status | Meaning |`);
  lines.push(`|---|---|`);
  lines.push(`| ACTUAL | GP from Lasersoft Profit-by-Sales export — most reliable |`);
  lines.push(`| BLENDED | Mix of Lasersoft GP and estimated GP on manual bills |`);
  lines.push(`| ESTIMATE | Estimated from average margin — no Lasersoft data |`);
  lines.push(`| NOT_AVAILABLE | No GP data at all — net_profit shows as null/N/A |`);
  lines.push(``);
  lines.push(`### 1.7 Reconciliation Flags`);
  lines.push(``);
  lines.push(`| Flag | Meaning |`);
  lines.push(`|---|---|`);
  lines.push(`| GP_STALE | No Lasersoft GP uploaded for this date |`);
  lines.push(`| NO_EXPENSES | No expense data entered for this date |`);
  lines.push(`| SALES_ARITHMETIC | Payment splits do not add up to total_sale |`);
  lines.push(`| LOSS_DAY | Net profit is negative |`);
  lines.push(`| HIGH_EXPENSE_RATIO | Expenses exceed 60% of sales |`);
  lines.push(`| PENDING_RECONCILIATION | Sales figure in DB differs from Excel; DB figure kept pending investigation |`);
  lines.push(`| MANUAL_REVIEW_REQUIRED | Conflict requires owner to review both sets of figures |`);
  lines.push(`| REUPLOAD_REQUIRED | Source file was empty or incomplete; correct file needed |`);
  lines.push(``);

  // ── PART 2: DAILY DATA TABLE ───────────────────────────────────────────────
  lines.push(`---`);
  lines.push(`## PART 2 — COMPLETE DAILY DATA (2025-12-21 to 2026-06-22)`);
  lines.push(``);
  lines.push(`*All figures in LKR. NOT_AVAILABLE = data not in system.*`);
  lines.push(``);
  lines.push(`| Date | Day | Total Sale | Cash | Card | Online | Cheque | Credit | Expenses | Cash In Hand | Gross Profit | Net Profit | GP% | GP Status | Day Status | Flags |`);
  lines.push(`|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|---|`);

  let sumSale = 0, sumCash = 0, sumCard = 0, sumOnline = 0, sumCheq = 0, sumCredit = 0;
  let sumExp = 0, sumCIH = 0, sumGP = 0, sumNP = 0;
  let countVerified = 0, countEstimated = 0, countFlagged = 0, countFull = 0;

  for (const r of rows) {
    const sale    = parseFloat(r.total_sale) || 0;
    const cash    = parseFloat(r.cash_sale) || 0;
    const card    = parseFloat(r.card_sale) || 0;
    const online  = parseFloat(r.online_sale) || 0;
    const cheq    = parseFloat(r.cheq_payment) || 0;
    const cred    = parseFloat(r.credit_sale) || 0;
    const exp     = parseFloat(r.total_expenses) || 0;
    const cih     = parseFloat(r.cash_in_hand) || 0;
    const gp      = parseFloat(r.gross_profit) || 0;
    const np      = r.net_profit !== null ? parseFloat(r.net_profit) : null;
    const gpPct   = r.gp_pct ? r.gp_pct + '%' : 'NOT_AVAILABLE';
    const flags   = (r.checker_flags && r.checker_flags.length) ? r.checker_flags.join(', ') : '—';

    sumSale += sale; sumCash += cash; sumCard += card; sumOnline += online;
    sumCheq += cheq; sumCredit += cred; sumExp += exp; sumCIH += cih;
    sumGP += gp;
    if (np !== null && r.gp_status !== 'NOT_AVAILABLE') sumNP += np;

    if (r.day_status === 'VERIFIED') countVerified++;
    else if (r.day_status === 'ESTIMATED') countEstimated++;
    if (r.checker_flags && r.checker_flags.length > 0) countFlagged++;
    if (['ACTUAL','BLENDED','ESTIMATE'].includes(r.gp_status)) countFull++;

    const npStr = np === null ? 'NOT_AVAILABLE' : fmtInt(np);

    lines.push(`| ${r.date} | ${r.day} | ${fmtInt(sale)} | ${fmtInt(cash)} | ${fmtInt(card)} | ${fmtInt(online)} | ${fmtInt(cheq)} | ${fmtInt(cred)} | ${fmtInt(exp)} | ${fmtInt(cih)} | ${fmtInt(gp)} | ${npStr} | ${gpPct} | ${r.gp_status} | ${r.day_status} | ${flags} |`);
  }

  lines.push(`| **TOTAL** | | **${fmtInt(sumSale)}** | **${fmtInt(sumCash)}** | **${fmtInt(sumCard)}** | **${fmtInt(sumOnline)}** | **${fmtInt(sumCheq)}** | **${fmtInt(sumCredit)}** | **${fmtInt(sumExp)}** | — | **${fmtInt(sumGP)}** | **${fmtInt(sumNP)}** | | | | |`);
  lines.push(``);
  lines.push(`**Summary statistics:**`);
  lines.push(`- Total days in range: ${rows.length}`);
  lines.push(`- Days with GP data (FULL tier): ${countFull}`);
  lines.push(`- Days without GP (NOT_AVAILABLE): ${rows.length - countFull}`);
  lines.push(`- VERIFIED days: ${countVerified}`);
  lines.push(`- ESTIMATED days: ${countEstimated}`);
  lines.push(`- Days with at least one flag: ${countFlagged}`);
  lines.push(`- Average daily sale (all days): LKR ${fmtInt(sumSale / rows.length)}`);
  lines.push(`- Average daily net profit (FULL-tier days only): LKR ${fmtInt(sumNP / Math.max(countFull, 1))}`);
  lines.push(``);

  // ── PART 3: EXPENSE BREAKDOWN ──────────────────────────────────────────────
  lines.push(`---`);
  lines.push(`## PART 3 — EXPENSE BREAKDOWN BY MONTH`);
  lines.push(``);
  lines.push(`*Note: Expense category breakdown is only available for days where a handwritten expense photo was processed by OCR. Many older dates have total_expenses recorded but no category breakdown in the DB. The figures below are from the details JSONB where available.*`);
  lines.push(``);

  const monthExp = {};
  for (const r of rows) {
    const month = r.date.slice(0, 7);
    if (!monthExp[month]) monthExp[month] = { total: 0, days: 0 };
    monthExp[month].total += parseFloat(r.total_expenses) || 0;
    if ((parseFloat(r.total_expenses) || 0) > 0) monthExp[month].days++;
  }

  lines.push(`| Month | Total Expenses (LKR) | Days with Expenses Recorded |`);
  lines.push(`|---|---:|---:|`);
  for (const [m, v] of Object.entries(monthExp)) {
    lines.push(`| ${m} | ${fmtInt(v.total)} | ${v.days} |`);
  }
  lines.push(`| **All-time total** | **${fmtInt(sumExp)}** | |`);
  lines.push(``);
  lines.push(`*Full expense line-item breakdown (salary, food, transport, etc.) requires reviewing the daily photo OCR outputs stored in the details JSONB column for each date. This data was not fully structured across all historical dates.*`);
  lines.push(``);

  // ── PART 4: STAFF PERFORMANCE ──────────────────────────────────────────────
  lines.push(`---`);
  lines.push(`## PART 4 — STAFF PERFORMANCE SUMMARY`);
  lines.push(``);
  lines.push(`*Commission rule: 1% of individual gross profit per staff member per pay cycle (25th to 24th). Staff commissions are tracked separately from the P&L — they do not reduce net_profit in the current system.*`);
  lines.push(``);
  lines.push(`*Note: Per-staff gross profit data requires the Lasersoft Rep Sales Analysis export, which is uploaded periodically (not daily). The figures below show salary and commission payments recorded in the staff_salary table.*`);
  lines.push(``);
  lines.push(`| Staff Member | Role | Base Salary | Commission % | Salary Paid (LKR) | Commission Paid (LKR) | Payment Records |`);
  lines.push(`|---|---|---:|---:|---:|---:|---:|`);
  for (const s of staff.rows) {
    lines.push(`| ${s.name} | ${s.role || 'Staff'} | ${fmtInt(s.base_salary)} | ${s.commission_pct || 1}% | ${fmtInt(s.total_salary_paid)} | ${fmtInt(s.total_commission_paid)} | ${s.payment_count} |`);
  }
  lines.push(``);

  // ── PART 5: CREDIT CUSTOMERS ───────────────────────────────────────────────
  lines.push(`---`);
  lines.push(`## PART 5 — OUTSTANDING CREDIT CUSTOMERS`);
  lines.push(``);

  let totalCredit = 0, totalPaid = 0, totalOutstanding = 0;
  for (const c of credits.rows) {
    totalCredit += parseFloat(c.amount) || 0;
    totalPaid += parseFloat(c.paid) || 0;
    totalOutstanding += parseFloat(c.outstanding) || 0;
  }

  lines.push(`| Customer | Invoice No | Invoice Date | Amount (LKR) | Paid (LKR) | Outstanding (LKR) | Notes | Verified? |`);
  lines.push(`|---|---|---|---:|---:|---:|---|---|`);
  for (const c of credits.rows) {
    const verified = c.quarantined ? `UNVERIFIED — ${c.quarantine_reason || 'flagged'}` : 'VERIFIED';
    lines.push(`| ${c.name || 'Unknown'} | ${c.invoice_no || 'NOT_AVAILABLE'} | ${c.invoice_date || 'NOT_AVAILABLE'} | ${fmtInt(c.amount)} | ${fmtInt(c.paid)} | ${fmtInt(c.outstanding)} | ${c.notes || '—'} | ${verified} |`);
  }
  lines.push(`| **TOTAL** | | | **${fmtInt(totalCredit)}** | **${fmtInt(totalPaid)}** | **${fmtInt(totalOutstanding)}** | | |`);
  lines.push(``);
  lines.push(`**Credit notes:**`);
  lines.push(`- Confirmed real debts: Zuhail Akam Transport (LKR 237,300) + Tharik (LKR 126,500) = LKR 363,800`);
  lines.push(`- UNVERIFIED entries: invoices not found in any Excel day sheet — may be data entry errors from initial system setup. Do NOT pursue without owner confirmation.`);
  lines.push(`- Owner's working figure for outstanding credits: LKR 385,380 (source: Ajmal, June 2026)`);
  lines.push(`- DB total before audit: LKR 542,300 — discrepancy of LKR 156,920 under investigation`);
  lines.push(``);

  // ── PART 6: OPEN ISSUES AND FLAGS ─────────────────────────────────────────
  lines.push(`---`);
  lines.push(`## PART 6 — OPEN ISSUES AND FLAGS`);
  lines.push(``);
  lines.push(`### 6.1 Four Conflict Dates (June 2026)`);
  lines.push(``);
  lines.push(`These 4 dates have conflicts between the Excel Day Sheet and the DB figure. No data has been changed — all are flagged for Ajmal's review.`);
  lines.push(``);
  lines.push(`| Date | DB Total Sale (LKR) | Excel Total Sale (LKR) | Difference | Flag | Action Required |`);
  lines.push(`|---|---:|---:|---:|---|---|`);
  lines.push(`| 2026-06-09 | 1,387,300 | 910,300 | DB higher by 477,000 | PENDING_RECONCILIATION | DB figure kept. Known gap: invoice HSL000447 (Zuhail, 237,300). Remaining gap ~240,000 unexplained. |`);
  lines.push(`| 2026-06-10 | 190,540 | 604,190 | Excel higher by 413,650 | MANUAL_REVIEW_REQUIRED | No data changed. Ajmal to compare invoice lists side by side. |`);
  lines.push(`| 2026-06-11 | 944,950 | 0 (empty file) | — | REUPLOAD_REQUIRED | Excel file was empty. DB figure kept. Fresh Lasersoft export needed. |`);
  lines.push(`| 2026-06-15 | 418,860 | 95,830 | DB higher by 323,030 | REUPLOAD_REQUIRED | Excel was incomplete. DB figure kept. Fresh Lasersoft export needed. |`);
  lines.push(``);
  lines.push(`### 6.2 GP Gap — June 1 to 15`);
  lines.push(``);
  lines.push(`Every date from 2026-06-01 to 2026-06-15 has gp_status = NOT_AVAILABLE. Net profit cannot be calculated for these dates until Lasersoft daily printout photos are uploaded via the dashboard (same method used for Jun 16 and Jun 17). This is the highest-priority data gap.`);
  lines.push(``);
  lines.push(`### 6.3 All Flagged Days`);
  lines.push(``);
  lines.push(`| Date | Flags | Day Status | Total Sale (LKR) | Notes |`);
  lines.push(`|---|---|---|---:|---|`);

  for (const r of flagged.rows) {
    const flags = Array.isArray(r.checker_flags) ? r.checker_flags.join(', ') : (r.checker_flags || '—');
    const note = r.recon_note || '—';
    lines.push(`| ${r.date} | ${flags} | ${r.day_status} | ${fmtInt(r.total_sale)} | ${note.slice(0, 120)} |`);
  }
  lines.push(``);

  // ── PART 7: SYSTEM SNAPSHOT ────────────────────────────────────────────────
  lines.push(`---`);
  lines.push(`## PART 7 — SYSTEM SNAPSHOT (as of 2026-06-22)`);
  lines.push(``);
  lines.push(`### 7.1 Database Totals`);
  lines.push(``);
  lines.push(`| Metric | Value |`);
  lines.push(`|---|---|`);
  lines.push(`| Total days in database (Dec 2025 – Jun 2026) | ${t.total_days} |`);
  lines.push(`| Days with GP data (ACTUAL/BLENDED/ESTIMATE) | ${t.full_days} |`);
  lines.push(`| Days with NO GP (NOT_AVAILABLE) | ${t.not_avail_days} |`);
  lines.push(`| VERIFIED days | ${t.verified_days} |`);
  lines.push(`| ESTIMATED days | ${t.estimated_days} |`);
  lines.push(`| Total sales (all time, LKR) | ${fmtInt(t.total_sale)} |`);
  lines.push(`| Total expenses (all time, LKR) | ${fmtInt(t.total_expenses)} |`);
  lines.push(`| Total gross profit (FULL-tier days only, LKR) | ${fmtInt(t.total_gp)} |`);
  lines.push(`| Total net profit (FULL-tier days only, LKR) | ${fmtInt(t.total_net_profit)} |`);
  lines.push(`| Overall GP margin (GP / Sales, FULL days) | ${pct(t.total_gp, t.total_sale)} |`);
  lines.push(``);
  lines.push(`### 7.2 Data Coverage by Period`);
  lines.push(``);
  lines.push(`| Period | Coverage Notes |`);
  lines.push(`|---|---|`);
  lines.push(`| Dec 2025 (21-31) | ESTIMATE GP only — Lasersoft data entered as bulk estimate. No expense data. |`);
  lines.push(`| Jan 2026 | Mix of ESTIMATE (early dates) and NOT_AVAILABLE. Some expense data. First Excel day sheets appear. |`);
  lines.push(`| Feb–Mar 2026 | All NOT_AVAILABLE GP. Expense data partially recorded. Many LOSS_DAY flags due to missing GP (not actual losses). |`);
  lines.push(`| Apr 2026 | ACTUAL GP begins (Lasersoft connected). Best data quality. Expenses partially recorded. |`);
  lines.push(`| May 2026 | ACTUAL GP. Full payment splits. Some expense data. |`);
  lines.push(`| Jun 1-15 2026 | Payment splits imported from Excel. GP NOT_AVAILABLE for all. 4 conflict dates flagged. |`);
  lines.push(`| Jun 16-17 2026 | ACTUAL GP via photo upload. Net profit confirmed. |`);
  lines.push(`| Jun 18-22 2026 | Not yet entered in system. |`);
  lines.push(``);
  lines.push(`### 7.3 Open Issues from BATHCO_STATUS_REPORT.md`);
  lines.push(``);
  lines.push(`1. **Jun 1–15 GP gap** — Upload Lasersoft printout photos for these 15 dates to get ACTUAL GP and net profit.`);
  lines.push(`2. **Jun 10 invoice conflict** — Ajmal to compare Excel invoice list vs DB before any figure change.`);
  lines.push(`3. **Jun 11 and Jun 15** — Re-export from Lasersoft and re-upload correct Excel files.`);
  lines.push(`4. **Credit balance discrepancy** — DB total vs Ajmal's working figure LKR 385,380 gap of LKR 156,920 unresolved.`);
  lines.push(`5. **UNVERIFIED credit entries** — 4 older credit records not found in any Excel sheet.`);
  lines.push(`6. **Staff commission formula confirmation** — 1% of individual GP (not total GP) confirmed June 2026 but commission amounts per person not yet calculated for the period.`);
  lines.push(`7. **Bathco Aromatic** — Referenced in config files but not active. Should be removed from system.`);
  lines.push(``);
  lines.push(`### 7.4 Technical`);
  lines.push(``);
  lines.push(`- **Server:** Node.js / Express, PM2-managed, running at http://localhost:3000`);
  lines.push(`- **Database:** PostgreSQL 5432, database name: bathco`);
  lines.push(`- **Repository:** github.com/ajmalkhan6233-eng/BATHCO`);
  lines.push(`- **Last git commit:** 93fcc59 — fix: null-guard for net_profit when GP not available`);
  lines.push(`- **AI integrations:** OpenRouter (OCR), Ollama llama3.2:1b (NL queries), Twilio (WhatsApp / LAYLA bot)`);
  lines.push(`- **Noor Digital:** Separate future SaaS project — NEVER shares DB, env, or git with this project`);
  lines.push(``);
  lines.push(`---`);
  lines.push(`*End of BATHCO MASTER EXPORT FOR GLM AUDIT — Generated 2026-06-22*`);

  const content = lines.join('\n');
  const outPath = 'C:/BATHCO_PHASE1/BATHCO_MASTER_EXPORT_FOR_GLM.md';
  fs.writeFileSync(outPath, content, 'utf8');
  fs.writeFileSync('C:/Users/DELL/Desktop/BATHCO_MASTER_EXPORT_FOR_GLM.md', content, 'utf8');

  const lineCount = lines.length;
  const byteSize = Buffer.byteLength(content, 'utf8');
  const dateRange = `${rows[0].date} to ${rows[rows.length-1].date}`;

  console.log('Written: ' + outPath);
  console.log('Desktop copy: C:/Users/DELL/Desktop/BATHCO_MASTER_EXPORT_FOR_GLM.md');
  console.log('Lines: ' + lineCount);
  console.log('Size: ' + (byteSize / 1024).toFixed(1) + ' KB');
  console.log('Date range: ' + dateRange);
  console.log('Rows processed: ' + rows.length);
}

run().then(() => pool.end()).catch(e => { console.error(e.message); pool.end(); process.exit(1); });
