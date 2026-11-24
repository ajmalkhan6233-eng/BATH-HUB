'use strict';
// BLOCK: vendor-payment-voucher (AJ 11 Nov 2026). A colourful payment voucher for ONE vendor: GRN numbers, invoice numbers,
// the cheques (number, bank, date, amount), invoices total, cheques total and the remaining payment. Read-only on the books.
// Preview as a picture, or send it to the vendor on WhatsApp (same bridge as customer receipts). The look lives in ONE file,
// public/brand/voucher-template/voucher.html (swap in Gemini's design, keep the /*DATA*/ ... /*END*/ markers).
//   GET  /api/vendor-voucher/data?vendor=NAME[&bills=G1CR1,G1CR2]   numbers only (JSON)
//   GET  /api/vendor-voucher/html?vendor=NAME                       the page
//   GET  /api/vendor-voucher/preview?vendor=NAME                    PNG picture
//   POST /api/vendor-voucher/send  {vendor, phone?, bills?, resend?}  WhatsApp (phone: typed, else the vendor's saved phone)
const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const axios = require('axios');
const pool = require('../utils/pool');
const inv = require('./invoice_receipts');

const router = express.Router();
const TEMPLATE = path.join(__dirname, '..', 'public', 'brand', 'voucher-template', 'voucher.html');
const LOGO = path.join(__dirname, '..', 'public', 'brand', 'logo-rbh-full.webp');
const BG = ['bg.jpg', 'bg.jpeg', 'bg.png', 'bg.webp'].map(f => path.join(__dirname, '..', 'public', 'brand', 'voucher-template', f));
const CHROME = [process.env.CHROME_PATH, 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean);
const err = (status, msg) => Object.assign(new Error(msg), { status });
const fail = (res, e, what) => res.status(e.status || 500).json({ error: e.status ? e.message : `${what}: ${e.message}` });
const dataUri = (file, mime) => { try { return `data:${mime};base64,` + fs.readFileSync(file).toString('base64'); } catch (_) { return ''; } };
const mimeOf = f => ({ '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }[path.extname(f)]);
const money = n => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// 17 Nov: a DATE column arrives as a Date at local midnight; toISOString() turned it into the PREVIOUS day (cheque 15 Jan showed 14 Jan). Use the local day parts.
const iso = d => (d instanceof Date ? d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') : String(d || '').slice(0, 10));

pool.query(`CREATE TABLE IF NOT EXISTS vendor_voucher_log (id SERIAL PRIMARY KEY, vendor TEXT, voucher_no TEXT, phone_last3 VARCHAR(3), status VARCHAR(12), detail TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
  .catch(e => console.error('[vendor_voucher] log table:', e.message));

// Numbers for one vendor. Bills = the vendor's bills that carry cheques (or the ones named in `only`). Pure reads.
async function build(vendor, only) {
  vendor = String(vendor || '').trim();
  if (!vendor) throw err(400, 'vendor is required');
  const bills = (await pool.query(`SELECT vb.id, vb.bill_no, vb.bill_date, vb.total,
      (SELECT g.grn_number FROM grn_records g WHERE g.id = vb.grn_id LIMIT 1) AS grn_no, (SELECT g.grn_date FROM grn_records g WHERE g.id = vb.grn_id LIMIT 1) AS grn_date
    FROM vendor_bills vb WHERE vb.voided = FALSE AND vb.vendor_name = $1
      AND ($2::text[] IS NOT NULL AND vb.bill_no = ANY($2::text[]) OR $2::text[] IS NULL AND vb.total - COALESCE((SELECT SUM(amount) FROM vendor_payments WHERE bill_id = vb.id),0) - COALESCE((SELECT SUM(amount) FROM vendor_credit_notes WHERE bill_id = vb.id),0) - COALESCE((SELECT SUM(amount) FROM vendor_bill_cheques WHERE bill_id = vb.id AND status = 'CLEARED'),0) > 0.005)
    ORDER BY vb.bill_date, vb.bill_no`, [vendor, only && only.length ? only : null])).rows;
  if (!bills.length) throw err(404, 'No open bills found for ' + vendor);
  const ch = (await pool.query(`SELECT cheque_no, MAX(bank) AS bank, MIN(cheque_date) AS cheque_date, SUM(amount) AS amount
    FROM vendor_bill_cheques WHERE bill_id = ANY($1::int[]) AND COALESCE(UPPER(status),'') <> 'CANCELLED' GROUP BY cheque_no ORDER BY MIN(cheque_date), cheque_no`, [bills.map(b => b.id)])).rows;
  const allc = (await pool.query(`SELECT bill_id, amount, cheque_no, bank, cheque_date FROM vendor_bill_cheques WHERE bill_id = ANY($1::int[]) AND COALESCE(UPPER(status),'') <> 'CANCELLED'`, [bills.map(b => b.id)])).rows;
  const notes = (await pool.query(`SELECT id, bill_id, note_no, amount, note_date, reason FROM vendor_credit_notes WHERE bill_id = ANY($1::int[]) ORDER BY note_date, id`, [bills.map(b => b.id)])).rows;
  const rl = notes.length ? (await pool.query(`SELECT credit_note_id, item_code, item_name, qty, rate, amount FROM vendor_return_lines WHERE credit_note_id = ANY($1::int[]) ORDER BY id`, [notes.map(n => n.id)]).catch(() => ({ rows: [] }))).rows : [];
  const pays = (await pool.query(`SELECT bill_id, amount, method, paid_at FROM vendor_payments WHERE bill_id = ANY($1::int[]) ORDER BY paid_at, id`, [bills.map(b => b.id)]).catch(() => ({ rows: [] }))).rows;
  const returns = [];
  for (const n of notes) { const ls = rl.filter(l => l.credit_note_id === n.id); if (ls.length) ls.forEach(l => returns.push({ bill_id: n.bill_id, item: `${l.item_name || l.item_code || ''}`.trim(), qty: Number(l.qty), rate: Number(l.rate), date: iso(n.note_date), amount: Number(l.amount) })); else returns.push({ bill_id: n.bill_id, item: String(n.reason || n.note_no || 'Credit note').replace(/^RETURN:\s*/i, ''), qty: '', date: iso(n.note_date), amount: Number(n.amount) }); }
  const vrow = (await pool.query(`SELECT phone FROM vendors WHERE name_key = lower(regexp_replace($1, '\\s+', ' ', 'g')) OR lower(name) = lower($1) LIMIT 1`, [vendor]).catch(() => ({ rows: [] }))).rows[0];
  const bills_total = bills.reduce((s, b) => s + Math.round(Number(b.total) * 100), 0) / 100;
  const returns_total = returns.reduce((s, r) => s + Math.round(r.amount * 100), 0) / 100;
  const cheques_total = ch.reduce((s, c) => s + Math.round(Number(c.amount) * 100), 0) / 100;
  const today = new Date(Date.now() + 5.5 * 3600e3);   // Sri Lanka date
  const ymd = today.toISOString().slice(0, 10);
  const key = vendor.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'VEN';
  const out = {
    voucher_no: `VS-${ymd.replace(/-/g, '')}-${key}`, date: today.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }),
    shop: { name: process.env.SHOP_NAME || 'Royal Bath Hub', address: 'No. 173/1, Kandy Road, Thihariya, Kalagedihena, Sri Lanka', phone: '+94 74 035 5536', email: 'royalbathhub1@gmail.com' },
    vendor: { name: vendor, phone: (vrow && vrow.phone) || '' },
    received_by: (m => m ? `Mr. ${m[1].trim()}, ${m[2].trim().replace(/\bPvt\b/i, '(Pvt)')}` : vendor)(vendor.match(/^(.+?)\s*\((.+)\)$/)),
    bills: bills.map(b => {
      const cq = allc.filter(c => c.bill_id === b.id).map(c => ({ no: c.cheque_no, bank: String(c.bank || '').replace(/,.*$/, ''), date: iso(c.cheque_date), amount: Number(c.amount) }));
      const cash = pays.filter(x => x.bill_id === b.id).map(x => ({ date: iso(x.paid_at), method: x.method || 'Cash', amount: Number(x.amount) }));
      const rt = returns.filter(r => r.bill_id === b.id);
      const sumA = a => Math.round(a.reduce((t, x) => t + Math.round(x.amount * 100), 0)) / 100;
      const net = Math.round((Number(b.total) - sumA(rt)) * 100) / 100, paid = Math.round((sumA(cq) + sumA(cash)) * 100) / 100;
      return { grn_no: b.grn_no || '', grn_date: b.grn_date ? iso(b.grn_date) : '', bill_no: b.bill_no, bill_date: iso(b.bill_date), total: Number(b.total), returns: rt, returns_total: sumA(rt), net_payable: net, cheques: cq, cash, paid, balance: Math.round((net - paid) * 100) / 100 };
    }),
    cheques: ch.map(c => ({ no: c.cheque_no, bank: String(c.bank || '').replace(/,.*$/, ''), date: iso(c.cheque_date), amount: Number(c.amount) })),
    returns, returns_total, net_payable: Math.round((bills_total - returns_total) * 100) / 100,
    bills_total, cheques_total, balance: 0,
  };
  out.balance = Math.round(out.bills.reduce((t, b) => t + Math.round(b.balance * 100), 0)) / 100;
  return out;
}

function html(data) {
  // 17 Nov: same picture + colour of the 2-day window as the customer receipt (utils/receiptTheme.js)
  const th = require('../utils/receiptTheme').pickFor('v' + Math.floor(Math.random() * 1000000));
  const setBg = th.set ? path.join(__dirname, '..', 'public', 'brand', 'receipt-sets', 'set' + th.set + '_bg.jpg') : null;
  const bg = setBg && fs.existsSync(setBg) ? setBg : BG.find(f => fs.existsSync(f));
  const full = { ...data, logo: dataUri(LOGO, 'image/webp'), bg: bg ? dataUri(bg, mimeOf(bg)) : '', hdr: th.hex, hdrRgb: th.rgb };
  const tpl = fs.readFileSync(TEMPLATE, 'utf8');
  const json = JSON.stringify(full).replace(/</g, '\\u003c');
  return tpl.replace(/\/\*DATA\*\/[\s\S]*?\/\*END\*\//, () => '/*DATA*/' + json + '/*END*/');
}

async function png(data, asPdf) {
  const chrome = CHROME.find(p => fs.existsSync(p));
  if (!chrome) throw err(503, 'Chrome was not found on this computer, so the picture cannot be made');
  const puppeteer = require('puppeteer-core');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'voucher-chrome-'));
  let browser;
  try {
    browser = await puppeteer.launch({ executablePath: chrome, headless: true, userDataDir: profile, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 900, deviceScaleFactor: 3 });
    await page.setContent(html(data), { waitUntil: 'load' });
    const h = await page.evaluate(() => document.getElementById('sheet').getBoundingClientRect().height);
    await page.setViewport({ width: 800, height: Math.ceil(h), deviceScaleFactor: 3 });
    if (asPdf) return Buffer.from(await page.pdf({ width: '800px', height: Math.ceil(h) + 'px', printBackground: true, pageRanges: '1' }));
    return Buffer.from(await page.screenshot({ type: 'jpeg', quality: 95, clip: { x: 0, y: 0, width: 800, height: Math.ceil(h) } }));
  } finally { if (browser) await browser.close().catch(() => {}); fs.rm(profile, { recursive: true, force: true }, () => {}); }
}

const only = q => (q ? String(q).split(',').map(s => s.trim()).filter(Boolean) : null);

router.get('/vendor-voucher/data', async (req, res) => { try { res.json(await build(req.query.vendor, only(req.query.bills))); } catch (e) { fail(res, e, 'Could not build the voucher'); } });
router.get('/vendor-voucher/html', async (req, res) => { try { res.type('html').send(html(await build(req.query.vendor, only(req.query.bills)))); } catch (e) { fail(res, e, 'Could not build the voucher'); } });
router.get('/vendor-voucher/preview', async (req, res) => { try { res.type('jpeg').send(await png(await build(req.query.vendor, only(req.query.bills)))); } catch (e) { fail(res, e, 'Could not draw the voucher'); } });

router.get('/vendor-voucher/pdf', async (req, res) => { try { res.type('pdf').send(await png(await build(req.query.vendor, only(req.query.bills)), true)); } catch (e) { fail(res, e, 'Could not make the PDF'); } });

router.post('/vendor-voucher/send', async (req, res) => {
  const b = req.body || {}; let d;
  try {
    d = await build(b.vendor, Array.isArray(b.bills) ? b.bills : only(b.bills));
    if (!(b.phone || d.vendor.phone)) throw err(400, 'No phone number saved for ' + d.vendor.name + '. Type one.');
    const phone = inv.normalizePhone(b.phone || d.vendor.phone);   // throws a clear error on a bad number
    const prev = await pool.query(`SELECT created_at FROM vendor_voucher_log WHERE vendor=$1 AND voucher_no=$2 AND status='sent' ORDER BY id DESC LIMIT 1`, [d.vendor.name, d.voucher_no]);
    if (prev.rows.length && b.resend !== true) return res.status(409).json({ error: 'This voucher was already sent today. Send again?', code: 'already_sent' });
    if (await inv.isOnWhatsApp(phone) === false) throw err(422, `${phone} is not on WhatsApp. Check the number.`);
    const buf = await png(d);
    const caption = `${d.shop.name}\nVendor statement ${d.voucher_no}\nInvoices: Rs ${money(d.bills_total)}${d.returns_total ? '\nReturns: Rs ' + money(d.returns_total) : ''}\nCheques: Rs ${money(d.cheques_total)}\nRemaining: Rs ${money(d.balance)}`;
    try {
      await axios.post(process.env.WHATSAPP_API_URL || 'http://localhost:3001/send', { to: phone, message: caption,
        media: { data: buf.toString('base64'), mimetype: 'image/jpeg', filename: `${d.voucher_no}.jpg` } }, { timeout: 30000, maxBodyLength: Infinity });
    } catch (e) { throw err(502, e.response ? 'WhatsApp bridge refused it: ' + (e.response.data && e.response.data.error || e.message) : 'WhatsApp bridge is not reachable, nothing was sent'); }
    await pool.query(`INSERT INTO vendor_voucher_log (vendor, voucher_no, phone_last3, status) VALUES ($1,$2,$3,'sent')`, [d.vendor.name, d.voucher_no, String(phone).slice(-3)]).catch(() => {});
    res.json({ sent: true, to: phone, voucher_no: d.voucher_no });
  } catch (e) {
    if (d) await pool.query(`INSERT INTO vendor_voucher_log (vendor, voucher_no, status, detail) VALUES ($1,$2,'failed',$3)`, [d.vendor.name, d.voucher_no, e.message.slice(0, 200)]).catch(() => {});
    fail(res, e, 'Could not send the voucher');
  }
});

module.exports = router;
module.exports.build = build;
module.exports.html = html;
module.exports.png = png;
