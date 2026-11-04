'use strict';
// Money plan + morning brief (Builds 6 and 7). READ-ONLY on daily_summary and vendor tables.
// Only writes: app_settings key 'money_plan' (owner settings) and uploads/briefs/<date>.txt. Login is enforced by the global /api gate.
const express = require('express');
const fs = require('fs');
const path = require('path');
const W = require('../utils/profitWaterfall');
const B = require('../utils/morningBrief');
const V = require('../utils/vendorLedger');

const DEFAULTS = { monthlyCosts: 316000, commissionRatePct: 2, depositAmount: 200000, depositMonths: 24, shopCash: 0, cashOnHand: 0, dailySalesTarget: 60000, dailyCost: 15000, savingsTarget: 0, savingsSaved: 0 };
const NUM_KEYS = Object.keys(DEFAULTS);
const iso = (v) => (v instanceof Date ? `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}` : String(v).slice(0, 10)); // node-postgres returns DATE as a local-midnight Date
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' });
const addDays = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const isIso = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));

module.exports = function createMoneyPlanRouter({ pool, branchOf = () => 1 }) {
  const r = express.Router();
  r.use(express.json({ limit: '20kb' }));
  const wrap = (fn) => (req, res) => fn(req, res).catch((e) => { console.error('[money-plan]', e.message); res.status(500).json({ error: 'Something went wrong' }); });

  async function settings() {
    let saved = {};
    try { const q = await pool.query(`SELECT value FROM app_settings WHERE key='money_plan'`); if (q.rows[0]) saved = q.rows[0].value || {}; } catch (_) { /* table may not exist yet: use defaults */ }
    const out = { ...DEFAULTS };
    NUM_KEYS.forEach((k) => { if (Number.isFinite(Number(saved[k])) && saved[k] !== '' && saved[k] !== null) out[k] = Number(saved[k]); });
    return out;
  }

  async function sums(from, to) {
    const q = await pool.query(`SELECT COALESCE(SUM(total_sale),0) AS sales, COALESCE(SUM(gross_profit),0) AS gp, COALESCE(SUM(total_expenses),0) AS exp, COUNT(*) AS days FROM daily_summary WHERE report_date BETWEEN $1 AND $2`, [from, to]);
    const x = q.rows[0]; return { sales: Number(x.sales), grossProfit: Number(x.gp), expenses: Number(x.exp), days: Number(x.days) };
  }

  r.get('/money/settings', wrap(async (req, res) => res.json(await settings())));
  r.put('/money/settings', wrap(async (req, res) => {
    const u = req.session && req.session.user;
    if (!u || (u.role !== 'admin' && u.role !== 'owner')) return res.status(403).json({ error: 'Owner only' });
    const cur = await settings(); const body = req.body || {};
    for (const k of NUM_KEYS) if (k in body) { const n = Number(body[k]); if (body[k] === '' || !Number.isFinite(n) || n < 0) return res.status(400).json({ error: `${k} must be a number, 0 or more` }); cur[k] = n; }
    if (cur.commissionRatePct > 100) return res.status(400).json({ error: 'commissionRatePct cannot exceed 100' });
    await pool.query(`INSERT INTO app_settings (key, value, updated_by, updated_at) VALUES ('money_plan',$1,$2,NOW()) ON CONFLICT (key) DO UPDATE SET value=$1, updated_by=$2, updated_at=NOW()`, [JSON.stringify(cur), u.username || null]);
    res.json(cur);
  }));

  // Waterfall for a period (default: this calendar month so far). Gross profit and costs come from daily_summary; costs use the monthly running cost pro-rated by days in the period.
  r.get('/money/waterfall', wrap(async (req, res) => {
    const t = today();
    const from = isIso(req.query.from) ? req.query.from : t.slice(0, 8) + '01';
    const to = isIso(req.query.to) ? req.query.to : t;
    if (from > to) return res.status(400).json({ error: 'from must be on or before to' });
    const s = await settings();
    const sm = await sums(from, to);
    const days = Math.round((new Date(to) - new Date(from)) / 86400000) + 1;
    const fixedCosts = Math.round((s.monthlyCosts * days) / 30);
    const w = W.waterfall({ grossProfit: sm.grossProfit, fixedCosts, commissionRatePct: s.commissionRatePct, depositPerPeriod: Math.round((W.depositSetAside(s.depositAmount, s.depositMonths) * days) / 30 * 100) / 100, shopCash: s.shopCash, monthlyCosts: s.monthlyCosts });
    const target = s.dailyCost * days;
    res.json({ from, to, days, sales: sm.sales, recordedDays: sm.days, settings: s, waterfall: w, costTarget: target, grossProfitVsTarget: Math.round(sm.grossProfit - target) });
  }));

  async function gather() {
    const t = today(); const y = addDays(t, -1); const s = await settings();
    const [yd, wk, ch] = await Promise.all([
      sums(y, y), sums(addDays(t, -7), y),
      pool.query(`SELECT c.id, c.amount AS amount, c.status, c.due_date, c.cheque_date, b.vendor_name FROM vendor_bill_cheques c JOIN vendor_bills b ON b.id=c.bill_id WHERE c.branch_id=$1 AND b.voided=FALSE`, [branchOf()]),
    ]);
    const cheques = ch.rows.map((c) => ({ ...c, amount: Number(c.amount), due_date: iso(c.due_date), cheque_date: iso(c.cheque_date) }));
    const d = {
      yesterday: { sales: yd.sales, grossProfit: yd.grossProfit, expenses: yd.expenses },
      targets: { dailySales: s.dailySalesTarget, dailyCost: s.dailyCost },
      week: { sales: wk.sales, grossProfit: wk.grossProfit, days: wk.days },
      cheques: V.chequeCalendar(cheques, t), cashGap: V.cashGap(cheques, { cashOnHand: s.cashOnHand }, t, 2),
      cashOnHand: s.cashOnHand, receivables: [], savings: s.savingsTarget > 0 ? { target: s.savingsTarget, saved: s.savingsSaved } : null,
    };
    return { brief: B.buildBrief(d, t), date: t };
  }

  r.get('/morning-brief', wrap(async (req, res) => {
    const { brief, date } = await gather();
    const text = B.toText(brief);
    let saved = false;
    try { const dir = path.join(__dirname, '..', 'uploads', 'briefs'); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, `${date}.txt`), text + '\n'); saved = true; } catch (_) { /* saving is a convenience only */ }
    res.json({ ...brief, text, saved });
  }));
  return r;
};
