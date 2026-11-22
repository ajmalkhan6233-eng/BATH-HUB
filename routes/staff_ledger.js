'use strict';
// Staff ledger (AJ 18 Nov 2026): one statement per staff member: salary earned each day, commission earned, what was paid, what was borrowed and repaid, the balance.
// Owner/admin only. Own table staff_ledger. Commission is NOT stored: it is worked out live from the POS bills the person sold
// (salesman on the bill, 5% of gross profit, from commission_from), so a voided bill takes its commission away automatically.
// Daily salary rows are added automatically up to today (once per day) when the staff member has a setting staff_daily_salary_<id>.
//   GET  /api/staff-ledger/:staffId?from=YYYY-MM-DD&to=YYYY-MM-DD   the statement
//   POST /api/staff-ledger/:staffId        { date, kind, amount, note }   kinds: paid, borrowed, repaid, adjust_up, adjust_down
//   POST /api/staff-ledger/entry/:id/void  { reason }                      nothing is deleted
const express = require('express');
const pool = require('../utils/pool');
const router = express.Router();
const roleOf = req => (req.session && req.session.user && req.session.user.role) || 'staff';
const ownerOnly = (req, res, next) => (['admin', 'owner'].includes(roleOf(req)) ? next() : res.status(403).json({ error: 'Owner only' }));
const r2 = n => Math.round(Number(n || 0) * 100) / 100;
const q = (sql, p) => pool.query(sql, p).then(r => r.rows);
const isDay = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v)) && !isNaN(Date.parse(v));
const KINDS = ['salary', 'paid', 'borrowed', 'repaid', 'adjust_up', 'adjust_down'];
const WHAT = { salary: 'Salary for the day', paid: 'Paid to him', borrowed: 'Borrowed (advance)', repaid: 'Loan repaid', adjust_up: 'Adjustment (he is owed more)', adjust_down: 'Adjustment (he is owed less)', commission: 'Commission earned' };

pool.query(`CREATE TABLE IF NOT EXISTS staff_ledger (
  id SERIAL PRIMARY KEY, staff_id INT NOT NULL, entry_date DATE NOT NULL, kind VARCHAR(20) NOT NULL, amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  note TEXT, voided BOOLEAN NOT NULL DEFAULT FALSE, void_reason TEXT, created_by TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
  .then(() => pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS staff_ledger_one_salary_a_day ON staff_ledger (staff_id, entry_date) WHERE kind = 'salary' AND voided = FALSE`))
  .catch(e => console.error('[staff_ledger] migration failed:', e.message));

const userOf = req => (req.session && req.session.user && (req.session.user.username || req.session.user.name)) || 'owner';
const setting = async key => { const r = await q('SELECT value FROM app_settings WHERE key = $1', [key]).catch(() => []); return r.length ? r[0].value : null; };

// add the daily salary rows that are missing, from the day after the last one up to today
async function accrueSalary(staffId) {
  const perDay = Number(await setting('staff_daily_salary_' + staffId) || 0); if (!(perDay > 0)) return;
  const last = (await q(`SELECT to_char(MAX(entry_date),'YYYY-MM-DD') d FROM staff_ledger WHERE staff_id = $1 AND kind = 'salary'`, [staffId]))[0].d;
  if (!last) return;   // the first day is set by the opening entries, never guessed
  await pool.query(`INSERT INTO staff_ledger (staff_id, entry_date, kind, amount, note, created_by)
    SELECT $1, d::date, 'salary', $2, 'daily salary (automatic)', 'auto' FROM generate_series(($3::date + 1), CURRENT_DATE, interval '1 day') d
    ON CONFLICT DO NOTHING`, [staffId, perDay, last]);
}

router.get('/staff-ledger/:staffId', ownerOnly, async (req, res) => {
  try {
    const id = Number(req.params.staffId); if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad staff id' });
    const st = (await q('SELECT id, name FROM staff WHERE id = $1', [id]))[0]; if (!st) return res.status(404).json({ error: 'staff not found' });
    await accrueSalary(id);
    const rows = await q(`SELECT id, to_char(entry_date,'YYYY-MM-DD') d, kind, amount, note, voided, void_reason FROM staff_ledger WHERE staff_id = $1 ORDER BY entry_date, id`, [id]);
    const pct = Number(await setting('commission_pct') || 5), from = String(await setting('commission_from') || '2026-11-18').slice(0, 10);
    const comm = await q(`SELECT to_char(b.created_at::date,'YYYY-MM-DD') d, COUNT(*) n, SUM(b.total) sales,
        SUM(b.total - COALESCE((SELECT SUM(i.qty * COALESCE(NULLIF(i.unit_cost,0), p.avg_cost, 0)) FROM pos_bill_items i LEFT JOIN products p ON p.item_code = i.item_code WHERE i.bill_id = b.id),0)) gp
      FROM pos_bills b WHERE LOWER(COALESCE(b.salesman,'')) = LOWER($1) AND b.created_at::date >= $2::date AND NOT EXISTS (SELECT 1 FROM pos_bill_voids v WHERE v.bill_id = b.id)
      GROUP BY 1 ORDER BY 1`, [st.name, from]);
    const all = rows.filter(r => !r.voided).map(r => ({ d: r.d, id: r.id, kind: r.kind, amount: Number(r.amount), note: r.note }))
      .concat(comm.map(c => ({ d: c.d, id: null, kind: 'commission', amount: r2(Number(c.gp) * pct / 100), note: c.n + ' bill' + (c.n > 1 ? 's' : '') + ', profit ' + r2(c.gp) + ', ' + pct + '%' })))
      .sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : (a.id || 1e9) - (b.id || 1e9)));
    let owed = 0, loan = 0; const tot = { salary: 0, commission: 0, paid: 0, borrowed: 0, repaid: 0, adjust: 0 };
    const lines = all.map(e => {
      let plus = 0, minus = 0;
      if (e.kind === 'salary' || e.kind === 'commission' || e.kind === 'adjust_up') plus = e.amount;
      else if (e.kind === 'paid' || e.kind === 'adjust_down') minus = e.amount;
      owed = r2(owed + plus - minus);
      if (e.kind === 'borrowed') loan = r2(loan + e.amount); if (e.kind === 'repaid') loan = r2(loan - e.amount);
      if (tot[e.kind] !== undefined) tot[e.kind] = r2(tot[e.kind] + e.amount); else if (e.kind.startsWith('adjust')) tot.adjust = r2(tot.adjust + (plus - minus));
      return { id: e.id, date: e.d, what: WHAT[e.kind] || e.kind, kind: e.kind, note: e.note || '', earned: plus || null, paid: minus || null, borrowed: e.kind === 'borrowed' ? e.amount : null, repaid: e.kind === 'repaid' ? e.amount : null, balance: owed, loan };
    });
    const f = isDay(req.query.from) ? req.query.from : null, t = isDay(req.query.to) ? req.query.to : null;
    const shown = lines.filter(l => (!f || l.date >= f) && (!t || l.date <= t));
    // what 5% would have been on everything sold so far (information only: commission counts from commission_from)
    const info = (await q(`SELECT COUNT(*) n, COALESCE(SUM(b.total),0) sales, COALESCE(SUM(b.total - COALESCE((SELECT SUM(i.qty * COALESCE(NULLIF(i.unit_cost,0), p.avg_cost, 0)) FROM pos_bill_items i LEFT JOIN products p ON p.item_code = i.item_code WHERE i.bill_id = b.id),0)),0) gp
      FROM pos_bills b WHERE NOT EXISTS (SELECT 1 FROM pos_bill_voids v WHERE v.bill_id = b.id)`))[0];
    res.json({
      staff: st, as_at: new Date().toISOString(), commission_pct: pct, commission_from: from, lines: shown, voided: rows.filter(r => r.voided).map(r => ({ id: r.id, date: r.d, kind: r.kind, amount: Number(r.amount), reason: r.void_reason })),
      totals: Object.assign({}, tot, { owed_to_him: owed, loan_he_owes: loan }),
      commission_so_far: { bills: Number(info.n), sales: r2(info.sales), profit: r2(info.gp), five_pct_of_profit: r2(Number(info.gp) * pct / 100), five_pct_of_sales: r2(Number(info.sales) * pct / 100) },
    });
  } catch (e) { console.error('[staff_ledger]', e.message); res.status(500).json({ error: 'Could not load the statement' }); }
});

router.post('/staff-ledger/:staffId', ownerOnly, async (req, res) => {
  try {
    const id = Number(req.params.staffId), b = req.body || {}, amount = Number(b.amount);
    if (!Number.isInteger(id) || !(await q('SELECT 1 FROM staff WHERE id = $1', [id])).length) return res.status(404).json({ error: 'staff not found' });
    if (!KINDS.includes(b.kind) || b.kind === 'salary') return res.status(400).json({ error: 'kind must be one of: paid, borrowed, repaid, adjust_up, adjust_down' });
    if (!isDay(b.date)) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) return res.status(400).json({ error: 'amount must be more than 0' });
    if (b.date > new Date(Date.now() + 19800000).toISOString().slice(0, 10)) return res.status(400).json({ error: 'date cannot be in the future' });
    const r = await q('INSERT INTO staff_ledger (staff_id, entry_date, kind, amount, note, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id', [id, b.date, b.kind, amount, String(b.note || '').slice(0, 300) || null, userOf(req)]);
    res.json({ ok: true, id: r[0].id });
  } catch (e) { res.status(500).json({ error: 'Could not save' }); }
});

router.post('/staff-ledger/entry/:id/void', ownerOnly, async (req, res) => {
  try {
    const why = String((req.body || {}).reason || '').trim(); if (why.length < 3) return res.status(400).json({ error: 'A reason is needed' });
    const r = await q(`UPDATE staff_ledger SET voided = TRUE, void_reason = $2 WHERE id = $1 AND voided = FALSE RETURNING id`, [Number(req.params.id), why.slice(0, 300)]);
    if (!r.length) return res.status(404).json({ error: 'entry not found' }); res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Could not void' }); }
});

// Sales commission (AJ 18 Nov): the numbers behind the commission, per salesman and per bill. 5% of PROFIT (sale minus cost), counted from commission_from.
//   GET /api/sales-commission?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/sales-commission', ownerOnly, async (req, res) => {
  try {
    const pct = Number(await setting('commission_pct') || 5), cfrom = String(await setting('commission_from') || '2026-11-18').slice(0, 10);
    const from = isDay(req.query.from) ? req.query.from : cfrom, to = isDay(req.query.to) ? req.query.to : new Date(Date.now() + 19800000).toISOString().slice(0, 10);
    const COST = `COALESCE((SELECT SUM(i.qty * COALESCE(NULLIF(i.unit_cost,0), p.avg_cost, 0)) FROM pos_bill_items i LEFT JOIN products p ON p.item_code = i.item_code WHERE i.bill_id = b.id),0)`;
    const LIVE = 'NOT EXISTS (SELECT 1 FROM pos_bill_voids v WHERE v.bill_id = b.id)';
    const hist = (await q(`SELECT COUNT(*) n, COALESCE(SUM(b.total),0) sales, COALESCE(SUM(b.total - ${COST}),0) gp, MIN(to_char(b.created_at::date,'YYYY-MM-DD')) first FROM pos_bills b WHERE ${LIVE}`))[0];
    const bills = await q(`SELECT b.id, b.bill_number, to_char(b.created_at,'YYYY-MM-DD HH24:MI') t, COALESCE(b.salesman,'') salesman, b.total, (b.total - ${COST}) gp FROM pos_bills b
      WHERE ${LIVE} AND b.created_at::date BETWEEN $1::date AND $2::date ORDER BY b.created_at DESC, b.id DESC LIMIT 300`, [from, to]);
    const comOf = b => (b.salesman && b.salesman.toLowerCase() !== 'ajmal' && b.t.slice(0, 10) >= cfrom ? r2(Number(b.gp) * pct / 100) : 0);
    // commission to pay = only bills from commission_from on (21 Nov: it used to add every bill in the range, even older ones)
    const by = {}; bills.forEach(b => { const k = b.salesman || 'not picked'; const o = by[k] = by[k] || { salesman: k, bills: 0, sales: 0, profit: 0, commission: 0 }; o.bills++; o.sales = r2(o.sales + Number(b.total)); o.profit = r2(o.profit + Number(b.gp)); o.commission = r2(o.commission + comOf(b)); });
    const bySalesman = Object.values(by);
    // staff who have a daily salary set: the page shows their salary + commission + paid + remaining (21 Nov, AJ)
    const ledgerStaff = await q(`SELECT s.id, s.name FROM staff s WHERE EXISTS (SELECT 1 FROM app_settings a WHERE a.key = 'staff_daily_salary_' || s.id) ORDER BY s.id`);
    res.json({
      pct, commission_from: cfrom, from, to, ledger_staff: ledgerStaff,
      history: { bills: Number(hist.n), since: hist.first, sales: r2(hist.sales), profit: r2(hist.gp), commission_on_profit: r2(Number(hist.gp) * pct / 100), commission_on_sales: r2(Number(hist.sales) * pct / 100) },
      by_salesman: bySalesman, bills: bills.map(b => ({ id: b.id, bill: b.bill_number, time: b.t, salesman: b.salesman, total: r2(b.total), profit: r2(b.gp), commission: comOf(b) })),
    });
  } catch (e) { console.error('[sales_commission]', e.message); res.status(500).json({ error: 'Could not load commission' }); }
});

// ---- Salary + commission statement (AJ 22 Nov): one page, by day / by invoice, and a PDF like a payslip. No bill amounts are shown, only invoice numbers and the commission each earned.
//   GET /api/staff-statement/:staffId?from=&to=        JSON
//   GET /api/staff-statement/:staffId/pdf?from=&to=    PDF (A4)
//   "He took" and "Paid" both deduct; they are saved as kind 'paid' (took = note starts with "Took:").
async function buildStatement(id, from, to) {
  const st = (await q('SELECT id, name FROM staff WHERE id = $1', [id]))[0]; if (!st) return null;
  await accrueSalary(id);
  const pretty = st.name.charAt(0).toUpperCase() + st.name.slice(1);
  const rows = await q(`SELECT id, to_char(entry_date,'YYYY-MM-DD') d, kind, amount, note FROM staff_ledger WHERE staff_id = $1 AND voided = FALSE ORDER BY entry_date, id`, [id]);
  const pct = Number(await setting('commission_pct') || 5), cfrom = String(await setting('commission_from') || '2026-11-18').slice(0, 10);
  const bills = await q(`SELECT b.bill_number bn, to_char(b.created_at::date,'YYYY-MM-DD') d,
      (b.total - COALESCE((SELECT SUM(i.qty * COALESCE(NULLIF(i.unit_cost,0), p.avg_cost, 0)) FROM pos_bill_items i LEFT JOIN products p ON p.item_code = i.item_code WHERE i.bill_id = b.id),0)) gp
    FROM pos_bills b WHERE LOWER(COALESCE(b.salesman,'')) = LOWER($1) AND b.created_at::date >= $2::date AND NOT EXISTS (SELECT 1 FROM pos_bill_voids v WHERE v.bill_id = b.id)
    ORDER BY b.created_at, b.id`, [st.name, cfrom]);
  const days = {}; const day = d => (days[d] = days[d] || { date: d, salary: 0, invoices: [], commission: 0, deductions: [], adjust: 0 });
  rows.forEach(r => {
    const o = day(r.d), a = Number(r.amount);
    if (r.kind === 'salary') o.salary = r2(o.salary + a);
    else if (r.kind === 'paid') o.deductions.push({ id: r.id, what: /^took:/i.test(r.note || '') ? 'Taken by ' + pretty : 'Paid to ' + pretty, amount: a, note: String(r.note || '').replace(/^took:\s*/i, '') });
    else if (r.kind === 'adjust_up') o.adjust = r2(o.adjust + a); else if (r.kind === 'adjust_down') o.adjust = r2(o.adjust - a);
  });
  const gpDay = {}; bills.forEach(b => { const o = day(b.d); o.invoices.push({ bill: b.bn, commission: r2(Number(b.gp) * pct / 100) }); gpDay[b.d] = (gpDay[b.d] || 0) + Number(b.gp); });
  Object.keys(gpDay).forEach(d => { const o = days[d]; o.commission = r2(gpDay[d] * pct / 100); const sum = r2(o.invoices.reduce((t, x) => t + x.commission, 0)); if (o.invoices.length) o.invoices[o.invoices.length - 1].commission = r2(o.invoices[o.invoices.length - 1].commission + (o.commission - sum)); });
  const list = Object.values(days).sort((a, b) => (a.date < b.date ? -1 : 1));
  let owed = 0, opening = 0; const out = [], tot = { salary: 0, commission: 0, deducted: 0, adjust: 0 };
  list.forEach(o => {
    if (from && o.date < from) { owed = r2(owed + o.salary + o.commission + o.adjust - o.deductions.reduce((t, x) => t + x.amount, 0)); opening = owed; return; }
    if (to && o.date > to) return;
    const ded = r2(o.deductions.reduce((t, x) => t + x.amount, 0));
    owed = r2(owed + o.salary + o.commission + o.adjust - ded);
    tot.salary = r2(tot.salary + o.salary); tot.commission = r2(tot.commission + o.commission); tot.deducted = r2(tot.deducted + ded); tot.adjust = r2(tot.adjust + o.adjust);
    out.push(Object.assign({}, o, { closing: owed }));
  });
  const name = st.name.charAt(0).toUpperCase() + st.name.slice(1);
  return { staff: { id: st.id, name }, from: from || (list[0] && list[0].date) || null, to: to || null, pct, commission_from: cfrom, opening, days: out, totals: Object.assign(tot, { net_payable: owed }), as_at: new Date().toISOString() };
}
router.get('/staff-statement/:staffId', ownerOnly, async (req, res) => {
  try {
    const id = Number(req.params.staffId); if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad staff id' });
    const d = await buildStatement(id, isDay(req.query.from) ? req.query.from : null, isDay(req.query.to) ? req.query.to : null);
    if (!d) return res.status(404).json({ error: 'staff not found' }); res.json(d);
  } catch (e) { console.error('[staff_statement]', e.message); res.status(500).json({ error: 'Could not load the statement' }); }
});
const rsf = n => Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const he = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const dmy = d => String(d).split('-').reverse().join('-');
function statementHtml(d) {
  let shop = { name: 'ROYAL BATH HUB', address: 'No. 173/1, Kandy Road, Thihariya, Kalagedihena, Sri Lanka', phone: '+94 74 035 5536', email: 'royalbathhub1@gmail.com' };
  try { Object.assign(shop, require('../utils/shopInfo').SHOP || {}); } catch (e) {}
  const body = d.days.map(o => {
    const lines = [];
    if (o.salary) lines.push(['Daily salary', o.salary, null]);
    o.invoices.forEach(i => lines.push(['Sales commission, invoice ' + i.bill, i.commission, null]));
    if (o.adjust) lines.push(['Adjustment', o.adjust > 0 ? o.adjust : null, o.adjust < 0 ? -o.adjust : null]);
    o.deductions.forEach(x => lines.push([x.what + (x.note ? ' (' + x.note + ')' : ''), null, x.amount]));
    if (!lines.length) lines.push(['No entries', null, null]);
    return lines.map((l, i) => '<tr class="' + (i === 0 ? 'first' : '') + '"><td class="d">' + (i === 0 ? he(dmy(o.date)) : '') + '</td><td>' + he(l[0]) + '</td><td class="n">' + (l[1] != null ? rsf(l[1]) : '') + '</td><td class="n">' + (l[2] != null ? rsf(l[2]) : '') + '</td><td class="n b">' + (i === lines.length - 1 ? rsf(o.closing) : '') + '</td></tr>').join('');
  }).join('');
  const T = d.totals;
  return '<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4;margin:14mm 14mm 16mm}*{box-sizing:border-box}body{font:11px/1.45 "Segoe UI",Arial,sans-serif;color:#111;margin:0}' +
    '.top{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #8f670a;padding-bottom:8px}.top h1{font-size:20px;letter-spacing:2px;margin:0;color:#8f670a}.top div{font-size:10px;color:#444;text-align:right}' +
    'h2{font-size:15px;margin:14px 0 2px;letter-spacing:.5px}.meta{display:flex;gap:30px;margin:6px 0 10px;font-size:11px}.meta b{display:block;font-size:12px}' +
    '.sum{display:flex;gap:0;border:1px solid #bbb;margin:8px 0 12px}.sum div{flex:1;padding:6px 8px;border-right:1px solid #ddd}.sum div:last-child{border:0;background:#f6efdc}.sum span{display:block;font-size:9px;color:#666;text-transform:uppercase;letter-spacing:.6px}.sum b{font-size:13px}' +
    'table{width:100%;border-collapse:collapse}th{background:#1a1a1a;color:#fff;text-align:left;padding:5px 6px;font-size:9.5px;text-transform:uppercase;letter-spacing:.6px}th.n,td.n{text-align:right;white-space:nowrap}td{padding:3px 6px;border-bottom:1px solid #eee;vertical-align:top}tr.first td{border-top:1px solid #bbb}td.d{width:72px;font-weight:600;white-space:nowrap}td.b{font-weight:700}tr{page-break-inside:avoid}' +
    '.foot{margin-top:22px;display:flex;justify-content:space-between;font-size:10px;color:#555}.sig{margin-top:34px;display:flex;justify-content:space-between}.sig div{width:44%;border-top:1px solid #333;padding-top:3px;font-size:10px}.note{font-size:9px;color:#777;margin-top:10px}</style></head><body>' +
    '<div class="top"><h1>' + he(shop.name) + '</h1><div>' + he(shop.address) + '<br>Tel ' + he(shop.phone) + ' &middot; ' + he(shop.email) + '</div></div>' +
    '<h2>SALARY &amp; COMMISSION STATEMENT</h2><div class="meta"><div><span>Employee</span><b>' + he(d.staff.name) + '</b></div><div><span>Period</span><b>' + he(dmy(d.from || '')) + ' to ' + he(dmy(d.to || new Date(Date.now() + 19800000).toISOString().slice(0, 10))) + '</b></div><div><span>Commission</span><b>' + d.pct + '% of profit, per invoice</b></div><div><span>Issued</span><b>' + he(dmy(new Date(Date.now() + 19800000).toISOString().slice(0, 10))) + '</b></div></div>' +
    '<div class="sum"><div><span>Brought forward</span><b>Rs ' + rsf(d.opening) + '</b></div><div><span>Salary</span><b>Rs ' + rsf(T.salary) + '</b></div><div><span>Commission</span><b>Rs ' + rsf(T.commission) + '</b></div><div><span>Paid / taken</span><b>Rs ' + rsf(T.deducted) + '</b></div><div><span>Net payable</span><b>Rs ' + rsf(T.net_payable) + '</b></div></div>' +
    '<table><thead><tr><th>Date</th><th>Description</th><th class="n">Earned (Rs)</th><th class="n">Paid / taken (Rs)</th><th class="n">Balance (Rs)</th></tr></thead><tbody>' + body + '</tbody></table>' +
    '<div class="sig"><div>Prepared by (Royal Bath Hub)</div><div>Received by (' + he(d.staff.name) + ')</div></div><div class="note">Computer-generated statement. Commission is shown per invoice number; bill amounts are not shown. Balance = salary + commission minus everything paid or taken, up to that day.</div></body></html>';
}
let pdfChain = Promise.resolve();
router.get('/staff-statement/:staffId/pdf', ownerOnly, async (req, res) => {
  try {
    const id = Number(req.params.staffId); if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad staff id' });
    const d = await buildStatement(id, isDay(req.query.from) ? req.query.from : null, isDay(req.query.to) ? req.query.to : null);
    if (!d) return res.status(404).json({ error: 'staff not found' });
    const html = statementHtml(d);
    const job = pdfChain.then(async () => {
      const puppeteer = require('puppeteer'); const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
      try { const page = await browser.newPage(); await page.setContent(html, { waitUntil: 'load', timeout: 30000 }); return Buffer.from(await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true })); }
      finally { await browser.close().catch(() => {}); }
    });
    pdfChain = job.catch(() => {});
    const buf = await job;
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="salary_statement_' + d.staff.name + '_' + (d.to || new Date().toISOString().slice(0, 10)) + '.pdf"' }); res.send(buf);
  } catch (e) { console.error('[staff_statement_pdf]', e.message); res.status(500).json({ error: 'Could not make the PDF' }); }
});

router.statementHtml = statementHtml;
module.exports = router;
