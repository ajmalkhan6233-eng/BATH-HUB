const XLSX = require('xlsx');
const fs = require('fs');

const toCheck = [
  // DALI format file
  'C:/Users/DELL/Desktop/complet till 17-06-2026/DALI/24-05-2026.xlsx',
  // AI-named or unknown reports
  'C:/Users/DELL/Desktop/complet till 17-06-2026/DALI/Daily_Report_13-05-2026.xlsx',
  'C:/Users/DELL/Desktop/complet till 17-06-2026/DALI/1st_Choice_Bathco_13May2026_Report.xlsx',
  'C:/Users/DELL/Desktop/complet till 17-06-2026/DALI/BATHCO_SIMPLE_REPORT.xlsx',
  // June 15-17
  'C:/Users/DELL/Desktop/complet till 17-06-2026/1122/DAY SALE/15-06-2026.xlsx',
  'C:/Users/DELL/Desktop/complet till 17-06-2026/1122/DAY SALE/16-06-2026.xlsx',
  'C:/Users/DELL/Desktop/complet till 17-06-2026/1122/DAY SALE/17-06-2026.xlsx',
];

for (const f of toCheck) {
  if (!fs.existsSync(f)) { console.log('\n=== ' + f.split('/').pop() + ' → NOT FOUND'); continue; }
  try {
    const wb = XLSX.readFile(f, { sheetRows: 8 });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    console.log('\n=== ' + f.split('/').slice(-2).join('/'));
    console.log('Sheets:', wb.SheetNames.join(', '));
    rows.filter(r => r.some(c => c !== '')).slice(0, 5).forEach((r, i) => {
      console.log('  Row' + i + ':', JSON.stringify(r.slice(0, 9)));
    });
  } catch(e) { console.log('\n=== ' + f.split('/').pop() + ' ERROR:', e.message); }
}

// Count all xlsx files in the source folder (non-temp, non-Transfer)
const { execSync } = require('child_process');
const cmd = 'powershell -Command "Get-ChildItem -Path \\"C:/Users/DELL/Desktop/complet till 17-06-2026\\" -Recurse -Filter *.xlsx | Where-Object { $_.Name -notlike \'~$*\' -and $_.FullName -notlike \'*\\\\Transfer\\\\*\' } | Select-Object FullName | Format-Table -HideTableHeaders"';
try {
  const out = execSync(cmd, { encoding: 'utf8' }).trim();
  const lines = out.split('\n').map(l => l.trim()).filter(Boolean);
  console.log('\n\nAll xlsx files (' + lines.length + ' total):');
  lines.forEach(l => console.log(' ', l));
} catch(e) { console.log('File scan error:', e.message); }
