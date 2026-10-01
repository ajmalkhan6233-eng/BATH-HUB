// utils/salaryMath.js
// SALARY module, pure maths (no database, no network). Every number comes in as an argument; nothing is hard-coded
// except the DEFAULTS below, which are only the starting values for the Settings screen (the owner edits them).
//
// MONEY ORDER (monthly, on NET profit only): savings first, then the commission pool, then commissions, the rest stays.
// Halal rule: no interest anywhere in here.

const money2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const DEFAULTS = {
    save_pct: 10, colleague_pct: 15, owner_pct: 10,                 // monthly split, % (savings of net; commissions of the pool)
    rent_month: 70000, utilities_month: 30000, working_days: 26,    // fixed costs, divided by working days
    owner_daily: 5000, colleague_daily: 3000, small_daily: 3000,    // daily pay and small expenses (transport, packing...)
    cost_normal: 15000, cost_ceiling: 18000,                        // daily cost target
    margin_pct: 25,                                                 // used for break-even only when there is no recent sales history
    push_1: 100000, push_2: 150000,                                 // daily sales targets for the staff push
    cheque_days: 7,                                                 // how far ahead the cheque reserve looks
    add_fixed_to_net: 1,                                            // 1 = also subtract rent, bills and daily pay (the owner's daily sheet does NOT include them); 0 = they are already in the expenses
    markup: 1.95, disc_min: 10, disc_max: 25, min_over_cost: 1.15,  // accessories pricing rules (owner's rules)
};

// The reference calculation the owner gave. net <= 0 means every commission is 0, never negative.
function monthSplit(net, s = {}) {
    const save_pct = (s.save_pct != null ? s.save_pct : DEFAULTS.save_pct) / 100;
    const colleague_pct = (s.colleague_pct != null ? s.colleague_pct : DEFAULTS.colleague_pct) / 100;
    const owner_pct = (s.owner_pct != null ? s.owner_pct : DEFAULTS.owner_pct) / 100;
    if (!(net > 0)) return { save: 0, pool: 0, colleague: 0, owner: 0, keep: 0 };
    const save = net * save_pct;
    const pool = net - save;
    const colleague = pool * colleague_pct;
    const owner = pool * owner_pct;
    return { save: money2(save), pool: money2(pool), colleague: money2(colleague), owner: money2(owner), keep: money2(pool - colleague - owner) };
}

// What everything costs per day, from the settings.
function dailyCosts(s) {
    const days = s.working_days > 0 ? s.working_days : 26;
    const rent = s.rent_month / days, utilities = s.utilities_month / days;
    const total = rent + utilities + s.owner_daily + s.colleague_daily + s.small_daily;
    const status = total > s.cost_ceiling ? 'over_ceiling' : total > s.cost_normal ? 'above_normal' : 'ok';
    return { rent: money2(rent), utilities: money2(utilities), owner: s.owner_daily, colleague: s.colleague_daily, small: s.small_daily, total: money2(total), normal: s.cost_normal, ceiling: s.cost_ceiling, status };
}

// Costs that are NOT on the daily expense sheet, charged to the month: rent and bills share by working days (a full month
// of working days = the full monthly amount), and the owner and colleague daily pay for each day that has sales.
function fixedCostsForMonth(daysWithData, s) {
    const days = Math.max(0, Number(daysWithData) || 0), wd = s.working_days > 0 ? s.working_days : 26;
    const rentAndBills = (s.rent_month + s.utilities_month) * Math.min(1, days / wd);
    const dailyPay = (s.owner_daily + s.colleague_daily) * days;
    return { rent_and_bills: money2(rentAndBills), daily_pay: money2(dailyPay), total: money2(rentAndBills + dailyPay) };
}

// Sales needed to cover the day's costs at the given profit margin (percent). null when the margin is unknown or not positive.
function breakEven(costs, marginPct) {
    return marginPct > 0 ? Math.ceil(costs / (marginPct / 100)) : null;
}

// Cheque reserve: cheques are paid from sales cash, so each unpaid cheque due within the window needs (amount / days left) set
// aside every day. A cheque due today or already late needs its full amount now. Cheques marked "covered" are skipped.
// cheques: [{ id, amount, due_date: 'YYYY-MM-DD', covered }]; today: 'YYYY-MM-DD'.
function chequeReserve(cheques, today, windowDays = 7) {
    const t = Date.parse(today + 'T00:00:00Z');
    const lines = [];
    let reserve = 0;
    for (const c of cheques) {
        if (c.covered) continue;
        const left = Math.round((Date.parse(String(c.due_date).slice(0, 10) + 'T00:00:00Z') - t) / 86400000);
        if (left > windowDays) continue;
        const need = left <= 0 ? Number(c.amount) : Number(c.amount) / left;
        reserve += need;
        lines.push({ id: c.id, amount: money2(c.amount), due_date: String(c.due_date).slice(0, 10), days_left: left, set_aside_today: money2(need), late: left < 0, party: c.party || '' });
    }
    lines.sort((a, b) => a.days_left - b.days_left);
    return { reserve: money2(reserve), lines };
}

// Late returns: a return that lowers an old, already-paid month never reopens it. The commission that month would have been
// is recalculated with the extra return and the difference is deducted from the next month's commission, as its own line.
function lateAdjustment(closedNet, lateReturns, s = {}) {
    const before = monthSplit(closedNet, s), after = monthSplit(closedNet - lateReturns, s);
    return { colleague: money2(before.colleague - after.colleague), owner: money2(before.owner - after.owner), savings: money2(before.save - after.save) };
}

// Owner's accessories pricing rules. cost -> suggested price and the allowed discount range; checks an offered price.
function priceCheck(cost, price, s = {}) {
    const markup = s.markup || DEFAULTS.markup, dmin = s.disc_min != null ? s.disc_min : DEFAULTS.disc_min, dmax = s.disc_max != null ? s.disc_max : DEFAULTS.disc_max;
    const floorMult = s.min_over_cost || DEFAULTS.min_over_cost;
    const list = money2(cost * markup);
    const out = { list_price: list, discount_range: [dmin, dmax], lowest_normal: money2(list * (1 - dmax / 100)), too_close_to_cost: false, verdict: 'ok' };
    if (price != null) {
        out.too_close_to_cost = price < cost * floorMult;
        out.verdict = out.too_close_to_cost ? 'refused: too close to cost (last resort only, needs the owner)' : price < out.lowest_normal ? 'below the normal discount range: needs the owner' : 'ok';
    }
    return out;
}

module.exports = { DEFAULTS, money2, monthSplit, dailyCosts, fixedCostsForMonth, breakEven, chequeReserve, lateAdjustment, priceCheck };
