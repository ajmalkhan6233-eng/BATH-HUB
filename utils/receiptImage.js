const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const TEMPLATE = path.join(__dirname, '..', 'public', 'brand', 'receipt-template', 'receipt.html');
const DEFAULT_DIR = path.join(__dirname, '..', 'uploads', 'receipts');
const WIDTH = 1122, HEIGHT = 200, SCALE = 1.5;   // short viewport: the picture is as tall as the receipt, no empty black
// Draws the receipt as a PNG. QR = the shop WhatsApp chat (never a personal number).
const MAX_ITEMS = 200;
const WA_LINK = 'https://wa.me/94740355536';
const MARK = 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, '..', 'public', 'brand', 'rbh-mark-plate.png')).toString('base64');
function brandedQr(url) {
  const qr = require('qrcode').create(url, { errorCorrectionLevel: 'H' });
  const n = qr.modules.size, get = (r, c) => qr.modules.data[r * n + c] ? 1 : 0, q = 2, T = n + q * 2;
  const inEye = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  const pw = n * 0.34, ph = pw * 400 / 740 + 0.8, px = q + (n - pw) / 2, py = q + (n - ph) / 2;   // logo plate, about 30% wide
  const inPlate = (r, c) => c + q + 1 > px - 0.35 && c + q < px + pw + 0.35 && r + q + 1 > py - 0.35 && r + q < py + ph + 0.35;
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (get(r, c) && !inEye(r, c) && !inPlate(r, c)) d += `<rect x="${c + q + 0.06}" y="${r + q + 0.06}" width="0.88" height="0.88" rx="0.36" fill="#0b0b0c"/>`;
  const eye = (r, c) => `<rect x="${c + q + 0.5}" y="${r + q + 0.5}" width="6" height="6" rx="1.7" fill="none" stroke="#0b0b0c" stroke-width="1"/><rect x="${c + q + 2}" y="${r + q + 2}" width="3" height="3" rx="0.8" fill="#8a6a1c"/>`;
  const plate = `<rect x="${px - 0.35}" y="${py - 0.35}" width="${pw + 0.7}" height="${ph + 0.7}" rx="0.9" fill="#0b0b0c" stroke="#c9a24b" stroke-width="0.28"/><image href="${MARK}" x="${px + 0.2}" y="${py + 0.2}" width="${pw - 0.4}" height="${ph - 0.4}" preserveAspectRatio="xMidYMid meet"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${T} ${T}"><rect width="${T}" height="${T}" fill="#fff"/>${d}${eye(0, 0)}${eye(0, n - 7)}${eye(n - 7, 0)}${plate}</svg>`;
}


const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const text = (v, max) => String(v == null ? '' : v).slice(0, max);

function cleanBill(d) {
  d = d || {};
  if (!Array.isArray(d.items) || !d.items.length) throw Object.assign(new Error('items (at least one) are required'), { status: 400 });
  if (d.items.length > MAX_ITEMS) throw Object.assign(new Error('a receipt can show at most ' + MAX_ITEMS + ' items'), { status: 400 });
  
  const items = d.items.map((it, i) => {
    const qty = Number(it && it.qty), price = Number(it && it.price);
    if (!it || !String(it.name || '').trim() || !(qty > 0) || !(price >= 0)) throw Object.assign(new Error('item ' + (i + 1) + ': name, qty (more than 0) and price (0 or more) are required'), { status: 400 });
    return { name: text(it.name, 120), code: it.code ? text(it.code, 30) : null, qty, price };
  });

  const discount = Number(d.discount || 0);
  if (!(discount >= 0)) throw Object.assign(new Error('discount must be 0 or more'), { status: 400 });

  const out = { items, discount };
  if (d.shopName) out.shopName = text(d.shopName, 60);
  if (d.address != null) out.address = esc(text(d.address, 160));
  if (d.phone != null) out.phone = esc(text(d.phone, 40));
  if (d.billNo != null) out.billNo = text(d.billNo, 30);
  if (d.date) out.date = text(d.date, 30);
  if (d.customer != null) out.customer = text(d.customer, 80);
  if (d.customerPhone != null) out.customerPhone = text(d.customerPhone, 40);
  if (d.paymentMethod != null) out.paymentMethod = text(d.paymentMethod, 20);
  if (d.chequeNo != null) out.chequeNo = text(d.chequeNo, 30);
  if (d.balanceDue != null) out.balanceDue = Number(d.balanceDue);
  if (d.total != null) out.total = Number(d.total);
  if (d.thanks) out.thanks = text(d.thanks, 80);
  if (d.tagline) out.tagline = text(d.tagline, 100);
  
  return out;
}

let chain = Promise.resolve();
function renderReceiptPng(bill, opts = {}) {
  const run = chain.then(() => render(bill, opts));
  chain = run.catch(() => {});
  return run;
}

async function render(bill, { outDir = DEFAULT_DIR, fileName, timeoutMs = 30000 } = {}) {
  const data = cleanBill(bill);
  
  // QR = shop WhatsApp chat (opens a chat with the shop number, message already typed). Styled: rounded dots, gold-ringed eyes, RBH logo plate in the middle (error correction H keeps it scannable).
  try { data.qrSvg = brandedQr(WA_LINK); } catch (e) { data.qrSvg = ''; }

  const puppeteer = require('puppeteer');
  fs.mkdirSync(outDir, { recursive: true });
  const safeBill = String(data.billNo || 'bill').replace(/[^\w.-]+/g, '_').slice(0, 30);
  const file = path.join(outDir, fileName || (safeBill + '-' + Date.now() + '.png'));
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--allow-file-access-from-files'] });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(timeoutMs);
    await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: SCALE });
    await page.evaluateOnNewDocument(d => { window.RECEIPT_DATA = d; }, data);
    await page.goto(pathToFileURL(TEMPLATE).href, { waitUntil: 'load' });
    await page.waitForSelector('body[data-ready="1"]');
    await page.screenshot({ path: file, type: 'png', fullPage: true });
  } finally { await browser.close().catch(() => {}); }
  const buf = fs.readFileSync(file);
  return { file, bytes: buf.length, width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), items: data.items.length };
}

module.exports = { brandedQr, WA_LINK, renderReceiptPng, cleanBill, DEFAULT_DIR, TEMPLATE };

