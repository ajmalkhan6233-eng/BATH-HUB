/* utils/receiptImage.js: turns a bill into the Bath Hub receipt PNG (the WhatsApp receipt design in public/brand/receipt-template).
   It opens the template in headless Chromium (puppeteer, already installed), hands it the bill as window.RECEIPT_DATA, waits for
   body[data-ready="1"], and saves a full-page PNG. Nothing here sends anything: the PNG is only saved for the receipt queue. */
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const TEMPLATE = path.join(__dirname, '..', 'public', 'brand', 'receipt-template', 'receipt.html');
const DEFAULT_DIR = path.join(__dirname, '..', 'uploads', 'receipts');
const WIDTH = 1122, HEIGHT = 1402, SCALE = 1.5;              // 1683 px wide, the size of the brand sample
const MAX_ITEMS = 200;

const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const text = (v, max) => String(v == null ? '' : v).slice(0, max);

// Checks and cleans the bill. Throws Error with a plain message (status 400) on bad input.
function cleanBill(d) {
  d = d || {};
  if (!Array.isArray(d.items) || !d.items.length) throw Object.assign(new Error('items (at least one) are required'), { status: 400 });
  if (d.items.length > MAX_ITEMS) throw Object.assign(new Error('a receipt can show at most ' + MAX_ITEMS + ' items'), { status: 400 });
  const items = d.items.map((it, i) => {
    const qty = Number(it && it.qty), price = Number(it && it.price);
    if (!it || !String(it.name || '').trim() || !(qty > 0) || !(price >= 0)) throw Object.assign(new Error('item ' + (i + 1) + ': name, qty (more than 0) and price (0 or more) are required'), { status: 400 });
    return { name: text(it.name, 120), qty, price };
  });
  const discount = Number(d.discount || 0);
  if (!(discount >= 0)) throw Object.assign(new Error('discount must be 0 or more'), { status: 400 });
  const out = { items, discount };
  if (d.shopName) out.shopName = text(d.shopName, 60);
  if (d.address != null) out.address = esc(text(d.address, 160));      // the template writes the address as HTML
  if (d.phone != null) out.phone = esc(text(d.phone, 40));
  if (d.billNo != null) out.billNo = text(d.billNo, 30);
  if (d.date) out.date = text(d.date, 30);
  if (d.customer != null) out.customer = text(d.customer, 80);
  if (d.thanks) out.thanks = text(d.thanks, 80);
  if (d.tagline) out.tagline = text(d.tagline, 100);
  return out;
}

let chain = Promise.resolve();                                   // one Chromium at a time: easy on a small laptop
function renderReceiptPng(bill, opts = {}) {
  const run = chain.then(() => render(bill, opts));
  chain = run.catch(() => {});
  return run;
}

async function render(bill, { outDir = DEFAULT_DIR, fileName, timeoutMs = 30000 } = {}) {
  const data = cleanBill(bill);
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

module.exports = { renderReceiptPng, cleanBill, DEFAULT_DIR, TEMPLATE };