'use strict';
// RBH Brain: READ-ONLY lookups of shop records (items, vendors, vendor bills, cheques) so a note can point at them.
// Never writes to any shop table. If a shop table is missing, that kind just finds nothing.
const pool = require('./pool');
const rs = v => 'Rs ' + Math.round(Number(v) || 0).toLocaleString('en-LK');
const day = v => (v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'no date');
const like = t => '%' + String(t || '').trim().slice(0, 60).replace(/[\\%_]/g, c => '\\' + c) + '%';
const q = (sql, p) => pool.query(sql, p).then(r => r.rows);
const KINDS = ['item', 'vendor', 'bill', 'cheque'];

const OWED = `SELECT COALESCE(SUM(b.total - COALESCE(p.paid,0) - COALESCE(n.cn,0)),0) AS owed, COUNT(*) AS n FROM vendor_bills b
  LEFT JOIN (SELECT bill_id, SUM(amount) AS paid FROM vendor_payments GROUP BY bill_id) p ON p.bill_id = b.id
  LEFT JOIN (SELECT bill_id, SUM(amount) AS cn FROM vendor_credit_notes GROUP BY bill_id) n ON n.bill_id = b.id
  WHERE b.voided = false AND b.vendor_name = $1`;

async function one(kind, key) {
  try {
    if (kind === 'item') {
      const [r] = await q('SELECT item_code, name, stock_level, selling_price FROM products WHERE item_code = $1 LIMIT 1', [String(key)]);
      return r ? { kind, key: String(r.item_code), label: r.name, facts: 'Stock ' + Number(r.stock_level || 0) + ' · Price ' + rs(r.selling_price) } : null;
    }
    if (kind === 'vendor') {
      const [x] = await q('SELECT vendor_name FROM vendor_bills WHERE voided = false AND vendor_name = $1 LIMIT 1', [String(key)]);
      if (!x) return null;
      let facts = '';
      try { const [o] = await q(OWED, [String(key)]); facts = Number(o.n) + ' bills · we owe ' + rs(o.owed); } catch (_e) { facts = 'vendor'; }
      return { kind, key: String(key), label: String(key), facts };
    }
    if (kind === 'bill') {
      const id = parseInt(key, 10); if (!id) return null;
      const [r] = await q('SELECT id, vendor_name, bill_no, bill_date, due_date, total, voided FROM vendor_bills WHERE id = $1', [id]);
      return r ? { kind, key: String(r.id), label: r.vendor_name + (r.bill_no ? ' · ' + r.bill_no : ''), facts: rs(r.total) + ' · bill ' + day(r.bill_date) + ' · due ' + day(r.due_date) + (r.voided ? ' · VOIDED' : '') } : null;
    }
    if (kind === 'cheque') {
      const id = parseInt(key, 10); if (!id) return null;
      const [r] = await q('SELECT id, payee, cheque_no, amount, due_date, status FROM cheque_register WHERE id = $1', [id]);
      return r ? { kind, key: String(r.id), label: r.payee + (r.cheque_no ? ' · #' + r.cheque_no : ''), facts: rs(r.amount) + ' · due ' + day(r.due_date) + ' · ' + r.status } : null;
    }
  } catch (_e) { /* shop table missing or different: treat as not found */ }
  return null;
}

async function search(kind, term) {
  const t = like(term);
  try {
    if (kind === 'item') return (await q('SELECT item_code FROM products WHERE name ILIKE $1 OR item_code ILIKE $1 ORDER BY name LIMIT 8', [t])).map(r => r.item_code);
    if (kind === 'vendor') return (await q('SELECT DISTINCT vendor_name FROM vendor_bills WHERE voided = false AND vendor_name ILIKE $1 ORDER BY vendor_name LIMIT 8', [t])).map(r => r.vendor_name);
    if (kind === 'bill') return (await q('SELECT id FROM vendor_bills WHERE vendor_name ILIKE $1 OR bill_no ILIKE $1 ORDER BY bill_date DESC, id DESC LIMIT 8', [t])).map(r => r.id);
    if (kind === 'cheque') return (await q('SELECT id FROM cheque_register WHERE payee ILIKE $1 OR cheque_no ILIKE $1 ORDER BY due_date DESC, id DESC LIMIT 8', [t])).map(r => r.id);
  } catch (_e) { /* ignore */ }
  return [];
}

async function find(kind, term) { const keys = await search(kind, term); return (await Promise.all(keys.map(k => one(kind, k)))).filter(Boolean); }

module.exports = { KINDS, one, find };
