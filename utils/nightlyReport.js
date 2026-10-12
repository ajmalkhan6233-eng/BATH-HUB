'use strict';
/**
 * Quick win 3: nightly report (after 21:00 Sri Lanka): sales, expenses, net profit as short text + a PDF.
 * The text goes through the notify queue, so the owner reads it in the ONE 06:00 message (rule 11). Money data: owner only.
 * Uses daily_summary for the day; if nobody entered it yet, falls back to the day's POS bills (sales only, marked).
 */
const fs = require('fs');
const path = require('path');
const rs = (n) => 'Rs ' + Number(n || 0).toLocaleString('en-LK', { maximumFractionDigits: 0 });

async function dayFigures(pool, day) {
  const d = (await pool.query(`SELECT COALESCE(SUM(total_sale),0) AS s, COALESCE(SUM(gross_profit),0) AS gp, COALESCE(SUM(total_expenses),0) AS e, COUNT(*) AS n FROM daily_summary WHERE report_date = $1`, [day])).rows[0];
  if (Number(d.n) > 0) return { sales: Number(d.s), gp: Number(d.gp), exp: Number(d.e), source: 'daily summary' };
  const b = (await pool.query(`SELECT COALESCE(SUM(b.total),0) AS s FROM pos_bills b WHERE b.created_at::date = $1 AND NOT EXISTS (SELECT 1 FROM pos_bill_voids v WHERE v.bill_id = b.id)`, [day])).rows[0];
  return { sales: Number(b.s), gp: null, exp: null, source: 'POS bills (daily summary not entered yet)' };
}
function reportText(day, f) {
  const net = f.gp == null ? null : f.gp - f.exp;
  return `NIGHTLY REPORT ${day}\nSales ${rs(f.sales)}${f.exp == null ? '' : `, expenses ${rs(f.exp)}, net profit ${rs(net)} (gross profit ${rs(f.gp)} minus expenses)`}.\nSource: ${f.source}.`;
}
async function makePdf(day, f, outDir) {
  const PDFDocument = require('pdfkit'); fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `nightly_${day}.pdf`);
  await new Promise((ok, bad) => {
    const doc = new PDFDocument({ margin: 40 }), s = fs.createWriteStream(file); doc.pipe(s); s.on('finish', ok); s.on('error', bad);
    reportText(day, f).split('\n').forEach((l, i) => doc.fontSize(i ? 11 : 16).text(l).moveDown(0.5)); doc.end();
  });
  return file;
}
async function once(pool, job, day) {
  await pool.query(`CREATE TABLE IF NOT EXISTS automation_runs (job TEXT NOT NULL, day DATE NOT NULL, PRIMARY KEY (job, day))`);
  return (await pool.query(`INSERT INTO automation_runs (job, day) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING job`, [job, day])).rows.length > 0;
}
/** Call every ~30 min. Runs once per Sri Lanka day, from 21:00. */
async function runNightly({ pool, enqueue, now = new Date(), outDir = path.join(process.cwd(), 'uploads', 'reports') }) {
  const sl = new Date(now.getTime() + 5.5 * 3600e3), day = sl.toISOString().slice(0, 10);
  if (sl.getUTCHours() < 21) return { done: false };
  if (!(await once(pool, 'nightly_report', day))) return { done: false };
  const f = await dayFigures(pool, day), pdf = await makePdf(day, f, outDir);
  await enqueue(`${reportText(day, f)}\nPDF: ${pdf}`, 'nightly');
  return { done: true, pdf };
}
module.exports = { runNightly, reportText, dayFigures, makePdf };
