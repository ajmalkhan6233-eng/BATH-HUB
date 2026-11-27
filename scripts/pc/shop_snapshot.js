'use strict';
// SHOP SNAPSHOT (22 Nov 2026). READ ONLY on the shop data. Writes ONE small file for Claude chat to read:
//   C:\Users\Sony\ai-bridge\AI_BRIDGE\SHOP_SNAPSHOT.md   (overwritten each run, under 6 KB)
// Numbers use the same rules as the screens: real finished bills only (voided bills out), cost = the cost kept on the bill line, else the item's average cost,
// maths in utils/profit.js (aggregate, rollup), same queries as routes/profit.js. No customer names, no phone numbers, no bank or cheque numbers, no passwords.
// Run by Windows Task Scheduler "RBH_Snapshot" every 5 minutes. The file is pushed to the PRIVATE bridge repo at most once an hour (never to a public repo).
const fs = require('fs');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
require('dotenv').config({ path: path.join(ROOT, '.env'), quiet: true });
const pool = require(path.join(ROOT, 'utils', 'pool'));
const P = require(path.join(ROOT, 'utils', 'profit'));

const BRIDGE = process.env.RBH_BRIDGE_DIR || 'C:\\Users\\Sony\\ai-bridge';
const OUT = path.join(BRIDGE, 'AI_BRIDGE', 'SHOP_SNAPSHOT.md');
const STAMP = path.join(ROOT, 'data', '.snapshot_last_push');
const FROM = '2026-10-29';
const rs = n => 'Rs ' + Math.round(Number(n) || 0).toLocaleString('en-US');
const pc = (a, b) => (b > 0 ? (a / b * 100).toFixed(1) + '%' : 'NOT FOUND');
const NF = 'NOT FOUND';
const colombo = d => new Date(new Date(d).getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
const safe = async (sql, args) => { try { return (await pool.query(sql, args || [])).rows; } catch (e) { return null; } };
const health = () => new Promise(res => { const r = http.get('http://127.0.0.1:' + (process.env.PORT || 3100) + '/health', { timeout: 4000 }, x => { let b = ''; x.on('data', c => (b += c)); x.on('end', () => { try { res({ ok: x.statusCode === 200, build: JSON.parse(b).build }); } catch (e) { res({ ok: x.statusCode === 200 }); } }); }); r.on('error', () => res({ ok: false })); r.on('timeout', () => { r.destroy(); res({ ok: false }); }); });

(async () => {
  const L = [];
  const now = new Date(), today = colombo(now);
  const h = await health();
  let build = h.build; if (!build) { try { build = (fs.readFileSync(path.join(ROOT, 'public', 'service-worker.js'), 'utf8').match(/VERSION\s*=\s*'([^']+)'/) || [])[1]; } catch (e) {} }
  L.push('Updated: ' + today + ' ' + new Date(now.getTime() + 5.5 * 3600 * 1000).toISOString().slice(11, 16) + ' (build ' + (build || NF) + ', health ' + (h.ok ? 'ok' : 'down') + ')');
  L.push('Real finished bills only (voids out). Cost = cost kept on the bill line, else item average cost (an estimate). Period starts ' + FROM + '.');

  // ---- bills with cost, per bill (same rule as routes/profit.js)
  const billRows = await safe(`SELECT b.id, b.bill_number, b.created_at, b.subtotal, b.total, b.discount_amount, b.payment_method,
      COALESCE(SUM(i.qty * COALESCE(NULLIF(i.unit_cost,0), p.avg_cost, 0)),0) AS cost, COUNT(i.id) FILTER (WHERE COALESCE(NULLIF(i.unit_cost,0), p.avg_cost, 0) = 0) AS no_cost
    FROM pos_bills b LEFT JOIN pos_bill_items i ON i.bill_id = b.id LEFT JOIN products p ON p.item_code = i.item_code
    WHERE NOT EXISTS (SELECT 1 FROM pos_bill_voids v WHERE v.bill_id = b.id) GROUP BY b.id`);
  const bills = (billRows || []).map(b => ({ id: b.id, no: b.bill_number, day: colombo(b.created_at), subtotal: Number(b.subtotal) || 0, total: Number(b.total) || 0, discount: Number(b.discount_amount) || 0, method: b.payment_method, cost: Number(b.cost) || 0, no_cost: Number(b.no_cost) || 0 }));
  const period = bills.filter(b => b.day >= FROM), todays = bills.filter(b => b.day === today);
  const inP = d => d && String(d).slice(0, 10) >= FROM;
  const expenses = ((await safe('SELECT report_date::text AS day, amount FROM expenses_detail')) || []).filter(r => inP(r.day));
  const salaries = ((await safe('SELECT pay_date::text AS day, amount FROM staff_salary')) || []).filter(r => inP(r.day));
  const comms = ((await safe('SELECT sale_date::text AS day, commission_amount AS amount FROM sale_commissions')) || []).filter(r => inP(r.day));
  let adj = []; try { adj = (await require(path.join(ROOT, 'utils', 'oversold')).costAdjustments(pool).catch(() => [])).filter(r => r.day && String(r.day).slice(0, 10) >= FROM); } catch (e) {}
  const agg = (bs, ex, sa, co, ad) => P.aggregate({ bills: bs.map(b => ({ day: b.day, total: b.total, discount: b.discount, cost: b.cost, no_cost: b.no_cost })), expenses: ex, salaries: sa, commissions: co, cogsAdjust: ad }, 'year').total;
  const T = agg(period, expenses, salaries, comms, adj);
  const tdg = agg(todays, [], [], [], []);

  // ---- a. Today
  const cashToday = ((await safe(`SELECT COALESCE(SUM(amount),0) AS s FROM (
      SELECT p.amount FROM pos_bill_payments p JOIN pos_bills b ON b.id = p.bill_id WHERE LOWER(p.method) = 'cash' AND (b.created_at AT TIME ZONE 'Asia/Colombo')::date = $1::date
        AND NOT EXISTS (SELECT 1 FROM pos_bill_voids v WHERE v.bill_id = b.id)
      UNION ALL SELECT b.total FROM pos_bills b WHERE LOWER(COALESCE(b.payment_method,'cash')) = 'cash' AND (b.created_at AT TIME ZONE 'Asia/Colombo')::date = $1::date
        AND NOT EXISTS (SELECT 1 FROM pos_bill_voids v WHERE v.bill_id = b.id) AND NOT EXISTS (SELECT 1 FROM pos_bill_payments p WHERE p.bill_id = b.id)) z`, [today])) || [{ s: null }])[0].s;
  L.push('', '## Today (' + today + ')');
  L.push('Bills ' + todays.length + ' | sales ' + rs(tdg.sales) + ' | cash in ' + (cashToday == null ? NF : rs(cashToday)) + ' | discount given ' + rs(tdg.discount) + ' | gross profit ' + rs(tdg.gross) + (tdg.lines_without_cost ? ' (' + tdg.lines_without_cost + ' lines without cost)' : ''));

  // ---- b. Since 29 Oct
  const listPrice = period.reduce((s, b) => s + b.subtotal, 0), disc = period.reduce((s, b) => s + b.discount, 0);
  const split = {};
  const pays = await safe(`SELECT LOWER(p.method) AS m, SUM(p.amount) AS s FROM pos_bill_payments p JOIN pos_bills b ON b.id = p.bill_id
      WHERE (b.created_at AT TIME ZONE 'Asia/Colombo')::date >= $1::date AND NOT EXISTS (SELECT 1 FROM pos_bill_voids v WHERE v.bill_id = b.id) GROUP BY 1`, [FROM]);
  for (const r of pays || []) split[r.m] = (split[r.m] || 0) + Number(r.s);
  const noPay = await safe(`SELECT LOWER(COALESCE(b.payment_method,'cash')) AS m, SUM(b.total) AS s FROM pos_bills b
      WHERE (b.created_at AT TIME ZONE 'Asia/Colombo')::date >= $1::date AND NOT EXISTS (SELECT 1 FROM pos_bill_voids v WHERE v.bill_id = b.id)
        AND NOT EXISTS (SELECT 1 FROM pos_bill_payments p WHERE p.bill_id = b.id) GROUP BY 1`, [FROM]);
  for (const r of noPay || []) split[r.m] = (split[r.m] || 0) + Number(r.s);
  const bucket = k => (/cash/.test(k) ? 'Cash' : /card/.test(k) ? 'Card' : /cheque|check/.test(k) ? 'Cheque' : /credit/.test(k) ? 'Credit' : /online|transfer|bank/.test(k) ? 'Transfer' : 'Other');
  const sp = {}; for (const k of Object.keys(split)) sp[bucket(k)] = (sp[bucket(k)] || 0) + split[k];
  const credOwed = ((await safe('SELECT COALESCE(SUM(amount - paid),0) AS s FROM credit_customers WHERE COALESCE(quarantined,false) = false AND amount > paid')) || [{ s: null }])[0].s;
  const firstBill = bills.length ? bills.map(b => b.day).sort()[0] : NF;
  L.push('', '## Since ' + FROM + ' (first real bill: ' + firstBill + ')');
  L.push('Bills ' + T.bills + ' | average bill ' + rs(T.bills ? T.sales / T.bills : 0) + ' | total sales ' + rs(T.sales));
  L.push('Split: ' + ['Cash', 'Card', 'Cheque', 'Credit', 'Transfer', 'Other'].filter(k => sp[k]).map(k => k + ' ' + rs(sp[k])).join(' | '));
  L.push('Credit owed to us: ' + (credOwed == null ? NF : rs(credOwed)));
  L.push('List price total ' + rs(listPrice) + ' | discount ' + rs(disc) + ' (' + pc(disc, listPrice) + ' of list) | bills with a discount ' + period.filter(b => b.discount > 0).length);
  L.push('Cost of goods ' + rs(T.cogs) + ' | gross profit ' + rs(T.gross) + ' (' + (T.margin_pct == null ? NF : T.margin_pct + '%') + ')');
  L.push('Expenses: rent/other ' + rs(T.expenses) + ' | salary ' + rs(T.salary) + ' | commission ' + rs(T.commissions) + (T.expenses + T.salary + T.commissions === 0 ? ' (none recorded in the app)' : '') + ' | net profit ' + rs(T.net) + ' (' + pc(T.net, T.sales) + ' of sales)');
  { const st = {}; (((await safe("SELECT key, value FROM app_settings WHERE key IN ('running_cost_per_day','running_cost_from')")) || [])).forEach(r => { st[r.key] = r.value; });
    const rc = Number(st.running_cost_per_day || 0), rf = String(st.running_cost_from || '').slice(0, 10);
    if (rc > 0 && rf) { const days = Math.max(0, Math.round((new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z') - new Date(rf + 'T00:00:00Z')) / 864e5) + 1);
      const gpRun = bills.filter(b => b.day >= rf).reduce((a, b) => a + Number(b.total) - Number(b.cost), 0);
      L.push('NET PROFIT (AJ rule): gross profit since ' + rf + ' ' + rs(gpRun) + ' minus ' + rs(rc) + ' a day x ' + days + ' days = ' + rs(gpRun - rc * days) + ' (the ' + rs(rc) + ' covers his and Jazeel salary, bills, transport, renovation credit, rough)'); } }

  // ---- c. Margins, best and worst items, biggest discounts
  const lines = ((await safe(`SELECT (b.created_at AT TIME ZONE 'Asia/Colombo')::date::text AS day, i.item_code, i.item_name, i.qty,
      i.line_total * CASE WHEN b.subtotal > 0 THEN b.total / b.subtotal ELSE 1 END AS revenue,
      i.qty * COALESCE(NULLIF(i.unit_cost,0), p.avg_cost, 0) AS cost, p.category, COALESCE(NULLIF(p.preferred_supplier,''), p.vendor_code) AS vendor
    FROM pos_bill_items i JOIN pos_bills b ON b.id = i.bill_id LEFT JOIN products p ON p.item_code = i.item_code
    WHERE NOT EXISTS (SELECT 1 FROM pos_bill_voids v WHERE v.bill_id = b.id)`)) || []).filter(r => r.day >= FROM);
  const cat = P.rollup(lines, 'category'), items = P.rollup(lines, 'item');
  const ven = P.rollup(lines.map(r => Object.assign({}, r, { category: r.vendor || 'No vendor' })), 'category').sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  const fmt = r => r.name + ' ' + (r.margin_pct == null ? NF : r.margin_pct + '%') + ' (' + rs(r.profit) + ')';
  L.push('', '## Margin');
  L.push('By category: ' + (cat.length ? cat.map(fmt).join(' | ') : NF));
  L.push('Top 10 vendors by sales: ' + (ven.length ? ven.map(fmt).join(' | ') : NF));
  L.push('10 best items (Rs profit): ' + (items.slice(0, 10).map(r => r.name.slice(0, 28) + ' ' + rs(r.profit)).join(' | ') || NF));
  L.push('10 worst items (Rs profit): ' + (items.slice(-10).reverse().map(r => r.name.slice(0, 28) + ' ' + rs(r.profit)).join(' | ') || NF));
  const bigDisc = period.filter(b => b.subtotal > 0 && b.discount > 0).map(b => ({ no: b.no, pct: b.discount / b.subtotal * 100, id: b.id })).sort((a, b) => b.pct - a.pct).slice(0, 5);
  const topItem = {};
  for (const d of bigDisc) { const r = await safe('SELECT item_name FROM pos_bill_items WHERE bill_id = $1 ORDER BY line_total DESC LIMIT 1', [d.id]); topItem[d.id] = r && r[0] ? r[0].item_name.slice(0, 28) : NF; }
  L.push('5 biggest discounts (bill, biggest item on it, % of bill list price; a bill stores one discount, not one per item): ' + (bigDisc.map(d => d.no + ', ' + topItem[d.id] + ', ' + d.pct.toFixed(1) + '%').join(' | ') || NF));

  // ---- d. Stock
  const st = await safe(`SELECT COUNT(*)::int AS n, COUNT(*) FILTER (WHERE stock_level <= 0)::int AS zero, COALESCE(SUM(GREATEST(stock_level,0) * COALESCE(avg_cost,0)),0) AS val FROM products WHERE active = true`);
  const low = await safe(`SELECT p.item_code, p.name, p.stock_level, s.q FROM products p JOIN (SELECT i.item_code, SUM(i.qty) AS q FROM pos_bill_items i JOIN pos_bills b ON b.id = i.bill_id
      WHERE (b.created_at AT TIME ZONE 'Asia/Colombo')::date >= $1::date AND NOT EXISTS (SELECT 1 FROM pos_bill_voids v WHERE v.bill_id = b.id) GROUP BY 1 ORDER BY 2 DESC LIMIT 40) s ON s.item_code = p.item_code
      WHERE p.active = true ORDER BY p.stock_level ASC, s.q DESC LIMIT 10`, [FROM]);
  L.push('', '## Stock');
  L.push(st && st[0] ? 'Items on sale ' + st[0].n + ' | items at 0: ' + st[0].zero + ' | stock value at cost ' + rs(st[0].val) : NF);
  L.push('10 lowest-stock best sellers: ' + ((low || []).map(r => r.item_code + ' ' + String(r.name).slice(0, 24) + ' (' + Number(r.stock_level) + ' left)').join(' | ') || NF));

  // ---- e. Money out
  const vb = await safe(`SELECT b.vendor_name, b.total - COALESCE(p.paid,0) - COALESCE(n.cn,0) AS owed FROM vendor_bills b
      LEFT JOIN (SELECT bill_id, SUM(amount) AS paid FROM vendor_payments GROUP BY bill_id) p ON p.bill_id = b.id
      LEFT JOIN (SELECT bill_id, SUM(amount) AS cn FROM vendor_credit_notes GROUP BY bill_id) n ON n.bill_id = b.id
      WHERE b.voided = false AND b.total - COALESCE(p.paid,0) - COALESCE(n.cn,0) > 0`);
  const vmap = {}; for (const r of vb || []) vmap[r.vendor_name || '?'] = (vmap[r.vendor_name || '?'] || 0) + Number(r.owed);
  const vtop = Object.entries(vmap).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const ch = await safe(`SELECT due_date::text AS d, amount FROM cheque_register WHERE status IN ('pending','held') AND due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 14 ORDER BY due_date`);
  L.push('', '## Money out');
  L.push('Vendors owed (open bills): ' + (vb ? rs(Object.values(vmap).reduce((a, b) => a + b, 0)) + ' | top 5: ' + vtop.map(([n, v]) => n + ' ' + rs(v)).join(' | ') : NF));
  L.push('Cheques due in the next 14 days (date, amount): ' + (ch ? (ch.length ? ch.map(r => r.d + ' ' + rs(r.amount)).join(' | ') : 'none') : NF));
  L.push('Cash in hand: NOT FOUND (the app keeps no running cash-in-hand figure; today\'s cash in is above)');

  // ---- e2. Advance orders and returns (27 Nov, AJ): the chat must see ADV-nnn. No customer names here (same rule as the rest of this file).
  const adv = await safe(`SELECT o.order_no, o.status, o.total, o.advance_amount, o.created_at::date::text AS d, (SELECT string_agg(DISTINCT l->>'item_name', ', ') FROM jsonb_array_elements(o.items) l) AS items
      FROM pos_advance_orders o WHERE o.status = 'open' OR o.created_at >= now() - interval '7 days' ORDER BY o.id DESC LIMIT 12`);
  const advToday = await safe(`SELECT COALESCE(SUM(amount),0) AS s FROM pos_advance_payments WHERE (paid_at AT TIME ZONE 'Asia/Colombo')::date = (now() AT TIME ZONE 'Asia/Colombo')::date`);
  const rets = await safe(`SELECT COUNT(*)::int AS n, COALESCE(-SUM(b.total),0) AS s FROM pos_sale_returns r JOIN pos_bills b ON b.id = r.return_bill_id WHERE (r.created_at AT TIME ZONE 'Asia/Colombo')::date = (now() AT TIME ZONE 'Asia/Colombo')::date`);
  L.push('', '## Advance orders (goods reserved, not sales yet) and returns');
  L.push('Advance money taken today (not a sale): ' + (advToday && advToday[0] ? rs(advToday[0].s) : NF) + ' | returns today: ' + (rets && rets[0] ? rets[0].n + ' for ' + rs(rets[0].s) : NF));
  L.push('Orders (no, status, total, advance, date, items): ' + (adv ? (adv.length ? adv.map(r => r.order_no + ' ' + r.status + ' ' + rs(r.total) + ' adv ' + rs(r.advance_amount) + ' ' + r.d + ' ' + String(r.items || '').slice(0, 40)).join(' // ') : 'none') : NF));

  // ---- f. Open tasks (customer names and long numbers redacted)
  const names = new Set(); for (const r of (await safe(`SELECT DISTINCT customer_name AS n FROM pos_bills WHERE customer_name IS NOT NULL UNION SELECT DISTINCT name FROM customers WHERE name IS NOT NULL`)) || []) { const n = String(r.n || '').trim(); if (n.length >= 4 && !/^(walk-in customer|cash)$/i.test(n)) names.add(n); }
  const clean = s => { let o = String(s || ''); for (const n of names) o = o.split(n).join('[customer]'); return o.replace(/\+?\d[\d ]{8,}\d/g, '[number]').replace(/[^\x20-\x7E]/g, '').slice(0, 130); };
  const tail = f => { try { return fs.readFileSync(f, 'utf8').split(/\r?\n/).filter(Boolean); } catch (e) { return null; } };
  const live = tail(path.join(BRIDGE, 'AI_BRIDGE', 'LIVE.md')), nd = tail(path.join(ROOT, 'AI_MEMORY', 'NOT_DONE.md'));
  L.push('', '## Open tasks');
  L.push('Latest LIVE lines (time, who, title, status only): ' + (live ? live.slice(0, 6).map(l => clean(l.split('|').slice(0, 4).join('|'))).join(' // ') : NF));
  L.push('NOT_DONE titles: ' + (nd ? nd.filter(l => /^[#\-*\d]/.test(l)).slice(0, 6).map(clean).join(' // ') || NF : NF));

  let txt = L.join('\n') + '\n';
  if (Buffer.byteLength(txt) > 6000) txt = txt.slice(0, 5900) + '\n(cut: over 6 KB)\n';
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, txt);
  console.log('snapshot written', Buffer.byteLength(txt), 'bytes');

  // ---- push to the PRIVATE bridge repo at most once an hour (never a public repo)
  try {
    const last = fs.existsSync(STAMP) ? Number(fs.readFileSync(STAMP, 'utf8')) || 0 : 0;
    if (Date.now() - last > 3600 * 1000 && fs.existsSync(path.join(BRIDGE, '.git'))) {
      const g = (...a) => execFileSync('git', ['-C', BRIDGE, ...a], { stdio: 'pipe', timeout: 60000 }).toString();
      const rel = 'AI_BRIDGE/SHOP_SNAPSHOT.md';
      try { g('update-index', '--no-assume-unchanged', rel); } catch (e) {}
      g('add', '-f', rel);
      try { g('commit', '-q', '-o', rel, '-m', 'SHOP_SNAPSHOT (auto, hourly)'); g('-c', 'rebase.autoStash=true', 'pull', '--rebase', '-q'); g('push', '-q'); fs.mkdirSync(path.dirname(STAMP), { recursive: true }); fs.writeFileSync(STAMP, String(Date.now())); } catch (e) { console.log('push skipped:', String(e.message).split('\n')[0]); }
      try { g('update-index', '--assume-unchanged', rel); } catch (e) {}
    }
  } catch (e) { console.log('push step skipped:', String(e.message).split('\n')[0]); }
  await pool.end();
})().catch(e => { console.error('SNAPSHOT FAILED:', e.message); process.exit(1); });
