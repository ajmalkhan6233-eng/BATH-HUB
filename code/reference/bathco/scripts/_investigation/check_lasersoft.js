const XLSX = require('xlsx');
const fs = require('fs');

const toCheck = [
  'C:/Users/DELL/Desktop/complet till 17-06-2026/1122/RepSalesAnalysis_260615012014.xlsx',
  'C:/Users/DELL/Desktop/complet till 17-06-2026/1122/RepSalesAnalysis_260618045436.xlsx',
  'C:/Users/DELL/Desktop/complet till 17-06-2026/1122/TILL 27TH 05.26/RepSalesAnalysis_260527060012.xlsx',
  'C:/Users/DELL/Desktop/complet till 17-06-2026/1122/TILL 27TH 05.26/RepSalesAnalysis_260527060433.xlsx',
  'C:/Users/DELL/Desktop/complet till 17-06-2026/1122/TILL 27TH 05.26/RepSalesAnalysis_260527061812.xlsx',
  'C:/Users/DELL/Desktop/complet till 17-06-2026/1122/TILL 27TH 05.26/T SALE.xlsx',
  'C:/Users/DELL/Desktop/complet till 17-06-2026/1122/TILL 27TH 05.26/DALY SALES REPORT.xlsx',
  'C:/Users/DELL/Desktop/complet till 17-06-2026/1122/Sales Accounts.xlsx',
  'C:/Users/DELL/Desktop/complet till 17-06-2026/DAY SALE/16-06-2026.xlsx',
];

for (const f of toCheck) {
  if (!fs.existsSync(f)) { console.log('\n=== ' + f.split('/').pop() + ' → NOT FOUND'); continue; }
  try {
    const wb = XLSX.readFile(f, { sheetRows: 10 });
    console.log('\n=== ' + f.split('/').slice(-2).join('/'));
    console.log('Sheets:', wb.SheetNames.join(', '));
    for (const sn of wb.SheetNames.slice(0, 2)) {
      const ws = wb.Sheets[sn];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      const nonEmpty = rows.filter(r => r.some(c => c !== '')).slice(0, 6);
      console.log(' [' + sn + ']');
      nonEmpty.forEach((r, i) => console.log('  Row' + i + ':', JSON.stringify(r.slice(0, 10))));
    }
  } catch(e) { console.log('\n=== ' + f.split('/').pop() + ' ERROR:', e.message); }
}
