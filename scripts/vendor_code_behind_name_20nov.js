'use strict';
// AJ 20 Nov ("Yes, all 36"): every ACTIVE item whose vendor code is filled but not in the name gets the vendor code BEHIND the name
// (rule 5 Nov: "Flexible Tap FH1208"). Name only. Code, price, cost, stock untouched. Nothing deleted.
// Dry run by default. Add --apply to write. Old names saved to backups/vendor_code_names_before_<time>.json first. Safe to re-run.
const fs = require('fs');
const path = require('path');
const pool = require('../utils/pool');
const APPLY = process.argv.includes('--apply');
const PICK = "SELECT item_code, name, vendor_code FROM products WHERE active AND coalesce(trim(vendor_code),'')<>'' AND position(upper(trim(vendor_code)) in upper(name))=0 ORDER BY item_code";

(async () => {
  const { rows } = await pool.query(PICK);
  console.log((APPLY ? 'APPLY' : 'DRY RUN') + ' | items to rename: ' + rows.length);
  if (!rows.length) { await pool.end(); return; }
  const plan = rows.map(r => ({ code: r.item_code, old: r.name, name: String(r.name).replace(/\s+$/, '') + ' ' + String(r.vendor_code).trim() }));
  const names = new Set();
  for (const p of plan) {
    if (p.name.includes('?')) throw new Error(`"?" in new name for ${p.code} (stop, nothing written)`);
    const k = p.name.toUpperCase();
    if (names.has(k)) throw new Error(`two items would get the same name "${p.name}" (stop, nothing written)`);
    names.add(k);
  }
  const clash = await pool.query('SELECT item_code, name FROM products WHERE upper(name) = ANY($1) AND NOT (item_code = ANY($2))', [[...names], plan.map(p => p.code)]);
  if (clash.rows.length) throw new Error('new name already used by ' + clash.rows.map(r => r.item_code + ' ' + r.name).join('; ') + ' (stop, nothing written)');
  plan.forEach(p => console.log(`${p.code} | "${p.old}" -> "${p.name}"`));
  if (APPLY) {
    const dir = path.join(__dirname, '..', 'backups');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `vendor_code_names_before_${new Date().toISOString().replace(/[:.]/g, '-')}.json`), JSON.stringify(rows, null, 1));
  }
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    for (const p of plan) await c.query('UPDATE products SET name=$1 WHERE item_code=$2', [p.name, p.code]);
    await c.query(APPLY ? 'COMMIT' : 'ROLLBACK');
  } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
  const after = await pool.query(PICK);
  console.log('CHECK items still without the vendor code in the name: ' + after.rows.length + (APPLY ? ' (must be 0)' : ' (dry run, unchanged)'));
  await pool.end();
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
