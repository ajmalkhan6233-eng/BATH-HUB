'use strict';
/**
 * Task 25: the rest of the owner automations (ideas 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 18). Same rules as utils/automations.js:
 * every text goes through enqueue() = the notify queue = the ONE 06:00 message (rule 11); money data goes only to the owner;
 * each job runs at most once per Sri Lanka day (automation_runs); a failing job is logged and skipped. Nothing here sends to customers:
 * texts meant for customers (review request, nudge) are DRAFTS the owner forwards himself. Social posting stays ON HOLD: only draft text.
 * Schema used (not checked against the live database): pos_bills, pos_bill_items, products, quotations(+_items), cheque_register, discount_rules.
 */
const fs = require('fs');
const path = require('path');

const rs = (n) => 'Rs ' + Number(n || 0).toLocaleString('en-LK', { maximumFractionDigits: 0 });
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (isoDate, n) => { const d = new Date(isoDate + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const readJson = (f, fallback) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (_) { return fallback; } };

// ---- 5 hot-lead nudge: quotes sent 2 to 7 days ago that never became a bill ----
async function hotLeads(pool, today) {
  const r = await pool.query(`SELECT q.id, q.total, q.quote_date, c.name, c.phone FROM quotations q LEFT JOIN customers c ON c.id = q.customer_id
      WHERE q.status IN ('draft','sent') AND q.quote_date <= $1 AND q.quote_date >= $2
      AND NOT EXISTS (SELECT 1 FROM pos_quotation_billed b WHERE b.quotation_id = q.id) ORDER BY q.total DESC LIMIT 10`, [addDays(today, -2), addDays(today, -7)]);
  return r.rows;
}
const leadNudge = (rows) => `HOT LEADS (${rows.length}): quotes with no sale yet. A call today may close them.\n` +
  rows.map((x) => `- ${x.name || 'customer'} ${x.phone || ''}: ${rs(x.total)} (quote ${String(x.quote_date).slice(0, 10)})`).join('\n');

// ---- 7 bounced-cheque helper ----
async function bouncedCheques(pool) {
  return (await pool.query(`SELECT cheque_no, bank, payee, amount, due_date FROM cheque_register WHERE LOWER(status) = 'bounced' ORDER BY due_date DESC LIMIT 10`)).rows;
}
const bouncedHelp = (rows) => `BOUNCED CHEQUES (${rows.length}, total ${rs(rows.reduce((s, x) => s + Number(x.amount || 0), 0))})\n` +
  rows.map((x) => `- ${x.payee || '?'} cheque ${x.cheque_no} ${x.bank || ''} ${rs(x.amount)} due ${String(x.due_date).slice(0, 10)}`).join('\n') +
  '\nSteps: 1) call the customer today, 2) ask for cash or a new cheque, 3) re-present only after they confirm funds, 4) record the bank return fee.';

// ---- 9 slow-moving stock: in stock, nothing sold for 90 days. Suggested cut stays inside the discount limit and above cost ----
async function slowStock(pool) {
  const lim = await pool.query(`SELECT max_discount_pct FROM discount_rules WHERE active = true ORDER BY (role = 'all'), id DESC LIMIT 1`).then((r) => (r.rows.length ? Number(r.rows[0].max_discount_pct) : 0)).catch(() => 0);
  const r = await pool.query(`SELECT p.item_code, p.name, p.stock_level, p.selling_price, p.avg_cost FROM products p WHERE p.active = true AND p.stock_level > 0
      AND NOT EXISTS (SELECT 1 FROM pos_bill_items i JOIN pos_bills b ON b.id = i.bill_id WHERE i.item_code = p.item_code AND b.created_at > NOW() - INTERVAL '90 days')
      ORDER BY p.stock_level * p.avg_cost DESC LIMIT 15`);
  return { limit: lim, rows: r.rows };
}
function slowSuggestion(x, limitPct) {
  const price = Number(x.selling_price), cost = Number(x.avg_cost);
  const cut = Math.min(limitPct, 10);                    // never more than 10 percent, never more than the discount limit
  let np = Math.round(price * (1 - cut / 100));
  if (np <= cost) np = Math.ceil(cost * 1.02);           // never below cost
  return np >= price ? null : { price: np, pct: Math.round((1 - np / price) * 100) };
}
const slowText = ({ limit, rows }) => `SLOW STOCK (${rows.length}): nothing sold in 90 days. Discount limit ${limit}%.\n` +
  rows.map((x) => { const s = slowSuggestion(x, limit); return `- ${x.item_code} ${x.name}: ${x.stock_level} in stock, price ${rs(x.selling_price)}${s ? `, try ${rs(s.price)} (-${s.pct}%)` : ', no safe discount'}`; }).join('\n');

// ---- 12 review request: drafts for bills 2 to 3 days old (owner forwards them himself) ----
async function reviewBills(pool, today) {
  return (await pool.query(`SELECT customer_name, customer_phone FROM pos_bills b WHERE b.customer_phone IS NOT NULL AND b.customer_phone <> ''
      AND b.created_at::date <= $1 AND b.created_at::date >= $2 AND NOT EXISTS (SELECT 1 FROM pos_bill_voids v WHERE v.bill_id = b.id) LIMIT 8`, [addDays(today, -2), addDays(today, -3)])).rows;
}
const reviewDraft = (rows, link) => `REVIEW REQUESTS (${rows.length}), DRAFT, you send them:\n` + rows.map((x) => `- ${x.customer_phone} ${x.customer_name || ''}`).join('\n') +
  `\nText: "Thank you for shopping at Royal Bath Hub! If you were happy, a short review helps us a lot: ${link || '(add the Google review link in config/business.json)'}"`;

// ---- 15 delivery / fitting reminders: config/deliveries.json = { items:[{date,customer,what,place}] } ----
const deliveriesTomorrow = (file, today) => (readJson(file, { items: [] }).items || []).filter((x) => x.date === addDays(today, 1));
const deliveryText = (rows) => `TOMORROW'S DELIVERIES / FITTINGS (${rows.length})\n` + rows.map((x) => `- ${x.customer || '?'}: ${x.what || ''} ${x.place ? '@ ' + x.place : ''}`).join('\n');

// ---- 18 monthly halal check (a fixed checklist, you tick it yourself) ----
const halalText = (month) => `MONTHLY HALAL CHECK ${month}\n1) No interest (riba) paid or taken on any loan, overdraft or late fee.\n2) Every supplier price, discount and fee was agreed before delivery.\n3) No stock sold that we do not own or cannot supply.\n4) Zakat date and amount reviewed with the accountant.\n5) Staff paid on time and fairly.\nReply to Ajmal's chat if any point needs attention.`;

// ---- 8 bank statement matching: CSV with date, description, debit; matches cheque numbers or amounts ----
function parseStatement(csv) {
  return String(csv).split(/\r?\n/).map((l) => l.split(',').map((s) => s.trim().replace(/^"|"$/g, ''))).filter((c) => c.length >= 3 && /^\d{4}-\d{2}-\d{2}$|^\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}$/.test(c[0]))
    .map((c) => ({ date: c[0], text: c[1], amount: Math.abs(parseFloat(String(c[2]).replace(/[^0-9.\-]/g, ''))) })).filter((x) => x.amount > 0);
}
function matchStatement(lines, cheques) {
  const used = new Set(), matched = [], unmatchedLines = [];
  for (const l of lines) {
    const hit = cheques.find((c) => !used.has(c.cheque_no) && (new RegExp(`\\b0*${String(c.cheque_no).replace(/^0+/, '')}\\b`).test(l.text) || Math.abs(Number(c.amount) - l.amount) < 0.01));
    if (hit) { used.add(hit.cheque_no); matched.push({ cheque_no: hit.cheque_no, date: l.date, amount: l.amount }); } else unmatchedLines.push(l);
  }
  return { matched, unmatchedLines, unclearedCheques: cheques.filter((c) => !used.has(c.cheque_no)) };
}
const matchText = (m) => `BANK MATCH: ${m.matched.length} cheques cleared on the statement, ${m.unclearedCheques.length} still not cleared, ${m.unmatchedLines.length} statement lines with no cheque.`;

// ---- 6 quote PDF (pdfkit) ----
async function quotePdf(pool, quoteId, outDir, shopName = 'Royal Bath Hub') {
  const PDFDocument = require('pdfkit');
  const q = (await pool.query(`SELECT q.*, c.name AS cname, c.phone FROM quotations q LEFT JOIN customers c ON c.id = q.customer_id WHERE q.id = $1`, [quoteId])).rows[0];
  if (!q) throw new Error('quotation not found');
  const items = (await pool.query(`SELECT description, qty, unit_price, line_total FROM quotation_items WHERE quotation_id = $1 ORDER BY sort_order, id`, [quoteId])).rows;
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `quote_${quoteId}.pdf`);
  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40 }); const s = fs.createWriteStream(file); doc.pipe(s); s.on('finish', resolve); s.on('error', reject);
    doc.fontSize(18).text(shopName).fontSize(11).text(`Quotation ${quoteId}  |  ${String(q.quote_date).slice(0, 10)}  |  valid until ${String(q.valid_until || '').slice(0, 10)}`).text(`Customer: ${q.cname || ''} ${q.phone || ''}`).moveDown();
    items.forEach((i) => doc.text(`${i.description}   ${Number(i.qty)} x ${rs(i.unit_price)} = ${rs(i.line_total)}`));
    doc.moveDown().text(`Subtotal ${rs(q.subtotal)}   Discount ${rs(q.discount)}`).fontSize(14).text(`TOTAL ${rs(q.total)}`);
    doc.end();
  });
  return file;
}

// ---- 10 TikTok idea + Sinhala caption, 11 Google Business post: DRAFT text from the best seller of the week ----
async function topItem(pool) {
  return (await pool.query(`SELECT i.item_name, SUM(i.qty) AS q FROM pos_bill_items i JOIN pos_bills b ON b.id = i.bill_id WHERE b.created_at > NOW() - INTERVAL '7 days' GROUP BY i.item_name ORDER BY q DESC LIMIT 1`)).rows[0];
}
function socialDrafts(item, week) {
  const name = item ? item.item_name : 'our bathroom accessories';
  return `SOCIAL DRAFTS ${week} (posting is on hold; copy only if you want)\nTikTok idea: 15-second video, the ${name} before and after fitting, close-up of the finish, end with "Royal Bath Hub".\nSinhala caption (check the wording before use): ${name} - ඔබේ නාන කාමරයට අලුත් පෙනුමක්. Royal Bath Hub\nGoogle Business post: This week's favourite at Royal Bath Hub: ${name}. Visit us or message us on WhatsApp for the price and fitting advice.`;
}

// ---- 13 competitor price look (public pages only, config/competitors.json = { items:[{name,url,regex}] }) ----
async function competitorPrices(file, fetchFn = (typeof fetch === 'function' ? fetch : null)) {
  const cfg = readJson(file, { items: [] }).items || [], out = [];
  if (!fetchFn) return out;
  for (const c of cfg.slice(0, 10)) {
    try {
      if (!/^https:\/\//.test(c.url)) continue;
      const html = await (await fetchFn(c.url, { redirect: 'follow' })).text();
      const m = new RegExp(c.regex || 'Rs\\.?\\s*([0-9,]+)', 'i').exec(html);
      if (m) out.push({ name: c.name, url: c.url, price: Number(String(m[1]).replace(/,/g, '')) });
    } catch (_) { /* public page unreachable: skipped */ }
  }
  return out;
}
const competitorText = (rows) => `COMPETITOR PRICES (public pages, ${rows.length})\n` + rows.map((x) => `- ${x.name}: ${rs(x.price)}`).join('\n');

async function once(pool, job, day) {
  await pool.query(`CREATE TABLE IF NOT EXISTS automation_runs (job TEXT NOT NULL, day DATE NOT NULL, PRIMARY KEY (job, day))`);
  return (await pool.query(`INSERT INTO automation_runs (job, day) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING job`, [job, day])).rows.length > 0;
}

/** Call every ~30 minutes from 04:00 Sri Lanka time, next to automations.runDaily. */
async function runDaily2({ pool, enqueue, now = new Date(), root = process.cwd(), fetchFn }) {
  const sl = new Date(now.getTime() + 5.5 * 3600e3), today = iso(sl), dow = sl.getUTCDay(), done = [];
  if (sl.getUTCHours() < 4) return { done };
  const guard = async (job, fn) => { try { if (await once(pool, job, today)) { await fn(); done.push(job); } } catch (e) { console.error('[automations2]', job, e.message); } };
  const cfg = (f) => path.join(root, 'config', f);
  await guard('hot_leads', async () => { const r = await hotLeads(pool, today); if (r.length) await enqueue(leadNudge(r), 'leads'); });
  await guard('bounced_help', async () => { const r = await bouncedCheques(pool); if (r.length) await enqueue(bouncedHelp(r), 'bounced'); });
  await guard('review_requests', async () => { const r = await reviewBills(pool, today); if (r.length) await enqueue(reviewDraft(r, (readJson(cfg('business.json'), {}) || {}).googleReviewLink), 'review'); });
  await guard('deliveries', async () => { const r = deliveriesTomorrow(cfg('deliveries.json'), today); if (r.length) await enqueue(deliveryText(r), 'delivery'); });
  if (dow === 3) await guard('slow_stock', async () => { const r = await slowStock(pool); if (r.rows.length) await enqueue(slowText(r), 'slow'); });
  if (dow === 5) await guard('social_drafts', async () => enqueue(socialDrafts(await topItem(pool), today), 'social'));
  if (dow === 2) await guard('competitor_prices', async () => { const r = await competitorPrices(cfg('competitors.json'), fetchFn); if (r.length) await enqueue(competitorText(r), 'competitor'); });
  if (sl.getUTCDate() === 1) await guard('halal_check', async () => enqueue(halalText(today.slice(0, 7)), 'halal'));
  return { done };
}
module.exports = { runDaily2, leadNudge, bouncedHelp, slowSuggestion, slowText, reviewDraft, deliveriesTomorrow, deliveryText, halalText, parseStatement, matchStatement, matchText, quotePdf, socialDrafts, competitorPrices, competitorText };
