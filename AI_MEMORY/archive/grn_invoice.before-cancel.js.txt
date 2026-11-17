/* GRN invoice page (opened from Vendor 360 > GRN). View, Edit (qty, cost, discount, charges, date), and the Bill total / Paid / Difference strip. API: /api/grn-invoice */
(function () {
  'use strict';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var rs = function (n) { return 'Rs. ' + Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var dmy = function (d) { return d ? String(d).split('-').reverse().join('-') : '-'; };
  var css = '.gi-back{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:60;overflow:auto;padding:12px}.gi{max-width:760px;margin:0 auto;background:var(--card,#fffdf7);color:var(--ink,#0B1B3A);border:1px solid var(--line,#ccc);border-radius:14px;padding:14px}' +
    '.gi h2{margin:0 0 6px}.gi .hd{display:grid;grid-template-columns:repeat(2,1fr);gap:6px 12px;margin:8px 0}.gi .hd span{display:block;color:var(--muted,#5b6070);font-size:13px}' +
    '.gi table{width:100%;border-collapse:collapse;margin:8px 0}.gi th,.gi td{padding:6px;border-bottom:1px solid var(--line,#ccc);text-align:left}.gi .n{text-align:right}.gi input{width:100%;min-width:70px;text-align:right}' +
    '.gi .tot{margin-left:auto;max-width:360px}.gi .tot div{display:flex;justify-content:space-between;gap:10px;padding:4px 0}.gi .tot .big{font-weight:700;font-size:18px;border-top:2px solid var(--line,#ccc)}' +
    '.gi .strip{margin-top:12px;border-radius:12px;padding:10px;border:2px solid}.gi .strip.green{border-color:#1b7a46;background:rgba(27,122,70,.12)}.gi .strip.amber{border-color:#c98a00;background:rgba(201,138,0,.15)}.gi .strip.none{border-color:var(--line,#ccc)}' +
    '.gi .strip .row{display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;font-weight:600}.gi .picks{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}.gi .picks button[aria-pressed=true]{outline:3px solid #0B1B3A}' +
    '.gi .bar{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.gi .aud{font-size:13px;color:var(--muted,#5b6070);margin-top:10px}.gi .err{color:#b3261e;margin-top:6px}';
  function api(method, vendor, grn, tail, body) {
    return fetch('/api/grn-invoice/' + encodeURIComponent(vendor) + '/' + encodeURIComponent(grn) + (tail || ''), { method: method, credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Could not load'); return j; }); });
  }
  window.openGrnInvoice = function (vendor, grn, onChange) {
    if (!document.getElementById('gi-css')) { var st = document.createElement('style'); st.id = 'gi-css'; st.textContent = css; document.head.appendChild(st); }
    var back = document.createElement('div'); back.className = 'gi-back'; back.setAttribute('role', 'dialog'); back.setAttribute('aria-modal', 'true');
    back.innerHTML = '<div class="gi"><div class="sm">Loading...</div></div>'; document.body.appendChild(back);
    var box = back.firstChild, D = null, editing = false, pick = '';
    var close = function () { back.remove(); document.removeEventListener('keydown', onKey); };
    var onKey = function (e) { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey); back.addEventListener('click', function (e) { if (e.target === back) close(); });
    function draw(err) {
      var d = D, e = editing;
      var rows = d.lines.map(function (l) {
        return '<tr><td>' + esc(l.code) + '</td><td>' + esc(l.name) + '</td><td class="n">' + (e ? '<input data-q="' + l.id + '" type="number" min="0" step="any" inputmode="decimal" value="' + l.qty + '" aria-label="Qty ' + esc(l.name) + '">' : l.qty) + '</td><td class="n">' +
          (e ? '<input data-c="' + l.id + '" type="number" min="0" step="any" inputmode="decimal" value="' + l.cost + '" aria-label="Cost ' + esc(l.name) + '">' : rs(l.cost)) + '</td><td class="n">' + rs(l.amount) + '</td></tr>';
      }).join('');
      var disc = e ? '<div>Discount % <input id="gi-dp" type="number" min="0" max="100" step="any" value="' + d.discount_pct + '"></div><div>Discount Rs. <input id="gi-da" type="number" min="0" step="any" value="' + d.discount_amt + '"></div><div>Other charges <input id="gi-oc" type="number" min="0" step="any" value="' + d.other_charges + '"></div>'
        : '<div><span>Discount' + (d.discount_pct ? ' (' + d.discount_pct + '%)' : '') + '</span><span>- ' + rs(d.discount) + '</span></div><div><span>Other charges' + (d.other_note ? ' (' + esc(d.other_note) + ')' : '') + '</span><span>' + rs(d.other_charges) + '</span></div>';
      var strip = '';
      if (d.bill_id) {
        var diff = d.difference, label = diff === 0 ? 'Balanced' : diff < 0 ? 'We paid ' + rs(-diff) + ' extra' : rs(diff) + ' still to pay';
        strip = '<div class="strip ' + d.state + '" id="gi-strip"><div class="row"><span>Bill total ' + rs(d.bill_total) + '</span><span>Paid (cash + cheques) ' + rs(d.paid) + '</span><span>Difference ' + rs(diff) + '</span></div>' +
          '<div class="sm">Cash ' + rs(d.cash) + ' + cheques ' + rs(d.cheques_total) + (d.cheques.length ? ' (' + d.cheques.map(function (c) { return esc(c.cheque_no || 'cheque') + ' ' + rs(c.amount); }).join(', ') + ')' : '') + '</div>';
        if (diff !== 0) {
          strip += '<div>' + label + (d.reason ? ' · Reason: <b>' + esc(d.reason.reason) + '</b>' + (d.reason.note ? ' (' + esc(d.reason.note) + ')' : '') : ' · <b>no reason yet</b>') + '</div><div class="picks" role="group" aria-label="Reason">' +
            d.reasons.map(function (r) { return '<button type="button" class="ghost" data-r="' + esc(r) + '" aria-pressed="' + ((pick || (d.reason && d.reason.reason)) === r) + '">' + esc(r) + '</button>'; }).join('') + '</div>' +
            '<input id="gi-note" type="text" placeholder="Note (optional)" style="text-align:left" value="' + esc((d.reason && d.reason.note) || '') + '"> <button type="button" id="gi-rsave">Save reason</button>';
        }
        strip += '</div>';
      }
      var aud = d.audit.length ? '<details class="aud"><summary>Changes (' + d.audit.length + ')</summary>' + d.audit.map(function (a) { return '<div>' + esc(a.at) + ' · ' + esc(a.field) + ': ' + esc(a.old_value) + ' to ' + esc(a.new_value) + '</div>'; }).join('') + '</details>' : '';
      box.innerHTML = '<h2>GRN ' + esc(d.bill_no) + ' · ' + esc(d.vendor) + '</h2><div class="hd"><div><span>Vendor</span>' + esc(d.vendor) + '</div><div><span>Bill no</span>' + esc(d.bill_no) + '</div>' +
        '<div><span>Date</span>' + (e ? '<input id="gi-date" type="date" value="' + esc(d.date) + '" style="text-align:left">' : dmy(d.date)) + '</div><div><span>Terms</span>' + esc(d.terms) + (d.due_date ? ' · due ' + dmy(d.due_date) : '') + '</div></div>' +
        '<table><thead><tr><th>Code</th><th>Item</th><th class="n">Qty</th><th class="n">Cost</th><th class="n">Amount</th></tr></thead><tbody>' + rows + '</tbody></table>' +
        '<div class="tot"><div><span>Subtotal</span><span>' + rs(d.subtotal) + '</span></div>' + disc + '<div class="big"><span>Total</span><span>' + rs(d.total) + '</span></div></div>' + strip +
        '<div class="err" role="alert">' + esc(err || '') + '</div><div class="bar">' + (d.bill_id ? (e ? '<button type="button" id="gi-save">Save</button><button type="button" class="ghost" id="gi-cancel">Cancel</button>' : '<button type="button" id="gi-edit">Edit</button>') : '') + '<button type="button" class="ghost" id="gi-close">Close</button></div>' + aud;
      var $ = function (id) { return box.querySelector('#' + id); };
      $('gi-close').onclick = close;
      if ($('gi-edit')) $('gi-edit').onclick = function () { editing = true; draw(); };
      if ($('gi-cancel')) $('gi-cancel').onclick = function () { editing = false; draw(); };
      if ($('gi-save')) $('gi-save').onclick = function () {
        var lines = d.lines.map(function (l) { return { id: l.id, qty: box.querySelector('[data-q="' + l.id + '"]').value, cost: box.querySelector('[data-c="' + l.id + '"]').value }; });
        api('PUT', vendor, grn, '', { lines: lines, discount_pct: $('gi-dp').value, discount_amt: $('gi-da').value, other_charges: $('gi-oc').value, date: $('gi-date').value })
          .then(function (j) { D = j; editing = false; draw(); if (onChange) onChange(); }).catch(function (x) { draw(x.message); });
      };
      Array.prototype.forEach.call(box.querySelectorAll('[data-r]'), function (b) { b.onclick = function () { pick = b.getAttribute('data-r'); Array.prototype.forEach.call(box.querySelectorAll('[data-r]'), function (o) { o.setAttribute('aria-pressed', o === b); }); }; });
      if ($('gi-rsave')) $('gi-rsave').onclick = function () {
        var r = pick || (d.reason && d.reason.reason); if (!r) return draw('Pick a reason first.');
        api('PUT', vendor, grn, '/reason', { reason: r, note: $('gi-note').value }).then(function (j) { D = j; pick = ''; draw(); if (onChange) onChange(); }).catch(function (x) { draw(x.message); });
      };
    }
    api('GET', vendor, grn).then(function (j) { D = j; draw(); }).catch(function (x) { box.innerHTML = '<div class="err">' + esc(x.message) + '</div><div class="bar"><button type="button" id="gi-x">Close</button></div>'; box.querySelector('#gi-x').onclick = close; });
  };
})();
