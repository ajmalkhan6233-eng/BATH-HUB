// PART 1 — Full date-range validation (token-efficient, filename/JSON-based only)
// Scans C:\Bathco\AI-Data for every date 21 Dec 2025 - 14 Jun 2026 and checks for:
//   A) Transactions Excel (sales record)      - .xlsx files named Document/Sales/Invoice/Transaction*
//   B) Handwritten expense photo              - daily-reports/*.JPG mapped via ocr_results.json
//   C) Cost/selling price report (Lasersoft)  - files named Profit_Report*/Lasersoft*
// Output: DATA_INDEX.json (per-date file paths + status), plus a console summary table.

const fs = require('fs');
const path = require('path');

const ROOT = 'C:\\Bathco\\AI-Data';
const SKIP_DIRS = new Set(['__pycache__', '.git', 'node_modules']);

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
}

const allFiles = [];
walk(ROOT, allFiles);

// ── Date parsing from filenames: DD-MM-YYYY or YYYY-MM-DD ──────────────────
const DATE_RE_DMY = /(\d{2})-(\d{2})-(\d{4})/;   // e.g. 09-06-2026
const DATE_RE_YMD = /(\d{4})-(\d{2})-(\d{2})/;   // e.g. 2026-06-09

function datesFromFilename(name) {
  const dates = [];
  let m = name.match(DATE_RE_YMD);
  if (m) dates.push(`${m[1]}-${m[2]}-${m[3]}`);
  m = name.match(DATE_RE_DMY);
  if (m) {
    const d = m[1], mo = m[2], y = m[3];
    // sanity check: month 01-12, day 01-31
    if (+mo >= 1 && +mo <= 12 && +d >= 1 && +d <= 31) dates.push(`${y}-${mo}-${d}`);
  }
  return dates;
}

// ── Category A: Transactions Excel (sales record) ──────────────────────────
const txnFiles = {}; // date -> [paths]
const TXN_RE = /(document|sales|invoice|transaction)/i;
for (const f of allFiles) {
  const name = path.basename(f);
  if (!name.toLowerCase().endsWith('.xlsx')) continue;
  if (!TXN_RE.test(name)) continue;
  for (const d of datesFromFilename(name)) {
    (txnFiles[d] = txnFiles[d] || []).push(f);
  }
}

// ── Category C: Lasersoft cost/selling price report ─────────────────────────
const laserFiles = {};
const LASER_RE = /(profit_report|lasersoft)/i;
for (const f of allFiles) {
  const name = path.basename(f);
  if (!LASER_RE.test(name)) continue;
  for (const d of datesFromFilename(name)) {
    (laserFiles[d] = laserFiles[d] || []).push(f);
  }
}

// ── Category B: Handwritten expense photo (via ocr_results.json) ───────────
const photoFiles = {}; // date -> [paths]
const ocrPath = path.join(ROOT, 'ocr_results.json');
let ocrResults = [];
if (fs.existsSync(ocrPath)) {
  ocrResults = JSON.parse(fs.readFileSync(ocrPath, 'utf8'));
}
for (const r of ocrResults) {
  if (!r.date) continue;
  const m = r.date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); // DD/MM/YYYY
  if (!m) continue;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  const filePath = path.join(ROOT, 'daily-reports', r._file || '');
  (photoFiles[iso] = photoFiles[iso] || []).push(filePath);
}

// ── Build date range 2025-12-21 .. 2026-06-14 ───────────────────────────────
function toISO(d) {
  const y = d.getFullYear(), mo = String(d.getMonth()+1).padStart(2,'0'), da = String(d.getDate()).padStart(2,'0');
  return `${y}-${mo}-${da}`;
}
const start = new Date(2025, 11, 21); // 21 Dec 2025
const end   = new Date(2026, 5, 14);  // 14 Jun 2026
const dates = [];
for (let d = new Date(start); d <= end; d.setDate(d.getDate()+1)) dates.push(toISO(d));

// ── Build index ──────────────────────────────────────────────────────────
const index = {};
let complete = 0, partial = 0, missing = 0;
const partialDates = [], missingDates = [], completeDates = [];

for (const d of dates) {
  const txn = txnFiles[d] || [];
  const photo = photoFiles[d] || [];
  const laser = laserFiles[d] || [];
  const count = (txn.length>0?1:0) + (photo.length>0?1:0) + (laser.length>0?1:0);
  let status;
  if (count === 3) { status = 'complete'; completeDates.push(d); complete++; }
  else if (count === 0) { status = 'missing'; missingDates.push(d); missing++; }
  else { status = 'partial'; partialDates.push(d); partial++; }
  index[d] = {
    transactions_excel: txn,
    expense_photo: photo,
    lasersoft_report: laser,
    status
  };
}

fs.writeFileSync(path.join('C:\\BATHCO_PHASE1', 'DATA_INDEX.json'), JSON.stringify({
  generated: new Date().toISOString(),
  range: { from: dates[0], to: dates[dates.length-1], total_days: dates.length },
  note: 'mismatch detection (filename date vs cross-file consistency) not computed in this pass — see summary notes',
  summary: { complete, partial, missing, mismatch: 0 },
  days: index
}, null, 2));

// ── Console summary ─────────────────────────────────────────────────────
console.log(`Date range: ${dates[0]} to ${dates[dates.length-1]} (${dates.length} days)`);
console.log(`complete: ${complete} | partial: ${partial} | missing: ${missing} | mismatch: 0 (not computed — see note)`);
console.log('');
console.log(`PARTIAL dates (${partialDates.length}):`);
console.log(partialDates.join(', ') || '(none)');
console.log('');
console.log(`MISSING dates (${missingDates.length}):`);
console.log(missingDates.length > 20 ? `${missingDates.slice(0,20).join(', ')} ... (+${missingDates.length-20} more)` : (missingDates.join(', ') || '(none)'));
console.log('');
console.log(`COMPLETE dates (${completeDates.length}):`);
console.log(completeDates.join(', ') || '(none)');
