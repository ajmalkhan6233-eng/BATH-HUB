/**
 * BATHCO MASTER DATA REBUILD — offline audit script, read-only
 * Source: C:\Users\DELL\Desktop\complet till 17-06-2026
 * Output: scripts/BATHCO_MASTER_DATA_REBUILD.xlsx
 *
 * Data sources found in source folder:
 *   Type A (sales):  DALY SALES REPORT.xlsx rollup (Jan 31 – Feb 28 2026)
 *                    Individual DD-MM-YYYY.xlsx files (Apr 18 – Jun 17 2026)
 *   Type B (GP):     Sales Accounts.xlsx — sheets named by date, per-item cost/profit
 *                    (Mar 15 – Apr 30 2026; March cost column = 0, flag as COST_MISSING)
 *   Expense photos:  WhatsApp images — paths recorded, no OCR
 *
 * NOTE: No sales data found for Dec 21–31 2025, Jan 1–30 2026, Mar 1–14 2026, Apr 1–17 2026.
 *       Sales Accounts.xlsx GP for March is unreliable (cost column blank → GP = TOTAL AMOUNT).
 *       Do NOT use March GP figures from this file for financial reporting.
 */

'use strict';

const XLSX = require('xlsx');
const fs   = require('fs');
const path = require('path');

// ── Config ────────────────────────────────────────────────────────────────────
const SOURCE      = 'C:/Users/DELL/Desktop/complet till 17-06-2026';
const OUTPUT      = path.join(__dirname, 'BATHCO_MASTER_DATA_REBUILD.xlsx');
const RANGE_START = '2025-12-21';
const RANGE_END   = '2026-06-17';

// ── Day record schema ─────────────────────────────────────────────────────────
function makeRecord() {
  return {
    sale: 0, cash: 0, card: 0, online: 0, cheq: 0, credit: 0,
    gp: null, cost: null,
    salesFiles: [], costFiles: [], photoFiles: [], flags: []
  };
}
const records = {};
function getRecord(dateStr) {
  if (!records[dateStr]) records[dateStr] = makeRecord();
  return records[dateStr];
}

// ─────────────────────────────────────────────────────────────────────────────
// DATE UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/** Convert any supported date format to YYYY-MM-DD, or null. */
function parseDate(val) {
  if (val == null || val === '') return null;
  // Excel serial number (days since 1899-12-30)
  if (typeof val === 'number' && val > 40000 && val < 60000) {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1, day = d.getUTCDate();
    if (y >= 2020 && y <= 2035)
      return `${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    return null;
  }
  const s = String(val).trim();
  // YYYY-MM-DD
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return s;
  // DD/MM/YYYY or DD-MM-YYYY
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  // DD.MM.YY (e.g. 01.02.26)
  m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2})$/);
  if (m) return `20${m[3]}-${m[2]}-${m[1].padStart(2,'0')}`;
  // DD.MM.YYYY
  m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1].padStart(2,'0')}`;
  // Try JS Date parse as last resort (UTC to avoid timezone shift)
  const ts = Date.parse(s);
  if (!isNaN(ts)) {
    const d = new Date(ts);
    const y = d.getUTCFullYear();
    if (y >= 2020 && y <= 2035)
      return `${y}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
  }
  return null;
}

/** Parse a Sales Accounts.xlsx sheet name like "24.03" or "01.04.2026". */
function parseSheetDate(name) {
  const s = String(name).trim();
  // DD.MM.YYYY
  let m = s.match(/^(\d{1,2})\.(\d{2})\.(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1].padStart(2,'0')}`;
  // DD.MM (assume 2026)
  m = s.match(/^(\d{1,2})\.(\d{2})$/);
  if (m) return `2026-${m[2]}-${m[1].padStart(2,'0')}`;
  return null;
}

/** Extract date hint from filename like 18-04-2026.xlsx or 01.02.26.xlsx. */
function dateFromFilename(filePath) {
  const name = path.basename(filePath, path.extname(filePath));
  // DD-MM-YYYY
  let m = name.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  // DD.MM.YY
  m = name.match(/^(\d{2})\.(\d{2})\.(\d{2})$/);
  if (m) return `20${m[3]}-${m[2]}-${m[1]}`;
  // DD.MM.YYYY
  m = name.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

/** Build full date spine between start and end (inclusive). */
function buildDateSpine(start, end) {
  const dates = [];
  const [sy,sm,sd] = start.split('-').map(Number);
  const [ey,em,ed] = end.split('-').map(Number);
  const cur  = new Date(Date.UTC(sy, sm-1, sd));
  const last = new Date(Date.UTC(ey, em-1, ed));
  while (cur <= last) {
    const y = cur.getUTCFullYear(), m = cur.getUTCMonth()+1, d = cur.getUTCDate();
    dates.push(`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`);
    cur.setUTCDate(cur.getUTCDate()+1);
  }
  return dates;
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPE A DETECTION (same logic as server.js recalculateDate)
// ─────────────────────────────────────────────────────────────────────────────

/** Returns true if the header array matches a Type A daily sales file. */
function isTypeAHeaders(headers) {
  const hs = headers.map(h => String(h).trim().toUpperCase());
  const has = (...keys) => keys.some(k => hs.some(h => h === k || h.replace(/\s+/g,'').includes(k.replace(/\s+/g,''))));
  return has('SALES','SALE','CASHPAYMENT','CARDPAYMENT') || has('RECEPTNO','RECEIPTNO');
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPE A — EXTRACT SALES FROM ONE WORKSHEET
// ─────────────────────────────────────────────────────────────────────────────

/** Read a numeric value from a row using a list of candidate column names. */
function colNum(row, ...cands) {
  for (const c of cands) {
    const key = Object.keys(row).find(k => String(k).trim().toUpperCase() === c.toUpperCase());
    if (key !== undefined) return parseFloat(row[key]) || 0;
  }
  return 0;
}

/** Read a string value from a row using candidate column names. */
function colStr(row, ...cands) {
  for (const c of cands) {
    const key = Object.keys(row).find(k => String(k).trim().toUpperCase() === c.toUpperCase());
    if (key !== undefined) return String(row[key] || '').trim();
  }
  return '';
}

/**
 * Extract day-level sales from a Type A worksheet.
 * Multi-day files (rollups) carry forward the last seen date per row.
 * Returns nothing — writes directly into records[].
 */
function extractSalesRows(rows, srcLabel, defaultDate) {
  let currentDate = defaultDate;
  for (const row of rows) {
    const rawDate = row['DATE'] || row['Date'] || row['date'] || '';
    const parsedDate = parseDate(rawDate);
    if (parsedDate) currentDate = parsedDate;
    if (!currentDate) continue;
    if (currentDate < RANGE_START || currentDate > RANGE_END) continue;

    const sale   = colNum(row, 'SALES', 'SALE');
    const cash   = colNum(row, '  CASH PAYMENT', 'CASH PAYMENT', 'CASH');
    const card   = colNum(row, 'CARD PAYMENT', 'CARD');
    const online = colNum(row, 'ONLINE PAYMENT', 'ONLINE');
    const cheq   = colNum(row, 'CHEQ PAYMENT', 'CHEQUE PAYMENT', 'CHECK PAYMENT');
    const credit = colNum(row, 'CREDIT');

    if (!sale && !cash && !card && !online && !cheq && !credit) continue;

    const rec = getRecord(currentDate);
    rec.sale   += sale;
    rec.cash   += cash;
    rec.card   += card;
    rec.online += online;
    rec.cheq   += cheq;
    rec.credit += credit;
    if (!rec.salesFiles.includes(srcLabel)) rec.salesFiles.push(srcLabel);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPE B EQUIVALENT — EXTRACT GP FROM SALES ACCOUNTS.XLSX
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sales Accounts.xlsx: each sheet is one day, named by date.
 * Columns: CODE | | | UNIT | SELLING PRICE | TOTAL AMOUNT | UNIT | COST | TOTAL COST | PROFIT
 * Sum TOTAL AMOUNT → Gross Sales, TOTAL COST → Total Cost, PROFIT → Gross Profit.
 * When TOTAL COST is all 0 (March sheets), flag as GP_COST_MISSING.
 */
function extractLasersoftGPBySheet(wb) {
  let sheetsProcessed = 0;
  for (const sheetName of wb.SheetNames) {
    if (sheetName.toLowerCase() === 'summary') continue;
    const dateStr = parseSheetDate(sheetName);
    if (!dateStr || dateStr < RANGE_START || dateStr > RANGE_END) continue;

    const ws   = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: 0 });

    // Find header row containing TOTAL AMOUNT / TOTAL COST / PROFIT
    let headerIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 5); i++) {
      const flat = rows[i].map(v => String(v).toUpperCase());
      if (flat.includes('TOTAL AMOUNT') || flat.includes('PROFIT')) { headerIdx = i; break; }
    }
    if (headerIdx < 0) continue;

    const hdr   = rows[headerIdx].map(v => String(v).trim().toUpperCase());
    const iAmt  = hdr.indexOf('TOTAL AMOUNT');
    const iCost = hdr.indexOf('TOTAL COST');
    const iPro  = hdr.indexOf('PROFIT');
    if (iAmt < 0 && iPro < 0) continue;

    let sumAmt = 0, sumCost = 0, sumProfit = 0;
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      // Skip subtotal / blank rows (no code in col 0)
      if (!r[0] && !r[1] && !r[2]) continue;
      sumAmt    += iAmt  >= 0 ? parseFloat(r[iAmt])  || 0 : 0;
      sumCost   += iCost >= 0 ? parseFloat(r[iCost]) || 0 : 0;
      sumProfit += iPro  >= 0 ? parseFloat(r[iPro])  || 0 : 0;
    }

    const rec = getRecord(dateStr);
    if (rec.gp === null) { rec.gp = 0; rec.cost = 0; }
    rec.gp   += sumProfit;
    rec.cost += sumCost;
    rec.costFiles.push(`Sales Accounts.xlsx[${sheetName}]`);
    if (sumCost === 0 && sumAmt > 0)
      rec.flags.push('GP_COST_MISSING — cost column blank in Sales Accounts.xlsx, GP equals selling price');
    sheetsProcessed++;
  }
  return sheetsProcessed;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPENSE PHOTO FINDER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Walk folder for image files (jpg/jpeg/png).
 * Only records images whose filename contains a YYYY-MM-DD date within range.
 * Skips tile product image folders.
 * Does NOT perform OCR — path is recorded only.
 * See C:\Bathco\AI-Data\ocr_openrouter.py for the existing OCR system.
 */
function findExpensePhotos(rootDir) {
  const SKIP_DIRS = ['TILE CORD','TILE CODES NEW','TILE CORD','Transfer','LETTER','URGENT'];
  let count = 0;

  function walk(dir, depth) {
    if (depth > 6 || !fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir)) {
      if (entry.startsWith('.') || entry.startsWith('~$')) continue;
      const full = path.join(dir, entry);
      let stat; try { stat = fs.statSync(full); } catch { continue; }

      if (stat.isDirectory()) {
        if (!SKIP_DIRS.some(s => entry.toLowerCase().includes(s.toLowerCase()))) walk(full, depth+1);
      } else if (/\.(jpg|jpeg|png)$/i.test(entry)) {
        // Extract YYYY-MM-DD from WhatsApp image filename
        const m = entry.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (!m) continue;
        const dateStr = `${m[1]}-${m[2]}-${m[3]}`;
        if (dateStr < RANGE_START || dateStr > RANGE_END) continue;
        getRecord(dateStr).photoFiles.push(full.replace(rootDir,'').replace(/^[\/\\]/,''));
        count++;
      }
    }
  }
  walk(rootDir, 0);
  return count;
}

// ─────────────────────────────────────────────────────────────────────────────
// FILE CLASSIFICATION HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const SKIP_BASENAMES = new Set([
  'OUTBOUND_CHEQ_CLEAN.xlsx', 'MASTER COPY - Copy - Copy.xlsx',
  'BATHCO_SIMPLE_REPORT.xlsx','BATHCO_SIMPLE_REPORT (1).xlsx',
  '1ST_CHOICE_BATHCO_COMPREHENSIVE_REPORT.xlsx',
  '1st_Choice_Bathco_Pricing_Report.xlsx',
  'PHYSICAL INVERNTORY WORKSHEET.xlsx',
  'Sales Accounts.xlsx', // processed separately
  'Sales Accounts - Copy.xlsx',
  'GRN.xlsx','T SALE.xlsx','TOTAL Q.xlsx','QUANTITY AND PRICE.xlsx',
]);
const SKIP_PATTERNS = [
  /^1stChoiceBathco_/i, /^1st_Choice_Bathco_/i, /^Daily_Report_\d/i,
  /^RepSalesAnalysis_/i, /^LYCOSE/i, /^STOCK LYCOSE/i,
  /^AFDAS|BFNH|CFBDF|FNGJN|SFSGS|TOTAL\.xlsx|DDD|DWQD|NN\.xlsx|^Q\.xlsx/i,
];
const SKIP_DIR_PARTS = ['transfer','tile cord','tile codes','letter','new]','urgent','12.2'];

function shouldSkipFile(filePath) {
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  if (path.basename(filePath).startsWith('~$')) return true;
  if (SKIP_BASENAMES.has(path.basename(filePath))) return true;
  if (SKIP_PATTERNS.some(p => p.test(path.basename(filePath)))) return true;
  if (SKIP_DIR_PARTS.some(d => normalized.includes('/' + d + '/'))) return true;
  return false;
}

function walkXlsx(dir, depth = 0) {
  if (depth > 6 || !fs.existsSync(dir)) return [];
  const files = [];
  for (const entry of fs.readdirSync(dir)) {
    if (entry.startsWith('.') || entry.startsWith('~$')) continue;
    const full = path.join(dir, entry);
    let stat; try { stat = fs.statSync(full); } catch { continue; }
    if (stat.isDirectory()) files.push(...walkXlsx(full, depth+1));
    else if (/\.(xlsx|xls)$/i.test(entry)) files.push(full);
  }
  return files;
}

/** Walk all subfolders for RepSalesAnalysis_*.xlsx files (doesn't apply skip rules). */
function walkRepSalesAnalysis(dir, depth = 0) {
  const SKIP = ['transfer','tile cord','tile codes new','letter'];
  if (depth > 6 || !fs.existsSync(dir)) return [];
  const files = [];
  for (const entry of fs.readdirSync(dir)) {
    if (entry.startsWith('.') || entry.startsWith('~$')) continue;
    const full = path.join(dir, entry);
    let stat; try { stat = fs.statSync(full); } catch { continue; }
    if (stat.isDirectory()) {
      if (SKIP.some(s => entry.toLowerCase().includes(s))) continue;
      files.push(...walkRepSalesAnalysis(full, depth+1));
    } else if (/^RepSalesAnalysis_.*\.xlsx$/i.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

/**
 * Extract Gross Profit from one RepSalesAnalysis file into repGPMap[date].
 *
 * Three formats found in the wild:
 *   F1 — CODE/DESCRIPTION/SLSQTY/SLSAMO/.../NETSLS/NETPRO (by-rep product summary)
 *         Single-day: sum NETPRO for header date.
 *         Multi-month: skip (no per-row date).
 *   F2 — DATE/NUMBER/CUSTOMER/CODE/DESCRIPTION/QTY/UOM/U-COST/U-PRICE (invoice detail, DATE per row)
 *         Sum (U-PRICE − U-COST) × QTY, grouped by row DATE.
 *   F3 — CODE/DESCRIPTION/QTY/UOM/U-COST/U-PRICE (product list, no DATE column)
 *         Single-day only: sum (U-PRICE − U-COST) × QTY using header date.
 *         Multi-month: skip.
 */
/**
 * Collects per-date GP contributions from one RepSalesAnalysis file.
 * Pushes { date, gp, label, format, hasCost } objects into `contributions`.
 * Deduplication across files happens in the caller.
 */
function extractRepSalesAnalysisGP(filePath, contributions) {
  let wb;
  try { wb = XLSX.readFile(filePath, { sheetRows: 10000 }); }
  catch { return; }

  const ws      = wb.Sheets[wb.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  // Detect header date from first 5 rows
  let headerDate = null, isRange = false;
  for (let i = 0; i < Math.min(rawRows.length, 5); i++) {
    for (const cell of rawRows[i]) {
      const s = String(cell);
      if (!/DATE:/i.test(s)) continue;
      if (/Through/i.test(s)) { isRange = true; }
      else {
        const m = s.match(/DATE:\s*(\d{4}-\d{2}-\d{2})/i);
        if (m) headerDate = m[1];
      }
      break;
    }
    if (headerDate || isRange) break;
  }
  if (!headerDate && !isRange) return;

  // Find column header row
  let hdrIdx = -1, hdr = [];
  for (let i = 0; i < Math.min(rawRows.length, 8); i++) {
    const upper = rawRows[i].map(v => String(v).trim().toUpperCase());
    if (upper.includes('NETPRO') || upper.includes('U-COST')) {
      hdrIdx = i; hdr = upper; break;
    }
  }
  if (hdrIdx < 0) return;

  const iNetPro = hdr.indexOf('NETPRO');
  const iUCost  = hdr.indexOf('U-COST');
  const iUPrice = hdr.indexOf('U-PRICE');
  const iQty    = hdr.indexOf('QTY');
  const iDate   = hdr.indexOf('DATE');
  const label   = path.basename(filePath);

  if (iNetPro >= 0) {
    // Format 1: NETSLS/NETPRO — only usable for single-day files
    if (isRange || !headerDate || headerDate < RANGE_START || headerDate > RANGE_END) return;
    let sumGP = 0;
    for (let i = hdrIdx + 1; i < rawRows.length; i++)
      sumGP += parseFloat(rawRows[i][iNetPro]) || 0;
    if (sumGP !== 0)
      contributions.push({ date: headerDate, gp: sumGP, label, format: 'NETPRO', hasCost: true });

  } else if (iUCost >= 0 && iUPrice >= 0 && iQty >= 0) {
    if (iDate >= 0) {
      // Format 2: DATE per row — works for single and multi-month
      const byDate = {};
      for (let i = hdrIdx + 1; i < rawRows.length; i++) {
        const row     = rawRows[i];
        const dateVal = row[iDate];
        if (dateVal === '') continue;
        const rowDate = parseDate(dateVal);
        if (!rowDate || rowDate < RANGE_START || rowDate > RANGE_END) continue;
        const qty    = parseFloat(row[iQty])    || 0;
        const ucost  = parseFloat(row[iUCost])  || 0;
        const uprice = parseFloat(row[iUPrice]) || 0;
        if (qty === 0 && ucost === 0 && uprice === 0) continue;
        if (!byDate[rowDate]) byDate[rowDate] = { gp: 0, hasCost: false };
        byDate[rowDate].gp += (uprice - ucost) * qty;
        if (ucost > 0) byDate[rowDate].hasCost = true;
      }
      for (const [d, v] of Object.entries(byDate))
        if (v.gp !== 0)
          contributions.push({ date: d, gp: v.gp, label, format: 'UCOST+DATE', hasCost: v.hasCost });

    } else {
      // Format 3: no DATE col — single-day only
      if (isRange || !headerDate || headerDate < RANGE_START || headerDate > RANGE_END) return;
      let sumGP = 0, hasCost = false;
      for (let i = hdrIdx + 1; i < rawRows.length; i++) {
        const row    = rawRows[i];
        const qty    = parseFloat(row[iQty])    || 0;
        const ucost  = parseFloat(row[iUCost])  || 0;
        const uprice = parseFloat(row[iUPrice]) || 0;
        if (ucost > 0) hasCost = true;
        sumGP += (uprice - ucost) * qty;
      }
      if (sumGP !== 0)
        contributions.push({ date: headerDate, gp: sumGP, label, format: 'UCOST_NODATE', hasCost });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NET PROFIT CALCULATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute net profit for a day's record.
 * Formula (matches server.js): Net Profit = Gross Profit − Total Expenses
 * This audit script has NO expense data (expenses come from handwritten photos via OCR).
 * Returns null when GP is unknown, 'PENDING' string when expenses missing.
 */
function calculateNetProfit(rec) {
  if (rec.gp == null) return null;   // GP unknown → cannot compute
  return 'PENDING';                  // GP known but expenses not in source folder
}

// ─────────────────────────────────────────────────────────────────────────────
// DETERMINE STATUS
// ─────────────────────────────────────────────────────────────────────────────
function determineStatus(rec) {
  const hasS = rec.salesFiles.length > 0;
  const hasC = rec.costFiles.length > 0;
  const hasP = rec.photoFiles.length > 0;
  if (!hasS && !hasC && !hasP) return 'NO DATA';
  if (hasS && hasC)            return 'COMPLETE';
  if (hasS && !hasC)           return 'MISSING COST';
  if (!hasS && hasC)           return 'MISSING SALES';
  return 'MISSING SALES + COST';
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log('BATHCO MASTER DATA REBUILD');
  console.log('Source:', SOURCE);
  console.log('Range: ', RANGE_START, '→', RANGE_END);
  console.log();

  // ── Step 1: GP from Sales Accounts.xlsx ────────────────────────────────────
  console.log('[Step 1] Extracting GP from Sales Accounts.xlsx...');
  const saPath = path.join(SOURCE, '1122', 'Sales Accounts.xlsx');
  if (fs.existsSync(saPath)) {
    const wb = XLSX.readFile(saPath);
    const n  = extractLasersoftGPBySheet(wb);
    console.log(`  Done — ${n} date sheets processed`);
  } else {
    console.log('  NOT FOUND — skipped');
  }

  // ── Step 1b: GP from RepSalesAnalysis_*.xlsx files ────────────────────────
  console.log('\n[Step 1b] Extracting GP from RepSalesAnalysis files...');
  const repFiles        = walkRepSalesAnalysis(SOURCE);
  const contributions   = []; // { date, gp, label, format, hasCost }
  for (const f of repFiles) extractRepSalesAnalysisGP(f, contributions);

  // Deduplicate: for each date, group contributions and skip any whose GP value
  // (rounded to 2dp) exactly matches a contribution already accepted for that date.
  // Same GP value = same underlying transactions exported twice. Different GP = different
  // rep/filter = additive. Log every dedup decision for transparency.
  const repGPMap     = {};  // date → final GP
  const repGPSources = {};  // date → accepted source labels
  const dedupLog     = [];  // { date, kept, skipped, reason }

  const byDate = {};
  for (const c of contributions) {
    if (!byDate[c.date]) byDate[c.date] = [];
    byDate[c.date].push(c);
  }

  for (const [date, contribs] of Object.entries(byDate)) {
    const seenGP  = new Set();
    let   total   = 0;
    const kept    = [], skipped = [];
    for (const c of contribs) {
      const key = c.gp.toFixed(2);
      if (seenGP.has(key)) {
        skipped.push(c.label);
      } else {
        seenGP.add(key);
        total += c.gp;
        kept.push(c.label);
      }
    }
    repGPMap[date]     = total;
    repGPSources[date] = kept;
    if (skipped.length > 0)
      dedupLog.push({ date, kept, skipped });
  }

  if (dedupLog.length > 0) {
    console.log(`  *** DEDUP REPORT — ${dedupLog.length} date(s) had duplicate GP sources removed:`);
    for (const { date, kept, skipped } of dedupLog) {
      console.log(`    ${date}: KEPT   ${kept.join(', ')}`);
      console.log(`           SKIPPED ${skipped.join(', ')} (identical GP value — duplicate export)`);
      const gpVal = repGPMap[date];
      console.log(`           Final GP for this date: ${gpVal.toFixed(2)}`);
    }
  }

  // Merge into records — only fills dates where Sales Accounts left gp===null
  let repMerged = 0;
  const noHasCost = new Set(
    contributions.filter(c => !c.hasCost).map(c => c.date)
  );
  for (const [dateStr, gpVal] of Object.entries(repGPMap)) {
    const rec = getRecord(dateStr);
    if (rec.gp === null) {
      rec.gp   = gpVal;
      rec.cost = 0;
      rec.costFiles.push(...repGPSources[dateStr]);
      if (noHasCost.has(dateStr))
        rec.flags.push('GP_COST_MISSING — U-COST all zero in RepSalesAnalysis file');
      repMerged++;
    }
  }
  console.log(`  Done — ${repFiles.length} files scanned, GP added for ${repMerged} new dates`);

  // ── Step 2: Sales data from all Type A xlsx files ──────────────────────────
  console.log('\n[Step 2] Scanning all xlsx files for Type A sales data...');
  const seenRollups = new Set(); // deduplicate identical rollup copies by basename
  let typeACount = 0, skippedCount = 0;

  for (const filePath of walkXlsx(SOURCE)) {
    if (shouldSkipFile(filePath)) { skippedCount++; continue; }

    const baseName = path.basename(filePath);
    if (/DALY SALES REPORT/i.test(baseName) && seenRollups.has(baseName)) {
      skippedCount++; continue;
    }

    const fileDateHint = dateFromFilename(filePath);

    try {
      const wb    = XLSX.readFile(filePath, { sheetRows: 2000 });
      const sname = wb.SheetNames.find(s => !/chart/i.test(s)) || wb.SheetNames[0];
      const ws    = wb.Sheets[sname];
      const rows  = XLSX.utils.sheet_to_json(ws, { defval: 0 });
      if (!rows.length) { skippedCount++; continue; }

      // Allow for files where row 0 is blank (header on row 1)
      const headers = Object.keys(rows[0]);
      const effectiveHeaders = headers.every(h => !isNaN(+h)) && rows[1]
        ? Object.keys(rows[1]) : headers;

      if (!isTypeAHeaders(effectiveHeaders)) { skippedCount++; continue; }

      typeACount++;
      if (/DALY SALES REPORT/i.test(baseName)) seenRollups.add(baseName);
      const label = filePath.replace(SOURCE.replace(/\//g,'\\'), '').replace(/^[\/\\]/,'');
      extractSalesRows(rows, label, fileDateHint || null);
    } catch { skippedCount++; }
  }
  console.log(`  Done — ${typeACount} Type A files, ${skippedCount} skipped`);

  // ── Step 3: Expense photos (paths only) ────────────────────────────────────
  console.log('\n[Step 3] Locating expense photos...');
  const photoCount = findExpensePhotos(SOURCE);
  console.log(`  Done — ${photoCount} photos with parseable dates in range`);

  // ── Step 4: Build output Excel ─────────────────────────────────────────────
  console.log('\n[Step 4] Building BATHCO_MASTER_DATA_REBUILD.xlsx...');
  const spine = buildDateSpine(RANGE_START, RANGE_END);
  const DOW   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  const hdr = [
    'Date','Day',
    'Sales File','Cost/GP File','Expense Photo',
    'Total Sale','Cash','Card','Online','Cheq','Credit',
    'Gross Profit','Total Cost','Net Profit',
    'Expense Photo Path','Source Files',
    'Status','Flags'
  ];

  const rows = spine.map(d => {
    const r  = records[d] || makeRecord();
    const np = calculateNetProfit(r);
    const [py,pm,pd] = d.split('-').map(Number);
    const day = DOW[new Date(Date.UTC(py, pm-1, pd)).getUTCDay()];

    // Split diff check
    if (r.sale > 0) {
      const split = r.cash + r.card + r.online + r.cheq + r.credit;
      if (split > 0 && Math.abs(r.sale - split) > 100)
        r.flags.push(`Split diff ${Math.round(Math.abs(r.sale - split))}`);
    }

    return [
      d, day,
      r.salesFiles.length ? 'YES' : 'NO',
      r.costFiles.length  ? 'YES' : 'NO',
      r.photoFiles.length ? 'YES' : 'NO',
      r.sale   || '',
      r.cash   || '',
      r.card   || '',
      r.online || '',
      r.cheq   || '',
      r.credit || '',
      r.gp   != null ? r.gp   : '',
      r.cost != null ? r.cost : '',
      np != null ? np : '',
      r.photoFiles.slice(0,3).join('; '),
      r.salesFiles.concat(r.costFiles).join('; ').slice(0,120),
      determineStatus(r),
      r.flags.join('; ')
    ];
  });

  // Totals row
  const numSum = (idx) => rows.reduce((s, r) => s + (parseFloat(r[idx]) || 0), 0);
  const totals = [
    'TOTALS','',
    rows.filter(r=>r[2]==='YES').length+' days',
    rows.filter(r=>r[3]==='YES').length+' days',
    rows.filter(r=>r[4]==='YES').length+' days',
    numSum(5),numSum(6),numSum(7),numSum(8),numSum(9),numSum(10),
    numSum(11),numSum(12),'',
    '','','',''
  ];

  // Status counts
  const statusCounts = {};
  rows.forEach(r => { const s=r[16]; statusCounts[s]=(statusCounts[s]||0)+1; });

  const wb = XLSX.utils.book_new();

  // Sheet 1: Date Spine
  const ws1 = XLSX.utils.aoa_to_sheet([hdr, ...rows, [], totals]);
  ws1['!cols'] = [
    {wch:12},{wch:4},
    {wch:12},{wch:14},{wch:15},
    {wch:13},{wch:13},{wch:10},{wch:10},{wch:10},{wch:10},
    {wch:13},{wch:13},{wch:13},
    {wch:40},{wch:50},
    {wch:22},{wch:60}
  ];
  XLSX.utils.book_append_sheet(wb, ws1, 'Date Spine');

  // Sheet 2: Coverage Summary
  const ws2 = XLSX.utils.aoa_to_sheet([
    ['Status','Count'],
    ...Object.entries(statusCounts).sort((a,b)=>b[1]-a[1]),
    [],
    ['Total days in range', spine.length],
    ['Days with sales data',  rows.filter(r=>r[2]==='YES').length],
    ['Days with cost/GP data',rows.filter(r=>r[3]==='YES').length],
    ['Days with expense photo',rows.filter(r=>r[4]==='YES').length],
    [],
    ['DATA GAPS (no sales data)',''],
    ...spine
      .filter(d => !records[d] || !records[d].salesFiles.length)
      .map(d => { const [y,m,dd]=d.split('-').map(Number); return [d, new Date(Date.UTC(y,m-1,dd)).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',timeZone:'UTC'})]; })
      .slice(0, 100),
  ]);
  ws2['!cols'] = [{wch:28},{wch:12}];
  XLSX.utils.book_append_sheet(wb, ws2, 'Coverage Summary');

  XLSX.writeFile(wb, OUTPUT);
  console.log('\n✓ Saved:', OUTPUT);

  // ── Print first 20 rows ────────────────────────────────────────────────────
  const cols = ['Date','Day','Sales','Cost','Photo','Total Sale','Cash','Card','Online','GP','Status'];
  const pad  = [12,4,6,5,6,11,11,11,11,13,22];
  const line = () => pad.map(w=>'-'.repeat(w)).join('-+-');
  const fmt  = (v, w) => String(v||'').padEnd(w).slice(0,w);

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log(' FIRST 20 ROWS — ' + RANGE_START + ' to ' + spine[19]);
  console.log('══════════════════════════════════════════════════════════════');
  console.log(cols.map((c,i)=>fmt(c,pad[i])).join(' | '));
  console.log(line());
  rows.slice(0,20).forEach(r => {
    const out = [r[0],r[1],r[2],r[3],r[4],r[5]||'—',r[6]||'—',r[7]||'—',r[8]||'—',r[11]||'—',r[16]];
    console.log(out.map((v,i)=>fmt(v,pad[i])).join(' | '));
  });
  console.log(line());

  console.log('\n══ STATUS SUMMARY ══');
  Object.entries(statusCounts).sort((a,b)=>b[1]-a[1]).forEach(([s,n])=>console.log(` ${n.toString().padStart(3)}  ${s}`));
  console.log();
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
