/**
 * BATHCO MASTER DATA AUDIT — offline, read-only
 * Source: C:\Users\DELL\Desktop\complet till 17-06-2026
 * Output: BATHCO_MASTER_DATA_REBUILD.xlsx (same scripts/ folder)
 *
 * Type A detection: reuse server.js logic (SALES/CASH PAYMENT/CARD PAYMENT/RECEPT NO headers)
 * Type B equivalent: Sales Accounts.xlsx (per-day sheets with TOTAL AMOUNT, TOTAL COST, PROFIT)
 * Expense photos: recorded by path only — no OCR attempted
 */

const XLSX   = require('xlsx');
const fs     = require('fs');
const path   = require('path');

const SOURCE = 'C:/Users/DELL/Desktop/complet till 17-06-2026';
const OUTPUT = path.join(__dirname, 'BATHCO_MASTER_DATA_REBUILD.xlsx');
const START  = '2025-12-21';
const END    = '2026-06-17';

// ── Date helpers ──────────────────────────────────────────────────────────────
function parseDateStr(v) {
  if (!v && v !== 0) return null;
  const s = String(v).trim();
  // DD/MM/YYYY or DD-MM-YYYY
  let m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  // YYYY-MM-DD
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return s;
  // DD.MM.YY (e.g. 01.02.26)
  m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2})$/);
  if (m) return `20${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  // Excel serial number
  if (typeof v === 'number' && v > 40000 && v < 60000) {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    const y = d.getUTCFullYear(), mo = d.getUTCMonth()+1, day = d.getUTCDate();
    if (y >= 2020 && y <= 2035)
      return `${y}-${String(mo).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }
  return null;
}

// Sheet name like "24.03" → 2026-03-24, "01.04.2026" → 2026-04-01
function parseSheetNameDate(name) {
  const s = String(name).trim();
  let m = s.match(/^(\d{1,2})\.(\d{2})\.(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1].padStart(2,'0')}`;
  m = s.match(/^(\d{1,2})\.(\d{2})$/);
  if (m) return `2026-${m[2]}-${m[1].padStart(2,'0')}`;
  return null;
}

function buildSpine(start, end) {
  const days = [];
  const cur = new Date(start + 'T00:00:00');
  const last = new Date(end + 'T00:00:00');
  while (cur <= last) {
    days.push(cur.toISOString().slice(0,10));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

// ── Type A header detection (same logic as server.js recalculateDate) ─────────
function isTypeA(headers) {
  const hs = headers.map(h => String(h).trim().toUpperCase());
  const has = (...c) => c.some(h => hs.some(x => x === h || x.includes(h)));
  return has('SALES','SALE','CASH PAYMENT','CARD PAYMENT') || has('RECEPT NO','RECEIPT NO');
}

// ── Records store ──────────────────────────────────────────────────────────────
// rec[date] = { sale, cash, card, online, cheq, credit, gp, cost,
//               salesFiles:[], costFiles:[], photoFiles:[], notes:[] }
const rec = {};
function getDay(d) {
  if (!rec[d]) rec[d] = { sale:0, cash:0, card:0, online:0, cheq:0, credit:0,
                           gp:null, cost:null, salesFiles:[], costFiles:[], photoFiles:[], notes:[] };
  return rec[d];
}

// ── Numeric extractor using Type A column aliases ─────────────────────────────
function col(row, ...cands) {
  for (const c of cands) {
    const k = Object.keys(row).find(k => String(k).trim().toUpperCase() === c);
    if (k !== undefined) return parseFloat(row[k]) || 0;
  }
  return 0;
}

// ── Process one Type A sheet (may be multi-day) ───────────────────────────────
function processTypeA(rows, srcFile, defaultDate) {
  let currentDate = defaultDate;
  for (const r of rows) {
    const dateVal = r['DATE'] || r['Date'] || r['date'] || '';
    const parsed  = parseDateStr(dateVal);
    if (parsed) currentDate = parsed;
    if (!currentDate) continue;
    const d = currentDate;
    if (d < START || d > END) continue;

    const sale   = col(r,'SALES','SALE');
    const cash   = col(r,'  CASH PAYMENT','CASH PAYMENT','CASH');
    const card   = col(r,'CARD PAYMENT','CARD');
    const online = col(r,'ONLINE PAYMENT','ONLINE');
    const cheq   = col(r,'CHEQ PAYMENT','CHEQUE PAYMENT','CHECK PAYMENT');
    const credit = col(r,'CREDIT');

    if (!sale && !cash && !card && !online && !cheq && !credit) continue;

    const day = getDay(d);
    day.sale   += sale;
    day.cash   += cash;
    day.card   += card;
    day.online += online;
    day.cheq   += cheq;
    day.credit += credit;
    if (!day.salesFiles.includes(srcFile)) day.salesFiles.push(srcFile);
  }
}

// ── File filter: skip temp files, Transfer, tile images, AI-generated names ────
const SKIP_NAMES = new Set([
  'OUTBOUND_CHEQ_CLEAN.xlsx',
  'MASTER COPY - Copy - Copy.xlsx',
  'BATHCO_SIMPLE_REPORT.xlsx','BATHCO_SIMPLE_REPORT (1).xlsx',
  '1ST_CHOICE_BATHCO_COMPREHENSIVE_REPORT.xlsx',
  '1st_Choice_Bathco_Pricing_Report.xlsx',
  'PHYSICAL INVERNTORY WORKSHEET.xlsx',
]);
const SKIP_NAME_PATTERNS = [
  /^1stChoiceBathco_/i, /^1st_Choice_Bathco_/i, /^Daily_Report_\d/i,
  /^Sales Accounts - Copy/i, /^LYCOSE/i, /^STOCK LYCOSE/i,
  /^GRN\.xlsx$/i, /^QUANTITY AND PRICE/i, /^T SALE/i, /^TOTAL Q/i,
  /^AFDAS|BFNH|CFBDF|FNGJN|SFSGS|TOTAL\.xlsx|DDD|DDDDD|DWQD|NN\.xlsx|Q\.xlsx/i,
];
const SKIP_DIRS = ['Transfer', 'TILE CODES NEW', 'TILE CORD', 'LETTER', 'NEW]', 'URGENT', '12.2', '21'];

function shouldSkip(filePath) {
  const parts = filePath.replace(/\\/g,'/').split('/');
  for (const p of parts.slice(0,-1)) {
    if (SKIP_DIRS.some(d => d.toLowerCase() === p.toLowerCase())) return true;
  }
  const base = path.basename(filePath);
  if (base.startsWith('~$')) return true;
  if (SKIP_NAMES.has(base)) return true;
  if (SKIP_NAME_PATTERNS.some(p => p.test(base))) return true;
  return false;
}

// ── Walk folder for all xlsx files ────────────────────────────────────────────
function walkXlsx(dir, depth = 0) {
  if (depth > 6) return [];
  if (!fs.existsSync(dir)) return [];
  const files = [];
  for (const entry of fs.readdirSync(dir)) {
    if (entry.startsWith('.') || entry.startsWith('~$')) continue;
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) files.push(...walkXlsx(full, depth+1));
    else if (/\.(xlsx|xls)$/i.test(entry)) files.push(full);
  }
  return files;
}

// ── Walk folder for all image files (expense photos) ─────────────────────────
function walkImages(dir, depth = 0) {
  if (depth > 6) return [];
  if (!fs.existsSync(dir)) return [];
  const files = [];
  for (const entry of fs.readdirSync(dir)) {
    if (entry.startsWith('.')) continue;
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) files.push(...walkImages(full, depth+1));
    else if (/\.(jpg|jpeg|png)$/i.test(entry)) files.push(full);
  }
  return files;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PASS 1 — Process Sales Accounts.xlsx (Type B equivalent: per-day GP sheets)
// ═══════════════════════════════════════════════════════════════════════════════
const SALES_ACCTS = path.join(SOURCE, '1122', 'Sales Accounts.xlsx');
console.log('\n[1] Processing Sales Accounts.xlsx (GP data by sheet)...');
try {
  const wb = XLSX.readFile(SALES_ACCTS);
  for (const sname of wb.SheetNames) {
    const d = parseSheetNameDate(sname);
    if (!d || d < START || d > END) continue;
    const ws  = wb.Sheets[sname];
    const rows = XLSX.utils.sheet_to_json(ws, { header:1, defval:0 });
    // Expected columns: CODE | | | UNIT | SELLING PRICE | TOTAL AMOUNT | UNIT | COST | TOTAL COST | PROFIT
    // Find the header row
    let hRow = 0;
    for (let i=0;i<rows.length;i++) {
      const flat = rows[i].map(v => String(v).toUpperCase());
      if (flat.includes('TOTAL AMOUNT') || flat.includes('TOTAL COST') || flat.includes('PROFIT')) {
        hRow = i; break;
      }
    }
    const headers = rows[hRow].map(v => String(v).trim().toUpperCase());
    const iAmt  = headers.findIndex(h => h === 'TOTAL AMOUNT');
    const iCost = headers.findIndex(h => h === 'TOTAL COST');
    const iPro  = headers.findIndex(h => h === 'PROFIT');
    if (iAmt < 0 && iPro < 0) continue;

    let gpSum = 0, saleSum = 0, costSum = 0;
    for (let i = hRow+1; i < rows.length; i++) {
      const r = rows[i];
      if (!r[0] && !r[1]) continue; // skip blank rows
      const amt  = iAmt  >= 0 ? parseFloat(r[iAmt])  || 0 : 0;
      const cost = iCost >= 0 ? parseFloat(r[iCost]) || 0 : 0;
      const pro  = iPro  >= 0 ? parseFloat(r[iPro])  || 0 : 0;
      saleSum += amt;
      costSum += cost;
      gpSum   += pro;
    }

    const day = getDay(d);
    if (day.gp === null) { day.gp = 0; day.cost = 0; }
    day.gp   += gpSum;
    day.cost += costSum;
    if (!day.costFiles.includes('Sales Accounts.xlsx['+sname+']'))
      day.costFiles.push('Sales Accounts.xlsx['+sname+']');
    console.log('  GP sheet:', d, '→ sale', Math.round(saleSum), '/ cost', Math.round(costSum), '/ GP', Math.round(gpSum));
  }
} catch(e) { console.error('[1] Sales Accounts.xlsx error:', e.message); }

// ═══════════════════════════════════════════════════════════════════════════════
// PASS 2 — Process all Type A xlsx files (deduplicate by date → highest-detail wins)
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n[2] Scanning all xlsx files for Type A sales data...');

// Priority order for duplicate dates: individual files > rollup files
// Track how many invoices we've seen per date to prefer the more detailed source
const dateSaleCount = {}; // date → invoice count seen so far

const allXlsx = walkXlsx(SOURCE);
const processed = new Set(); // avoid processing identical rollup copies twice
let typeACount = 0, skipCount = 0;

for (const filePath of allXlsx) {
  if (shouldSkip(filePath)) { skipCount++; continue; }

  const baseName = path.basename(filePath);
  // Deduplicate rollup files (multiple identical copies)
  if (processed.has(baseName) && /DALY SALES REPORT/i.test(baseName)) {
    skipCount++; continue;
  }

  // Extract date hint from filename (DD-MM-YYYY or DD.MM.YY)
  let fileDateHint = null;
  const fn = path.basename(baseName, path.extname(baseName));
  let fm = fn.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (fm) fileDateHint = `${fm[3]}-${fm[2]}-${fm[1]}`;
  fm = fn.match(/^(\d{2})\.(\d{2})\.(\d{2})$/);
  if (fm) fileDateHint = `20${fm[3]}-${fm[2]}-${fm[1]}`;
  fm = fn.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (fm) fileDateHint = `${fm[3]}-${fm[2]}-${fm[1]}`;

  try {
    const wb = XLSX.readFile(filePath, { sheetRows: 2000 });
    // Use Sheet1 or the first sheet that's not a chart
    const sname = wb.SheetNames.find(s => !s.toLowerCase().startsWith('chart')) || wb.SheetNames[0];
    const ws    = wb.Sheets[sname];
    const rows  = XLSX.utils.sheet_to_json(ws, { defval: 0 });
    if (!rows.length) { skipCount++; continue; }

    // Find header row — rows might have a blank row 0
    let headers = Object.keys(rows[0]).map(k => String(k).trim().toUpperCase());
    // If headers look blank or numeric, try row[1]
    if (headers.every(h => !isNaN(+h) || h === '')) {
      if (rows[1]) headers = Object.keys(rows[1]).map(k => String(k).trim().toUpperCase());
    }

    if (!isTypeA(headers)) { skipCount++; continue; }

    typeACount++;
    processed.add(baseName);
    const shortPath = filePath.replace(SOURCE, '').replace(/\\/g,'/').replace(/^\//,'');
    console.log('  Type A:', shortPath);
    processTypeA(rows, shortPath, fileDateHint || null);
  } catch(e) {
    // silently skip corrupted / locked files
  }
}
console.log(`  Done: ${typeACount} Type A files processed, ${skipCount} skipped`);

// ═══════════════════════════════════════════════════════════════════════════════
// PASS 3 — Collect expense photos (paths only, no OCR)
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n[3] Scanning for expense photos (WhatsApp images)...');
const allImages = walkImages(SOURCE);
let photoCount = 0;
for (const img of allImages) {
  // Skip tile product images (in TILE CORD / TILE CODES NEW folders)
  const fp = img.replace(/\\/g,'/');
  if (fp.includes('TILE CORD') || fp.includes('TILE CODES') || fp.includes('New folder/TILE')) continue;

  // Try to extract a date from the path or filename
  // WhatsApp images: "WhatsApp Image 2026-05-13 at ..." → 2026-05-13
  let photoDate = null;
  const wm = path.basename(img).match(/(\d{4})-(\d{2})-(\d{2})/);
  if (wm) photoDate = `${wm[1]}-${wm[2]}-${wm[3]}`;

  if (photoDate && photoDate >= START && photoDate <= END) {
    const day = getDay(photoDate);
    day.photoFiles.push(fp.replace(SOURCE.replace(/\//g,'\\'), '').replace(/^\\/,''));
    photoCount++;
  }
}
console.log(`  Found ${photoCount} expense photos with parseable dates`);

// ═══════════════════════════════════════════════════════════════════════════════
// PASS 4 — Build output
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n[4] Building output Excel...');

const spine = buildSpine(START, END);

const headers = [
  'Date', 'Day',
  'Sales File Found', 'Cost/GP File Found', 'Expense Photo Found',
  'Total Sale', 'Cash', 'Card', 'Online', 'Cheq', 'Credit',
  'Gross Profit', 'Cost',
  'Expense Photo Path',
  'Source File(s)',
  'Status', 'Notes'
];

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const dataRows = spine.map(d => {
  const r   = rec[d] || {};
  const hasS = !!(r.salesFiles && r.salesFiles.length);
  const hasC = !!(r.costFiles  && r.costFiles.length);
  const hasP = !!(r.photoFiles && r.photoFiles.length);

  // Status
  let status;
  if (!hasS && !hasC && !hasP) {
    status = 'NO DATA';
  } else if (hasS && hasC) {
    status = 'COMPLETE';
  } else if (hasS && !hasC) {
    status = 'MISSING COST';
  } else if (!hasS && hasC) {
    status = 'MISSING SALES';
  } else {
    status = 'MISSING SALES + COST';
  }

  const dayName = DAYS[new Date(d+'T00:00:00').getDay()];
  const sale   = r.sale   || 0;
  const cash   = r.cash   || 0;
  const card   = r.card   || 0;
  const online = r.online || 0;
  const cheq   = r.cheq   || 0;
  const credit = r.credit || 0;
  const gp     = r.gp != null ? r.gp : '';
  const cost   = r.cost != null ? r.cost : '';

  const photoPath = hasP ? r.photoFiles.join('; ') : '';
  const srcFiles  = [
    ...(r.salesFiles || []),
    ...(r.costFiles  || []),
  ].join('; ');

  // Notes
  const notes = [];
  if (sale > 0 && cash + card + online + cheq + credit > 0) {
    const split = cash + card + online + cheq + credit;
    const diff  = Math.abs(sale - split);
    if (diff > 100) notes.push(`Split diff: ${Math.round(diff)}`);
  }
  if (r.notes) notes.push(...r.notes);

  return [
    d, dayName,
    hasS ? 'YES' : 'NO',
    hasC ? 'YES' : 'NO',
    hasP ? 'YES' : 'NO',
    sale || '', cash || '', card || '', online || '', cheq || '', credit || '',
    gp, cost,
    photoPath,
    srcFiles,
    status,
    notes.join('; ')
  ];
});

// Totals row
const sumCol = (colIdx) => dataRows.reduce((a, r) => a + (parseFloat(r[colIdx]) || 0), 0);
const totalsRow = [
  'TOTALS', '',
  dataRows.filter(r => r[2]==='YES').length + ' days',
  dataRows.filter(r => r[3]==='YES').length + ' days',
  dataRows.filter(r => r[4]==='YES').length + ' days',
  sumCol(5), sumCol(6), sumCol(7), sumCol(8), sumCol(9), sumCol(10),
  sumCol(11), sumCol(12),
  '', '', '', ''
];

// Status summary
const statCount = {};
dataRows.forEach(r => { const s=r[15]; statCount[s]=(statCount[s]||0)+1; });

const wb  = XLSX.utils.book_new();

// Sheet 1: Date spine
const ws1 = XLSX.utils.aoa_to_sheet([headers, ...dataRows, [], totalsRow]);
ws1['!cols'] = [
  {wch:12},{wch:4},{wch:18},{wch:18},{wch:20},
  {wch:12},{wch:12},{wch:10},{wch:10},{wch:10},{wch:10},
  {wch:12},{wch:12},
  {wch:35},{wch:40},{wch:22},{wch:30}
];
// Bold header row
const range = XLSX.utils.decode_range(ws1['!ref']);
for (let c = range.s.c; c <= range.e.c; c++) {
  const addr = XLSX.utils.encode_cell({r:0, c});
  if (!ws1[addr]) continue;
  ws1[addr].s = { font: { bold: true } };
}
XLSX.utils.book_append_sheet(wb, ws1, 'Date Spine');

// Sheet 2: Status summary
const sumRows = [
  ['Status', 'Days'],
  ...Object.entries(statCount).sort((a,b)=>b[1]-a[1]),
  [],
  ['Total dates in range', spine.length],
  ['Dates with ANY data', dataRows.filter(r=>r[2]==='YES'||r[3]==='YES'||r[4]==='YES').length],
  ['Dates with sales data', dataRows.filter(r=>r[2]==='YES').length],
  ['Dates with cost/GP data', dataRows.filter(r=>r[3]==='YES').length],
  ['Dates with expense photos', dataRows.filter(r=>r[4]==='YES').length],
];
const ws2 = XLSX.utils.aoa_to_sheet(sumRows);
ws2['!cols'] = [{wch:30},{wch:10}];
XLSX.utils.book_append_sheet(wb, ws2, 'Summary');

XLSX.writeFile(wb, OUTPUT);
console.log('\n✓ Written:', OUTPUT);

// Print first 15 rows for inspection
console.log('\n══ FIRST 15 ROWS OF OUTPUT ══');
const printHeader = ['Date','Day','Sales','Cost','Photo','Total Sale','Cash','Card','Online','Cheq','Credit','GP','Status'];
console.log(printHeader.join(' | '));
console.log(printHeader.map(h => '-'.repeat(h.length)).join('-+-'));
dataRows.slice(0, 15).forEach(r => {
  const cols = [r[0],r[1],r[2].slice(0,3),r[3].slice(0,3),r[4].slice(0,3),
    r[5]||'-',r[6]||'-',r[7]||'-',r[8]||'-',r[9]||'-',r[10]||'-',r[11]||'-',r[15]];
  console.log(cols.join(' | '));
});
console.log('\n══ STATUS SUMMARY ══');
Object.entries(statCount).sort((a,b)=>b[1]-a[1]).forEach(([s,n]) => console.log(` ${s}: ${n} days`));
