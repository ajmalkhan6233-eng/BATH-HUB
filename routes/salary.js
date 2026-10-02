// routes/salary.js
// SALARY module (isolated): the daily cost target and break-even, the monthly profit split (savings, commissions, what stays
// with the owner), late-return adjustments, and the cheque set-aside. Owner/admin only.
//
// It only READS the core tables (daily_summary, daily_reports, cheque_register); the locked formula chain is not touched.
// Own tables: sal_settings, sal_month_close, sal_cheque_cover. All numbers are editable in Settings (defaults in utils/salaryMath.js).

require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const { todayLK } = require('../utils/lkTime');
const M = require('../utils/salaryMath');

function ownerOnly(req, res, next) {
    const u = req.session && req.session.user;
    if (!u || (u.role !== 'admin' && u.role !== 'owner')) return res.status(403).json({ error: 'Owner only' });
    next();
}

const YM = /^\d{4}-(0[1-9]|1[0-2])$/;
const nextMonth = ym => { const [y, m] = ym.split('-').map(Number); return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`; };
const firstDay = ym => `${ym}-01`;
const num = v => (v == null ? 0 : Number(v));

function createRouter(pool, { today = todayLK } = {}) {
    const router = express.Router();

    const ready = (async () => {
        await pool.query(`CREATE TABLE IF NOT EXISTS sal_settings (key TEXT PRIMARY KEY, value NUMERIC NOT NULL)`);
        await pool.query(`CREATE TABLE IF NOT EXISTS sal_month_close (
            ym TEXT PRIMARY KEY, net NUMERIC NOT NULL, savings NUMERIC NOT NULL, colleague NUMERIC NOT NULL, owner_comm NUMERIC NOT NULL, keep NUMERIC NOT NULL,
            adj_applied TEXT NOT NULL DEFAULT '{}', closed_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
        await pool.query(`CREATE TABLE IF NOT EXISTS sal_cheque_cover (cheque_id INT PRIMARY KEY, covered_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
        // one-time set-up costs (e.g. key money): NOT part of the daily cost or break-even; shown separately with a payback line
        await pool.query(`CREATE TABLE IF NOT EXISTS sal_setup_costs (id SERIAL PRIMARY KEY, label TEXT NOT NULL, amount NUMERIC NOT NULL, paid_on DATE NOT NULL, status TEXT NOT NULL DEFAULT 'paid', note TEXT)`);
    })().catch(e => console.error('[salary] init failed:', e.message));

    // A core table that may not exist yet on a fresh instance counts as "no rows", never as an error.
    const soft = async (sql, params, fallback) => { try { return (await pool.query(sql, params)).rows; } catch (e) { return fallback; } };

    async function settings() {
        const rows = await soft(`SELECT key, value FROM sal_settings`, [], []);
        const s = { ...M.DEFAULTS };
        for (const r of rows) if (r.key in s) s[r.key] = Number(r.value);
        return s;
    }

    // ── settings ────────────────────────────────────────────────────────────
    router.get('/salary/settings', ownerOnly, async (req, res) => {
        try { await ready; res.json({ settings: await settings(), defaults: M.DEFAULTS }); }
        catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.put('/salary/settings', ownerOnly, async (req, res) => {
        try {
            await ready;
            const body = req.body || {}, cur = await settings(), next = { ...cur };
            for (const [k, v] of Object.entries(body)) {
                if (!(k in M.DEFAULTS)) return res.status(400).json({ error: `Unknown setting: ${k}` });
                const n = Number(v);
                if (v === '' || v === null || !Number.isFinite(n) || n < 0) return res.status(400).json({ error: `${k} must be a number, 0 or more` });
                next[k] = n;
            }
            for (const k of ['save_pct', 'colleague_pct', 'owner_pct', 'margin_pct', 'disc_min', 'disc_max']) if (next[k] > 100) return res.status(400).json({ error: `${k} cannot be more than 100` });
            if (next.colleague_pct + next.owner_pct > 100) return res.status(400).json({ error: 'The two commissions together cannot be more than 100% of the pool' });
            if (!(next.working_days >= 1 && next.working_days <= 31)) return res.status(400).json({ error: 'working_days must be between 1 and 31' });
            if (next.cost_ceiling < next.cost_normal) return res.status(400).json({ error: 'The ceiling cannot be lower than the normal daily cost' });
            if (next.disc_min > next.disc_max) return res.status(400).json({ error: 'The smallest discount cannot be bigger than the largest' });
            if (!(next.markup > 1)) return res.status(400).json({ error: 'markup must be more than 1 (1.95 means price is 1.95 times cost)' });
            for (const [k, v] of Object.entries(body)) {
                await pool.query(`INSERT INTO sal_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [k, Number(v)]);
            }
            res.json({ settings: await settings() });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ── screen 1: today ─────────────────────────────────────────────────────
    router.get('/salary/today', ownerOnly, async (req, res) => {
        try {
            await ready;
            const s = await settings(), t = today();
            const ds = (await soft(`SELECT total_sale, cash_sale, gross_profit, total_expenses, gp_status FROM daily_summary WHERE report_date = $1`, [t], []))[0] || null;
            const costs = M.dailyCosts(s);

            // margin: the last 30 days of real figures, else the setting
            const hist = (await soft(`SELECT COALESCE(SUM(gross_profit),0) AS gp, COALESCE(SUM(total_sale),0) AS sales FROM daily_summary WHERE report_date >= ($1::date - 30) AND report_date < $1::date AND gross_profit > 0`, [t], [{ gp: 0, sales: 0 }]))[0];
            const histMargin = num(hist.sales) > 0 ? Math.round(num(hist.gp) / num(hist.sales) * 1000) / 10 : null;
            const margin = histMargin != null ? histMargin : s.margin_pct;

            const sales = ds ? num(ds.total_sale) : 0, cash = ds ? num(ds.cash_sale) : 0;
            const gpKnown = ds && !(ds.gp_status === 'NOT_AVAILABLE' && !num(ds.gross_profit));
            const gp = gpKnown ? num(ds.gross_profit) : null, expenses = ds ? num(ds.total_expenses) : null;
            const net = gp != null && expenses != null ? M.money2(gp - expenses) : null;      // PENDING when the cost inputs are missing: never a guess

            // cheques: where they are recorded (cheque_register; pending or held = not paid yet)
            const cq = await soft(`SELECT c.id, c.amount, c.due_date, c.payee, (v.cheque_id IS NOT NULL) AS covered
                FROM cheque_register c LEFT JOIN sal_cheque_cover v ON v.cheque_id = c.id
                WHERE c.status IN ('pending','held') AND c.due_date <= ($1::date + $2::int) ORDER BY c.due_date`, [t, Math.round(s.cheque_days)], []);
            const reserve = M.chequeReserve(cq.map(r => ({ id: r.id, amount: Number(r.amount), due_date: r.due_date instanceof Date ? r.due_date.toISOString().slice(0, 10) : String(r.due_date).slice(0, 10), covered: r.covered, party: r.payee })), t, s.cheque_days);

            res.json({
                date: t, settings_used: { margin_source: histMargin != null ? 'last 30 days' : 'Settings (no recent sales)' },
                sales, gross_profit: gp, expenses, net,
                costs, costs_vs_target: { spent_today: expenses, normal: costs.normal, ceiling: costs.ceiling, status: costs.status },
                margin_pct: margin, break_even_sales: M.breakEven(costs.total, margin),
                break_even_reached: M.breakEven(costs.total, margin) != null ? sales >= M.breakEven(costs.total, margin) : null,
                push: [s.push_1, s.push_2].map(target => ({ target, sales, pct: target > 0 ? Math.min(100, Math.round(sales / target * 100)) : 0, remaining: Math.max(0, target - sales) })),
                cheque_set_aside: {
                    amount: reserve.reserve, lines: reserve.lines, cash_today: cash,
                    message: `Set aside Rs ${Math.round(reserve.reserve).toLocaleString('en-US')} today for cheques.`,
                    warning: reserve.reserve > cash ? `The set-aside (Rs ${Math.round(reserve.reserve).toLocaleString('en-US')}) is more than today's sales cash (Rs ${Math.round(cash).toLocaleString('en-US')}).` : null,
                },
            });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/salary/cheque-cover/:id', ownerOnly, async (req, res) => {
        try {
            await ready;
            const id = Number(req.params.id);
            if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Bad cheque id' });
            if (req.body && req.body.covered === false) await pool.query(`DELETE FROM sal_cheque_cover WHERE cheque_id = $1`, [id]);
            else await pool.query(`INSERT INTO sal_cheque_cover (cheque_id) VALUES ($1) ON CONFLICT (cheque_id) DO NOTHING`, [id]);
            res.json({ cheque_id: id, covered: !(req.body && req.body.covered === false) });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ── screen 2: month ─────────────────────────────────────────────────────
    async function monthFigures(ym, s) {
        const a = firstDay(ym), b = nextMonth(ym);
        const agg = (await soft(`SELECT COALESCE(SUM(gross_profit),0) AS gp, COALESCE(SUM(total_expenses),0) AS exp, COALESCE(SUM(total_sale),0) AS sales, COUNT(*) AS days FROM daily_summary WHERE report_date >= $1::date AND report_date < $2::date`, [a, b], [{ gp: 0, exp: 0, sales: 0, days: 0 }]))[0];
        const ret = (await soft(`SELECT COALESCE(SUM(CASE WHEN total_sale < 0 THEN -total_sale ELSE total_sale END),0) AS r FROM daily_reports WHERE is_refund = true AND report_date >= $1::date AND report_date < $2::date`, [a, b], [{ r: 0 }]))[0];
        const days = Number(agg.days);
        const fixedParts = s.add_fixed_to_net ? M.fixedCostsForMonth(days, s) : { rent_and_bills: 0, daily_pay: 0, total: 0 };
        const fixed = fixedParts.total;
        const gross = M.money2(num(agg.gp)), returns = M.money2(num(ret.r)), expenses = M.money2(num(agg.exp));
        const net = M.money2(gross - returns - expenses - fixed);
        return { gross_profit: gross, returns, expenses, fixed_costs_added: M.money2(fixed), fixed_costs: fixedParts, sales: M.money2(num(agg.sales)), days_with_data: days, net };
    }

    // Adjustments still waiting to be deducted: for every closed month, what late returns (recorded after it was closed) took off its commission, minus what earlier closings already deducted.
    async function outstandingAdjustments(s, beforeYm) {
        const closed = await soft(`SELECT * FROM sal_month_close ORDER BY ym`, [], []);
        const applied = {};
        for (const m of closed) { try { for (const [c, v] of Object.entries(JSON.parse(m.adj_applied))) { applied[c] = applied[c] || { colleague: 0, owner: 0 }; applied[c].colleague += v.colleague; applied[c].owner += v.owner; } } catch (e) { /* ignore */ } }
        const lines = [];
        for (const m of closed) {
            if (beforeYm && m.ym >= beforeYm) continue;
            const late = (await soft(`SELECT COALESCE(SUM(CASE WHEN total_sale < 0 THEN -total_sale ELSE total_sale END),0) AS r FROM daily_reports WHERE is_refund = true AND report_date >= $1::date AND report_date < $2::date AND created_at > $3::timestamptz`, [firstDay(m.ym), nextMonth(m.ym), new Date(m.closed_at).toISOString()], [{ r: 0 }]))[0];
            const adj = M.lateAdjustment(Number(m.net), num(late.r), s);
            const done = applied[m.ym] || { colleague: 0, owner: 0 };
            const colleague = M.money2(Math.max(0, adj.colleague - done.colleague)), owner = M.money2(Math.max(0, adj.owner - done.owner));
            if (colleague > 0 || owner > 0) lines.push({ from_month: m.ym, late_returns: M.money2(num(late.r)), colleague, owner });
        }
        return lines;
    }

    async function monthView(ym, s) {
        const fig = await monthFigures(ym, s);
        const split = M.monthSplit(fig.net, s);
        const adjLines = await outstandingAdjustments(s, ym);
        const adj = adjLines.reduce((a, l) => ({ colleague: a.colleague + l.colleague, owner: a.owner + l.owner }), { colleague: 0, owner: 0 });
        const colleaguePay = Math.max(0, split.colleague - adj.colleague), ownerPay = Math.max(0, split.owner - adj.owner);
        const closed = (await soft(`SELECT ym, net, savings, colleague, owner_comm, keep, closed_at FROM sal_month_close WHERE ym = $1`, [ym], []))[0] || null;
        return {
            ym, ...fig, split, adjustments: adjLines,
            colleague_commission: { calculated: split.colleague, adjustment: M.money2(adj.colleague), payable: M.money2(colleaguePay), carried_forward: M.money2(Math.max(0, adj.colleague - split.colleague)) },
            owner_commission: { calculated: split.owner, adjustment: M.money2(adj.owner), payable: M.money2(ownerPay), carried_forward: M.money2(Math.max(0, adj.owner - split.owner)) },
            stays_with_owner: split.keep, closed: closed ? { closed_at: closed.closed_at, net: Number(closed.net) } : null,
            note: fig.net <= 0 ? 'Net profit is zero or negative: no savings and no commission this month.' : null,
        };
    }

    router.get('/salary/month', ownerOnly, async (req, res) => {
        try {
            await ready;
            const ym = String(req.query.ym || today().slice(0, 7));
            if (!YM.test(ym)) return res.status(400).json({ error: 'ym must look like 2026-09' });
            res.json(await monthView(ym, await settings()));
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // Closing a month freezes what was worked out and records which adjustments were deducted. A closed month is never reopened.
    router.post('/salary/month/:ym/close', ownerOnly, async (req, res) => {
        try {
            await ready;
            const ym = req.params.ym;
            if (!YM.test(ym)) return res.status(400).json({ error: 'ym must look like 2026-09' });
            if (ym >= today().slice(0, 7)) return res.status(400).json({ error: 'A month can only be closed after it has ended.' });
            if ((await soft(`SELECT 1 FROM sal_month_close WHERE ym = $1`, [ym], [])).length) return res.status(409).json({ error: `${ym} is already closed. A closed month is never reopened; late returns become an adjustment next month.` });
            const s = await settings(), v = await monthView(ym, s);
            // deduct the waiting adjustments from this month's commission, oldest first; anything larger than the commission stays outstanding
            const applied = {};
            let remC = v.split.colleague, remO = v.split.owner;
            for (const l of v.adjustments) {
                const c = Math.min(l.colleague, remC), o = Math.min(l.owner, remO);
                applied[l.from_month] = { colleague: M.money2(c), owner: M.money2(o) };
                remC -= c; remO -= o;
            }
            await pool.query(`INSERT INTO sal_month_close (ym, net, savings, colleague, owner_comm, keep, adj_applied) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                [ym, v.net, v.split.save, v.colleague_commission.payable, v.owner_commission.payable, v.split.keep, JSON.stringify(applied)]);
            res.status(201).json(await monthView(ym, s));
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // Owner's accessories pricing rules, as a small helper: cost (+ optional offered price) -> list price, range, verdict.
    router.get('/salary/price-check', ownerOnly, async (req, res) => {
        try {
            await ready;
            const cost = Number(req.query.cost), price = req.query.price === undefined || req.query.price === '' ? null : Number(req.query.price);
            if (!(cost > 0)) return res.status(400).json({ error: 'cost must be more than 0' });
            if (price !== null && !(price >= 0)) return res.status(400).json({ error: 'price must be a number' });
            res.json(M.priceCheck(cost, price, await settings()));
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ── dashboard card + set-up costs (read-only; uses the same settings and the same maths as the screens above) ──
    router.get('/salary/overview', ownerOnly, async (req, res) => {
        try {
            await ready;
            const s = await settings(), t = today();
            const ds = (await soft(`SELECT total_sale, gross_profit, total_expenses, gp_status FROM daily_summary WHERE report_date = $1`, [t], []))[0] || null;
            const gpKnown = ds && !(ds.gp_status === 'NOT_AVAILABLE' && !num(ds.gross_profit));
            const net = gpKnown && ds.total_expenses != null ? M.money2(num(ds.gross_profit) - num(ds.total_expenses)) : null;
            const split = net != null ? M.monthSplit(net, s) : null;
            const cq = await soft(`SELECT c.id, c.amount, c.due_date, c.payee, (v.cheque_id IS NOT NULL) AS covered
                FROM cheque_register c LEFT JOIN sal_cheque_cover v ON v.cheque_id = c.id
                WHERE c.status IN ('pending','held') AND c.due_date <= ($1::date + $2::int) ORDER BY c.due_date`, [t, Math.round(s.cheque_days)], []);
            const reserve = M.chequeReserve(cq.map(r => ({ id: r.id, amount: Number(r.amount), due_date: r.due_date instanceof Date ? r.due_date.toISOString().slice(0, 10) : String(r.due_date).slice(0, 10), covered: r.covered, party: r.payee })), t, Math.round(s.cheque_days));
            const due7 = M.money2(reserve.lines.reduce((a, l) => a + l.amount, 0));

            const costs = await soft(`SELECT id, label, amount, paid_on, status, note FROM sal_setup_costs ORDER BY paid_on, id`, [], []);
            const setup = [];
            for (const c of costs) {
                const paidOn = c.paid_on instanceof Date ? c.paid_on.toISOString().slice(0, 10) : String(c.paid_on).slice(0, 10);
                const agg = (await soft(`SELECT COALESCE(SUM(gross_profit),0) AS gp, COALESCE(SUM(total_expenses),0) AS exp, COUNT(*) AS days FROM daily_summary WHERE report_date >= $1::date AND gp_status <> 'NOT_AVAILABLE'`, [paidOn], [{ gp: 0, exp: 0, days: 0 }]))[0];
                const days = Number(agg.days);
                const fixedPerDay = s.add_fixed_to_net ? (s.rent_month + s.utilities_month) / (s.working_days > 0 ? s.working_days : 26) + s.owner_daily + s.colleague_daily : 0;
                const profitSince = M.money2(num(agg.gp) - num(agg.exp) - fixedPerDay * days);
                const amount = Number(c.amount), back = Math.max(0, Math.min(amount, profitSince));
                setup.push({ id: c.id, label: c.label, amount, paid_on: paidOn, status: c.status, note: c.note,
                    payback: { profit_since: profitSince, days_counted: days, paid_back: M.money2(back), pct: amount > 0 ? Math.round(back / amount * 1000) / 10 : 0,
                        note: 'Net profit since the day it was paid (gross profit minus expenses, rent, bills and daily pay). An estimate.' } });
            }
            res.json({
                date: t,
                cost_target: { target: s.cost_normal, ceiling: s.cost_ceiling },
                savings_today: { net, pending: net == null, save_pct: s.save_pct, amount: split ? split.save : null },
                who_gets_what: split ? { savings: split.save, colleague: split.colleague, owner: split.owner, stays: split.keep } : null,
                cheque_reserve: { set_aside_today: reserve.reserve, due_within_days: Math.round(s.cheque_days), due_total: due7, count: reserve.lines.length },
                setup_costs: setup,
            });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    return router;
}

let _router;
module.exports = function (req, res, next) {
    if (!_router) _router = createRouter(new Pool({
        host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME,
        user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    }));
    _router(req, res, next);
};
module.exports.createRouter = createRouter;
