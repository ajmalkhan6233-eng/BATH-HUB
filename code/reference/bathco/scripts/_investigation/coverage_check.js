/**
 * COVERAGE CHECK — read-only, prints to terminal only.
 * Lists every file in the source folder (excluding Transfer),
 * classifies each one, and reports unrecognized files with their first 3 rows.
 */
'use strict';

const XLSX = require('xlsx');
const fs   = require('fs');
const path = require('path');

const SOURCE = 'C:/Users/DELL/Desktop/complet till 17-06-2026';

// ── Classification rules ──────────────────────────────────────────────────────
const ROLLUP_NAMES   = /DALY SALES REPORT|MASTER COPY|DALY SALES REPORT/i;
const GENERATED_XLSX = /^1stChoiceBathco_|^1st_Choice_Bathco_|^Daily_Report_\d|^BATHCO_SIMPLE_REPORT|^1ST_CHOICE_BATHCO_COMPREHENSIVE|^Sales Accounts - Copy/i;
const CHEQ_FILES     = /OUTBOUND_CHEQ_CLEAN/i;
const REP_SALES      = /^RepSalesAnalysis_/i;
const MISC_ADMIN     = /^GRN\.xlsx$|^T SALE\.xlsx$|^TOTAL Q\.xlsx$|^QUANTITY AND PRICE\.xlsx$|^PHYSICAL INVENTORY|^PHYSICAL INVERNTORY/i;
const SKIP_DIRS      = ['Transfer','TILE CORD','TILE CODES NEW','LETTER','_investigation'];

function isTypeA(headers) {
  const hs = headers.map(h => String(h).trim().toUpperCase());
  const has = (...keys) => keys.some(k => hs.some(h => h === k || h.replace(/\s+/g,'').includes(k.replace(/\s+/g,''))));
  return has('SALES','SALE','CASHPAYMENT','CARDPAYMENT') || has('RECEPTNO','RECEIPTNO');
}

function classifyXlsx(filePath) {
  const base = path.basename(filePath);
  if (CHEQ_FILES.test(base))     return { cls: 'UNRECOGNIZED', reason: 'Cheque register — not a daily report' };
  if (GENERATED_XLSX.test(base)) return { cls: 'UNRECOGNIZED', reason: 'AI-generated summary — not source data' };
  if (REP_SALES.test(base))      return { cls: 'LASERSOFT_COST', reason: 'Lasersoft Rep Sales Analysis (NETSLS/NETPRO by product)' };
  if (MISC_ADMIN.test(base))     return { cls: 'UNRECOGNIZED', reason: 'Admin/inventory file' };
  if (base === 'Sales Accounts.xlsx') return { cls: 'LASERSOFT_COST', reason: 'Per-day cost/profit sheets (Sales Accounts.xlsx)' };

  let rows, headers;
  try {
    const wb = XLSX.readFile(filePath, { sheetRows: 8 });
    // Check all sheets; use the first non-chart sheet
    for (const sname of wb.SheetNames) {
      if (/chart/i.test(sname)) continue;
      const ws = wb.Sheets[sname];
      rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      // Flatten and find the first non-empty row to use as headers
      for (let i = 0; i < Math.min(rows.length, 3); i++) {
        if (rows[i].some(c => c !== '')) { headers = rows[i]; break; }
      }
      if (headers) break;
    }
    if (!headers) return { cls: 'UNRECOGNIZED', reason: 'Empty or unreadable', rows };
  } catch(e) {
    return { cls: 'UNRECOGNIZED', reason: 'Cannot open: ' + e.message };
  }

  if (isTypeA(headers)) {
    if (ROLLUP_NAMES.test(base)) return { cls: 'MONTHLY_ROLLUP', reason: 'Multi-date sales rollup' };
    return { cls: 'SALES', reason: 'Daily sales file (Type A: DATE/SALES/CASH PAYMENT...)' };
  }

  // Check for Lasersoft-style headers (NETSLS, NETPRO, CODE, DESCRIPTION, COST)
  const flat = headers.map(h => String(h).toUpperCase());
  if (flat.includes('NETSLS') || flat.includes('NETPRO'))
    return { cls: 'LASERSOFT_COST', reason: 'Lasersoft export (NETSLS/NETPRO columns)' };
  if (flat.includes('TOTAL COST') && flat.includes('PROFIT'))
    return { cls: 'LASERSOFT_COST', reason: 'Per-item cost/profit (TOTAL COST + PROFIT columns)' };
  if (flat.includes('TOTAL AMOUNT') && flat.includes('SELLING PRICE'))
    return { cls: 'LASERSOFT_COST', reason: 'Per-item selling data (TOTAL AMOUNT/SELLING PRICE)' };

  return { cls: 'UNRECOGNIZED', reason: 'Headers not matched: ' + headers.filter(h=>h!=='').slice(0,6).join(', '), rows };
}

function classifyImage(filePath) {
  const base = path.basename(filePath);
  const fp   = filePath.replace(/\\/g,'/');
  if (fp.toLowerCase().includes('tile cord') || fp.toLowerCase().includes('tile codes'))
    return { cls: 'UNRECOGNIZED', reason: 'Tile product photo' };
  if (/whatsapp/i.test(base)) return { cls: 'EXPENSE_PHOTO', reason: 'WhatsApp expense/handwritten photo' };
  return { cls: 'EXPENSE_PHOTO', reason: 'Photo file' };
}

function classifyPDF(filePath) {
  return { cls: 'UNRECOGNIZED', reason: 'PDF — cannot parse without OCR' };
}

// ── Walk folder ────────────────────────────────────────────────────────────────
function walkAll(dir, depth = 0) {
  if (depth > 6 || !fs.existsSync(dir)) return [];
  const entries = [];
  for (const entry of fs.readdirSync(dir)) {
    if (entry.startsWith('.') || entry.startsWith('~$')) continue;
    const full = path.join(dir, entry);
    let stat; try { stat = fs.statSync(full); } catch { continue; }
    if (stat.isDirectory()) {
      if (SKIP_DIRS.some(d => entry.toLowerCase() === d.toLowerCase())) continue;
      entries.push(...walkAll(full, depth + 1));
    } else {
      entries.push(full);
    }
  }
  return entries;
}

// ── Main ──────────────────────────────────────────────────────────────────────
const allFiles = walkAll(SOURCE);

// Group by subfolder relative to SOURCE
const groups = {};
for (const f of allFiles) {
  const rel  = f.replace(SOURCE.replace(/\//g,'\\'), '').replace(/^[\/\\]/, '');
  const parts = rel.split(/[\/\\]/);
  const folder = parts.length > 1 ? parts.slice(0, -1).join('/') : '(root)';
  if (!groups[folder]) groups[folder] = [];
  groups[folder].push({ full: f, base: parts[parts.length - 1] });
}

let totalFiles = 0, totalClassified = 0, totalUnrecognized = 0;
const classifyCounts = {};
const unrecognizedList = [];

const sortedFolders = Object.keys(groups).sort();

console.log('═══════════════════════════════════════════════════════════════════════');
console.log(' COVERAGE CHECK — complet till 17-06-2026');
console.log('═══════════════════════════════════════════════════════════════════════\n');

for (const folder of sortedFolders) {
  const files = groups[folder];
  console.log(`\n📁 ${folder}/  (${files.length} files)`);
  console.log('  ' + '─'.repeat(70));

  for (const { full, base } of files.sort((a,b)=>a.base.localeCompare(b.base))) {
    totalFiles++;
    let cls, reason, rows;
    const ext = path.extname(base).toLowerCase();

    if (['.xlsx','.xls'].includes(ext)) {
      const r = classifyXlsx(full);
      cls = r.cls; reason = r.reason; rows = r.rows;
    } else if (['.jpg','.jpeg','.png'].includes(ext)) {
      const r = classifyImage(full);
      cls = r.cls; reason = r.reason;
    } else if (ext === '.pdf') {
      const r = classifyPDF(full);
      cls = r.cls; reason = r.reason;
    } else if (['.html','.htm'].includes(ext)) {
      cls = 'UNRECOGNIZED'; reason = 'HTML file';
    } else {
      cls = 'UNRECOGNIZED'; reason = 'Unknown type: ' + ext;
    }

    classifyCounts[cls] = (classifyCounts[cls] || 0) + 1;
    if (cls !== 'UNRECOGNIZED') totalClassified++;
    else {
      totalUnrecognized++;
      unrecognizedList.push({ base, folder, reason, rows });
    }

    const tag = cls.padEnd(18);
    console.log(`  [${tag}]  ${base}`);
    if (cls === 'UNRECOGNIZED') console.log(`              → ${reason}`);
  }
}

// ── Unrecognized detail section ────────────────────────────────────────────────
if (unrecognizedList.length) {
  console.log('\n\n═══════════════════════════════════════════════════════════════════════');
  console.log(' UNRECOGNIZED FILES — first 3 rows of content');
  console.log('═══════════════════════════════════════════════════════════════════════');
  for (const { base, folder, reason, rows } of unrecognizedList) {
    console.log(`\n  ${folder}/${base}`);
    console.log(`  Reason: ${reason}`);
    if (rows) {
      const nonEmpty = rows.filter(r => r.some(c => c !== '')).slice(0, 3);
      nonEmpty.forEach((r, i) => console.log(`  Row${i}: ${JSON.stringify(r.slice(0,8))}`));
    } else {
      console.log('  (not an Excel file or could not open)');
    }
  }
}

// ── Final summary ─────────────────────────────────────────────────────────────
console.log('\n\n═══════════════════════════════════════════════════════════════════════');
console.log(' FINAL SUMMARY');
console.log('═══════════════════════════════════════════════════════════════════════');
Object.entries(classifyCounts).sort((a,b)=>b[1]-a[1]).forEach(([cls,n]) => {
  console.log(` ${String(n).padStart(4)}  ${cls}`);
});
console.log(`\n ${totalFiles} total files found, ${totalClassified} classified, ${totalUnrecognized} unrecognized.`);
