'use strict';
/**
 * AUDIT INVARIANTS (read-only). One file, one job: ask the database "do the numbers agree with each other?"
 * Only SELECT / SHOW statements. Safe to run on the live database; never writes, never alters.
 *
 * runAll(pool, { previousGaps }) -> { checks:[{id,name,status,detail,rows}], red, warn, ok, skipped, gaps, line }
 * status: OK | WARN (heads-up, look when you can) | RED (numbers disagree) | SKIP (table not there yet)
 * line:   one short line for the 06:00 message (Rule 11), e.g. "AUDIT GREEN: 12 checks agree" or "AUDIT RED: 2 (negative stock; bill totals)"
 *
 * What this proves: the stored numbers tie to each other. It does NOT prove a number is the right number
 * (a wrong price typed by hand ties perfectly). Say that when reporting.
 */
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const TOL = 0.01;               // one cent: money is NUMERIC(.,2)
const SAMPLE = 8;               // rows shown per check, enough to find the problem, small enough for a phone

async function has(pool, table) {
  const r = await pool.query(`SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1 LIMIT 1`, [table]);
  return r.rows.length > 0;
}
async function hasCol(pool, table, col) {
  const r = await pool.query(`SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2 LIMIT 1`, [table, col]);
  return r.rows.length > 0;
}
const res = (status, detail, rows = [], extra = {}) => ({ status, detail, rows: rows.slice(0, SAMPLE), count: rows.length, ...extra });
const needs = (...t) => async (pool) => { for (const x of t) if (!(await has(pool, x))) return `table ${x} not created yet`; return null; };

const CHECKS = [
  {
    id: 'negative_stock', name: 'no negative stock', needs: needs('products'),
    run: async (pool) => {
      const r = await pool.query(`SELECT item_code, name, stock_level FROM products WHERE active = true AND COALESCE(stock_level,0) < 0 ORDER BY stock_level LIMIT 200`);
      return r.rows.length ? res('RED', `${r.rows.length} item(s) below zero`, r.rows) : res('OK', 'no item is below zero');
    },
  },
  {
    id: 'duplicate_items', name: 'no duplicate item codes or names', needs: needs('products'),
    run: async (pool) => {
      const r = await pool.query(`
        SELECT 'code' AS kind, item_code AS key, COUNT(*)::int AS n FROM products WHERE active = true AND item_code IS NOT NULL GROUP BY item_code HAVING COUNT(*) > 1
        UNION ALL
        SELECT 'name', LOWER(TRIM(name)), COUNT(*)::int FROM products WHERE active = true GROUP BY LOWER(TRIM(name)) HAVING COUNT(*) > 1`);
      return r.rows.length ? res('RED', `${r.rows.length} duplicate(s)`, r.rows) : res('OK', 'every active item has its own code and name');
    },
  },
  {
    id: 'bill_totals', name: 'bill totals add up', needs: needs('pos_bills', 'pos_bill_items'),
    run: async (pool) => {
      const r = await pool.query(`
        SELECT b.bill_number, b.subtotal, b.discount_amount, b.total,
               (SELECT COALESCE(SUM(i.line_total),0) FROM pos_bill_items i WHERE i.bill_id = b.id) AS lines
        FROM pos_bills b
        WHERE ABS(b.total - (b.subtotal - b.discount_amount)) > ${TOL}
           OR ABS(b.subtotal - (SELECT COALESCE(SUM(i.line_total),0) FROM pos_bill_items i WHERE i.bill_id = b.id)) > ${TOL}
        ORDER BY b.id DESC LIMIT 200`);
      const li = await pool.query(`SELECT b.bill_number, i.item_name, i.qty, i.unit_price, i.line_total FROM pos_bill_items i JOIN pos_bills b ON b.id = i.bill_id
        WHERE ABS(i.line_total - ROUND(i.qty * i.unit_price, 2)) > ${TOL} ORDER BY i.id DESC LIMIT 200`);
      const rows = [...r.rows.map((x) => ({ type: 'bill', ...x })), ...li.rows.map((x) => ({ type: 'line', ...x }))];
      return rows.length ? res('RED', `${r.rows.length} bill(s) and ${li.rows.length} line(s) do not add up`, rows) : res('OK', 'every bill = lines minus discount; every line = qty x price');
    },
  },
  {
    id: 'bill_payments', name: 'bill payments equal bill total', needs: needs('pos_bills', 'pos_bill_payments'),
    run: async (pool) => {
      const r = await pool.query(`
        SELECT b.bill_number, b.total, p.paid FROM pos_bills b
        JOIN (SELECT bill_id, SUM(amount) AS paid FROM pos_bill_payments GROUP BY bill_id) p ON p.bill_id = b.id
        WHERE ABS(p.paid - b.total) > ${TOL} ORDER BY b.id DESC LIMIT 200`);
      return r.rows.length ? res('RED', `${r.rows.length} bill(s) where payments differ from the total`, r.rows) : res('OK', 'payments match the total on every split bill');
    },
  },
  {
    id: 'void_integrity', name: 'void bills are kept, never lost', needs: needs('pos_bills', 'pos_bill_voids'),
    run: async (pool) => {
      const r = await pool.query(`SELECT v.bill_id FROM pos_bill_voids v LEFT JOIN pos_bills b ON b.id = v.bill_id WHERE b.id IS NULL`);
      return r.rows.length ? res('RED', `${r.rows.length} void record(s) point to a missing bill`, r.rows) : res('OK', 'every void points to a real bill');
    },
  },
  {
    id: 'vendor_orphans', name: 'vendor cheques, payments and credit notes belong to a bill', needs: needs('vendor_bills', 'vendor_bill_cheques', 'vendor_payments', 'vendor_credit_notes'),
    run: async (pool) => {
      const r = await pool.query(`
        SELECT 'cheque' AS kind, c.id FROM vendor_bill_cheques c LEFT JOIN vendor_bills b ON b.id = c.bill_id WHERE b.id IS NULL
        UNION ALL SELECT 'payment', p.id FROM vendor_payments p LEFT JOIN vendor_bills b ON b.id = p.bill_id WHERE b.id IS NULL
        UNION ALL SELECT 'credit note', n.id FROM vendor_credit_notes n LEFT JOIN vendor_bills b ON b.id = n.bill_id WHERE b.id IS NULL`);
      return r.rows.length ? res('RED', `${r.rows.length} orphan row(s)`, r.rows) : res('OK', 'nothing hangs without a bill');
    },
  },
  {
    id: 'vendor_balance', name: 'vendor owed = bills minus cleared cheques, payments, credit notes (never below zero)', needs: needs('vendor_bills', 'vendor_bill_cheques', 'vendor_payments', 'vendor_credit_notes'),
    run: async (pool) => {
      const r = await pool.query(`
        SELECT b.id, b.vendor_name, b.bill_no, b.total,
               COALESCE((SELECT SUM(amount) FROM vendor_bill_cheques WHERE bill_id = b.id AND status = 'CLEARED'),0) AS cleared,
               COALESCE((SELECT SUM(amount) FROM vendor_payments WHERE bill_id = b.id),0) AS paid,
               COALESCE((SELECT SUM(amount) FROM vendor_credit_notes WHERE bill_id = b.id),0) AS credited,
               COALESCE((SELECT SUM(amount) FROM vendor_bill_cheques WHERE bill_id = b.id AND status IN ('ISSUED','CLEARED')),0) AS written
        FROM vendor_bills b WHERE b.voided = FALSE`);
      const over = r.rows.filter((x) => round2(Number(x.cleared) + Number(x.paid) + Number(x.credited) - Number(x.total)) > TOL);
      const overWritten = r.rows.filter((x) => round2(Number(x.written) - Number(x.total)) > TOL);
      const bad = [...over.map((x) => ({ problem: 'overpaid', ...x })), ...overWritten.filter((x) => !over.includes(x)).map((x) => ({ problem: 'cheques written above the bill', ...x }))];
      return bad.length ? res('RED', `${bad.length} bill(s) paid or covered for more than owed`, bad) : res('OK', `${r.rows.length} open vendor bill(s), none overpaid`);
    },
  },
  {
    id: 'vendor_screen_ties', name: 'vendor screen total equals the database total', needs: needs('vendor_bills', 'vendor_bill_cheques', 'vendor_payments', 'vendor_credit_notes'),
    run: async (pool) => {
      const L = require('./vendorLedger');
      const bills = (await pool.query(`SELECT * FROM vendor_bills`)).rows;
      const ch = (await pool.query(`SELECT * FROM vendor_bill_cheques`)).rows;
      const pay = (await pool.query(`SELECT * FROM vendor_payments`)).rows;
      const cr = (await pool.query(`SELECT * FROM vendor_credit_notes`)).rows;
      const rows = bills.map((b) => ({ bill: b, cheques: ch.filter((c) => c.bill_id === b.id), payments: pay.filter((p) => p.bill_id === b.id), credits: cr.filter((c) => c.bill_id === b.id) }));
      const screen = L.summarise(rows).totals.outstanding;
      const sql = Number((await pool.query(`
        SELECT COALESCE(SUM(GREATEST(0, b.total
              - COALESCE((SELECT SUM(amount) FROM vendor_bill_cheques WHERE bill_id = b.id AND status = 'CLEARED'),0)
              - COALESCE((SELECT SUM(amount) FROM vendor_payments WHERE bill_id = b.id),0)
              - COALESCE((SELECT SUM(amount) FROM vendor_credit_notes WHERE bill_id = b.id),0))),0) AS owed
        FROM vendor_bills b WHERE b.voided = FALSE`)).rows[0].owed);
      return Math.abs(round2(screen) - round2(sql)) > TOL
        ? res('RED', `screen says ${screen}, database says ${sql}`, [{ screen, sql }])
        : res('OK', `owed to vendors Rs ${round2(sql).toLocaleString('en-US')} on both`);
    },
  },
  {
    id: 'grn_vs_bill', name: 'every GRN total equals its vendor bill', needs: needs('grn_records', 'vendor_bills'),
    run: async (pool) => {
      const r = await pool.query(`
        SELECT g.grn_number, g.supplier_name, g.grn_total, b.total AS bill_total, b.id IS NULL AS no_bill
        FROM (SELECT grn_number, MAX(supplier_name) AS supplier_name, SUM(total_amount) AS grn_total FROM grn_records WHERE grn_number IS NOT NULL GROUP BY grn_number) g
        LEFT JOIN vendor_bills b ON b.bill_no = g.grn_number AND b.voided = FALSE
        WHERE b.id IS NULL OR ABS(b.total - g.grn_total) > ${TOL} ORDER BY g.grn_number DESC LIMIT 200`);
      const diff = r.rows.filter((x) => !x.no_bill);
      if (diff.length) return res('RED', `${diff.length} GRN(s) whose bill total is different`, diff);
      return r.rows.length ? res('WARN', `${r.rows.length} GRN(s) with no vendor bill yet (photo or WhatsApp drafts?)`, r.rows) : res('OK', 'every GRN has a bill with the same total');
    },
  },
  {
    id: 'stock_vs_ledger', name: 'stock = GRN in minus sales out (change since last run)', needs: needs('products', 'grn_records', 'pos_bills', 'pos_bill_items'),
    run: async (pool, opts = {}) => {
      // gap = stock_level - (GRN qty - sold qty on bills that are not void). A gap that stays the same is opening stock
      // (stock entered before the app tracked it). A gap that CHANGES means stock moved without a GRN or a bill.
      const r = await pool.query(`
        SELECT p.item_code, p.name, COALESCE(p.stock_level,0) AS stock,
               COALESCE(g.qty,0) AS grn_in, COALESCE(s.qty,0) AS sold
        FROM products p
        LEFT JOIN (SELECT TRIM(split_part(item_description, ' - ', 1)) AS code, SUM(quantity) AS qty FROM grn_records GROUP BY 1) g ON g.code = p.item_code
        LEFT JOIN (SELECT i.item_code, SUM(i.qty) AS qty FROM pos_bill_items i JOIN pos_bills b ON b.id = i.bill_id
                   LEFT JOIN pos_bill_voids v ON v.bill_id = b.id WHERE v.bill_id IS NULL AND i.item_code IS NOT NULL GROUP BY i.item_code) s ON s.item_code = p.item_code
        WHERE p.item_code IS NOT NULL AND p.active = true`);
      const gaps = {};
      for (const x of r.rows) gaps[x.item_code] = round2(Number(x.stock) - (Number(x.grn_in) - Number(x.sold)));
      const prev = opts.previousGaps;
      const withOpening = Object.values(gaps).filter((g) => Math.abs(g) > TOL).length;
      if (!prev) return res('OK', `first run: baseline saved (${r.rows.length} items, ${withOpening} carry opening stock)`, [], { gaps });
      const changed = Object.keys(gaps).filter((k) => prev[k] !== undefined && Math.abs(gaps[k] - prev[k]) > TOL)
        .map((k) => ({ item_code: k, was: prev[k], now: gaps[k], moved_without_paper: round2(gaps[k] - prev[k]) }));
      return changed.length ? res('RED', `${changed.length} item(s) moved without a GRN or a bill`, changed, { gaps }) : res('OK', `${r.rows.length} items: every stock change has a GRN or a bill`, [], { gaps });
    },
  },
  {
    id: 'duplicate_cheques', name: 'no cheque number written twice', needs: needs('vendor_bill_cheques'),
    run: async (pool) => {
      const r = await pool.query(`SELECT cheque_no, COALESCE(bank,'') AS bank, COUNT(*)::int AS n, SUM(amount) AS total FROM vendor_bill_cheques
        WHERE cheque_no IS NOT NULL AND TRIM(cheque_no) <> '' AND status <> 'CANCELLED' GROUP BY cheque_no, COALESCE(bank,'') HAVING COUNT(*) > 1`);
      return r.rows.length ? res('RED', `${r.rows.length} cheque number(s) used twice`, r.rows) : res('OK', 'every cheque number is used once');
    },
  },
  {
    id: 'cheques_overdue', name: 'no old cheque left as ISSUED', needs: needs('vendor_bill_cheques'),
    run: async (pool) => {
      const r = await pool.query(`SELECT cheque_no, payee, amount, due_date FROM vendor_bill_cheques WHERE status = 'ISSUED' AND due_date < (CURRENT_DATE - 7) ORDER BY due_date LIMIT 100`);
      return r.rows.length ? res('WARN', `${r.rows.length} cheque(s) still ISSUED a week after the due date: mark cleared or bounced`, r.rows) : res('OK', 'no cheque is stuck as ISSUED');
    },
  },
  {
    id: 'profit_formula', name: 'net profit = gross profit minus expenses (daily sheet)', needs: needs('daily_summary'),
    run: async (pool) => {
      const r = await pool.query(`SELECT report_date, gross_profit, total_expenses, net_profit FROM daily_summary
        WHERE gross_profit IS NOT NULL AND net_profit IS NOT NULL AND ABS(net_profit - (gross_profit - COALESCE(total_expenses,0))) > 1 ORDER BY report_date DESC LIMIT 200`);
      return r.rows.length ? res('RED', `${r.rows.length} day(s) where net is not gross minus expenses`, r.rows) : res('OK', 'net = gross - expenses on every filled day');
    },
  },
  {
    id: 'daily_cash_tie', name: 'daily sheet: cash + card + online + credit + cheque = total sale', needs: needs('daily_summary'),
    run: async (pool) => {
      const r = await pool.query(`SELECT report_date, total_sale, cash_sale, card_sale, online_sale, credit_sale FROM daily_summary
        WHERE total_sale IS NOT NULL AND ABS(total_sale - (COALESCE(cash_sale,0)+COALESCE(card_sale,0)+COALESCE(online_sale,0)+COALESCE(credit_sale,0))) > 1 ORDER BY report_date DESC LIMIT 200`);
      return r.rows.length ? res('WARN', `${r.rows.length} day(s) where the payment types do not add to the total sale (cheque sales may sit outside these columns)`, r.rows) : res('OK', 'payment types add up to the total sale on every day');
    },
  },
  {
    id: 'pg_timezone', name: 'database clock is Sri Lanka time', needs: async () => null,
    run: async (pool) => {
      // pos_bills.created_at is a plain TIMESTAMP and the day reports cut it with ::date. If Postgres runs in UTC, a bill made
      // between 00:00 and 05:30 Sri Lanka time lands on the previous day in the daily breakdown.
      const tz = (await pool.query(`SELECT current_setting('TimeZone') AS tz`)).rows[0].tz;
      return /colombo|calcutta|kolkata|asia\/(?:kathmandu)|\+?05:?30/i.test(tz) ? res('OK', `database time zone ${tz}`)
        : res('WARN', `database time zone is ${tz}: bills made 00:00 to 05:30 may land on the previous day in the day reports`, [{ timezone: tz }]);
    },
  },
];

async function runAll(pool, opts = {}) {
  const checks = [];
  let gaps = null;
  for (const c of CHECKS) {
    try {
      const why = await c.needs(pool);
      if (why) { checks.push({ id: c.id, name: c.name, status: 'SKIP', detail: why, rows: [], count: 0 }); continue; }
      const out = await c.run(pool, opts);
      if (out.gaps) { gaps = out.gaps; delete out.gaps; }
      checks.push({ id: c.id, name: c.name, ...out });
    } catch (e) {
      checks.push({ id: c.id, name: c.name, status: 'RED', detail: `the check itself failed: ${e.message}`, rows: [], count: 0 });
    }
  }
  const count = (s) => checks.filter((c) => c.status === s).length;
  const red = count('RED'), warn = count('WARN'), ok = count('OK'), skipped = count('SKIP');
  const redNames = checks.filter((c) => c.status === 'RED').map((c) => c.name.split(' (')[0]);
  const line = red ? `AUDIT RED: ${red} of ${checks.length - skipped} checks disagree (${redNames.slice(0, 3).join('; ')})`
    : warn ? `AUDIT GREEN with ${warn} heads-up: ${ok} checks agree` : `AUDIT GREEN: ${ok} checks agree`;
  return { checks, red, warn, ok, skipped, gaps, line };
}

module.exports = { runAll, CHECKS };
