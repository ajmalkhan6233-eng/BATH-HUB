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

module.exports = router;
