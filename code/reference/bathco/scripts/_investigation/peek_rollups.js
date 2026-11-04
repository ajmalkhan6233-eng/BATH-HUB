const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const files = [
  'C:/Users/DELL/Desktop/complet till 17-06-2026/1122/DALY SALES REPORT - Copy.xlsx',
  'C:/Users/DELL/Desktop/complet till 17-06-2026/DALI/DALY SALES REPORT.xlsx',
  'C:/Users/DELL/Desktop/complet till 17-06-2026/DALI/DALY SALES 1/New folder (3)/DALY SALES REPORT.xlsx',
  'C:/Users/DELL/Desktop/complet till 17-06-2026/DAY SALE/MASTER COPY - Copy - Copy.xlsx',
  'C:/Users/DELL/Desktop/complet till 17-06-2026/DAY SALE/04-26/DALY SALES REPORT 01-01-2026 TO 04-26.xlsx',
  'C:/Users/DELL/Desktop/complet till 17-06-2026/1122/DAY SALE/14-06-2026.xlsx',
];

for (const f of files) {
  try {
    const wb = XLSX.readFile(f, { sheetRows: 15 });
    const sheetName = wb.SheetNames.includes('Sheet1') ? 'Sheet1' : wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    const label = f.split('/').slice(-2).join('/');
    console.log('\n=== ' + label);
    console.log('Sheets:', wb.SheetNames.join(', '));
    rows.filter(r => r.some(c => c !== '')).slice(0, 8).forEach((r, i) => {
      console.log('  Row' + i + ':', JSON.stringify(r.slice(0, 8)));
    });
  } catch(e) {
    console.log('\n=== ' + f.split('/').pop() + ' ERROR:', e.message);
  }
}

// Also check what dates the 1122 rollup covers by scanning column A
try {
  const wb = XLSX.readFile('C:/Users/DELL/Desktop/complet till 17-06-2026/1122/DALY SALES REPORT - Copy.xlsx', { sheetRows: 400 });
  const ws = wb.Sheets[wb.SheetNames.find(s => s.toLowerCase().includes('sheet')) || wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const dates = rows.map(r => r[0]).filter(v => v && /\d{2}/.test(String(v))).slice(0, 5);
  const lastDates = rows.map(r => r[0]).filter(v => v && /\d{2}/.test(String(v))).slice(-5);
  console.log('\n1122 rollup — first dates:', dates);
  console.log('1122 rollup — last dates:', lastDates);
} catch(e) { console.log('rollup scan error:', e.message); }
