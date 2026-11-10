'use strict';
/**
 * POCKET SNAPSHOT (10 Nov 2026). Feeds the phone app "RBH Pocket" so AJ can see the shop numbers with the PC off.
 * Every 10 minutes the app (read-only SQL, same rules as /api/dashboard-pro and /api/due-board) builds ONE small summary,
 * locks it with AJ's passcode (AES-256-GCM, key from PBKDF2) and posts the locked copy to a free Cloudflare Worker (cloudflare/pocket_worker.js).
 * The cloud only ever holds the LOCKED copy. The passcode never leaves this PC and the phone.
 * It changes nothing in the shop data. Switched off unless all three are in .env: POCKET_URL, POCKET_PUSH_SECRET, POCKET_PASSCODE.
 */
const crypto = require('crypto');

const ITER = 310000;                 // PBKDF2 rounds. The phone app (pocket/app.js) must use the same number.
const NV = `LEFT JOIN pos_bill_voids v ON v.bill_id = b.id WHERE v.bill_id IS NULL`;   // live (not voided) bills

const num = (x) => Number(x) || 0;
const ymd = (d) => (d instanceof Date ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : (d ? String(d).slice(0, 10) : null));

async function rows(pool, sql, params) { try { return (await pool.query(sql, params)).rows; } catch (e) { console.error('[pocket]', e.message); return null; } }

/** Plain object, only what the phone shows. Any part that fails to read comes back as null (the phone shows "no data"). */
async function build(pool, now = new Date()) {
  const [tot, pays, low, stock, bills, cheques, top] = await Promise.all([
    rows(pool, `SELECT
        COALESCE(SUM(total) FILTER (WHERE d = CURRENT_DATE),0) AS today, COUNT(*) FILTER (WHERE d = CURRENT_DATE) AS bills_today,
        COALESCE(SUM(total) FILTER (WHERE d = CURRENT_DATE - 1),0) AS yesterday,
        COALESCE(SUM(total) FILTER (WHERE d >= date_trunc('week', CURRENT_DATE)::date),0) AS week,
        COALESCE(SUM(total) FILTER (WHERE d >= date_trunc('month', CURRENT_DATE)::date),0) AS month
      FROM (SELECT b.created_at::date AS d, b.total FROM pos_bills b ${NV} AND b.created_at::date >= date_trunc('month', CURRENT_DATE)::date - 7) x`),
    rows(pool, `SELECT method, SUM(amount) AS amount FROM (
          SELECT p.method, p.amount FROM pos_bill_payments p JOIN pos_bills b ON b.id = p.bill_id ${NV} AND b.created_at::date = CURRENT_DATE
          UNION ALL SELECT COALESCE(b.payment_method,'cash'), b.total FROM pos_bills b ${NV} AND b.created_at::date = CURRENT_DATE
            AND NOT EXISTS (SELECT 1 FROM pos_bill_payments p WHERE p.bill_id = b.id)) z GROUP BY method ORDER BY 2 DESC`),
    rows(pool, `SELECT item_code, name, stock_level, reorder_threshold FROM products WHERE active = true AND stock_level > 0
        AND reorder_threshold > 0 AND stock_level <= reorder_threshold ORDER BY (stock_level::float / reorder_threshold) ASC, name LIMIT 15`),
    rows(pool, `SELECT COUNT(*) AS items, COUNT(*) FILTER (WHERE stock_level <= 0) AS out_of_stock,
        COUNT(*) FILTER (WHERE stock_level > 0 AND reorder_threshold > 0 AND stock_level <= reorder_threshold) AS low_stock FROM products WHERE active = true`),
    rows(pool, `SELECT b.vendor_name, b.bill_no, b.due_date, b.total - COALESCE(p.paid,0) - COALESCE(n.cn,0) AS owed FROM vendor_bills b
      LEFT JOIN (SELECT bill_id, SUM(amount) AS paid FROM vendor_payments GROUP BY bill_id) p ON p.bill_id = b.id
      LEFT JOIN (SELECT bill_id, SUM(amount) AS cn FROM vendor_credit_notes GROUP BY bill_id) n ON n.bill_id = b.id
      WHERE b.voided = false AND b.total - COALESCE(p.paid,0) - COALESCE(n.cn,0) > 0 ORDER BY b.due_date NULLS LAST, b.id LIMIT 200`),
    rows(pool, `SELECT payee, cheque_no, amount, due_date, status FROM cheque_register WHERE status IN ('pending','held') ORDER BY due_date, id LIMIT 200`),
    rows(pool, `SELECT i.item_name AS name, SUM(i.qty) AS qty, SUM(i.line_total) AS revenue FROM pos_bill_items i JOIN pos_bills b ON b.id = i.bill_id ${NV}
        AND b.created_at::date >= date_trunc('month', CURRENT_DATE)::date GROUP BY 1 ORDER BY 3 DESC LIMIT 5`),
  ]);

  const t = tot && tot[0];
  const today = ymd(new Date(now.getTime() + 5.5 * 3600e3));        // Sri Lanka date, for overdue maths
  const dueItems = [
    ...(bills || []).map((r) => ({ kind: 'bill', who: r.vendor_name, ref: r.bill_no, due: ymd(r.due_date), amount: num(r.owed) })),
    ...(cheques || []).map((r) => ({ kind: 'cheque', who: r.payee, ref: r.cheque_no, due: ymd(r.due_date), amount: num(r.amount) })),
  ].sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
  const overdue = dueItems.filter((x) => x.due && x.due < today);

  return {
    v: 1,
    at: now.toISOString(),
    sales: t ? { today: num(t.today), bills_today: num(t.bills_today), yesterday: num(t.yesterday), week: num(t.week), month: num(t.month) } : null,
    pays_today: pays ? pays.map((r) => ({ method: r.method, amount: num(r.amount) })) : null,
    top_month: top ? top.map((r) => ({ name: r.name, qty: num(r.qty), revenue: num(r.revenue) })) : null,
    stock: stock && stock[0] ? { items: num(stock[0].items), out: num(stock[0].out_of_stock), low: num(stock[0].low_stock),
      low_list: (low || []).map((r) => ({ code: r.item_code, name: r.name, qty: num(r.stock_level), min: num(r.reorder_threshold) })) } : null,
    due: (bills || cheques) ? { overdue_count: overdue.length, overdue_amount: overdue.reduce((s, x) => s + x.amount, 0),
      next: dueItems.slice(0, 15) } : null,
  };
}

const b64 = (buf) => Buffer.from(buf).toString('base64');

/** Lock an object with a passcode. Output is plain JSON the phone can unlock with WebCrypto. */
function lock(obj, passcode) {
  const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12);
  const key = crypto.pbkdf2Sync(String(passcode), salt, ITER, 32, 'sha256');
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final(), c.getAuthTag()]);   // tag last = WebCrypto layout
  return { v: 1, iter: ITER, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
}

async function push(sealed, { url, secret, fetchFn = globalThis.fetch }) {
  const r = await fetchFn(String(url).replace(/\/+$/, '') + '/snap', {
    method: 'PUT', headers: { Authorization: 'Bearer ' + secret, 'Content-Type': 'application/json' }, body: JSON.stringify(sealed),
  });
  if (!r.ok) throw new Error('pocket push HTTP ' + r.status);
  return true;
}

function configured(env = process.env) { return !!(env.POCKET_URL && env.POCKET_PUSH_SECRET && env.POCKET_PASSCODE); }

async function runOnce(pool, env = process.env, deps = {}) {
  if (!configured(env)) return { ran: false, reason: 'not configured' };
  const snap = await (deps.build || build)(pool);
  await push(lock(snap, env.POCKET_PASSCODE), { url: env.POCKET_URL, secret: env.POCKET_PUSH_SECRET, fetchFn: deps.fetchFn });
  return { ran: true, at: snap.at };
}

function start(pool, everyMs = 10 * 60 * 1000) {
  if (!configured()) return null;
  const tick = () => runOnce(pool).catch((e) => console.error('[pocket]', e.message));
  setTimeout(tick, 45 * 1000).unref();
  return setInterval(tick, everyMs).unref();
}

module.exports = { build, lock, push, runOnce, start, configured, ITER };
