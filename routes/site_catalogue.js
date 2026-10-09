'use strict';
// routes/site_catalogue.js (isolated module): search-engine and sharing extras for the public website.
//   GET /robots.txt               what crawlers may read (the website only; the owner app and the API stay private)
//   GET /sitemap.xml              the one public page
//   GET /site                     only when SITE_URL is set: the same page with absolute canonical / share-preview links
//   GET /api/site/catalogue.pdf   "Download catalogue": the VISIBLE tiles as a PDF. Public. No prices, no stock, no private data.
// No new tables. The PDF is cached on disk and made again only when the visible tile list changes.
// SITE_URL (optional, e.g. https://www.example.lk): the public address. Without it, links in the files stay relative.
const express = require('express');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const router = express.Router();
const ROOT = path.join(__dirname, '..');
const PAGE = path.join(ROOT, 'public', 'website', 'index.html');
const PHOTO_DIR = () => process.env.SITE_UPLOAD_DIR || path.join(ROOT, 'uploads', 'site');
const CACHE_DIR = () => process.env.SITE_CACHE_DIR || path.join(PHOTO_DIR(), 'catalogue-cache');
const FILE_RE = /^[a-f0-9]{24}\.(webp|jpg)$/;
const TEMPLATE_VERSION = 'v1';   // bump when the PDF layout changes so old cached files are not reused
const GROUP_NAME = { stone: 'Stone look', wood: 'Wood look', wall: 'Wall and mosaic', conc: 'Concrete and terrazzo' };
const FINISH_NAME = { glossy: 'Glossy', matt: 'Matt', polished: 'Polished' };

// Public address without a trailing slash, or '' when SITE_URL is not set or not a plain http(s) address.
function siteOrigin() {
    const raw = String(process.env.SITE_URL || '').trim().replace(/\/+$/, '');
    return /^https?:\/\/[A-Za-z0-9.-]+(:\d{1,5})?$/.test(raw) ? raw : '';
}
// For the sitemap and robots.txt, which need full addresses: SITE_URL, else the address the visitor used (only if it looks like a plain host name).
function originFor(req) {
    return siteOrigin() || (/^[A-Za-z0-9.-]+(:\d{1,5})?$/.test(req.get('host') || '') ? req.protocol + '://' + req.get('host') : '');
}
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

router.get('/robots.txt', (req, res) => {
    const o = originFor(req);
    const lines = ['User-agent: *', 'Allow: /site', 'Allow: /website/', 'Allow: /api/site/photo/', 'Allow: /api/site/catalogue.pdf',
        'Disallow: /api/', 'Disallow: /owner', 'Disallow: /uploads/'];
    if (o) lines.push('', 'Sitemap: ' + o + '/sitemap.xml');
    res.type('text/plain').send(lines.join('\n') + '\n');
});

router.get('/sitemap.xml', (req, res) => {
    const loc = originFor(req) + '/site';
    res.type('application/xml').send('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>'
        + esc(loc) + '</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>\n</urlset>\n');
});

// /site with absolute links, only when SITE_URL is set. Otherwise next() and the plain static route serves the file unchanged.
router.get('/site', (req, res, next) => {
    const o = siteOrigin();
    if (!o) return next();
    fs.readFile(PAGE, 'utf8', (err, html) => {
        if (err) return next();
        res.type('html').send(html.replace(/(<(?:meta|link)\b[^>]*?\b(?:content|href)=")(\/[^"]*)("[^>]*\bdata-abs\b)/g, (m, a, u, b) => a + o + u + b));
    });
});

// ───────── catalogue PDF ─────────
const limiter = rateLimit({
    windowMs: 10 * 60 * 1000, limit: 20, standardHeaders: false, legacyHeaders: false,
    message: { error: 'Too many downloads from this device. Please try again in a few minutes.' },
});

// Only these fields ever leave the database for the PDF.
async function visibleTiles() {
    const pool = require('../utils/pool');
    const r = await pool.query(`SELECT id, name, size, finish, grp, photo_file FROM site_tiles WHERE visible = TRUE ORDER BY id`);
    return r.rows.map(t => ({ id: t.id, name: String(t.name || ''), size: String(t.size || ''), finish: t.finish, group: t.grp,
        photo: t.photo_file && FILE_RE.test(t.photo_file) ? t.photo_file : null }));
}
const versionKey = tiles => crypto.createHash('sha1').update(TEMPLATE_VERSION + JSON.stringify(tiles)).digest('hex').slice(0, 20);

function photoData(file) {
    try {
        const buf = fs.readFileSync(path.join(PHOTO_DIR(), file));
        return 'data:image/' + (file.endsWith('.jpg') ? 'jpeg' : 'webp') + ';base64,' + buf.toString('base64');
    } catch (e) { return null; }
}

function catalogueHtml(tiles) {
    let logo = '';
    try { logo = 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'public', 'brand', 'logo-header-400h.png')).toString('base64'); } catch (e) { /* no logo file: header text only */ }
    const cards = tiles.map(t => {
        const p = t.photo ? photoData(t.photo) : null;
        return '<div class="c"><div class="i"' + (p ? ' style="background-image:url(' + p + ')"' : '') + '></div><div class="n">' + esc(t.name) + '</div><div class="s">'
            + esc([t.size, FINISH_NAME[t.finish] || t.finish, GROUP_NAME[t.group]].filter(Boolean).join(' / ')) + '</div></div>';
    }).join('');
    return '<!doctype html><html><head><meta charset="utf-8"><title>Royal Bath Hub catalogue</title><style>'
        + '@page{size:A4;margin:14mm}*{box-sizing:border-box}body{margin:0;font-family:Georgia,serif;color:#0B1B3A;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
        + '.h{background:#0B1B3A;color:#F6EFDC;padding:18px 22px;display:flex;align-items:center;gap:18px;border-radius:8px}.h img{height:48px;width:auto}'
        + '.h b{display:block;font-size:30px;letter-spacing:.12em;color:#E8CF8A;font-weight:500}.h span{font-size:15px}'
        + '.g{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:16px}.c{break-inside:avoid;border:1px solid #d9d3c0;border-radius:8px;overflow:hidden}'
        + '.i{height:120px;background:#e9e2cf center/cover no-repeat}.n{font-size:16px;font-weight:bold;padding:8px 10px 0}.s{font-size:12px;color:#4a4f5e;padding:2px 10px 10px}'
        + '.f{margin-top:18px;font-size:12px;color:#4a4f5e;line-height:1.5}'
        + '</style></head><body><div class="h">' + (logo ? '<img src="' + logo + '" alt="">' : '') + '<div><b>ROYAL BATH HUB</b><span>Tile catalogue. Thihariya, Kandy Road.</span></div></div>'
        + '<div class="g">' + cards + '</div>'
        + '<div class="f">Colours and finishes can look different in your light, so please see the tile in our showroom before you buy. Ask us on WhatsApp: 077 799 9219.</div></body></html>';
}

// One Chromium at a time: every run waits in this queue (same idea as utils/siteImage.js).
let chain = Promise.resolve();
function queued(job) {
    const run = chain.then(job);
    chain = run.catch(() => {});
    return run;
}
async function renderPdf(html) {
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'load', timeout: 30000 });
        return Buffer.from(await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true }));
    } finally { await browser.close().catch(() => {}); }
}

async function getCataloguePdf() {
    const tiles = await visibleTiles();
    const key = versionKey(tiles);
    const dir = CACHE_DIR();
    const file = path.join(dir, 'catalogue-' + key + '.pdf');
    const hit = () => { try { return fs.readFileSync(file); } catch (e) { return null; } };
    const first = hit();
    if (first) return { buf: first, cached: true, key };
    return queued(async () => {
        const again = hit();   // a run ahead of us in the queue may have just made it
        if (again) return { buf: again, cached: true, key };
        const buf = await renderPdf(catalogueHtml(tiles));
        try {
            fs.mkdirSync(dir, { recursive: true });
            const tmp = file + '.' + process.pid + '.tmp';
            fs.writeFileSync(tmp, buf); fs.renameSync(tmp, file);
            for (const f of fs.readdirSync(dir)) if (/^catalogue-[a-f0-9]{20}\.pdf$/.test(f) && f !== path.basename(file)) fs.unlink(path.join(dir, f), () => {});   // old versions
        } catch (e) { console.error('[site_catalogue] could not cache the PDF:', e.message); }
        return { buf, cached: false, key };
    });
}

router.get('/api/site/catalogue.pdf', limiter, async (req, res) => {
    try {
        const { buf, cached, key } = await getCataloguePdf();
        res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="bath-hub-catalogue.pdf"',
            'Cache-Control': 'public, max-age=300', 'ETag': '"' + key + '"', 'X-Catalogue-Cache': cached ? 'hit' : 'miss' });
        res.send(buf);
    } catch (e) {
        console.error('[site_catalogue] pdf failed:', e.message);
        res.status(500).json({ error: 'The catalogue could not be made right now. Please try again later.' });
    }
});

module.exports = router;
module.exports.siteOrigin = siteOrigin;
module.exports.catalogueHtml = catalogueHtml;
