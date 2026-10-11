'use strict';
// Cheque clearing alerts to the owner's WhatsApp: 3 days, 2 days, 1 day and the morning of clearing.
// Pure part (alertsDue, buildMessage) has no database. runChequeAlerts needs the pool and a send(text) function.
const { clearingDate, alertDates } = require('./cheque_clearing');
const { all: staticHolidays } = require('./slBankHolidays');

const FOOTER = 'Clearing rule (Fri->Mon, Sat/Sun->Tue, holidays skipped) not yet confirmed with the bank.';
const money = n => 'Rs ' + Number(n || 0).toLocaleString('en-LK', { maximumFractionDigits: 2 });

/** cheques: [{ id, payee, amount, deposit_date, reg_status }]. Returns alerts whose date is today, not already sent. */
function alertsDue(cheques, todayISO, hol = [], sentKeys = new Set()) {
  const out = [];
  for (const c of cheques) {
    if (!c.deposit_date || c.reg_status === 'cleared' || c.reg_status === 'bounced') continue;
    const clears = clearingDate(c.deposit_date, hol);
    for (const a of alertDates(clears)) {
      if (a.when !== todayISO || sentKeys.has(`${c.id}|${a.when}`)) continue;
      out.push({ key: `${c.id}|${a.when}`, cheque_id: c.id, payee: c.payee, amount: Number(c.amount), clears_on: clears, text: a.text });
    }
  }
  return out;
}
function buildMessage(alerts, withFooter = true) {
  const lines = alerts.map(a => `${a.text}: cheque to ${a.payee || 'unknown'} ${money(a.amount)} (clears ${a.clears_on})`);
  return `CHEQUE ALERT\n${lines.join('\n')}${withFooter ? '\n' + FOOTER : ''}`;
}

async function ensureTable(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS cheque_alerts_sent (cheque_id INT NOT NULL, alert_date DATE NOT NULL, sent_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (cheque_id, alert_date))`);
}
const slToday = (now) => new Date(now.getTime() + 5.5 * 3600e3);

/** Safe to call every few minutes. Sends nothing before 07:00 Sri Lanka time and never repeats an alert. */
async function runChequeAlerts({ pool, send, now = new Date() }) {
  await ensureTable(pool);
  const sl = slToday(now), todayISO = sl.toISOString().slice(0, 10);
  if (sl.getUTCHours() < 7) return { sent: 0, reason: 'before 07:00' };
  const hol = [...new Set([...(await pool.query(`SELECT TO_CHAR(day,'YYYY-MM-DD') d FROM bank_holidays`).catch(() => ({ rows: [] }))).rows.map(r => r.d), ...staticHolidays()])];
  const rows = (await pool.query(`SELECT c.id, c.payee, c.amount::float AS amount, c.status AS reg_status, TO_CHAR(d.deposit_date,'YYYY-MM-DD') deposit_date
      FROM cheque_register c JOIN cheque_deposits d ON d.cheque_id=c.id`)).rows;
  const sentKeys = new Set((await pool.query(`SELECT cheque_id, TO_CHAR(alert_date,'YYYY-MM-DD') d FROM cheque_alerts_sent WHERE alert_date=$1`, [todayISO])).rows.map(r => `${r.cheque_id}|${r.d}`));
  const due = alertsDue(rows, todayISO, hol, sentKeys);
  if (!due.length) return { sent: 0 };
  await send(buildMessage(due));
  for (const a of due) await pool.query(`INSERT INTO cheque_alerts_sent (cheque_id, alert_date) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [a.cheque_id, todayISO]);
  return { sent: due.length };
}
module.exports = { alertsDue, buildMessage, runChequeAlerts, FOOTER };
