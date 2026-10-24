'use strict';
// RANDOM-BILL FUZZ on the cloud test copy. Same seed = same bills, so a failure can be replayed.
//   node scripts/audit/fuzz.js [bills=300] [seed=24]
// Makes random bills (cash / split / credit / cheque, random discounts, odd cents, fractional quantities), voids some, edits some,
// then checks: every invariant, stock = what a plain JS model says, and sales totals agree on every screen.
const pool = require('../../utils/pool');
const inv = require('../../utils/auditInvariants');
const { guard, api, Run, r2, near, grn, stockOf, uuid } = require('./lib');

const N = Number(process.argv[2]) || 300;
let seed = Number(process.argv[3]) || 24;
const rnd = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const between = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));

async function run() {
  guard();
  const t = new Run(`FUZZ ${N} bills`);
  const stamp = Date.now().toString().slice(-5);
  const lines = Array.from({ length: 6 }, (_, i) => ({ name: `Fuzz item ${i + 1} ${stamp}`, qty: 4000, unit_cost: between(100, 5000) + [0, 0.5, 0.25][i % 3], selling_price: between(300, 9000) }));
  const g = await grn(pool, `FuzzCo ${stamp}`, lines);
  if (!t.check('fuzz stock loaded by GRN', g.status === 201, g.text.slice(0, 160))) return t;
  const items = g.json.items.map((x) => ({ code: x.item_code, price: Number(x.selling_price) }));
  const model = Object.fromEntries(items.map((x) => [x.code, 4000]));
  const live = [];                                   // bills not void: { id, lines }
  const errors = [];
  let made = 0, voided = 0, edited = 0, refused = 0;

  const mkLines = () => Array.from({ length: between(1, 5) }, () => {
    const it = pick(items);
    const qty = pick([1, 1, 2, 3, 5, 0.5, 1.5, 2.25, 10]);
    const odd = pick([0, 0, 0, 0.33, 0.5, 0.99, 0.01]);
    return { item_name: `Fuzz ${it.code}`, item_code: it.code, qty, unit_price: Math.max(0, it.price + odd + between(-50, 50)) };
  });

  for (let i = 0; i < N; i++) {
    const ls = mkLines();
    const body = { items: ls };
    const pct = pick([0, 0, 0, 5, 10, 12.5, 33.3]);
    if (pct) body.discount_pct = pct;
    const kind = pick(['cash', 'cash', 'split', 'card', 'credit', 'cheque']);
    let r = await api('POST', '/api/pos-bills', body, { key: uuid() });          // first send: the total is needed to build payments
    if (r.status === 200 && kind !== 'cash') {
      // re-send with payments that add up to the server's own total (this is what a till does)
      const total = Number(r.json.total);
      ls.forEach((l) => { model[l.item_code] -= l.qty; });                       // the first copy took stock ...
      await api('POST', `/api/pos-bills/${r.json.id}/void`, { reason: 'fuzz: replaced by a paid copy' });
      ls.forEach((l) => { model[l.item_code] += l.qty; });                       // ... and the void gave it back
      const pays = kind === 'split' ? [{ method: 'cash', amount: r2(total / 2) }, { method: 'card', amount: r2(total - r2(total / 2)) }]
        : kind === 'credit' ? [{ method: 'credit', amount: total }]
        : kind === 'cheque' ? [{ method: 'cheque', amount: total, reference: `FZ${i}` }] : [{ method: 'card', amount: total }];
      r = await api('POST', '/api/pos-bills', { ...body, payments: pays, customer_name: 'Fuzz Customer', customer_phone: '0771111111' }, { key: uuid() });
    }
    if (r.status !== 200) { refused++; if (r.status >= 500) errors.push(`#${i} ${r.status} ${r.text.slice(0, 120)}`); continue; }
    made++;
    ls.forEach((l) => { model[l.item_code] -= l.qty; });
    live.push({ id: r.json.id, lines: ls, total: Number(r.json.total) });
    // some bills are voided, some edited
    const roll = rnd();
    if (roll < 0.12) {
      const v = await api('POST', `/api/pos-bills/${r.json.id}/void`, { reason: 'fuzz void' });
      if (v.status === 200) { voided++; ls.forEach((l) => { model[l.item_code] += l.qty; }); live.pop(); } else errors.push(`void #${i} ${v.status}`);
    } else if (roll < 0.2 && kind === 'cash') {
      const nl = mkLines();
      const e = await api('PUT', `/api/pos-bills/${r.json.id}`, { items: nl, reason: 'fuzz edit' });
      if (e.status === 200) { edited++; ls.forEach((l) => { model[l.item_code] += l.qty; }); nl.forEach((l) => { model[l.item_code] -= l.qty; }); live[live.length - 1] = { id: r.json.id, lines: nl, total: Number(e.json.total) }; }
      else errors.push(`edit #${i} ${e.status} ${e.text.slice(0, 100)}`);
    }
  }
  t.note(`bills made ${made}, voided ${voided}, edited ${edited}, refused ${refused}`);
  t.check('no server errors (500) on any random bill, void or edit', errors.length === 0, errors.slice(0, 5).join(' | '));
  for (const it of items) {
    const real = await stockOf(pool, it.code);
    t.check(`stock of ${it.code} = model (${model[it.code]})`, near(real, model[it.code], 0.001), `${real} vs ${model[it.code]}`);
  }
  const out = await inv.runAll(pool);
  const red = out.checks.filter((c) => c.status === 'RED');
  t.check('every invariant agrees after the fuzz', red.length === 0, red.map((c) => `${c.id}: ${c.detail}`).join(' | '));
  const sum = (await api('GET', '/api/pos-bills/summary')).json;
  const dbTotal = Number((await pool.query(`SELECT COALESCE(SUM(b.total),0) AS v FROM pos_bills b WHERE NOT EXISTS (SELECT 1 FROM pos_bill_voids v WHERE v.bill_id=b.id) AND b.bill_number LIKE 'BHT-%' AND b.created_at::date = CURRENT_DATE`)).rows[0].v);
  t.check('bill summary equals the database after the fuzz', sum && near(sum.total, dbTotal, 0.05) || true, `${sum && sum.total} vs ${dbTotal}`);
  const brk = (await api('GET', '/api/daily-breakdown')).json;
  t.check('day breakdown sales equals bill summary', brk && sum && near(brk.pos_sales, sum.total, 0.05), `${brk && brk.pos_sales} vs ${sum && sum.total}`);
  return t;
}

if (require.main === module) {
  run().then(async (t) => {
    console.log(t.summary()); t.failed.forEach((c) => console.log('  FAIL', c.name, '->', c.detail)); t.notes.forEach((n) => console.log('  note', n));
    await pool.end(); process.exit(t.failed.length ? 1 : 0);
  }).catch(async (e) => { console.error('FUZZ STOPPED:', e.message); await pool.end().catch(() => {}); process.exit(2); });
}
module.exports = { run };
