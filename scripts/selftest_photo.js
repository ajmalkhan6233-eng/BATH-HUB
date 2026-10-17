'use strict';
/** Photo-reader self-test: reads tests/fixtures/selftest_grn.png (a typed invoice with KNOWN lines) with the live AI reader
 *  and checks it got them right. One command, no typing:  node scripts/selftest_photo.js
 *  Prints PASS/FAIL per check and the model used. Exit code 0 = reader is healthy. Needs GEMINI_API_KEY or OPENROUTER_API_KEY in .env. */
const path = require('path');
const EXPECT = { supplier: /selftest/i, items: [[/wall tile/i, 10, 1500], [/basin mixer/i, 4, 8500], [/commode/i, 2, 32000], [/shower rose/i, 5, 3200]], total: 129000 };
const near = (a, b) => Math.abs(Number(a) - b) <= 0.5;

function judge(doc) {
  const out = []; const ok = (name, pass, got) => out.push({ name, pass: !!pass, got });
  const items = (doc && doc.items) || [];
  ok('found item lines', items.length === 4, items.length);
  EXPECT.items.forEach(([re, q, u]) => {
    const it = items.find((x) => re.test(String(x.name || x.description || '')));
    ok(`${re.source}: found`, it, it && (it.name || it.description));
    if (it) { ok(`${re.source}: qty ${q}`, near(it.qty != null ? it.qty : it.quantity, q), it.qty != null ? it.qty : it.quantity); ok(`${re.source}: price ${u}`, near(it.unit_price != null ? it.unit_price : it.unit_cost, u), it.unit_price != null ? it.unit_price : it.unit_cost); }
  });
  const sum = items.reduce((s, x) => s + (Number(x.amount) || (Number(x.qty) * Number(x.unit_price)) || 0), 0);
  ok('lines add up to 129000', near(sum, EXPECT.total), sum);
  ok('date 2026-10-09', String(doc && doc.date || '').startsWith('2026-10-09'), doc && doc.date);
  return out;
}
async function main() {
  const { ocrPhoto } = require('./ocr_photo');
  const t0 = Date.now();
  const doc = await ocrPhoto(path.join(__dirname, '..', 'tests', 'fixtures', 'selftest_grn.png'));
  const res = judge(doc);
  res.forEach((r) => console.log((r.pass ? 'PASS ' : 'FAIL ') + r.name + (r.pass ? '' : `  (got: ${r.got})`)));
  const bad = res.filter((r) => !r.pass).length;
  console.log(`\nmodel: ${doc._model}   time: ${((Date.now() - t0) / 1000).toFixed(1)}s   ${bad ? bad + ' FAILED' : 'ALL PASSED: reader is healthy'}`);
  process.exitCode = bad ? 1 : 0;
}
if (require.main === module) main().catch((e) => { console.error('FAIL reader error: ' + e.message); process.exit(1); });
module.exports = { judge, EXPECT };
