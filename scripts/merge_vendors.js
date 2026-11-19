'use strict';
// Vendor list clean-up (AJ 16 Nov). Merges duplicates, moves every record to the kept vendor, hides the extra (active=false, nothing deleted).
//   node scripts/merge_vendors.js          rehearsal (rolls back)      node scripts/merge_vendors.js --yes   saves. Safe to repeat.
// Fazal: the two "Fazaal Hardware (Pvt) Ltd" rows -> the one with more GRN lines is kept. "Fawaz (...)" is accessories: left alone.
// Metro: "Metro Enterprises" (mixed case, bottom of list) -> into "METRO ENTERPRISES". Fan lights 210/211 -> Mr Afham.
require('dotenv').config({ quiet: true });
const pool = require('../utils/pool');
const YES = process.argv.includes('--yes');
(async () => {
  const c = await pool.connect(); const out = [];
  try {
    await c.query('BEGIN'); await c.query('SELECT pg_advisory_xact_lock($1)', [774415]);
    const S = (await c.query('SELECT s.id, s.name, s.active, (SELECT COUNT(*) FROM grn_records g WHERE g.supplier_id=s.id) n FROM suppliers s ORDER BY s.id')).rows;
    const tabs = (await c.query(`SELECT table_name, MAX((column_name='supplier_name')::int) has_name FROM information_schema.columns WHERE table_schema='public' AND column_name IN ('supplier_id','supplier_name') GROUP BY table_name HAVING BOOL_OR(column_name='supplier_id')`)).rows;
    const merge = async (from, to) => {
      for (const t of tabs) {
        const r = await c.query(`UPDATE ${t.table_name} SET supplier_id=$1 ${t.has_name ? ', supplier_name=$3' : ''} WHERE supplier_id=$2`, t.has_name ? [to.id, from.id, to.name] : [to.id, from.id]);
        if (r.rowCount) out.push(`${t.table_name}: ${r.rowCount} moved ${from.name} -> ${to.name}`);
      }
      await c.query('UPDATE suppliers SET active=false WHERE id=$1', [from.id]); out.push(`hidden: ${from.name} (id ${from.id})`);
    };
    const faz = S.filter((s) => /^faz+a+l hardware \(pvt\) ltd$/i.test(s.name.trim())).sort((a, b) => b.n - a.n || a.id - b.id);
    if (faz.length > 1) for (const f of faz.slice(1)) await merge(f, faz[0]);
    const met = S.filter((s) => /^metro enterprises$/i.test(s.name.trim()));
    const keep = met.find((s) => s.name === 'METRO ENTERPRISES') || met[0];
    for (const m of met) if (m.id !== keep.id) await merge(m, keep);
    const af = S.find((s) => /^mr afham$/i.test(s.name.trim()));
    if (!af) throw new Error('Mr Afham not found in the vendor list. Nothing saved.');
    const r = await c.query(`UPDATE grn_records SET supplier_id=$1, supplier_name=$2 WHERE split_part(item_description,' - ',1) IN ('210','211') AND supplier_id IS DISTINCT FROM $1`, [af.id, af.name]);
    out.push(`fan lights 210/211 -> Mr Afham: ${r.rowCount} GRN lines`);
    await c.query(YES ? 'COMMIT' : 'ROLLBACK');
    console.log(YES ? 'SAVED:' : 'REHEARSAL ONLY (nothing saved):'); out.forEach((x) => console.log('  ' + x));
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); console.log('STOPPED: ' + e.message); process.exitCode = 1; } finally { c.release(); await pool.end().catch(() => {}); }
})();
