'use strict';
// Website photos: checks the REAL file type (not the name), shrinks to at most 1200 px and re-encodes as webp.
// Re-encoding also throws away anything hidden in the original file (metadata, trailing data).
// Uses the headless Chromium that is already installed for receipts (no new package); one at a time.
const { fromBuffer } = require('file-type');

const ALLOWED = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_SIDE = 1200;

// -> 'jpg' | 'png' | 'webp' | null   (null = not an allowed picture, whatever the file is called)
async function detectType(buf) {
    try { const t = await fromBuffer(buf); return t && ALLOWED[t.mime] ? ALLOWED[t.mime] : null; } catch (e) { return null; }
}

let chain = Promise.resolve();
function resizeToWebp(buf) {
    const run = chain.then(() => doResize(buf));
    chain = run.catch(() => {});
    return run;
}
async function doResize(buf) {
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    try {
        const page = await browser.newPage();
        await page.setContent('<!doctype html><meta charset="utf-8"><body></body>');
        const out = await page.evaluate(async (b64, maxSide) => {
            const blob = await (await fetch('data:application/octet-stream;base64,' + b64)).blob();
            const bmp = await createImageBitmap(blob);
            const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));      // never enlarge
            const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
            const c = document.createElement('canvas'); c.width = w; c.height = h;
            const g = c.getContext('2d'); g.drawImage(bmp, 0, 0, w, h);
            return { data: c.toDataURL('image/webp', 0.85).split(',')[1], width: w, height: h };
        }, buf.toString('base64'), MAX_SIDE);
        return { buffer: Buffer.from(out.data, 'base64'), ext: 'webp', width: out.width, height: out.height };
    } finally { await browser.close().catch(() => {}); }
}

module.exports = { detectType, resizeToWebp, MAX_BYTES, MAX_SIDE, ALLOWED };