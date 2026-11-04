'use strict';
/**
 * Diagnostic: checks two GP data quality issues — no modifications to build output.
 * 1. Double-count detection for 2026-05-12 and 2026-05-15
 * 2. GP_COST_MISSING analysis for 2025-12-24
 */

const XLSX   = require('xlsx');
const fs     = require('fs');
const path   = require('path');
const SOURCE = 'C:/Users/DELL/Desktop/complet till 17-06-2026';

function parseDate(val) {
  if (val == null || val === '') return null;
  if (typeof val === 'number' && val > 40000 && val < 60000) {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    const y = d.getUTCFullYear(), m = d.getUTCMonth()+1, day = d.getUTCDate();
    if (y >= 2020 && y <= 2035) return `${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    return null;
  }
  const s = String(val).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return s;
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  return null;
}

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
 * Returns per-date GP contribution from one RepSalesAnalysis file.
 * { date → { gp, rows, zeroCostRows, zeroCostSalesAmt, totalSalesAmt } }
 */
function extractGPPerDate(filePath) {
  const base = path.basename(filePath);
  let wb;
  try { wb = XLSX.readFile(filePath, { sheetRows: 10000 }); }
  catch (e) { return { error: e.message }; }

  const ws      = wb.Sheets[wb.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  // Detect header date
  let headerDate = null, isRange = false;
  for (let i = 0; i < Math.min(rawRows.length, 5); i++) {
    for (const cell of rawRows[i]) {
      const s = String(cell);
      if (!/DATE:/i.test(s)) continue;
      if (/Through/i.test(s)) { isRange = true; }
      else {
        const mm = s.match(/DATE:\s*(\d{4}-\d{2}-\d{2})/i);
        if (mm) headerDate = mm[1];
      }
      break;
    }
    if (headerDate || isRange) break;
  }

  // Find column headers
  let hdrIdx = -1, hdr = [];
  for (let i = 0; i < Math.min(rawRows.length, 8); i++) {
    const upper = rawRows[i].map(v => String(v).trim().toUpperCase());
    if (upper.includes('NETPRO') || upper.includes('U-COST')) {
      hdrIdx = i; hdr = upper; break;
    }
  }
  if (hdrIdx < 0) return { headerDate, isRange, format: 'NO_HEADERS', byDate: {} };

  const iNetPro = hdr.indexOf('NETPRO');
  const iUCost  = hdr.indexOf('U-COST');
  const iUPrice = hdr.indexOf('U-PRICE');
  const iQty    = hdr.indexOf('QTY');
  const iDate   = hdr.indexOf('DATE');

  const format = iNetPro >= 0 ? 'NETPRO' : (iUCost >= 0 && iDate >= 0 ? 'UCOST+DATE' : iUCost >= 0 ? 'UCOST_NODATE' : 'UNKNOWN');
  const byDate = {};

  function getDay(d) {
    if (!byDate[d]) byDate[d] = { gp: 0, rowCount: 0, zeroCostRows: 0, zeroCostSalesAmt: 0, totalSalesAmt: 0 };
    return byDate[d];
  }

  if (iNetPro >= 0) {
    if (isRange || !headerDate) return { headerDate, isRange, format, byDate };
    const day = getDay(headerDate);
    for (let i = hdrIdx + 1; i < rawRows.length; i++) {
      const v = parseFloat(rawRows[i][iNetPro]) || 0;
      if (v !== 0) { day.gp += v; day.rowCount++; }
    }
  } else if (iUCost >= 0 && iUPrice >= 0 && iQty >= 0) {
    if (iDate >= 0) {
      for (let i = hdrIdx + 1; i < rawRows.length; i++) {
        const row     = rawRows[i];
        const dateVal = row[iDate];
        if (dateVal === '') continue;
        const rowDate = isRange ? parseDate(dateVal) : (headerDate || parseDate(dateVal));
        if (!rowDate) continue;
        const qty    = parseFloat(row[iQty])    || 0;
        const ucost  = parseFloat(row[iUCost])  || 0;
        const uprice = parseFloat(row[iUPrice]) || 0;
        if (qty === 0 && ucost === 0 && uprice === 0) continue;
        const itemGP   = (uprice - ucost) * qty;
        const itemSale = uprice * qty;
        const day = getDay(rowDate);
        day.gp           += itemGP;
        day.totalSalesAmt += itemSale;
        day.rowCount++;
        if (ucost === 0) {
          day.zeroCostRows++;
          day.zeroCostSalesAmt += itemSale;
        }
      }
    } else {
      if (isRange || !headerDate) return { headerDate, isRange, format, byDate };
      const day = getDay(headerDate);
      for (let i = hdrIdx + 1; i < rawRows.length; i++) {
        const row    = rawRows[i];
        const qty    = parseFloat(row[iQty])    || 0;
        const ucost  = parseFloat(row[iUCost])  || 0;
        const uprice = parseFloat(row[iUPrice]) || 0;
        if (qty === 0 && ucost === 0 && uprice === 0) continue;
        const itemGP   = (uprice - ucost) * qty;
        const itemSale = uprice * qty;
        day.gp           += itemGP;
        day.totalSalesAmt += itemSale;
        day.rowCount++;
        if (ucost === 0) {
          day.zeroCostRows++;
          day.zeroCostSalesAmt += itemSale;
        }
      }
    }
  }

  return { headerDate, isRange, format, byDate };
}

// ── Run diagnostics ────────────────────────────────────────────────────────────
const allRepFiles = walkRepSalesAnalysis(SOURCE);
console.log(`Found ${allRepFiles.length} RepSalesAnalysis files.\n`);

// Extract GP per date from every file
const fileResults = {};
for (const f of allRepFiles) {
  fileResults[path.basename(f)] = { path: f, ...extractGPPerDate(f) };
}

// ════════════════════════════════════════════════════════════════════════════════
// CHECK 1: Double-count detection for 2026-05-12 and 2026-05-15
// ════════════════════════════════════════════════════════════════════════════════
const CHECK_DATES = ['2026-05-12', '2026-05-15'];
console.log('════════════════════════════════════════════════════════════════════════');
console.log(' CHECK 1 — Double-count detection');
console.log('════════════════════════════════════════════════════════════════════════');

let anyDoubleCount = false;

for (const checkDate of CHECK_DATES) {
  const contributors = [];
  for (const [fname, result] of Object.entries(fileResults)) {
    if (result.byDate && result.byDate[checkDate]) {
      contributors.push({ fname, gp: result.byDate[checkDate].gp, rows: result.byDate[checkDate].rowCount, format: result.format, isRange: result.isRange });
    }
  }

  console.log(`\nDate: ${checkDate}`);
  if (contributors.length === 0) {
    console.log('  No RepSalesAnalysis files contributed GP for this date.');
    continue;
  }
  if (contributors.length === 1) {
    const c = contributors[0];
    console.log(`  Single source — no double-count.`);
    console.log(`  File: ${c.fname} (format=${c.format}, range=${c.isRange})`);
    console.log(`  GP: ${c.gp.toFixed(2)}  |  Rows: ${c.rows}`);
    continue;
  }

  // Multiple contributors
  const totalGP = contributors.reduce((s, c) => s + c.gp, 0);
  console.log(`  *** ${contributors.length} files contributed — potential double-count ***`);
  contributors.forEach(c => {
    console.log(`  File: ${c.fname}`);
    console.log(`    Format: ${c.format}, Range: ${c.isRange}, GP: ${c.gp.toFixed(2)}, Rows: ${c.rows}`);
  });
  console.log(`  Combined (summed) GP in build output: ${totalGP.toFixed(2)}`);
  console.log(`  If only one source should be used, over-count = ${(totalGP - Math.max(...contributors.map(c=>c.gp))).toFixed(2)}`);
  anyDoubleCount = true;
}

// ════════════════════════════════════════════════════════════════════════════════
// CHECK 2: GP_COST_MISSING analysis for 2025-12-24
// ════════════════════════════════════════════════════════════════════════════════
console.log('\n\n════════════════════════════════════════════════════════════════════════');
console.log(' CHECK 2 — GP_COST_MISSING analysis for 2025-12-24');
console.log('════════════════════════════════════════════════════════════════════════');

const dec24 = '2025-12-24';
const dec24Sources = [];
for (const [fname, result] of Object.entries(fileResults)) {
  if (result.byDate && result.byDate[dec24]) {
    dec24Sources.push({ fname, ...result.byDate[dec24], format: result.format, isRange: result.isRange });
  }
}

if (dec24Sources.length === 0) {
  console.log('\n  No RepSalesAnalysis files found with data for 2025-12-24.');
} else {
  for (const src of dec24Sources) {
    console.log(`\nSource file: ${src.fname}`);
    console.log(`  Format: ${src.format}, Range: ${src.isRange}`);
    console.log(`  Total rows for this date:    ${src.rowCount}`);
    console.log(`  Rows with U-COST = 0:        ${src.zeroCostRows}`);
    console.log(`  Rows with cost entered:      ${src.rowCount - src.zeroCostRows}`);
    if (src.totalSalesAmt > 0) {
      const zeroPct = (src.zeroCostSalesAmt / src.totalSalesAmt * 100).toFixed(1);
      console.log(`  Sales amount (U-PRICE×QTY) for zero-cost items: ${src.zeroCostSalesAmt.toFixed(2)}`);
      console.log(`  Total sales amount (all items): ${src.totalSalesAmt.toFixed(2)}`);
      console.log(`  Zero-cost items as % of day's total sales: ${zeroPct}%`);
    }
    console.log(`  Reported GP (as built): ${src.gp.toFixed(2)}`);
    if (src.zeroCostRows > 0) {
      const gpFromCostedItems = src.gp - src.zeroCostSalesAmt;
      console.log(`  ⚠  GP includes ${src.zeroCostRows} items with U-COST=0 — their "GP" is actually selling price`);
      console.log(`  True GP (costed items only): ~${gpFromCostedItems.toFixed(2)}`);
    } else {
      console.log(`  ✓ All items have cost data — GP of ${src.gp.toFixed(2)} appears reliable.`);
    }
  }
}

// ── Final verdict ──────────────────────────────────────────────────────────────
console.log('\n\n════════════════════════════════════════════════════════════════════════');
console.log(' VERDICT');
console.log('════════════════════════════════════════════════════════════════════════');
if (anyDoubleCount) {
  console.log(' CHECK 1: DOUBLE-COUNT DETECTED — re-run of build_master_data.js IS needed.');
  console.log('   Fix: for each date, accept GP only from the first file that provided it.');
  console.log('   Files that arrive later for the same date should be skipped.');
} else {
  console.log(' CHECK 1: No double-count — May 12 and May 15 each had a single GP source.');
}
console.log('\n See CHECK 2 output above for Dec 24 GP reliability assessment.');
