'use strict';
/** Pending-paper notifications: every photo Layla has read (bill, GRN, cheque, sheet) and Aj has not yet filed or rejected. */
const LABEL = { manual_bill: 'Bill', grn: 'GRN', cheque: 'Cheque', day_sheet: 'Daily sales sheet', expense_sheet: 'Expenses sheet', unknown: 'Paper' };

function paperItem(r) {
  let ex = {}; try { ex = JSON.parse(r.extracted || '{}'); } catch (_) { /* unreadable stays empty */ }
  const label = LABEL[r.doc_type] || 'Paper';
  const who = ex.supplier_name || ex.customer_name || ex.payee || '';
  const total = ex.total || ex.total_amount || ex.amount;
  const bits = [who, total ? `LKR ${Number(total).toLocaleString()}` : ''].filter(Boolean).join(' · ');
  return {
    category: 'paper', ref_id: r.id, due_date: null, days_to_due: 0,
    title: `${label} waiting for you to check`,
    amount: total || null,
    detail: bits || (r.reader_note ? String(r.reader_note).slice(0, 80) : 'Open it to see the photo and what Layla read'),
    link: `/owner#docinbox`,
  };
}

/** Never throws: if the inbox table is missing, there is simply nothing to show. */
async function getPendingPapers(pool, limit = 50) {
  try {
    const r = await pool.query(`SELECT id, doc_type, extracted, reader_note FROM document_inbox WHERE status = 'to_check' AND doc_type <> 'customer_photo' ORDER BY created_at DESC LIMIT $1`, [limit]);
    return r.rows.map(paperItem);
  } catch (_) { return []; }
}

module.exports = { getPendingPapers, paperItem };
