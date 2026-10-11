// Checks on a paper (GRN / purchase invoice / cheque) that Layla has READ into a draft. Pure functions, nothing saved here.
// Nothing reaches stock or the cheque tables until Ajmal replies "ok"; these checks make the reading mistakes visible first.
// Draft shape: { supplier, invoice_no, total, pages:[{ page, lines:[{ code, name, qty, unit_cost, line_total }], page_total? }] }
// (also accepts a flat { lines:[...] }). Money is compared in cents so rounding never flips a result.
const cents = n => Math.round(Number(n) * 100);

function flatten(d) {
  const pages = d.pages && d.pages.length ? d.pages : [{ page: 1, lines: d.lines || [] }];
  const seen = new Set(), lines = [];
  for (const p of pages) for (const l of p.lines || []) {
    // multi-page invoice: a line repeated on the next page with the same invoice number is the same line, counted ONCE
    const key = [d.invoice_no || '', l.code || l.name || '', l.qty, l.unit_cost, l.line_total, l.line_no || ''].join('|');
    if (l.line_no != null && seen.has(key)) continue;
    if (l.line_no != null) seen.add(key);
    lines.push(l);
  }
  return lines;
}

function checkGrn(d) {
  const warnings = [], lines = flatten(d);
  let sum = 0, returns = 0; const codes = new Map();
  lines.forEach((l, i) => {
    const n = i + 1, q = Number(l.qty), c = Number(l.unit_cost), lt = Number(l.line_total);
    if (!(q === q)) warnings.push(`line ${n}: quantity unreadable`);
    if (q < 0) { returns++; warnings.push(`line ${n}: negative quantity = purchase RETURN, not a GRN`); }
    if (!(c > 0)) warnings.push(`line ${n}: zero or missing price`);
    if (c === c && q === q && lt === lt && Math.abs(cents(q * c) - cents(lt)) > 1) warnings.push(`line ${n}: qty x price = ${(q * c).toFixed(2)} but the paper says ${lt.toFixed(2)}`);
    if (l.code) codes.set(l.code, (codes.get(l.code) || []).concat(n));
    sum += lt === lt ? lt : q * c;
  });
  for (const [code, at] of codes) if (at.length > 1) warnings.push(`code ${code} repeats on lines ${at.join(', ')}`);
  if (d.total != null && Math.abs(cents(sum) - cents(d.total)) > 1) warnings.push(`lines add up to ${sum.toFixed(2)} but the net total says ${Number(d.total).toFixed(2)}`);
  return { ok: warnings.length === 0, kind: returns && returns === lines.length ? 'purchase_return' : 'grn', lines: lines.length, computed_total: Math.round(sum * 100) / 100, warnings };
}

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
function wordsToNumber(text) {
  const t = String(text || '').toLowerCase().replace(/\b(rupees?|rs|only|and)\b|[-.]/g, ' ').split(/\s+/).filter(Boolean);
  let total = 0, cur = 0;
  for (const w of t) {
    const o = ONES.indexOf(w), tn = TENS.indexOf(w);
    if (o >= 0) cur += o; else if (tn >= 2) cur += tn * 10;
    else if (w === 'hundred') cur *= 100;
    else if (w === 'thousand') { total += cur * 1000; cur = 0; }
    else if (w === 'lakh' || w === 'lakhs') { total += cur * 100000; cur = 0; }
    else if (w === 'million') { total += cur * 1000000; cur = 0; }
    else return NaN;
  }
  return total + cur;
}

/** cheque draft: { amount_digits, amount_words, date, payee } */
function checkCheque(c) {
  const warnings = [];
  const w = wordsToNumber(c.amount_words);
  if (!(Number(c.amount_digits) > 0)) warnings.push('amount in digits is missing');
  if (w !== w) warnings.push('could not read the amount in words');
  else if (Number(c.amount_digits) !== w) warnings.push(`digits say ${Number(c.amount_digits).toLocaleString('en-US')} but words say ${w.toLocaleString('en-US')}`);
  if (!c.payee) warnings.push('payee missing');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(c.date || ''))) warnings.push('date missing or not YYYY-MM-DD');
  return { ok: warnings.length === 0, warnings };
}

module.exports = { checkGrn, checkCheque, wordsToNumber };
