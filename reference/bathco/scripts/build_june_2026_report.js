// Generates MASTER_LEDGER/JUNE_2026_REPORT.md + .xlsx from live daily_summary.
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const raw = fs.readFileSync('C:/Users/DELL/.claude/jobs/4206b815/tmp/june_days.txt', 'utf8').trim().split('\n');
const rows = raw.map(l => {
  const [date, sale, cash, card, online, cheque, credit, gp, exp, np, expSrc, gpStatus, dayStatus] = l.split('|');
  return {
    date, sale:+sale, cash:+cash, card:+card, online:+online, cheque:+cheque, credit:+credit,
    gp:+gp, exp:+exp, np: np==='' ? null : +np, expSrc, gpStatus, dayStatus,
  };
});

function confidence(r){
  if (r.gpStatus === 'NOT_AVAILABLE') return 'ESTIMATED';
  if (r.expSrc === 'DEFAULT_50000' || r.gpStatus === 'ESTIMATE') return 'PARTIAL';
  return 'COMPLETE';
}

const totals = rows.reduce((a,r) => ({
  sale:a.sale+r.sale, cash:a.cash+r.cash, card:a.card+r.card, online:a.online+r.online,
  cheque:a.cheque+r.cheque, credit:a.credit+r.credit, gp:a.gp+r.gp, exp:a.exp+r.exp,
}), {sale:0,cash:0,card:0,online:0,cheque:0,credit:0,gp:0,exp:0});
totals.np = totals.gp - totals.exp;

const tierCounts = { COMPLETE:0, PARTIAL:0, ESTIMATED:0 };
rows.forEach(r => tierCounts[confidence(r)]++);

const fmt = n => Number(n).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
const pct = n => (n/totals.sale*100).toFixed(1)+'%';

// ── MARKDOWN ──
const md = [];
md.push('# BATHCO June 2026 Report');
md.push('');
md.push(`Generated 2026-07-02 from live \`daily_summary\` Postgres table. Range: 2026-06-01 to 2026-06-30 (${rows.length}/30 days present).`);
md.push('');
md.push('## Summary');
md.push('');
md.push('| Metric | Amount (LKR) |');
md.push('|---|---:|');
md.push(`| Total Sale | ${fmt(totals.sale)} |`);
md.push(`| Total Gross Profit | ${fmt(totals.gp)} |`);
md.push(`| Total Expenses | ${fmt(totals.exp)} |`);
md.push(`| **Net Profit** | **${fmt(totals.np)}** |`);
md.push('');
md.push('## Payment Breakdown');
md.push('');
md.push('| Method | Amount (LKR) | % of Sale |');
md.push('|---|---:|---:|');
md.push(`| Cash | ${fmt(totals.cash)} | ${pct(totals.cash)} |`);
md.push(`| Card | ${fmt(totals.card)} | ${pct(totals.card)} |`);
md.push(`| Online | ${fmt(totals.online)} | ${pct(totals.online)} |`);
md.push(`| Cheque | ${fmt(totals.cheque)} | ${pct(totals.cheque)} |`);
md.push(`| Credit | ${fmt(totals.credit)} | ${pct(totals.credit)} |`);
md.push('');
md.push(`## Confidence: ${tierCounts.COMPLETE} COMPLETE / ${tierCounts.PARTIAL} PARTIAL / ${tierCounts.ESTIMATED} ESTIMATED`);
md.push('');
md.push('- **COMPLETE** = real sale + real (non-default) expense + real/ACTUAL gross profit');
md.push('- **PARTIAL** = real sale, but expense is the Rs 50,000 default and/or GP is estimated via monthly average');
md.push('- **ESTIMATED** = no real GP data at all for that day');
md.push('');
md.push('## Day-by-Day');
md.push('');
md.push('| Date | Total Sale | Cash | Card | Online | Cheque | Credit | Gross Profit | Expenses | Net Profit | Confidence |');
md.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|');
rows.forEach(r => {
  md.push(`| ${r.date} | ${fmt(r.sale)} | ${fmt(r.cash)} | ${fmt(r.card)} | ${fmt(r.online)} | ${fmt(r.cheque)} | ${fmt(r.credit)} | ${fmt(r.gp)} | ${fmt(r.exp)} | ${r.np===null?'PENDING':fmt(r.np)} | ${confidence(r)} |`);
});
md.push('');

fs.writeFileSync('C:/BATHCO_PHASE1/MASTER_LEDGER/JUNE_2026_REPORT.md', md.join('\n'));

// ── XLSX ──
const wb = XLSX.utils.book_new();
const summarySheet = XLSX.utils.aoa_to_sheet([
  ['BATHCO June 2026 Report', '', ''],
  ['Generated 2026-07-02', '', ''],
  [],
  ['Metric', 'Amount (LKR)'],
  ['Total Sale', totals.sale],
  ['Total Gross Profit', totals.gp],
  ['Total Expenses', totals.exp],
  ['Net Profit', totals.np],
  [],
  ['Payment Method', 'Amount (LKR)', '% of Sale'],
  ['Cash', totals.cash, totals.cash/totals.sale],
  ['Card', totals.card, totals.card/totals.sale],
  ['Online', totals.online, totals.online/totals.sale],
  ['Cheque', totals.cheque, totals.cheque/totals.sale],
  ['Credit', totals.credit, totals.credit/totals.sale],
  [],
  ['Confidence', 'Days'],
  ['COMPLETE', tierCounts.COMPLETE],
  ['PARTIAL', tierCounts.PARTIAL],
  ['ESTIMATED', tierCounts.ESTIMATED],
]);
XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

const dayHeader = ['Date','Total Sale','Cash','Card','Online','Cheque','Credit','Gross Profit','Expenses','Net Profit','Confidence'];
const dayRows = rows.map(r => [r.date, r.sale, r.cash, r.card, r.online, r.cheque, r.credit, r.gp, r.exp, r.np===null?'PENDING':r.np, confidence(r)]);
const daySheet = XLSX.utils.aoa_to_sheet([dayHeader, ...dayRows]);
XLSX.utils.book_append_sheet(wb, daySheet, 'Day-by-Day');

XLSX.writeFile(wb, 'C:/BATHCO_PHASE1/MASTER_LEDGER/JUNE_2026_REPORT.xlsx');

console.log('Written: MASTER_LEDGER/JUNE_2026_REPORT.md and .xlsx');
console.log(`Total Sale: ${fmt(totals.sale)} | GP: ${fmt(totals.gp)} | Exp: ${fmt(totals.exp)} | NP: ${fmt(totals.np)}`);
console.log(`Confidence: ${tierCounts.COMPLETE} COMPLETE / ${tierCounts.PARTIAL} PARTIAL / ${tierCounts.ESTIMATED} ESTIMATED`);
