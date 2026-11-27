'use strict';
// BANKING & MONEY overview (27 Nov 2026): ONE page for the money position. Read only, owner/admin only.
// Sales and cost come from the money core (utils/moneyCore.js). Cheques given = vendor bill cheques still ISSUED, plus any
// cheque-register entry that is not already one of them (same cheque number is never counted twice). Existing screens
// (Cheque register, Cheque Calendar, Expenses, Loans, Money Control) stay as they are; this page links to them.
const express = require('express');
const MC = require('../utils/moneyCore');
const num = (x) => Number(x) || 0;

module.exports = function createBankMoney({ pool } = {}) {
  const router = express.Router();
  const owner = (req) => process.env.LOGIN_DISABLED === 'true' || ['admin', 'owner'].includes(req.session && req.session.user && req.session.user.role);
  router.use((req, res, next) => (owner(req) ? next() : res.status(403).json({ error: 'Owner only' })));
  const q = (sql, a) => pool.query(sql, a).then((r) => r.rows).catch(() => []);

  router.get('/overview', async (req, res) => {
    try {
      const today = (await q(`SELECT CURRENT_DATE::text AS d, date_trunc('month', CURRENT_DATE)::date::text AS m`))[0];
      const [given, regOnly, received, exp, credit] = await Promise.all([
        q(`SELECT cheque_no, payee, amount, due_date::text AS due FROM vendor_bill_cheques WHERE status = 'ISSUED' ORDER BY due_date`),
        q(`SELECT cheque_no, payee, amount, due_date::text AS due FROM cheque_register r WHERE lower(status) = 'pending'
             AND NOT EXISTS (SELECT 1 FROM vendor_bill_cheques v WHERE v.cheque_no = r.cheque_no) ORDER BY due_date`),
        q(`SELECT cheque_no, payee, amount, due_date::text AS due FROM cheques WHERE lower(COALESCE(status,'pending')) IN ('pending','received','issued') ORDER BY due_date`),
        q(`SELECT COALESCE(SUM(amount),0) AS total FROM expenses_detail WHERE report_date >= date_trunc('month', CURRENT_DATE)::date`),
        q(`SELECT COALESCE(SUM(amount - COALESCE(paid,0)),0) AS owed FROM credit_customers WHERE COALESCE(quarantined,false) = false`),
      ]);
      const allGiven = given.concat(regOnly);
      const sumC = (l) => l.reduce((a, c) => a + num(c.amount), 0);
      const in30 = (l) => l.filter((c) => c.due && c.due >= today.d && c.due <= new Date(Date.parse(today.d) + 30 * 864e5).toISOString().slice(0, 10));
      const overdue = (l) => l.filter((c) => c.due && c.due < today.d);
      const day = await MC.range(pool, today.d, today.d), month = await MC.range(pool, today.m, today.d);
      res.json({
        as_of: today.d,
        sales: { today: day, month },
        cheques_given: { count: allGiven.length, total: sumC(allGiven), next30: sumC(in30(allGiven)), overdue_count: overdue(allGiven).length, next: allGiven.slice(0, 8) },
        cheques_received: { count: received.length, total: sumC(received), next30: sumC(in30(received)), overdue_count: overdue(received).length, next: received.slice(0, 8) },
        expenses_month: num(exp[0] && exp[0].total),
        customers_owe: num(credit[0] && credit[0].owed),
        commission_month: (await MC.commission(pool, today.m, today.d)).total,
      });
    } catch (e) { console.error('[bank-money]', e.message); res.status(500).json({ error: 'Could not load the money position' }); }
  });
  return router;
};
