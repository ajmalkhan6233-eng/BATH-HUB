'use strict';
/**
 * POCKET INBOX (19 Nov 2026). The phone app can now MAKE A BILL and ORDER STOCK. The phone locks the request with AJ's passcode and drops it in the
 * free Cloudflare mailbox (/inbox). This shop PC picks it up every few seconds, opens it with the same passcode (a wrong or forged one cannot open),
 * does it through the app's own normal routes (so every price, discount and stock rule still applies), and leaves a locked answer (/out/<id>).
 * Safe by design: each request id runs ONCE (table pocket_inbox_done), requests older than 24 h are refused, only 2 kinds exist (bill, order),
 * and nothing here can delete or change old records. Off unless POCKET_URL, POCKET_PUSH_SECRET and POCKET_PASSCODE are in .env.
 */
const crypto = require('crypto');
const snap = require('./pocketSnapshot');

const num = (x) => Number(x);
const saltOf = (env) => crypto.createHmac('sha256', String(env.POCKET_PUSH_SECRET)).update('rbh-pocket-salt-v2').digest().subarray(0, 16);

/** Open a locked request. Throws if the passcode, the lock or the salt is wrong. */
function open(sealed, env) {
  const salt = Buffer.from(String(sealed.salt), 'base64');
  if (!salt.equals(saltOf(env))) throw new Error('wrong lock');
  const key = crypto.pbkdf2Sync(String(env.POCKET_PASSCODE), salt, snap.ITER, 32, 'sha256');
  const ct = Buffer.from(String(sealed.ct), 'base64'), iv = Buffer.from(String(sealed.iv), 'base64');
  if (ct.length < 17 || iv.length !== 12) throw new Error('bad lock');
  const d = crypto.createDecipheriv('aes-256-gcm', key, iv); d.setAuthTag(ct.subarray(ct.length - 16));
  return JSON.parse(Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]).toString('utf8'));
}

const str = (x, max) => String(x == null ? '' : x).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);

/** Checks the shape only. The app's own routes still apply every money rule. Returns a clean command or throws a plain sentence. */
function clean(c) {
  if (!c || typeof c !== 'object') throw new Error('empty request');
  const id = str(c.id, 64); if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) throw new Error('bad request id');
  const ts = num(c.ts); if (!Number.isFinite(ts) || Date.now() - ts > 24 * 3600e3 || ts - Date.now() > 10 * 60e3) throw new Error('request is too old, please send again');
  if (c.type === 'bill') {
    const items = Array.isArray(c.items) ? c.items : []; if (!items.length || items.length > 30) throw new Error('a bill needs 1 to 30 items');
    const lines = items.map((it, i) => {
      const q = num(it && it.qty); if (!Number.isFinite(q) || q <= 0 || q > 9999) throw new Error('line ' + (i + 1) + ': quantity is not right');
      const code = str(it && it.code, 50), pid = Number.isInteger(it && it.pid) ? it.pid : null; if (!code && !pid) throw new Error('line ' + (i + 1) + ': no item');
      const price = it.price === undefined || it.price === null || it.price === '' ? null : num(it.price);
      if (price !== null && (!Number.isFinite(price) || price < 0 || price > 99999999)) throw new Error('line ' + (i + 1) + ': price is not right');
      return { code, pid, qty: q, price };
    });
    const pm = str(c.pay, 10).toLowerCase(); if (!['cash', 'card', 'online'].includes(pm)) throw new Error('pay by cash, card or online');
    const disc = num(c.disc || 0); if (!Number.isFinite(disc) || disc < 0 || disc > 100) throw new Error('discount must be 0 to 100');
    return { id, type: 'bill', lines, pay: pm, disc, name: str(c.name, 60), phone: str(c.phone, 20).replace(/[^0-9+ ]/g, '') };
  }
  if (c.type === 'order') {
    const items = Array.isArray(c.items) ? c.items : []; if (!items.length || items.length > 40) throw new Error('an order needs 1 to 40 items');
    const lines = items.map((it, i) => { const q = num(it && it.qty); if (!Number.isFinite(q) || q <= 0 || q > 99999) throw new Error('line ' + (i + 1) + ': quantity is not right');
      const name = str(it && it.name, 120); if (!name) throw new Error('line ' + (i + 1) + ': no item name'); return { code: str(it.code, 50), name, qty: q }; });
    const sup = str(c.supplier, 80); if (!sup) throw new Error('type the vendor name');
    return { id, type: 'order', supplier: sup, lines, note: str(c.note, 200) };
  }
  throw new Error('unknown request');
}

/** Runs one clean command against the app. deps.call(method, path, body, wantBinary) talks to the app; deps.pool reads item prices. */
async function run(cmd, deps) {
  if (cmd.type === 'bill') {
    const items = [];
    for (const l of cmd.lines) {
      const r = (await deps.pool.query(l.pid ? `SELECT id, item_code, name, selling_price FROM products WHERE id = $1 AND active = true`
        : `SELECT id, item_code, name, selling_price FROM products WHERE item_code = $1 AND active = true LIMIT 1`, [l.pid || l.code])).rows[0];
      if (!r) throw new Error('item not found: ' + (l.code || l.pid));
      items.push({ item_name: r.name, item_code: r.item_code, qty: l.qty, unit_price: l.price !== null ? l.price : Number(r.selling_price) });
    }
    const b = await deps.call('POST', '/api/pos-bills', { items, payment_method: cmd.pay, discount_pct: cmd.disc, customer_name: cmd.name || undefined,
      customer_phone: cmd.phone || undefined, salesman: 'Ajmal', notes: 'Made on the phone (Pocket)' });
    const bill = b.bill || b, bid = bill.id || b.id, no = bill.bill_number || b.bill_number || bid;
    let png = null; try { const buf = await deps.call('GET', '/api/pos-bills/' + bid + '/receipt.png?download=1', null, true); if (buf && buf.length < 480000) png = buf.toString('base64'); } catch (e) { /* receipt can be fetched again later */ }
    return { ok: true, type: 'bill', no, total: Number(bill.total || b.total) || 0, png };
  }
  const text = cmd.lines.map((l) => l.qty + ' x ' + l.name + (l.code ? ' (' + l.code + ')' : '')).join('; ');
  const po = await deps.call('POST', '/api/purchase-orders', { supplier_name: cmd.supplier, total_amount: 0, notes: ('Phone order (draft, nothing sent to the vendor): ' + text + (cmd.note ? ' | ' + cmd.note : '')).slice(0, 900) });
  return { ok: true, type: 'order', po: po.po_number || po.id };
}

function makeCaller(port, secret, fetchFn = globalThis.fetch) {
  return async (method, path, body, binary) => {
    const r = await fetchFn('http://127.0.0.1:' + port + path, { method, headers: { 'x-pocket-secret': secret, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    if (!r.ok) { let m = 'HTTP ' + r.status; try { const j = await r.json(); m = j.error || m; } catch (e) {} throw new Error(m); }
    return binary ? Buffer.from(await r.arrayBuffer()) : r.json();
  };
}

async function ensureTable(pool) { await pool.query(`CREATE TABLE IF NOT EXISTS pocket_inbox_done (id text PRIMARY KEY, kind text, state text NOT NULL, at timestamptz NOT NULL DEFAULT now())`); }

/** One pass: take everything waiting, run each once, leave answers, clear the inbox. */
async function pollOnce(pool, env = process.env, deps = {}) {
  if (!snap.configured(env)) return { ran: false };
  const f = deps.fetchFn || globalThis.fetch, base = String(env.POCKET_URL).replace(/\/+$/, ''), auth = { Authorization: 'Bearer ' + env.POCKET_PUSH_SECRET };
  const r = await f(base + '/inbox', { headers: auth }); if (!r.ok) throw new Error('inbox HTTP ' + r.status);
  const box = await r.json(); if (!Array.isArray(box) || !box.length) return { ran: true, n: 0 };
  const call = deps.call || makeCaller(env.PORT || 3100, env.POCKET_PUSH_SECRET, f);
  for (const sealed of box) {
    let id = null, res;
    try {
      const cmd = clean(open(sealed, env)); id = cmd.id;
      const ins = await pool.query(`INSERT INTO pocket_inbox_done (id, kind, state) VALUES ($1,$2,'working') ON CONFLICT (id) DO NOTHING RETURNING id`, [id, cmd.type]);
      if (!ins.rows.length) continue;                         // already handled: never twice
      try { res = await run(cmd, { pool, call }); await pool.query(`UPDATE pocket_inbox_done SET state='done' WHERE id=$1`, [id]); }
      catch (e) { res = { ok: false, error: e.message }; await pool.query(`UPDATE pocket_inbox_done SET state='failed' WHERE id=$1`, [id]); }
    } catch (e) { id = id || (function () { try { return clean0(sealed, env); } catch (_) { return null; } })(); res = { ok: false, error: e.message }; }
    if (id) {
      const salt = saltOf(env);
      await f(base + '/out/' + id, { method: 'PUT', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify(snap.lock(Object.assign({ id }, res), env.POCKET_PASSCODE, { salt })) });
    }
  }
  await f(base + '/inbox/ack', { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ n: box.length }) });
  snap.kick();                                                 // phone numbers refresh within seconds
  return { ran: true, n: box.length };
}
function clean0(sealed, env) { const c = open(sealed, env); const id = str(c && c.id, 64); return /^[A-Za-z0-9_-]{8,64}$/.test(id) ? id : null; }

function start(pool, everyMs = Number(process.env.POCKET_POLL_MS) || 6000) {
  if (!snap.configured()) return null;
  ensureTable(pool).catch((e) => console.error('[pocket-inbox]', e.message));
  let busy = false;
  return setInterval(() => { if (busy) return; busy = true; pollOnce(pool).catch((e) => console.error('[pocket-inbox]', e.message)).finally(() => { busy = false; }); }, everyMs).unref();
}

module.exports = { open, clean, run, pollOnce, start, makeCaller, ensureTable };
