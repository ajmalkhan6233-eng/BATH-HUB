// scripts/build_visiting_card.js
// Builds the Royal Bath Hub visiting card: trim 90x50 mm + 3 mm bleed = 96x56 mm canvas.
// Output in public/print/: visiting-card.pdf (2 pages: front, back), visiting-card-front.png,
// visiting-card-back.png (1134x661 px = 300 dpi). Run: node scripts/build_visiting_card.js
// Plain HTML/CSS/SVG rendered with headless Chrome; nothing is fetched from the internet.

const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const puppeteer = require('puppeteer-core');

// ── Settings (edit here) ────────────────────────────────────────────────────
const NAME = 'Ajmal Khan';
const TITLE = 'Owner';
const SHOP_PHONE = '074 035 5536';
const EMAIL = '';   // add later, e.g. 'name@example.com'. Empty = no email line.
const ADDRESS = ['No. 173/1, Kandy Road,', 'Thihariya, Kalagedihena,', 'Sri Lanka'];
const SERVICES = ['Sanitary Ware', 'Bathroom Fittings', 'Tiles', 'Accessories'];
// ────────────────────────────────────────────────────────────────────────────

const OUT = path.join(__dirname, '..', 'public', 'print');
const ASSETS = path.join(OUT, 'assets');
const CHROME = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium']
    .filter(Boolean).find(p => fs.existsSync(p));

const W = 96, H = 56, PX = 11.811;     // canvas in mm, px per mm at 300 dpi
const NAVY = '#0a1d44', NAVY_DEEP = '#07132e', GOLD = '#d4af37', GOLD_LIGHT = '#f3dc8a';
const b64 = f => fs.readFileSync(path.join(ASSETS, f)).toString('base64');
const m = n => `calc(var(--u) * ${n})`;
const pt = n => `calc(var(--u) * ${(n * 25.4 / 72).toFixed(4)})`;

// Thin gold line icons, 24x24 grid.
const ICON = {
    'Sanitary Ware': '<path d="M7 3h6v5H7z M5 8h14c0 5-2 8-5 9v3H9v-3c-3-1-4-4-4-9z"/>',
    'Bathroom Fittings': '<path d="M4 9h9a4 4 0 0 1 4 4v2 M8 5h6 M11 5v4 M17 18v3"/>',
    'Tiles': '<path d="M3 3h8v8H3z M13 3h8v8h-8z M3 13h8v8H3z M13 13h8v8h-8z"/>',
    'Accessories': '<circle cx="12" cy="14" r="5"/><path d="M12 9V4 M9 4h6 M3 21h18"/>',
    phone: '<path d="M6 3h4l2 5-2.5 1.5a11 11 0 0 0 5 5L16 12l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2z"/>',
    pin: '<path d="M12 21s-6-6-6-11a6 6 0 0 1 12 0c0 5-6 11-6 11z"/><circle cx="12" cy="10" r="2"/>',
    mail: '<path d="M3 6h18v12H3z M3 7l9 7 9-7"/>',
};
const icon = (k, size, stroke = 1.3) => `<svg viewBox="0 0 24 24" style="width:${m(size)};height:${m(size)}" fill="none" stroke="${GOLD}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${ICON[k]}</svg>`;

// Navy marble with white veining, as a raster at 300 dpi (used by PNG and PDF alike).
function marbleSvg() {
    const layer = (freq, seed, op, thin) => `<filter id="f${seed}" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="5" seed="${seed}"/>
        <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  1 0 0 0 0"/>
        <feComponentTransfer><feFuncA type="table" tableValues="${thin}"/></feComponentTransfer></filter>
        <rect width="${W}" height="${H}" filter="url(#f${seed})" opacity="${op}"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * PX}" height="${H * PX}">
      <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14306b"/><stop offset=".55" stop-color="${NAVY}"/><stop offset="1" stop-color="${NAVY_DEEP}"/></linearGradient></defs>
      <rect width="${W}" height="${H}" fill="url(#bg)"/>
      ${layer('0.012 0.02', 7, 0.5, '0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 1 0.25 0 0 0 0 0 0 0 0 0 0 0 0 0 0')}
      ${layer('0.03 0.05', 21, 0.18, '0 0 0 0 0 0 0 0 0 0 0 0 0 0.2 1 0.2 0 0 0 0 0 0 0 0 0 0 0 0 0 0')}
    </svg>`;
}

const css = u => `:root{--u:${u}}*{margin:0;padding:0;box-sizing:border-box}
@page{size:${W}mm ${H}mm;margin:0}
html,body{width:${m(W)};background:${NAVY}}
.page{position:relative;width:${m(W)};height:${m(H)};overflow:hidden;font-family:'Segoe UI',Arial,sans-serif;color:#fff;break-after:page}
.page:last-child{break-after:auto}
.abs{position:absolute}
.bgimg,.vec{position:absolute;left:0;top:0;width:${m(W)};height:${m(H)}}
.name{font-family:Georgia,'Times New Roman',serif;font-weight:700;font-size:${pt(11.5)};color:#fff;white-space:nowrap;letter-spacing:.01em;line-height:1}
.role{font-size:${pt(6)};letter-spacing:.32em;text-transform:uppercase;color:${GOLD};font-weight:600}
.line{display:flex;align-items:center;gap:${m(1.4)};font-size:${pt(8)};font-weight:600;color:#fff;letter-spacing:.03em;white-space:nowrap}
.addr{display:flex;gap:${m(1.4)};font-size:${pt(5.5)};line-height:1.5;color:#e6ebf7;white-space:nowrap}
.svc{display:flex;align-items:center;gap:${m(2)};font-size:${pt(6)};font-weight:600;color:#fff;letter-spacing:.04em;white-space:nowrap}`;

// Panel + swoosh as vector art (sharp at any size).
const vector = `<svg class="vec" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="g" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#9c7a1c"/><stop offset=".5" stop-color="${GOLD_LIGHT}"/><stop offset="1" stop-color="#b8922a"/></linearGradient></defs>
  <path d="M60.5 0 C 54 18, 66 38, 57 ${H} L ${W} ${H} L ${W} 0 Z" fill="${NAVY_DEEP}"/>
  <path d="M0 46.5 C 20 52, 42 42, 61 16 C 52 36, 26 54, 0 49.5 Z" fill="url(#g)"/>
  <path d="M60.5 0 C 54 18, 66 38, 57 ${H}" fill="none" stroke="${GOLD}" stroke-width=".25"/></svg>`;

function front(bg) {
    return `<div class="page"><img class="bgimg" src="${bg}">${vector}
      <img class="abs" src="data:image/png;base64,${b64('rbh-logo-full.png')}" style="left:${m(6.5)};top:${m(7)};width:${m(40)}">
      <img class="abs" src="data:image/jpeg;base64,${b64('card-product.jpg')}" style="left:${m(6.5)};top:${m(29)};width:${m(24)};height:${m(17.5)};object-fit:cover;border:${m(.35)} solid ${GOLD};border-radius:${m(1.2)}">
      <div class="abs" style="left:${m(64.5)};top:${m(8.5)};width:${m(27)}">
        <div class="name">${NAME}</div>
        <div class="role" style="margin-top:${m(1.6)}">${TITLE}</div>
        <div class="line" style="margin-top:${m(3.6)}">${icon('phone', 3.4)}<span>${SHOP_PHONE}</span></div>
        ${EMAIL ? `<div class="line" style="margin-top:${m(1.8)};font-size:${pt(6.5)}">${icon('mail', 3.2)}<span>${EMAIL}</span></div>` : ''}
        <div style="margin-top:${m(4)};height:${m(.25)};width:${m(8)};background:${GOLD}"></div>
        <div class="addr" style="margin-top:${m(3.4)}">${icon('pin', 3.4)}<div>${ADDRESS.join('<br>')}</div></div>
      </div></div>`;
}

function back(bg) {
    return `<div class="page"><img class="bgimg" src="${bg}">${vector}
      <img class="abs" src="data:image/png;base64,${b64('rbh-logo-full.png')}" style="left:${m(6)};top:${m(17)};width:${m(48)}">
      <div class="abs" style="left:${m(64.5)};top:${m(9.5)};width:${m(27)};display:flex;flex-direction:column;gap:${m(4)}">
        ${SERVICES.map(s => `<div class="svc">${icon(s, 5.2, 1.1)}<span>${s}</span></div>`).join('')}
      </div></div>`;
}

const doc = (body, u) => `<!doctype html><html><head><meta charset="utf-8"><style>${css(u)}</style></head><body>${body}</body></html>`;

// Write a 300 dpi marker (pHYs chunk) into a PNG so printers read it as 300 dpi.
function setDpi300(png) {
    const ppm = Math.round(300 / 0.0254), data = Buffer.alloc(9);
    data.writeUInt32BE(ppm, 0); data.writeUInt32BE(ppm, 4); data[8] = 1;
    const type = Buffer.from('pHYs'), len = Buffer.alloc(4); len.writeUInt32BE(9);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(Buffer.concat([type, data])) >>> 0);
    return Buffer.concat([png.subarray(0, 33), len, type, data, crc, png.subarray(33)]);
}

(async () => {
    if (!CHROME) throw new Error('Chrome not found (set CHROME_PATH)');
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'card-chrome-'));
    const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, userDataDir: profile, args: ['--no-sandbox', '--disable-gpu'] });
    try {
        const pg = await browser.newPage();
        const pxW = Math.round(W * PX), pxH = Math.round(H * PX);
        await pg.setViewport({ width: pxW, height: pxH, deviceScaleFactor: 1 });

        // 1) marble background raster at 300 dpi
        await pg.setContent(`<body style="margin:0">${marbleSvg()}</body>`, { waitUntil: 'load' });
        const marble = await pg.screenshot({ type: 'png', clip: { x: 0, y: 0, width: pxW, height: pxH } });
        const bg = 'data:image/png;base64,' + Buffer.from(marble).toString('base64');

        // 2) PNGs
        for (const [name, fn] of [['front', front], ['back', back]]) {
            await pg.setContent(doc(fn(bg), `${PX}px`), { waitUntil: 'load' });
            const png = await pg.screenshot({ type: 'png', clip: { x: 0, y: 0, width: pxW, height: pxH } });
            fs.writeFileSync(path.join(OUT, `visiting-card-${name}.png`), setDpi300(Buffer.from(png)));
        }

        // 3) one PDF, 2 pages (front, back), page = 96x56 mm
        await pg.setContent(doc(front(bg) + back(bg), '1mm'), { waitUntil: 'load' });
        fs.writeFileSync(path.join(OUT, 'visiting-card.pdf'),
            await pg.pdf({ preferCSSPageSize: true, printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } }));
        console.log('built: visiting-card.pdf, visiting-card-front.png, visiting-card-back.png');
    } finally {
        await browser.close().catch(() => {});
        fs.rm(profile, { recursive: true, force: true }, () => {});
    }
})().catch(e => { console.error(e.message); process.exit(1); });
