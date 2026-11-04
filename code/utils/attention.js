'use strict';
// NEEDS ATTENTION strip for the dashboard (AJ 24 Oct): the things only AJ can fix, big and colour-coded, red first. Every query is optional.
async function q(pool, sql) { try { return (await pool.query(sql)).rows[0]; } catch (e) { return null; } }
async function collect(pool) {
  const out = [];
  const bw = await q(pool, `SELECT COUNT(*)::int n, COALESCE(SUM(ABS(diff_amount)),0)::numeric amt FROM vendor_bill_watch WHERE status='OPEN'`);
  if (bw && bw.n > 0) out.push({ level: 'red', text: 'Vendor bill mismatch: Rs ' + Math.round(bw.amt).toLocaleString('en-US') + ' (' + bw.n + ')', go: '/pending_delivery.html' });
  const ch = await q(pool, `SELECT COUNT(*)::int n FROM vendor_bill_cheques WHERE status='ISSUED' AND due_date <= CURRENT_DATE + 2`);
  if (ch && ch.n > 0) out.push({ level: 'red', text: 'Cheques due within 2 days: ' + ch.n, go: null });
  const ow = await q(pool, `SELECT COUNT(*)::int n FROM oversold_owed WHERE status='OPEN'`);
  if (ow && ow.n > 0) out.push({ level: 'amber', text: 'Items you owe customers: ' + ow.n, go: null });
  const pd = await q(pool, `SELECT COUNT(*)::int n FROM vendor_pending_items WHERE status='WAITING'`);
  if (pd && pd.n > 0) out.push({ level: 'amber', text: 'Vendor items not delivered yet: ' + pd.n, go: '/pending_delivery.html' });
  const pr = await q(pool, `SELECT COUNT(*)::int n FROM grn_records WHERE status='PENDING_REVIEW'`);
  if (pr && pr.n > 0) out.push({ level: 'amber', text: 'Stock-in lines waiting for your price check: ' + pr.n, go: null });
  return out;
}
module.exports = { collect };
