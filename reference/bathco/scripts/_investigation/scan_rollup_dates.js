const XLSX = require('xlsx');

// Read the big rollup and list all unique dates it covers
const wb = XLSX.readFile('C:/Users/DELL/Desktop/complet till 17-06-2026/1122/DALY SALES REPORT - Copy.xlsx', { sheetRows: 2000 });
const ws = wb.Sheets['Sheet1'] || wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

// Find the header row
let headerRow = 0;
for (let i = 0; i < rows.length; i++) {
  if (String(rows[i][0]).toUpperCase().includes('DATE')) { headerRow = i; break; }
}
console.log('Header at row:', headerRow, '→', rows[headerRow]);
console.log('Total rows:', rows.length);

// Collect unique dates from column 0
const datesSeen = new Set();
let currentDate = null;
for (let i = headerRow + 1; i < rows.length; i++) {
  const v = String(rows[i][0]).trim();
  if (v && v !== '') {
    // Try to parse as a date
    const m1 = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    const m2 = v.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (m1) currentDate = `${m1[3]}-${m1[2].padStart(2,'0')}-${m1[1].padStart(2,'0')}`;
    else if (m2) currentDate = `${m2[3]}-${m2[2].padStart(2,'0')}-${m2[1].padStart(2,'0')}`;
    else currentDate = v; // might be a non-date label
  }
  if (currentDate) datesSeen.add(currentDate);
}

const sortedDates = [...datesSeen].filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
console.log('\nDate range in rollup:');
console.log('  First:', sortedDates[0]);
console.log('  Last: ', sortedDates[sortedDates.length - 1]);
console.log('  Count:', sortedDates.length, 'unique dates');
console.log('  All dates:');
sortedDates.forEach(d => process.stdout.write(d + '  '));
console.log();
