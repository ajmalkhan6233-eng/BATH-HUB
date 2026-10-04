// LAYLA business-question answer engine: deterministic DB lookups for the
// question types that must never be answered by a hallucination-prone LLM
// (money figures, stock, balances). Matched questions bypass the AI call
// entirely; unmatched ones fall through to LAYLA's normal chat flow.
'use strict';

// Common WhatsApp shorthand -> full words, so matching still works on
// "np yesterday", "gp for june", "cheq due this week" etc.
function expandShorthand(text) {
    return text
        .replace(/\bnp\b/gi, 'net profit')
        .replace(/\bgp\b/gi, 'gross profit')
        .replace(/\bcheqs?\b/gi, 'cheques')
        .replace(/\bchq\b/gi, 'cheque');
}

function fmtDate(d) { return d.toISOString().slice(0, 10); }

function parseDateRef(text) {
    const t = text.toLowerCase();
    const today = new Date();
    if (/\byesterday\b/.test(t)) {
        const d = new Date(today); d.setDate(d.getDate() - 1);
        return { kind: 'day', value: fmtDate(d) };
    }
    if (/\btoday\b/.test(t)) return { kind: 'day', value: fmtDate(today) };
    if (/\blast\s+week\b/.test(t)) {
        const end = new Date(today); end.setDate(end.getDate() - 7);
        const start = new Date(today); start.setDate(start.getDate() - 13);
        return { kind: 'range', from: fmtDate(start), to: fmtDate(end), label: 'last week' };
    }
    if (/\bthis\s+week\b/.test(t)) {
        const start = new Date(today); start.setDate(start.getDate() - 6);
        return { kind: 'range', from: fmtDate(start), to: fmtDate(today), label: 'this week' };
    }
    const isoMatch = t.match(/\b(\d{4}-\d{2}-\d{2})\b/);
    if (isoMatch) return { kind: 'day', value: isoMatch[1] };
    const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
    for (let i = 0; i < months.length; i++) {
        if (t.includes(months[i])) {
            const yearMatch = t.match(/\b(20\d{2})\b/);
            const year = yearMatch ? yearMatch[1] : String(today.getFullYear());
            return { kind: 'month', value: `${year}-${String(i + 1).padStart(2, '0')}` };
        }
    }
    return null;
}

// gp_status honesty label — never present an ESTIMATE/BLENDED figure as if
// it were a confirmed actual number.
function npStatusFlag(gp_status) {
    if (gp_status === 'ESTIMATE') return ' (ESTIMATED, not final)';
    if (gp_status === 'BLENDED') return ' (partly estimated — blended)';
    return '';
}

async function classifyAndAnswer(pool, rawText) {
    const t = expandShorthand(rawText.trim());

    // 1) Net profit / sales for a day, week range, or month
    if (/\b(net profit|sales?|revenue|turnover)\b/i.test(t)) {
        const ref = parseDateRef(t);
        if (ref) {
            if (ref.kind === 'day') {
                const r = await pool.query(
                    `SELECT total_sale, gross_profit, total_expenses, net_profit, gp_status
                     FROM daily_summary WHERE report_date=$1`, [ref.value]);
                if (!r.rows.length) return { intent: 'net_profit_day', reply: `No data for ${ref.value} — nothing recorded yet, so I can't say.` };
                const row = r.rows[0];
                const npKnown = ['ACTUAL', 'BLENDED', 'ESTIMATE'].includes(row.gp_status);
                return {
                    intent: 'net_profit_day',
                    reply: `${ref.value}: Sales LKR ${Number(row.total_sale).toLocaleString()}` +
                        (npKnown
                            ? `, Net Profit LKR ${Number(row.net_profit).toLocaleString()}${npStatusFlag(row.gp_status)}`
                            : `. Net profit isn't available yet for that day (GP status: ${row.gp_status}) — not going to guess it.`),
                };
            }
            if (ref.kind === 'range') {
                const r = await pool.query(
                    `SELECT COALESCE(SUM(total_sale),0) as sale,
                            COALESCE(SUM(net_profit) FILTER (WHERE gp_status IN ('ACTUAL','BLENDED','ESTIMATE')),0) as np,
                            COUNT(*) FILTER (WHERE gp_status='ESTIMATE') as est_days,
                            COUNT(*) FILTER (WHERE gp_status='BLENDED') as blend_days,
                            COUNT(*) FILTER (WHERE gp_status IN ('ACTUAL','BLENDED','ESTIMATE')) as np_days, COUNT(*) as days
                     FROM daily_summary WHERE report_date BETWEEN $1 AND $2`, [ref.from, ref.to]);
                const row = r.rows[0];
                if (!Number(row.days)) return { intent: 'net_profit_range', reply: `No data recorded for ${ref.label} — nothing to report.` };
                const flag = (Number(row.est_days) + Number(row.blend_days)) > 0 ? ' (includes estimated day(s))' : '';
                return {
                    intent: 'net_profit_range',
                    reply: `${ref.label} (${ref.from} to ${ref.to}): Sales LKR ${Number(row.sale).toLocaleString()}, ` +
                        `Net Profit LKR ${Number(row.np).toLocaleString()}${flag} — known for ${row.np_days}/${row.days} days.`,
                };
            }
            const r = await pool.query(
                `SELECT COALESCE(SUM(total_sale),0) as sale, COALESCE(SUM(gross_profit),0) as gp,
                        COALESCE(SUM(net_profit) FILTER (WHERE gp_status IN ('ACTUAL','BLENDED','ESTIMATE')),0) as np,
                        COUNT(*) FILTER (WHERE gp_status='ESTIMATE') as est_days,
                        COUNT(*) FILTER (WHERE gp_status='BLENDED') as blend_days,
                        COUNT(*) FILTER (WHERE gp_status IN ('ACTUAL','BLENDED','ESTIMATE')) as np_days, COUNT(*) as days
                 FROM daily_summary WHERE TO_CHAR(report_date,'YYYY-MM')=$1`, [ref.value]);
            const row = r.rows[0];
            if (!Number(row.days)) return { intent: 'net_profit_month', reply: `No sales data recorded for ${ref.value} yet.` };
            const flag = (Number(row.est_days) + Number(row.blend_days)) > 0 ? ' (includes estimated day(s))' : '';
            return {
                intent: 'net_profit_month',
                reply: `${ref.value}: Sales LKR ${Number(row.sale).toLocaleString()} across ${row.days} day(s), ` +
                    `Net Profit LKR ${Number(row.np).toLocaleString()}${flag} (known for ${row.np_days}/${row.days} days).`,
            };
        }
    }

    // 2) Credit balance of a named customer
    const creditMatch = t.match(/credit\s+(?:balance|outstanding)\s+(?:of|for)\s+([a-zA-Z][\w .]*)/i)
        || t.match(/(?:balance|outstanding)\s+(?:of|for)\s+([a-zA-Z][\w .]*)/i);
    if (creditMatch) {
        const name = creditMatch[1].trim();
        const r = await pool.query(
            `SELECT name, SUM(amount) as total, SUM(paid) as paid, SUM(amount-paid) as due
             FROM credit_customers WHERE name ILIKE $1 AND NOT COALESCE(quarantined,false)
             GROUP BY name`, [`%${name}%`]);
        if (!r.rows.length) return { intent: 'credit_balance', reply: `Couldn't find a credit account for "${name}" — no record of that name.` };
        const row = r.rows[0];
        return {
            intent: 'credit_balance',
            reply: `${row.name}: outstanding credit balance LKR ${Number(row.due).toLocaleString()} ` +
                `(total invoiced LKR ${Number(row.total).toLocaleString()}, paid LKR ${Number(row.paid).toLocaleString()}).`,
        };
    }

    // 3) Cheques — pending, or due within a specific window
    if (/cheques?\s+(pending|due|outstanding)|pending\s+cheques?/i.test(t)) {
        const daysMatch = t.match(/next\s+(\d+)\s+days?/i);
        const days = daysMatch ? parseInt(daysMatch[1]) : null;
        const query = days
            ? { sql: `SELECT cheque_number, amount, due_date FROM cheques WHERE status='pending' AND due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + $1::int ORDER BY due_date`, params: [days], label: `due in the next ${days} days` }
            : { sql: `SELECT cheque_number, amount, due_date FROM cheques WHERE status='pending' ORDER BY due_date NULLS LAST LIMIT 10`, params: [], label: 'pending' };
        const r = await pool.query(query.sql, query.params);
        if (!r.rows.length) return { intent: 'pending_cheques', reply: `No cheques ${query.label} right now.` };
        const total = r.rows.reduce((a, x) => a + Number(x.amount), 0);
        const lines = r.rows.map(x => `#${x.cheque_number} — LKR ${Number(x.amount).toLocaleString()} due ${x.due_date || 'unknown'}`);
        return { intent: 'pending_cheques', reply: `Cheques ${query.label} (LKR ${total.toLocaleString()} total):\n${lines.join('\n')}` };
    }

    // 4) Item code lookup — price/cost/stock
    const codeMatch = t.match(/(?:code|item)\s*#?\s*(\d{2,8})/i) || t.match(/\b(\d{4,8})\b/);
    if (codeMatch && /\b(price|cost|stock|available|code|item)\b/i.test(t)) {
        const code = codeMatch[1];
        const r = await pool.query(
            `SELECT item_code, name, selling_price, avg_cost, stock_level FROM products WHERE item_code=$1`, [code]);
        if (!r.rows.length) return { intent: 'item_lookup', reply: `No item found with code ${code}.` };
        const row = r.rows[0];
        return {
            intent: 'item_lookup',
            reply: `${row.item_code} — ${row.name}: Price LKR ${Number(row.selling_price).toLocaleString()}, ` +
                `Cost LKR ${Number(row.avg_cost).toLocaleString()}, Stock ${row.stock_level} units.`,
        };
    }

    return null; // not a recognized business question — let normal LAYLA chat handle it
}

module.exports = { classifyAndAnswer, parseDateRef, expandShorthand };
