/* GRN import helper: turns a typed invoice (JSON / CSV rows / sheet rows) or an
 * OCR result into GRN screen rows. Pure functions, no DOM. Never saves anything. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GrnImport = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  var NAME = ['name', 'item', 'item_name', 'itemname', 'description', 'desc', 'product', 'particulars'];
  var QTY = ['qty', 'quantity', 'qnty', 'nos', 'units'];
  var COST = ['unit_cost', 'unitcost', 'cost', 'unit_price', 'unitprice', 'price', 'rate', 'unit rate'];
  var TOTAL = ['line_total', 'linetotal', 'amount', 'total', 'value'];
  var SELL = ['selling_price', 'sell_price', 'sale_price', 'retail_price'];

  function norm(k) { return String(k).trim().toLowerCase().replace(/[\s\-]+/g, '_'); }
  function pick(o, keys) {
    var m = {}; Object.keys(o || {}).forEach(function (k) { m[norm(k)] = o[k]; });
    for (var i = 0; i < keys.length; i++) { var v = m[keys[i].replace(/ /g, '_')]; if (v !== undefined && v !== null && v !== '') return v; }
    return undefined;
  }
  function num(v) {
    if (v === undefined || v === null || v === '') return null;
    var n = parseFloat(String(v).replace(/[,\s]/g, '').replace(/[\/\-]+$/, ''));
    return isFinite(n) ? n : null;
  }
  function isoDate(v) {
    if (!v) return '';
    var s = String(v).trim(), m;
    if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return m[1] + '-' + m[2] + '-' + m[3];
    if ((m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/))) // Sri Lanka: day first
      return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
    return '';
  }
  function key(s) { return String(s || '').trim().toLowerCase().replace(/\s+/g, ' '); }

  function fromLines(arr) {
    var lines = [];
    (arr || []).forEach(function (r) {
      if (!r || typeof r !== 'object') return;
      var name = pick(r, NAME); if (name === undefined) return;
      var qty = num(pick(r, QTY)), cost = num(pick(r, COST)), tot = num(pick(r, TOTAL));
      if (cost === null && tot !== null && qty) cost = Math.round(tot / qty * 100) / 100;
      lines.push({ name: String(name).trim(), qty: qty, cost: cost, price: num(pick(r, SELL)), line_total: tot });
    });
    return lines;
  }

  // input: object (parsed JSON) or array of row objects (CSV/sheet)
  function build(input) {
    var head = Array.isArray(input) ? {} : (input || {});
    var arr = Array.isArray(input) ? input : (head.lines || head.items || head.line_items || head.rows || []);
    var lines = fromLines(arr);
    var out = {
      supplier: String(pick(head, ['supplier', 'supplier_name', 'vendor', 'vendor_name']) || '').trim(),
      date: isoDate(pick(head, ['date', 'grn_date', 'invoice_date'])),
      ref: String(pick(head, ['invoice_no', 'invoice_number', 'ref', 'reference', 'bill_no', 'grn_number']) || '').trim(),
      paper_total: num(pick(head, ['total', 'grand_total', 'invoice_total', 'net_total'])),
      credit_days: num(pick(head, ['credit_days', 'terms_days'])),
      lines: lines, warnings: []
    };
    return check(out);
  }

  function check(out) {
    var w = out.warnings = [];
    if (!out.lines.length) w.push('No item lines found in this file.');
    var seen = {}, dup = {};
    out.lines.forEach(function (l, i) {
      var k = key(l.name);
      if (!k) w.push('Line ' + (i + 1) + ' has no item name.');
      else if (seen[k]) dup[l.name] = true; else seen[k] = true;
      if (!l.qty || l.qty <= 0) w.push('Line ' + (i + 1) + ' (' + l.name + ') has no quantity.');
      if (l.cost === null || l.cost < 0) w.push('Line ' + (i + 1) + ' (' + l.name + ') has no unit cost.');
    });
    Object.keys(dup).forEach(function (n) { w.push('Same item twice: "' + n + '". The GRN refuses a repeated name. Merge or rename one.'); });
    var sum = 0; out.lines.forEach(function (l) { sum += (l.qty || 0) * (l.cost || 0); });
    out.lines_total = Math.round(sum * 100) / 100;
    if (out.paper_total !== null && Math.abs(out.paper_total - out.lines_total) > 10)
      w.push('Lines add up to ' + out.lines_total + ' but the paper total is ' + out.paper_total + '. Check before saving.');
    if (!out.supplier) w.push('Supplier name not found: pick it yourself.');
    if (!out.date) w.push('Date not found: set it yourself.');
    return out;
  }

  function parseCsv(text) {
    var rows = [], row = [], cur = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) { if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some(function (x) { return x !== ''; })) rows.push(row); row = []; }
      else cur += c;
    }
    row.push(cur); if (row.some(function (x) { return x !== ''; })) rows.push(row);
    if (rows.length < 2) return [];
    var h = rows[0];
    return rows.slice(1).map(function (r) { var o = {}; h.forEach(function (k, i) { o[k] = r[i]; }); return o; });
  }

  function fromText(text, filename) {
    var t = String(text || '').replace(/^﻿/, '');
    if (/\.json$/i.test(filename || '') || /^\s*[\[{]/.test(t)) return build(JSON.parse(t));
    return build(parseCsv(t));
  }

  // OCR result from scripts/ocr_photo.js
  function fromOcr(doc) {
    doc = doc || {};
    var o = build({
      supplier: doc.supplier_name || doc.vendor_name || '', date: doc.date,
      invoice_no: doc.grn_number || doc.invoice_number || doc.bill_number || '',
      total: doc.total != null ? doc.total : doc.grand_total,
      lines: (doc.items || []).map(function (it) {
        return { name: it.name || it.description, qty: it.qty != null ? it.qty : it.quantity,
                 unit_cost: it.unit_cost != null ? it.unit_cost : it.unit_price, amount: it.amount };
      })
    });
    o.warnings.unshift('Read by AI from a photo. It can misread digits. Check every line against the paper.');
    if (doc.confidence === 'low') o.warnings.unshift('The AI said the photo was hard to read' + (doc.notes ? ': ' + doc.notes : '') + '.');
    return o;
  }

  return { build: build, check: check, fromText: fromText, fromOcr: fromOcr, parseCsv: parseCsv };
});
