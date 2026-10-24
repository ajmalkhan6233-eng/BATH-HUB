'use strict';
// A POS bill paid (fully or partly) on CREDIT must reach "customers owe us" (credit_customers), and a VOID must take it back.
// Found by the Audit Machine (24 Oct 2026): a credit bill left the receivables at 0. Runs inside the bill's own transaction.
// Only INSERT/UPDATE on credit_customers and customers (no ALTER). Idempotent per bill number.
const digits = s => String(s || '').replace(/\D/g, '');

async function findOrCreateCustomer(client, name, phone) {
  const d = digits(phone).slice(-9);
  if (d.length === 9) {
    const r = await client.query(`SELECT id FROM customers WHERE RIGHT(regexp_replace(COALESCE(phone,''),'\\D','','g'),9) = $1 OR RIGHT(regexp_replace(COALESCE(whatsapp,''),'\\D','','g'),9) = $1 ORDER BY id LIMIT 1`, [d]);
    if (r.rows.length) return r.rows[0].id;
  }
  const n = String(name || '').trim();
  if (n) { const r = await client.query(`SELECT id FROM customers WHERE LOWER(name) = LOWER($1) ORDER BY id LIMIT 1`, [n]); if (r.rows.length) return r.rows[0].id; }
  const ins = await client.query(`INSERT INTO customers (name, phone, source, notes) VALUES ($1,$2,'pos_credit','Created from a credit bill') RETURNING id`, [n || String(phone || '').trim() || 'Credit customer', String(phone || '').trim() || null]);
  return ins.rows[0].id;
}

// payments: [{method, amount}] already checked by the route. Returns the credit amount recorded (0 when none).
async function addReceivable(client, { billNumber, name, phone, payments, date }) {
  const credit = Math.round(((payments || []).filter(p => p.method === 'credit').reduce((a, p) => a + Number(p.amount || 0), 0) + Number.EPSILON) * 100) / 100;
  if (!(credit > 0)) return 0;
  const dup = await client.query(`SELECT id FROM credit_customers WHERE invoice_no = $1 LIMIT 1`, [billNumber]);
  if (dup.rows.length) return 0;
  const cid = await findOrCreateCustomer(client, name, phone);
  await client.query(`INSERT INTO credit_customers (customer_id, invoice_date, invoice_no, amount, paid, due_date, notes) VALUES ($1,$2,$3,$4,0,NULL,$5)`,
    [cid, date || new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10), billNumber, credit, 'POS bill ' + billNumber]);
  return credit;
}

// A voided bill no longer owes anything beyond what was already paid on it.
async function voidReceivable(client, billNumber) {
  const r = await client.query(`UPDATE credit_customers SET amount = paid, notes = COALESCE(notes,'') || ' [bill voided]' WHERE invoice_no = $1 AND amount > paid RETURNING id`, [billNumber]);
  return r.rows.length;
}
module.exports = { addReceivable, voidReceivable, findOrCreateCustomer };
