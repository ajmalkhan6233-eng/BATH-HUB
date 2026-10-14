// routes/payment_planner.js — vendor cheque schedule. Preview touches nothing; save writes only
// to cheque_register (money the shop owes OUT). Never touches the golden-core `cheques` table.
const express = require('express');
const router = express.Router();
const pool = require('../utils/pool');
const { planSchedule, weeklySetAside, cashWarnings, outstanding } = require('../utils/payment_planner');
const todaySL = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10); // Sri Lanka date

function build(b) {
  const plan = planSchedule({ total: b.total, count: Number(b.count), firstDate: b.first_date,
    everyDays: b.every_days === undefined ? 30 : Number(b.every_days),
    everyMonths: b.every_months === undefined ? 0 : Number(b.every_months), parts: b.parts || null, vendorDueDate: b.vendor_due_date || null, todayISO: todaySL(), holidays: b.holidays || [] });
  if (!plan.ok) return plan;
  plan.weeklySetAside = weeklySetAside(plan.installments, todaySL());
  plan.warnings = cashWarnings({ openingCash: b.opening_cash || 0, inflows: b.inflows || [], cheques: plan.installments });
  return plan;
}
// Preview only: no database writes. Body: vendor, total, count, first_date, every_days? | every_months?, parts?, vendor_due_date?, opening_cash?, inflows?, holidays?
router.post('/payment-planner/preview', (req, res) => {
  const plan = build(req.body || {});
  res.status(plan.ok ? 200 : 400).json(plan);
});
// Save: creates pending rows in cheque_register. Refuses if guardrail 1 warns unless force_short=true.
router.post('/payment-planner/save', async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.vendor) return res.status(400).json({ error: 'vendor is required' });
    const plan = build(b);
    if (!plan.ok) return res.status(400).json(plan);
    if (b.price_confirmed !== true) return res.status(409).json({ error: 'vendor must confirm the credit price equals the cash price (price_confirmed: true)' });
    if (plan.warnings.length && b.force_short !== true) return res.status(409).json({ error: 'cash will not cover every cheque', warnings: plan.warnings });
    const tag = `PLAN ${b.ref || Date.now()} total ${Number(b.total).toFixed(2)}`;
    const ids = [];
    for (const i of plan.installments) {
      const r = await pool.query(`INSERT INTO cheque_register (payee, amount, due_date, bank, notes) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [b.vendor, i.amount, i.date, b.bank || null, `${tag} #${i.no}/${plan.installments.length}`]);
      ids.push(r.rows[0].id);
    }
    res.json({ tag, ids, installments: plan.installments });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// How much is still owed on a saved plan (only cleared cheques count).
router.get('/payment-planner/outstanding', async (req, res) => {
  try {
    const { vendor, tag } = req.query;
    if (!vendor || !tag) return res.status(400).json({ error: 'vendor and tag are required' });
    const total = Number((String(tag).match(/total ([\d.]+)/) || [])[1]);
    if (!total) return res.status(400).json({ error: 'tag must be the PLAN tag returned by save' });
    const r = await pool.query(`SELECT amount, status FROM cheque_register WHERE payee=$1 AND notes LIKE $2`, [vendor, tag + ' #%']);
    res.json({ cheques: r.rows.length, ...outstanding(total, r.rows) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
module.exports = router;
