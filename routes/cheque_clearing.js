// routes/cheque_clearing.js  (NEW, additive; touches no existing table)
// Owed / in transit / cleared + alert dates (-3d, -2d, -1d, morning-of). Rule: Fri deposit->Mon, Sat/Sun->Tue, holidays skipped.
const express = require('express');
const pool = require('../utils/pool');
const { clearingDate, alertDates, status } = require('../utils/cheque_clearing');
const { all: staticHolidays } = require('../utils/slBankHolidays');
const router = express.Router();
const today = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10); // Sri Lanka date

pool.query(`CREATE TABLE IF NOT EXISTS cheque_deposits (
  cheque_id INT PRIMARY KEY, deposit_date DATE NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`).catch(e => console.error('[cheque_clearing]', e.message));
pool.query(`CREATE TABLE IF NOT EXISTS bank_holidays (day DATE PRIMARY KEY, label VARCHAR(80))`).catch(() => {});

async function load() {
  const hol = [...new Set([...(await pool.query(`SELECT TO_CHAR(day,'YYYY-MM-DD') d FROM bank_holidays`)).rows.map(r => r.d), ...staticHolidays()])];
  const rows = (await pool.query(`SELECT c.id, c.cheque_no, c.payee, c.amount::float AS amount, TO_CHAR(c.due_date,'YYYY-MM-DD') due_date,
      c.status AS reg_status, TO_CHAR(d.deposit_date,'YYYY-MM-DD') deposit_date
      FROM cheque_register c LEFT JOIN cheque_deposits d ON d.cheque_id=c.id WHERE c.status <> 'bounced' ORDER BY c.due_date`)).rows;
  const t = today();
  return rows.map(r => {
    const st = r.reg_status === 'cleared' ? 'cleared' : status({ depositDate: r.deposit_date }, t, hol);
    const clears = r.deposit_date ? clearingDate(r.deposit_date, hol) : null;
    return { ...r, state: st, clears_on: clears, alerts: clears ? alertDates(clears) : [] };
  });
}
router.get('/cheque-clearing', async (req, res) => {
  try {
    const list = await load(), sum = s => list.filter(x => x.state === s).reduce((a, x) => a + x.amount, 0);
    res.json({ today: today(), owed: sum('owed'), in_transit: sum('in_transit'), cleared: sum('cleared'), cheques: list });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// What to ring the phone about TODAY (use from the morning brief / notifications / Layla owner chat)
router.get('/cheque-clearing/alerts', async (req, res) => {
  try {
    const t = today(), out = [];
    (await load()).forEach(c => c.alerts.forEach(a => { if (a.when === t && c.state !== 'cleared') out.push({ cheque_id: c.id, payee: c.payee, amount: c.amount, clears_on: c.clears_on, text: a.text }); }));
    res.json({ today: t, alerts: out });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/cheque-clearing/:id/deposit', async (req, res) => {
  const dd = String(req.body.deposit_date || today());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dd)) return res.status(400).json({ error: 'deposit_date must be YYYY-MM-DD' });
  try {
    await pool.query(`INSERT INTO cheque_deposits (cheque_id, deposit_date) VALUES ($1,$2) ON CONFLICT (cheque_id) DO UPDATE SET deposit_date=$2`, [req.params.id, dd]);
    res.json({ ok: true, clears_on: clearingDate(dd, [...new Set([...(await pool.query(`SELECT TO_CHAR(day,'YYYY-MM-DD') d FROM bank_holidays`)).rows.map(r => r.d), ...staticHolidays()])]) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/cheque-clearing/holidays', async (req, res) => {
  const { day, label } = req.body || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day))) return res.status(400).json({ error: 'day must be YYYY-MM-DD' });
  await pool.query(`INSERT INTO bank_holidays (day,label) VALUES ($1,$2) ON CONFLICT (day) DO UPDATE SET label=$2`, [day, label || null]);
  res.json({ ok: true });
});
module.exports = router;
