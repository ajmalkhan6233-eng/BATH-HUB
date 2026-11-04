'use strict';
// Turns a report (utils/documents/reports.js) into a CSV text or a PDF (headless Chromium, already installed for receipts).
// PDF: page 1 = header (logo, shop, report name, period) + the summary; the table follows on the next page(s).
// Numbers use tabular figures; money is shown as "Rs 1,234,567.00". CSV has plain numbers (no Rs, no commas) so spreadsheets can add them up.
const fs = require('fs');
const path = require('path');
const { csvCell } = require('../csv');
const { rs, int, qty, esc, num } = require('./format');
const lk = require('../lkTime');

const ROOT = path.join(__dirname, '..', '..');
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };

// Shop name + logo (as a data URI so the PDF needs no network). Never throws: no logo = text header only.
function branding(root = ROOT) {
    let cfg = {};
    try { cfg = JSON.parse(fs.readFileSync(path.join(root, 'config', 'active.branding.json'), 'utf8')); } catch (e) { /* default */ }
    const pub = path.join(root, 'public');
    const candidates = [];
    if (cfg.logo_url && String(cfg.logo_url).startsWith('/')) candidates.push(path.join(pub, String(cfg.logo_url).split('?')[0]));
    candidates.push(path.join(pub, 'brand', 'logo-main-transparent.png'), path.join(pub, 'vendor', 'logo.svg'));
    let logo = '';
    for (const c of candidates) {
        const full = path.resolve(c);
        if (!full.startsWith(path.resolve(pub) + path.sep) || !MIME[path.extname(full).toLowerCase()]) continue;
        try { logo = `data:${MIME[path.extname(full).toLowerCase()]};base64,${fs.readFileSync(full).toString('base64')}`; break; } catch (e) { /* next */ }
    }
    return { name: cfg.company_name || 'Royal Bath Hub', tagline: cfg.tagline || '', logo };
}

const cell = (type, v) => {
    if (v === undefined || v === null || v === '') return '';
    if (type === 'money') return rs(v);
    if (type === 'int') return int(v);
    if (type === 'qty') return qty(v);
    return String(v);
};
const isNum = t => t === 'money' || t === 'int' || t === 'qty';

function toCsv(report) {
    const lines = [];
    lines.push(report.columns.map(c => csvCell(c.label, true)).join(','));
    const plain = (c, v) => {
        if (v === undefined || v === null || v === '') return csvCell('');
        if (c.type === 'money') return csvCell(num(v).toFixed(2));
        if (isNum(c.type)) return csvCell(num(v));
        return csvCell(v, true);
    };
    for (const r of report.rows) lines.push(report.columns.map(c => plain(c, r[c.key])).join(','));
    if (report.total) lines.push(report.columns.map((c, i) => (i === 0 && report.total[c.key] === undefined ? csvCell('Total', true) : plain(c, report.total[c.key]))).join(','));
    return '﻿' + lines.join('\r\n') + '\r\n';
}

const CSS = `
@page { size: A4 PORTRAIT; margin: 16mm 12mm 18mm 12mm; }
* { box-sizing: border-box; }
body { font-family: "Segoe UI", Arial, Helvetica, sans-serif; color: #201c16; font-size: 10.5pt; margin: 0; font-variant-numeric: tabular-nums; }
.num, td.n, th.n { font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; text-align: right; white-space: nowrap; }
.head { display: flex; align-items: center; gap: 14px; border-bottom: 3px solid #0a4531; padding-bottom: 10px; }
.head img { height: 56px; max-width: 160px; object-fit: contain; }
.head .shop { font-size: 17pt; font-weight: 700; color: #0a4531; }
.head .tag { font-size: 9pt; color: #5c4033; }
h1 { font-size: 20pt; margin: 18px 0 2px; color: #062e21; }
.period { font-size: 11.5pt; color: #5c4033; margin-bottom: 16px; }
.cards { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.card { border: 1px solid #d8d0bd; border-left: 4px solid #c9a227; border-radius: 4px; padding: 9px 12px; background: #f7f4ec; break-inside: avoid; }
.card .l { font-size: 9pt; color: #5c4033; }
.card .v { font-size: 14pt; font-weight: 700; margin-top: 2px; font-variant-numeric: tabular-nums; }
.notes { margin-top: 18px; font-size: 9pt; color: #5c4033; }
.notes li { margin-bottom: 3px; }
.gen { margin-top: 22px; font-size: 8.5pt; color: #8b6f47; }
.pb { break-before: page; }
h2 { font-size: 13pt; color: #0a4531; margin: 0 0 8px; }
table { width: 100%; border-collapse: collapse; font-size: 9pt; }
thead { display: table-header-group; }
th { background: #0a4531; color: #fff; text-align: left; padding: 5px 6px; font-weight: 600; }
td { padding: 4px 6px; border-bottom: 1px solid #e2dccb; vertical-align: top; }
tr { break-inside: avoid; }
tbody tr:nth-child(even) td { background: #faf8f2; }
tr.total td { font-weight: 700; border-top: 2px solid #0a4531; background: #efe9dc; }
.empty { padding: 24px; text-align: center; color: #8b6f47; border: 1px dashed #d8d0bd; border-radius: 6px; }
`;

function toHtml(report, brand = branding(), now = new Date()) {
    const wide = report.columns.length > 6;
    const gen = `${lk.todayLK(now)} ${new Intl.DateTimeFormat('en-GB', { timeZone: lk.TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(now)}`;
    const cards = report.summary.map(s => `<div class="card"><div class="l">${esc(s.label)}</div><div class="v">${esc(cell(s.type, s.value))}</div></div>`).join('');
    const notes = (report.notes || []).length ? `<ul class="notes">${report.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : '';
    const head = report.columns.map(c => `<th class="${isNum(c.type) ? 'n' : ''}">${esc(c.label)}</th>`).join('');
    const body = report.rows.map(r => `<tr>${report.columns.map(c => `<td class="${isNum(c.type) ? 'n' : ''}">${esc(cell(c.type, r[c.key]))}</td>`).join('')}</tr>`).join('');
    const tot = report.total ? `<tr class="total">${report.columns.map((c, i) => `<td class="${isNum(c.type) ? 'n' : ''}">${esc(i === 0 && report.total[c.key] === undefined ? 'Total' : cell(c.type, report.total[c.key]))}</td>`).join('')}</tr>` : '';
    const table = report.rows.length
        ? `<table><thead><tr>${head}</tr></thead><tbody>${body}${tot}</tbody></table>`
        : `<div class="empty">No records in this period.</div>`;
    return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(report.title)} ${esc(report.period)}</title><style>${CSS}${wide ? '@page { size: A4 LANDSCAPE; }' : ''}</style></head><body>
<div class="head">${brand.logo ? `<img src="${brand.logo}" alt="">` : ''}<div><div class="shop">${esc(brand.name)}</div>${brand.tagline ? `<div class="tag">${esc(brand.tagline)}</div>` : ''}</div></div>
<h1>${esc(report.title)}</h1><div class="period">Period: ${esc(report.period)}</div>
<div class="cards">${cards}</div>${notes}
<div class="gen">Made on ${esc(gen)} (Sri Lanka time).</div>
<div class="pb"><h2>${esc(report.title)}: details</h2>${table}</div>
</body></html>`;
}

let chain = Promise.resolve();   // one Chromium at a time: easy on a small laptop
function toPdf(html, { landscape = false, footerText = '' } = {}) {
    const run = chain.then(() => doPdf(html, landscape, footerText));
    chain = run.catch(() => {});
    return run;
}
async function doPdf(html, landscape, footerText) {
    const puppeteer = require('puppeteer');
    let exe; try { exe = puppeteer.executablePath(); if (exe && !fs.existsSync(exe)) exe = undefined; } catch (e) { exe = undefined; }
    const browser = await puppeteer.launch({ headless: true, executablePath: exe, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'load' });
        const buf = await page.pdf({
            format: 'A4', landscape, printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true, headerTemplate: '<span></span>',
            footerTemplate: `<div style="width:100%;font-size:8px;color:#8b6f47;padding:0 12mm;display:flex;justify-content:space-between;font-family:Arial"><span>${esc(footerText)}</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
        });
        return Buffer.from(buf);
    } finally { await browser.close().catch(() => {}); }
}

async function makePdf(report, opts = {}) {
    const brand = opts.brand || branding();
    const wide = report.columns.length > 6;
    return (opts.toPdf || toPdf)(toHtml(report, brand, opts.now), { landscape: wide, footerText: `${brand.name}  |  ${report.title}  |  ${report.period}` });
}

module.exports = { branding, toCsv, toHtml, toPdf, makePdf };
