'use strict';
// SELLING PRICE ON THE RECEIPT (AJ 28 Nov). Bills keep only what the customer paid, so the selling price of the day is
// kept here (new table only) the first time a bill's receipt is drawn, and never changes after that.
// shortcut: only bills made in the last 24 h are captured, so an old bill never gets today's price. A new bill whose
// receipt is never drawn within a day shows paid prices only; move the capture into the bill save if that ever happens.
let ready = null;
const ensure = (pool) => ready || (ready = pool.query(`CREATE TABLE IF NOT EXISTS receipt_list_prices (
  bill_number TEXT NOT NULL, item_code TEXT NOT NULL, list_price NUMERIC(14,2) NOT NULL, PRIMARY KEY (bill_number, item_code))`));

async function addListPrices(bill, pool) {
  const no = bill && bill.billNo ? String(bill.billNo) : '';
  const codes = no && Array.isArray(bill.items) ? [...new Set(bill.items.map((i) => i && i.code).filter(Boolean).map(String))] : [];
  if (!codes.length) return bill;
  await ensure(pool);
  const kept = async () => new Map((await pool.query('SELECT item_code, list_price FROM receipt_list_prices WHERE bill_number = $1', [no])).rows.map((r) => [r.item_code, Number(r.list_price)]));
  let have = await kept();
  const missing = codes.filter((c) => !have.has(c));
  if (missing.length) {
    const made = (await pool.query('SELECT created_at FROM pos_bills WHERE bill_number = $1', [no])).rows[0];
    if (made && Date.now() - new Date(made.created_at).getTime() < 24 * 3600 * 1000) {
      for (const code of missing) {
        const p = (await pool.query('SELECT selling_price FROM products WHERE item_code = $1', [code])).rows[0];
        if (p && Number(p.selling_price) > 0) await pool.query('INSERT INTO receipt_list_prices (bill_number, item_code, list_price) VALUES ($1,$2,$3) ON CONFLICT (bill_number, item_code) DO NOTHING', [no, code, Number(p.selling_price)]);
      }
      have = await kept();
    }
  }
  return { ...bill, items: bill.items.map((i) => (i && have.has(String(i.code)) ? { ...i, list: have.get(String(i.code)) } : i)) };
}
module.exports = { addListPrices };
