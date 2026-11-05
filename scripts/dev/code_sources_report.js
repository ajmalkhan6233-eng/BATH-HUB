'use strict';
// READ ONLY. Shows where the item codes Ajmal typed are stored, per vendor, so chat can restore them exactly. Changes nothing. Prints no secrets.
// Run on the PC from the app folder: node scripts/dev/code_sources_report.js   (optional: path to a pre-fix backup .sql.gz as 1st argument)
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const root = path.resolve(__dirname, '..', '..');
const show = (t, rows) => { console.log('\n== ' + t + ' (' + rows.length + ')'); rows.forEach(r => console.log('  ' + r)); };
(async () => {
  const pool = require('../../utils/pool');
  const q = async (s, a) => { try { return (await pool.query(s, a || [])).rows; } catch (e) { return [{ err: e.message }]; } };
  for (const v of ['metro', 'leo', 'fazaal', 'cool', 'afham', 'imran']) {
    const r = await q(`SELECT item_description d FROM grn_records WHERE supplier_name ILIKE $1 ORDER BY id LIMIT 4`, ['%' + v + '%']);
    show('LIVE grn_records text, vendor ~ ' + v, r.map(x => x.err || x.d));
  }
  const ex = await q(`SELECT bill_id, jsonb_array_length(lines) n, lines->0 first FROM grn_bill_extra ORDER BY bill_id LIMIT 12`);
  show('LIVE grn_bill_extra (bill_id, lines, first line)', ex.map(x => x.err || (x.bill_id + ' | ' + x.n + ' | ' + JSON.stringify(x.first).slice(0, 220))));
  try { const L = JSON.parse(fs.readFileSync(path.join(root, 'data', 'grn_bills.json'), 'utf8'));
    show('data/grn_bills.json', L.slice(0, 12).map(b => (b.vendor || b.supplier || '?') + ' | ' + (b.bill_no || b.number || '?') + ' | lines ' + (b.lines || []).length + ' | first ' + JSON.stringify((b.lines || [])[0]).slice(0, 200)));
  } catch (e) { show('data/grn_bills.json', ['not readable: ' + e.message]); }
  const bak = process.argv[2] || (fs.existsSync(path.join(root, 'backups')) ? fs.readdirSync(path.join(root, 'backups')).filter(f => /^pre_morning_fix_.*\.sql\.gz$/.test(f)).sort().pop() : null);
  if (bak) { const f = path.isAbsolute(bak) ? bak : path.join(root, 'backups', bak);
    const txt = zlib.gunzipSync(fs.readFileSync(f)).toString('utf8').split('\n'); let on = false, n = 0; const out = [];
    for (const l of txt) { if (/^COPY public\.grn_records /.test(l)) { on = true; continue; } if (on && l === '\\.') on = false; if (on && /metro|leo/i.test(l) && n++ < 10) out.push(l.slice(0, 220)); }
    show('PRE-FIX BACKUP grn_records rows (Metro/Leo) in ' + path.basename(f), out);
  } else show('PRE-FIX BACKUP', ['none found']);
  await pool.end();
})().catch(e => { console.log('FAILED', e.message); process.exit(1); });
