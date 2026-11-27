'use strict';
// RUNNING COST (AJ 27 Nov): gross profit minus a daily running cost, counted every calendar day from a start date.
// Daily figure = real costs (own salary, staff, food, rent, electricity, commission) + a "Debt buffer" that tops it up to the daily line.
// All numbers are settings (app_settings key "running_cost"), editable on the Profit tab. Read only on money records. Owner only.
const express = require('express');
const pool = require('../utils/pool');
const { isOwner } = require('../utils/moneyAudit');

const DEFAULTS = { from: '2026-10-29', daily_line: 20000, own_salary_day: 5000, staff_day: 3000, food_day: 500, rent_month: 70000, electricity_month: 25000, commission_pct: 5 };
const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const daysBetween = (from, to) => Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1);

// commission = pct of GROSS PROFIT (shop rule). The buffer is never negative: if real costs pass the line, the real costs count.
function compute(s, days, gross) {
  const month = (m) => r2(m * 12 / 365 * days);
  const lines = [
    ['Own salary', r2(s.own_salary_day * days)], ['Staff', r2(s.staff_day * days)], ['Food', r2(s.food_day * days)],
    ['Rent', month(s.rent_month)], ['Electricity', month(s.electricity_month)], ['Commission (' + s.commission_pct + '% of gross profit)', r2(Math.max(0, gross) * s.commission_pct / 100)],
  ].map(([name, amount]) => ({ name, amount }));
  const real = r2(lines.reduce((a, l) => a + l.amount, 0));
  const buffer = r2(Math.max(0, s.daily_line * days - real));
  return { days, gross: r2(gross), lines, real, buffer, total: r2(real + buffer), net: r2(gross - real - buffer), net_before_buffer: r2(gross - real) };
}
function validate(input, base) {
  const out = { ...base };
  for (const k of Object.keys(DEFAULTS)) {
    if (input[k] === undefined) continue;
    if (k === 'from') { if (!/^\d{4}-\d{2}-\d{2}$/.test(input[k]) || isNaN(Date.parse(input[k]))) throw new Error('Start date is not valid'); out[k] = input[k]; continue; }
    const n = Number(input[k]);
    if (!Number.isFinite(n) || n < 0 || (k === 'commission_pct' && n > 100)) throw new Error('Not a valid number: ' + k);
    out[k] = n;
  }
  return out;
}
async function settings() {
  const row = (await pool.query("SELECT value FROM app_settings WHERE key='running_cost'")).rows[0];
  const saved = row ? (typeof row.value === 'string' ? JSON.parse(row.value) : row.value) : {};
  return { ...DEFAULTS, ...saved };
}

const router = express.Router();
router.use((req, res, next) => (isOwner(req) ? next() : res.status(403).json({ error: 'Owner only' })));
router.get('/', async (req, res) => {
  try {
    const s = await settings();
    const today = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
    const g = (await pool.query(`SELECT COALESCE(SUM(b.total - c.cost), 0) AS gross, COUNT(*) AS bills FROM pos_bills b
        CROSS JOIN LATERAL (SELECT COALESCE(SUM(i.qty * COALESCE(NULLIF(i.unit_cost,0), p.avg_cost, 0)), 0) AS cost FROM pos_bill_items i LEFT JOIN products p ON p.item_code = i.item_code WHERE i.bill_id = b.id) c
       WHERE NOT EXISTS (SELECT 1 FROM pos_bill_voids v WHERE v.bill_id = b.id) AND (b.created_at + INTERVAL '0')::date >= $1::date`, [s.from])).rows[0];
    res.json({ settings: s, to: today, bills: Number(g.bills), ...compute(s, daysBetween(s.from, today), Number(g.gross)) });
  } catch (e) { console.error('[running-cost]', e.message); res.status(500).json({ error: 'Could not work out the running cost' }); }
});
router.put('/', express.json(), async (req, res) => {
  let next;
  try { next = validate(req.body || {}, await settings()); } catch (e) { return res.status(400).json({ error: e.message }); }
  try {
    const who = (req.session && req.session.user && req.session.user.username) || 'owner';
    await pool.query("INSERT INTO app_settings (key, value, updated_by, updated_at) VALUES ('running_cost',$1,$2,NOW()) ON CONFLICT (key) DO UPDATE SET value=$1, updated_by=$2, updated_at=NOW()", [JSON.stringify(next), who]);
    res.json({ settings: next });
  } catch (e) { console.error('[running-cost]', e.message); res.status(500).json({ error: 'Not saved' }); }
});

module.exports = router;
Object.assign(module.exports, { compute, validate, daysBetween, DEFAULTS });
