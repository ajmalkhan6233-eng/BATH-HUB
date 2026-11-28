'use strict';
// SHOP NUMBERS (28 Nov 2026, idea 8.2). One read-only answer for chat and Claude Code, using the SAME rules as the screens:
// sales and profit from utils/moneyCore.js, cheques from the real cheque table (Cheque Calendar), low stock as on the Dashboard.
// A part that cannot be read comes back as null (NOT FOUND), never as a pretend zero. No customer names, phones or cheque numbers.
const MC = require('./moneyCore');
const { advanceDay } = require('./advanceCash');

const DAY = 86400e3;
const colomboDay = (now) => new Date(now.getTime() + 5.5 * 3600e3).toISOString().slice(0, 10);
const addDays = (ymd, n) => new Date(Date.parse(ymd + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10);
const r2 = MC.round2;

// Each part gets its own READ ONLY transaction: the database refuses any write, and one failed part cannot spoil the next.
async function part(pool, fn) {
    const c = await pool.connect();
    try { await c.query('BEGIN READ ONLY'); await c.query("SET LOCAL statement_timeout = '15000'"); return await fn(c); }
    catch (e) { return null; }
    finally { try { await c.query('ROLLBACK'); } catch (x) { /* ignore */ } c.release(); }
}

async function dayNumbers(pool, day, running) {
    const s = await part(pool, (c) => MC.range(c, day, day));
    if (!s) return null;
    const cashSales = await part(pool, async (c) => (await c.query(
        `SELECT COALESCE(SUM(amount),0) AS s FROM (
           SELECT p.amount FROM pos_bill_payments p JOIN pos_bills b ON b.id = p.bill_id WHERE LOWER(p.method) = 'cash' AND b.created_at::date = $1::date AND ${MC.LIVE}
           UNION ALL SELECT b.total FROM pos_bills b WHERE LOWER(COALESCE(b.payment_method,'cash')) = 'cash' AND b.created_at::date = $1::date AND ${MC.LIVE}
             AND NOT EXISTS (SELECT 1 FROM pos_bill_payments p WHERE p.bill_id = b.id)) z`, [day])).rows[0].s);
    // advanceDay answers zeros when its tables are missing, which is right: no advance tables means no advance money.
    const adv = await part(pool, (c) => advanceDay(c, day));
    let after = null;
    if (running && running.per_day > 0) after = r2(s.gross - (day >= running.from ? running.per_day : 0));
    return { day, bills: s.n, sales: s.sales, gross_profit: s.gross, lines_without_cost: s.no_cost, profit_after_running_cost: after,
        cash_from_bills_and_advances: cashSales == null || !adv ? null : r2(Number(cashSales) + adv.received.cash - adv.applied.cash) };
}

async function shopNumbers(pool, now = new Date()) {
    const today = colomboDay(now), yesterday = addDays(today, -1);
    const running = await part(pool, async (c) => {
        const set = {};
        (await c.query("SELECT key, value FROM app_settings WHERE key IN ('running_cost_per_day','running_cost_from')")).rows.forEach((r) => { set[r.key] = r.value; });
        const per = Number(set.running_cost_per_day || 0), from = String(set.running_cost_from || '').slice(0, 10);
        return per > 0 && from ? { per_day: per, from } : null;
    });
    const cheques = await part(pool, async (c) => (await c.query(
        `SELECT to_char(c.due_date,'YYYY-MM-DD') AS due, b.vendor_name AS vendor, c.amount FROM vendor_bill_cheques c JOIN vendor_bills b ON b.id = c.bill_id
          WHERE b.voided = false AND c.status = 'ISSUED' AND c.due_date <= $1::date ORDER BY c.due_date, c.id`, [addDays(today, 7)])).rows
        .map((r) => ({ due: r.due, vendor: r.vendor, amount: Number(r.amount) })));
    const low = await part(pool, async (c) => {
        const w = 'active = true AND stock_level > 0 AND reorder_threshold > 0 AND stock_level <= reorder_threshold';
        const n = (await c.query(`SELECT COUNT(*) FILTER (WHERE ${w})::int AS low, COUNT(*) FILTER (WHERE active = true AND stock_level <= 0)::int AS out FROM products`)).rows[0];
        const list = (await c.query(`SELECT name, stock_level FROM products WHERE ${w} ORDER BY (stock_level::float / reorder_threshold), name LIMIT 10`)).rows;
        return { low: n.low, out: n.out, first_10: list.map((r) => ({ name: r.name, left: Number(r.stock_level) })) };
    });
    const advances = await part(pool, async (c) => (await c.query(
        `SELECT order_no, total, advance_amount, to_char(created_at::date,'YYYY-MM-DD') AS opened FROM pos_advance_orders WHERE status = 'open' ORDER BY created_at, id LIMIT 50`)).rows
        .map((r) => ({ order_no: r.order_no, total: Number(r.total), advance: Number(r.advance_amount), opened: r.opened, older_than_14_days: r.opened < addDays(today, -14) })));
    return {
        at: now.toISOString(), running_cost: running,
        today: await dayNumbers(pool, today, running), yesterday: await dayNumbers(pool, yesterday, running),
        cheques_overdue: cheques && cheques.filter((x) => x.due < today),
        cheques_next_7_days: cheques && cheques.filter((x) => x.due >= today),
        stock: low, open_advance_orders: advances,
    };
}
module.exports = { shopNumbers, colomboDay, addDays };
