// routes/grn_barcodes.js
// "Print barcode" for the GRN screen: ONE PDF of Code 128 stickers, black and white only.
// Each sticker = item name (exactly as saved on the GRN), Code 128 of the item code (001, 002 ...),
// the code in digits, and the selling price.
//
// - layout "sticker": one row per page, `across` stickers side by side (roll printer).
// - layout "a4": A4 sheet, 3 across x 8 rows.
// - Sticker size is ONE setting: BARCODE_STICKER_MM, e.g. "50x30" (default), across: BARCODE_STICKER_ACROSS (default 2).
// - Reads nothing from the database and writes nothing: the screen sends the items it just saved.

const express = require('express');
const PDFDocument = require('pdfkit');
const { code128Widths } = require('../utils/barcode128');

const router = express.Router();

const MM = 72 / 25.4;
const A4 = { w: 210, h: 297, cols: 3, rows: 8 };
const MAX_LABELS = 1000;

function stickerSetting() {
    const m = /^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/i.exec(String(process.env.BARCODE_STICKER_MM || '50x30').trim());
    const across = Math.max(1, parseInt(process.env.BARCODE_STICKER_ACROSS || '2', 10) || 2);
    return { w: m ? Number(m[1]) : 50, h: m ? Number(m[2]) : 30, across };
}

const rs = n => { const v = Number(n); return isFinite(v) && v > 0 ? 'Rs. ' + v.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 }) : ''; };

// Draw one sticker inside the cell (x, y, w, h all in mm).
function drawLabel(doc, it, x, y, w, h) {
    const pad = 1.5, innerW = (w - 2 * pad) * MM;
    const left = (x + pad) * MM;
    doc.fillColor('#000');

    // name: shrink to fit in at most 2 lines, never cut or reworded
    let fs = 8;
    doc.font('Helvetica-Bold');
    while (fs > 4.5 && doc.fontSize(fs).heightOfString(it.name, { width: innerW }) > fs * 1.2 * 2 + 0.5) fs -= 0.5;
    const nameTop = (y + 1.2) * MM;
    doc.fontSize(fs).text(it.name, left, nameTop, { width: innerW, align: 'center', lineGap: 0 });
    const nameBottom = nameTop + Math.min(doc.heightOfString(it.name, { width: innerW }), fs * 1.2 * 2 + 0.5);

    // price (bottom) and code digits (above it)
    const price = rs(it.price);
    const priceH = price ? 11 : 0, digitsH = 9;
    const bottom = (y + h - 1) * MM;
    if (price) { doc.font('Helvetica-Bold').fontSize(9).text(price, left, bottom - 10, { width: innerW, align: 'center', lineBreak: false }); }
    doc.font('Helvetica').fontSize(7).text(it.code, left, bottom - priceH - digitsH + 2, { width: innerW, align: 'center', lineBreak: false });

    // bars fill what is left between name and digits
    const barTop = nameBottom + 2, barBottom = bottom - priceH - digitsH - 1;
    const barH = Math.max(barBottom - barTop, 8);
    const widths = code128Widths(it.code);
    const modules = widths.reduce((a, b) => a + b, 0), quiet = 10;
    const mw = Math.min(0.6 * MM, innerW / (modules + 2 * quiet));
    let cx = left + (innerW - modules * mw) / 2;
    widths.forEach((m, i) => { if (i % 2 === 0) doc.rect(cx, barTop, m * mw, barH).fill('#000'); cx += m * mw; });
}

// items: [{ code, name, price, copies }] -> Buffer (PDF)
function buildBarcodePdf(items, layout) {
    const labels = [];
    items.forEach(it => { for (let i = 0; i < it.copies; i++) labels.push(it); });
    if (!labels.length) throw Object.assign(new Error('Nothing to print'), { status: 400 });
    if (labels.length > MAX_LABELS) throw Object.assign(new Error(`Too many stickers (max ${MAX_LABELS} in one PDF)`), { status: 400 });

    const st = stickerSetting();
    const a4 = layout === 'a4';
    const pageW = a4 ? A4.w : st.w * st.across, pageH = a4 ? A4.h : st.h;
    const cellW = a4 ? A4.w / A4.cols : st.w, cellH = a4 ? A4.h / A4.rows : st.h;
    const perPage = a4 ? A4.cols * A4.rows : st.across, cols = a4 ? A4.cols : st.across;

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: [pageW * MM, pageH * MM], margin: 0, autoFirstPage: false,
            info: { Title: 'Barcode stickers', Author: 'Royal Bath Hub' } });
        const chunks = [];
        doc.on('data', c => chunks.push(c)).on('end', () => resolve(Buffer.concat(chunks))).on('error', reject);
        labels.forEach((it, i) => {
            if (i % perPage === 0) doc.addPage({ size: [pageW * MM, pageH * MM], margin: 0 });
            const slot = i % perPage;
            drawLabel(doc, it, (slot % cols) * cellW, Math.floor(slot / cols) * cellH, cellW, cellH);
        });
        doc.end();
    });
}

router.post('/grn-barcodes', async (req, res) => {
    try {
        const body = req.body || {};
        if (!Array.isArray(body.items) || !body.items.length) throw Object.assign(new Error('Nothing to print'), { status: 400 });
        const items = body.items.map(i => {
            const code = String(i.item_code || '').trim(), name = String(i.name || '').trim();
            if (!code || !name) throw Object.assign(new Error('Every sticker needs an item code and a name'), { status: 400 });
            const copies = Math.max(1, Math.min(500, Math.ceil(Number(i.copies) || 1)));
            return { code, name, price: i.price, copies };
        });
        const pdf = await buildBarcodePdf(items, body.layout === 'a4' ? 'a4' : 'sticker');
        res.type('application/pdf').set('Content-Disposition', 'inline; filename="barcode-stickers.pdf"').send(pdf);
    } catch (e) {
        res.status(e.status || 500).json({ error: e.status ? e.message : `Could not make the barcode PDF: ${e.message}` });
    }
});

module.exports = router;
module.exports.buildBarcodePdf = buildBarcodePdf;
