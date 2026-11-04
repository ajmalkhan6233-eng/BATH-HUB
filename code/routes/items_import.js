// routes/items_import.js (NEW). Paste real items as CSV: name,category,selling_price,avg_cost,stock_level,reorder_threshold
// Default is a DRY RUN (nothing saved). Send {commit:true} to save. Duplicates are skipped, never overwritten.
const express = require('express');
const { createItem } = require('./item_catalog');
const router = express.Router();

function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some(c => c.trim())) rows.push(row); row = []; }
    else cell += ch;
  }
  row.push(cell); if (row.some(c => c.trim())) rows.push(row);
  return rows;
}
router.post('/items/import-csv', async (req, res) => {
  const rows = parseCsv(String(req.body.csv || ''));
  if (rows.length < 2) return res.status(400).json({ error: 'Need a header row and at least one item' });
  const head = rows[0].map(h => h.trim().toLowerCase());
  if (!head.includes('name')) return res.status(400).json({ error: 'First column header must include "name"' });
  const report = { commit: !!req.body.commit, saved: 0, skipped: [], errors: [], preview: [] };
  for (const r of rows.slice(1)) {
    const f = {}; head.forEach((h, i) => { f[h] = (r[i] || '').trim(); });
    try {
      if (!report.commit) { if (!f.name) throw Object.assign(new Error('name is empty'), { status: 400 }); report.preview.push(f.name); continue; }
      await createItem(f); report.saved++;
    } catch (e) { (e.status === 409 ? report.skipped : report.errors).push(`${f.name || '(blank)'}: ${e.message}`); }
  }
  res.json(report);
});
module.exports = router;
