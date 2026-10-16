'use strict';
/**
 * The reviewed list of SQL built from a template string (".query(`... ${x} ...`)"). Audit item: "review the 32 dynamic SQL spots".
 * Reviewed 2026-10-11: in every one of them the interpolated part is a fixed fragment written in our own code (column list,
 * table name from an internal map, "WHERE status = $1" style clauses, SET lists built from a fixed list of column names),
 * and every value goes through a $n placeholder. NO user text is ever pasted into the SQL.
 * This test is the ratchet: a NEW dynamic SQL spot (or a file with more of them than listed) fails here until someone reviews it
 * and adds it below with the reason. Counting is per file.
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');

const ALLOWED = {
  'routes/admin_core.js': [1, 'SET list from the fixed fields role / name'],
  'routes/agent_rulebook.js': [1, "fixed 'WHERE active = TRUE' or nothing"],
  'routes/apex_admin.js': [2, 'SET list from the fixed FLEET_FIELDS list; fixed WHERE id = $1 or nothing'],
  'routes/audit.js': [2, "date_trunc unit comes from a fixed lookup {daily,weekly,monthly,quarterly}, default 'day'"],
  'routes/cheque_register.js': [1, "fixed 'WHERE status = $1'"],
  'routes/corrections.js': [4, 'table and column names come from the internal MODULES map (unknown module is refused); values are $n'],
  'routes/document_inbox.js': [1, "fixed ' FOR UPDATE' or nothing"],
  'routes/investor_loans.js': [5, "LOAN_SELECT is a constant; fixed 'WHERE l.status = $1'"],
  'routes/item_catalog.js': [2, 'ITEM_COLS is a constant; limit is a clamped number'],
  'layla_owner/taskStore.js': [2, "done/snooze: fixed 'source=$n' or fixed 'NOT LIKE family' fragment chosen by a yes/no; values are $n"],
  'routes/money_control.js': [2, "fixed 'WHERE status = $1'"],
  'routes/purchasing_accounting.js': [5, 'SET lists from fixed field names; notVoided() and CASH_OUT_EXPR are internal constants'],
  'routes/sale_commissions.js': [2, 'clauses are fixed fragments with $n; notVoided() is internal'],
  'routes/shop_operations.js': [1, "fixed 'WHERE status = $1'"],
  'routes/site_editor.js': [1, 'SET list from the keys readTile() builds: name, size, finish, grp, photo_file, visible only'],
  'routes/staff_reports.js': [4, 'fixed WHERE / AND fragments with $n placeholders'],
  'routes/vendor_ledger.js': [3, "fixed AND fragments, internal table names, a list of $n placeholders, fixed 'NOW()' or 'NULL'"],
  'utils/documents/reports.js': [4, 'internal column lists and constants (CASH_IN_EXPR, CASH_OUT_EXPR, notVoided)'],
  'utils/egressGate.js': [1, "fixed 'WHERE status = $1' or nothing"],
};

function scan() {
  const found = {};
  const walk = (d) => {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, f.name);
      if (f.isDirectory()) { walk(p); continue; }
      if (!f.name.endsWith('.js')) continue;
      const s = fs.readFileSync(p, 'utf8');
      const re = /\.query\(\s*`([^`]*)`/g; let m; let n = 0;
      while ((m = re.exec(s))) if (m[1].includes('${')) n++;
      if (n) found[path.relative(root, p).replace(/\\/g, '/')] = n;
    }
  };
  ['routes', 'utils', 'layla_owner', 'layla_v2'].forEach((d) => fs.existsSync(path.join(root, d)) && walk(path.join(root, d)));
  return found;
}

describe('dynamic SQL ratchet', () => {
  const found = scan();
  test('every file with template-string SQL is on the reviewed list, with no more spots than reviewed', () => {
    const problems = [];
    for (const [file, n] of Object.entries(found)) {
      if (!ALLOWED[file]) problems.push(`${file}: ${n} dynamic SQL spot(s) not reviewed`);
      else if (n > ALLOWED[file][0]) problems.push(`${file}: ${n} spots but only ${ALLOWED[file][0]} reviewed`);
    }
    expect(problems).toEqual([]);
  });
  test('the list has no stale entries (a file that no longer has the spots is removed from the list)', () => {
    const stale = Object.keys(ALLOWED).filter((f) => !found[f] || found[f] < ALLOWED[f][0]);
    expect(stale).toEqual([]);
  });
  test('44 reviewed spots in total', () => {
    expect(Object.values(found).reduce((a, b) => a + b, 0)).toBe(44);
  });
});
