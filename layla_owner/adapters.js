'use strict';
/**
 * The ONLY file that touches existing app data. Read-only queries. Claude Code: fill the three ADAPT blocks by reading
 * routes/item_catalog.js, the money-control route and the daily summary route (grep for the table and column names). 15 minutes of work.
 * Each function must return plain data or null; the brain turns it into words. Cheques and payables use the vendor ledger tables from Build 1 (no ADAPT needed).
 */
const L = require('../utils/vendorLedger');
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' });
const num = (v) => Number(v) || 0;

module.exports = function createAdapters({ pool }) {
  async function ledgerRows() {
    const bills = (await pool.query('SELECT * FROM vendor_bills WHERE voided=FALSE')).rows.map((b) => ({ ...b, total: num(b.total) }));
    const ch = (await pool.query('SELECT * FROM vendor_bill_cheques')).rows.map((c) => ({ ...c, amount: num(c.amount), due_date: String(c.due_date instanceof Date ? c.due_date.toISOString() : c.due_date).slice(0, 10) }));
    const pay = (await pool.query('SELECT * FROM vendor_payments')).rows.map((p) => ({ ...p, amount: num(p.amount) }));
    const cn = (await pool.query('SELECT * FROM vendor_credit_notes')).rows.map((n) => ({ ...n, amount: num(n.amount) }));
    const by = (rows, id) => rows.filter((x) => Number(x.bill_id) === Number(id));
    return bills.map((b) => ({ bill: b, cheques: by(ch, b.id), payments: by(pay, b.id), credits: by(cn, b.id) }));
  }
  return {
    async cheques() { const rows = await ledgerRows(); return L.chequeCalendar(rows.flatMap((r) => r.cheques.map((c) => ({ ...c, vendor_name: r.bill.vendor_name }))), today()); },
    async cashGap(cash) { const rows = await ledgerRows(); return L.cashGap(rows.flatMap((r) => r.cheques), { cashOnHand: cash || 0 }, today(), 2); },
    async payable(vendor) { const rows = await ledgerRows(); const s = L.summarise(rows); if (!vendor) return s; const v = s.vendors.filter((x) => x.vendor.toLowerCase().includes(vendor.toLowerCase())); return { vendors: v, totals: v.reduce((a, x) => ({ outstanding: a.outstanding + x.outstanding, covered: a.covered + x.covered, uncovered: a.uncovered + x.uncovered }), { outstanding: 0, covered: 0, uncovered: 0 }) }; },

    /** ADAPT 1: stock lookup. Return [{ name, code, qty, price }] for items whose name or code contains q (max 5). */
    async stock(q) {
      if (!q) return null;
      let rows;
      try { ({ rows } = await pool.query(`SELECT name, item_code AS code, stock_level AS qty, selling_price AS price FROM products WHERE active = true AND (LOWER(name) LIKE $1 OR item_code = $2) ORDER BY name LIMIT 5`, ['%' + String(q).toLowerCase() + '%', String(q)])); } catch (_) { return null; } // catalogue table not reachable: say 'not connected'
      return rows.map((r) => ({ ...r, qty: num(r.qty), price: num(r.price) }));
    },
    /** ADAPT 2: price lookup, same shape as stock. */
    async price(q) { return this.stock(q); },
    /** ADAPT 3: sales and cash. Return { sales, grossProfit, cashOnHand } for 'today' or 'yesterday' from the daily summary / money control tables (read only), or null. */
    async sales(day) {
      const d = new Date(today() + 'T00:00:00Z'); if (day === 'yesterday') d.setUTCDate(d.getUTCDate() - 1);
      const iso = d.toISOString().slice(0, 10);
      const { rows } = await pool.query(`SELECT COALESCE(SUM(total_sale),0) AS sales, COALESCE(SUM(gross_profit),0) AS gp, COUNT(*) AS n FROM daily_summary WHERE report_date = $1`, [iso]);
      if (!Number(rows[0].n)) return null; // nothing recorded for that day
      let cashOnHand = 0;
      try { const q = await pool.query(`SELECT value FROM app_settings WHERE key='money_plan'`); cashOnHand = num(q.rows[0] && q.rows[0].value && q.rows[0].value.cashOnHand); } catch (_) { /* settings optional */ }
      return { sales: num(rows[0].sales), grossProfit: num(rows[0].gp), cashOnHand };
    },
  };
};
