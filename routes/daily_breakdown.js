// routes/daily_breakdown.js: DAILY BREAKDOWN (isolated module). Splits each day's POS sales into what to keep aside and what is Aj's.
// Reads: pos_bills, pos_bill_items, pos_bill_voids, products (avg_cost), cheque_register. Writes ONLY its own two tables:
//   daily_breakdown_settings (one row: rent, salary, other costs, commission %, due days) and market_purchases.
// Does not change stock, bills, day sheets or any golden-core table. The sums live in utils/daily_breakdown_math.js.
//
//   GET  /api/daily-breakdown?date=YYYY-MM-DD     the day: sales, keep-aside lines, net profit, what is due
//   GET  /api/daily-breakdown/settings            PUT /api/daily-breakdown/settings
//   GET  /api/daily-breakdown/market-purchases?date=      POST /api/daily-breakdown/market-purchases      POST .../:id/void
const express = require('express');
const pool = require('../utils/pool');
const { todayLK } = require('../utils/lkTime');
const { computeBreakdown, dueList } = require('../utils/daily_breakdown_math');

const router = express.Router();
const isDay = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v)) && !isNaN(Date.parse(v));
const nonNeg = (v) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : null; };

const ready = pool.query(`
  CREATE TABLE IF NOT EXISTS daily_breakdown_settings (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    rent_monthly NUMERIC(12,2) NOT NULL DEFAULT 70000,
    salary_monthly NUMERIC(12,2) NOT NULL DEFAULT 0,
    other_monthly NUMERIC(12,2) NOT NULL DEFAULT 0,
    commission_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
    rent_day INT NOT NULL DEFAULT 0,
    salary_day INT NOT NULL DEFAULT 0,
    cheque_window_days INT NOT NULL DEFAULT 7,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`)
  .then(() => pool.query(`INSERT INTO daily_breakdown_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING`))
  .then(() => pool.query(`
    CREATE TABLE IF NOT EXISTS market_purchases (
      id SERIAL PRIMARY KEY,
      purchase_date DATE NOT NULL,
      item VARCHAR(200) NOT NULL,
      customer VARCHAR(150),
      buy_cost NUMERIC(12,2) NOT NULL,
      sell_price NUMERIC(12,2) NOT NULL,
      bill_number VARCHAR(30),
      note TEXT,
      voided BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`))
  .catch((e) => console.error('[daily_breakdown] migration failed:', e.message));

const getSettings = async () => { await ready; return (await pool.query(`SELECT * FROM daily_breakdown_settings WHERE id = 1`)).rows[0]; };

router.get('/settings', async (req, res) => {
  try { res.json(await getSettings()); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/settings', async (req, res) => {
  try {
    await ready;
    const b = req.body || {}; const cols = {};
    for (const k of ['rent_monthly', 'salary_monthly', 'other_monthly']) if (b[k] !== undefined) { const n = nonNeg(b[k]); if (n === null) return res.status(400).json({ error: `${k} must be a number, 0 or more` }); cols[k] = n; }
    if (b.commission_rate !== undefined) { const n = nonNeg(b.commission_rate); if (n === null || n > 100) return res.status(400).json({ error: 'commission_rate must be 0 to 100' }); cols.commission_rate = n; }
    for (const k of ['rent_day', 'salary_day']) if (b[k] !== undefined) { const n = Math.floor(Number(b[k])); if (!(n >= 0 && n <= 31)) return res.status(400).json({ error: `${k} must be 0 (not set) or 1 to 31` }); cols[k] = n; }
    if (b.cheque_window_days !== undefined) { const n = Math.floor(Number(b.cheque_window_days)); if (!(n >= 1 && n <= 60)) return res.status(400).json({ error: 'cheque_window_days must be 1 to 60' }); cols.cheque_window_days = n; }
    const keys = Object.keys(cols);
    if (keys.length) await pool.query(`UPDATE daily_breakdown_settings SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = 1`, keys.map((k) => cols[k]));
    res.json(await getSettings());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/market-purchases', async (req, res) => {
  try {
    await ready; const date = isDay(req.query.date) ? req.query.date : todayLK();
    res.json((await pool.query(`SELECT id, TO_CHAR(purchase_date,'YYYY-MM-DD') AS purchase_date, item, customer, buy_cost, sell_price, bill_number, note FROM market_purchases WHERE purchase_date = $1::date AND NOT voided ORDER BY id`, [date])).rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/market-purchases', async (req, res) => {
  try {
    await ready; const b = req.body || {};
    const item = String(b.item || '').trim(); const buy = nonNeg(b.buy_cost); const sell = nonNeg(b.sell_price);
    if (!item) return res.status(400).json({ error: 'What was bought? (item)' });
    if (buy === null || sell === null) return res.status(400).json({ error: 'Bought-for and sold-for must be numbers, 0 or more' });
    const date = isDay(b.purchase_date) ? b.purchase_date : todayLK();
    const bill = String(b.bill_number || '').trim() || null;
    const r = await pool.query(`INSERT INTO market_purchases (purchase_date, item, customer, buy_cost, sell_price, bill_number, note) VALUES ($1::date,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [date, item.slice(0, 200), String(b.customer || '').slice(0, 150) || null, buy, sell, bill, String(b.note || '').slice(0, 500) || null]);
    res.status(201).json({ ok: true, id: r.rows[0].id, profit: Math.round((sell - buy) * 100) / 100 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/market-purchases/:id/void', async (req, res) => {   // never deleted: a voided entry is simply left out of the day
  try {
    await ready; if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ error: 'not found' });
    const r = await pool.query(`UPDATE market_purchases SET voided = TRUE WHERE id = $1 AND NOT voided RETURNING id`, [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'not found' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/', async (req, res) => {
  try {
    await ready;
    const date = isDay(req.query.date) ? req.query.date : todayLK();
    const settings = await getSettings();
    const sales = await pool.query(
      `SELECT COALESCE(SUM(b.total),0) AS total, COUNT(*) AS n FROM pos_bills b LEFT JOIN pos_bill_voids v ON v.bill_id = b.id
       WHERE v.bill_id IS NULL AND b.created_at::date = $1::date`, [date]);
    const cost = await pool.query(
      `SELECT COALESCE(SUM(i.qty * COALESCE(p.avg_cost,0)),0) AS cost,
              COUNT(*) FILTER (WHERE p.id IS NULL OR p.avg_cost IS NULL OR p.avg_cost = 0) AS nocost
       FROM pos_bill_items i JOIN pos_bills b ON b.id = i.bill_id LEFT JOIN pos_bill_voids v ON v.bill_id = b.id
       LEFT JOIN products p ON p.item_code = i.item_code AND i.item_code IS NOT NULL
       WHERE v.bill_id IS NULL AND b.created_at::date = $1::date`, [date]);
    const mk = (await pool.query(
      `SELECT m.id, m.item, m.customer, m.buy_cost, m.sell_price, m.bill_number,
              EXISTS (SELECT 1 FROM pos_bills b LEFT JOIN pos_bill_voids v ON v.bill_id = b.id WHERE b.bill_number = m.bill_number AND v.bill_id IS NULL) AS on_bill
       FROM market_purchases m WHERE m.purchase_date = $1::date AND NOT m.voided ORDER BY m.id`, [date])).rows;
    const onBillCount = mk.filter((m) => m.on_bill).length;   // a market line on a bill has no catalogue cost; its cost is the market purchase
    const day = computeBreakdown({ date, posSales: Number(sales.rows[0].total), stockCost: Number(cost.rows[0].cost), noCostLines: Number(cost.rows[0].nocost) - onBillCount, market: mk, settings });
    const cheques = (await pool.query(`SELECT id, payee, amount, TO_CHAR(due_date,'YYYY-MM-DD') AS due_date, status FROM cheque_register WHERE status = 'pending' AND due_date <= ($1::date + $2::int) ORDER BY due_date`, [todayLK(), settings.cheque_window_days]).catch(() => ({ rows: [] }))).rows;
    const due = dueList({ today: todayLK(), windowDays: settings.cheque_window_days, cheques, rentDay: settings.rent_day, salaryDay: settings.salary_day,
      rentAmount: Number(settings.rent_monthly), salaryAmount: Number(settings.salary_monthly) });
    res.json({ ...day, bills_count: Number(sales.rows[0].n), market, settings, due, due_total: Math.round(due.reduce((a, d) => a + d.amount, 0) * 100) / 100 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
