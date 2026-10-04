const XLSX = require('xlsx');

const files = [
  'C:/Users/DELL/Desktop/complet till 17-06-2026/DAY SALE/01-06-2026.xlsx',
  'C:/Users/DELL/Desktop/complet till 17-06-2026/DAY SALE/05/01-05-2026.xlsx',
  'C:/Users/DELL/Desktop/complet till 17-06-2026/DAY SALE/04-26/18-04-2026.xlsx',
  'C:/Users/DELL/Desktop/complet till 17-06-2026/DALI/DALY SALES REPORT.xlsx',
  'C:/Users/DELL/Desktop/complet till 17-06-2026/DALI/24-05-2026.xlsx',
  'C:/Users/DELL/Desktop/complet till 17-06-2026/DALI/DALY SALES 1/01.02.26.xlsx',
  'C:/Users/DELL/Desktop/complet till 17-06-2026/1122/DALY SALES REPORT - Copy.xlsx',
];

for (const f of files) {
  try {
    const wb = XLSX.readFile(f, { sheetRows: 6 });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    console.log('\n=== ' + f.split('/').slice(-2).join('/'));
    console.log('Sheets:', wb.SheetNames.join(', '));
    rows.slice(0, 4).forEach((r, i) => console.log('  Row' + i + ':', JSON.stringify(r.slice(0, 10))));
  } catch(e) {
    console.log('\n=== ' + f.split('/').slice(-1)[0] + ' ERROR:', e.message);
  }
}
