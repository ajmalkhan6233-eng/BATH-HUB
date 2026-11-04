'use strict';
/** Layla for registered investors. A registered number gets ONLY that investor's own figures from investor_loans. Nothing else is ever shown. */
const digitsOf = v => String(v == null ? '' : v).replace(/\D/g, '');
const money = n => 'LKR ' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const r2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const TABLE = `CREATE TABLE IF NOT EXISTS investor_contacts (
  id SERIAL PRIMARY KEY, phone TEXT NOT NULL UNIQUE, name TEXT NOT NULL, lender_name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;

/** Pure: loans [{amount, profit_rate, due_date, status, paid}] -> the investor's own figures. */
function summarize(loans) {
  let invested = 0, profit = 0, paid = 0, next = null;
  for (const l of loans) {
    const a = Number(l.amount) || 0, p = r2(a * (Number(l.profit_rate) || 0) / 100);
    invested += a; profit += p; paid += Number(l.paid) || 0;
    if (l.status !== 'repaid' && l.due_date && (!next || String(l.due_date) < next)) next = String(l.due_date).slice(0, 10);
  }
  const total = r2(invested + profit);
  return { invested: r2(invested), agreedProfit: r2(profit), totalDue: total, paid: r2(paid), outstanding: r2(Math.max(0, total - paid)), nextDue: next };
}

function reply(name, s) {
  const lines = [`Hello ${name}. Here are your figures with Royal Bath Hub:`,
    `Your investment: ${money(s.invested)}`,
    `Agreed profit share: ${money(s.agreedProfit)}`,
    `Paid back so far: ${money(s.paid)}`,
    `Still to be paid: ${money(s.outstanding)}`];
  if (s.nextDue) lines.push(`Next due date: ${s.nextDue}`);
  lines.push('For anything else, please speak to Ajmal directly.');
  return lines.join('\n');
}

let ensured = false;
async function findInvestor(pool, phone) {
  try {
    if (!ensured) { await pool.query(TABLE); ensured = true; }
    const d = digitsOf(phone); if (!d) return null;
    const r = await pool.query(`SELECT * FROM investor_contacts WHERE active AND (phone = $1 OR RIGHT(phone, 9) = RIGHT($1, 9)) LIMIT 1`, [d]);
    return r.rows[0] || null;
  } catch (_) { return null; }
}

/** The reply text for a registered investor, or null when the number is not a registered investor. */
async function answerInvestor(pool, phone) {
  const inv = await findInvestor(pool, phone);
  if (!inv) return null;
  try {
    const r = await pool.query(
      `SELECT l.amount, l.profit_rate, l.due_date, l.status,
              COALESCE((SELECT SUM(p.amount) FROM investor_loan_payments p WHERE p.loan_id = l.id), 0) AS paid
         FROM investor_loans l WHERE LOWER(l.lender_name) = LOWER($1)`, [inv.lender_name]);
    if (!r.rows.length) return `Hello ${inv.name}. I could not find your investment on record yet. Ajmal will confirm it with you.`;
    return reply(inv.name, summarize(r.rows));
  } catch (_) { return `Hello ${inv.name}. I cannot read your figures right now. Please try again shortly, or speak to Ajmal.`; }
}

module.exports = { TABLE, digitsOf, summarize, reply, findInvestor, answerInvestor };
