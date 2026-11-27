/* pos-returns.js (AJ 27 Nov): CUSTOMER RETURN / REFUND / EXCHANGE inside the POS. Own module: remove the script tag and nothing else changes.
   Button "Return / refund": type the bill number, tick what comes back, pick how the money goes back, reason, Save -> return note RBH-Rnnn (stock back, sales down today).
   "Exchange": after saving, the screen is cleared for the new item; bill it in full, the drawer nets out by itself. Owner only (the server checks). */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var tools = $('posTools'); if (!tools) return;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var money = function (n) { return 'Rs ' + Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var J = function (u, o) { o = o || {}; o.credentials = 'same-origin'; if (o.body && typeof o.body !== 'string') { o.headers = { 'Content-Type': 'application/json' }; o.body = JSON.stringify(o.body); }
    return fetch(u, o).then(function (r) { return r.json().catch(function () { return null; }).then(function (d) { return { ok: r.ok, status: r.status, d: d }; }); }); };
  var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'secondary small'; btn.id = 'retBtn'; btn.textContent = 'Return / refund';
  tools.insertBefore(btn, tools.firstChild);
  var ov = null;
  function close() { if (ov && ov.parentNode) ov.parentNode.removeChild(ov); ov = null; }
  function modal(html) { close(); ov = document.createElement('div'); ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:99999;display:flex;align-items:center;justify-content:center;padding:10px';
    ov.innerHTML = '<div style="background:#fff;color:#111;border-radius:10px;max-width:580px;width:100%;max-height:92vh;overflow:auto;padding:14px;box-shadow:0 8px 30px rgba(0,0,0,.3);font:14px Arial">' + html + '</div>';
    document.body.appendChild(ov); ov.addEventListener('click', function (e) { if (e.target === ov) close(); }); return ov; }
  var inp = 'style="padding:8px;border:1px solid #bbb;border-radius:6px;font-size:15px"';
  var bt = function (bg) { return 'style="padding:9px 14px;border:0;border-radius:6px;font-weight:700;background:' + (bg || '#222') + ';color:#fff;margin:3px 3px 0 0"'; };

  function start(prefill) {
    modal('<h3 style="margin:0 0 8px">Return / refund</h3><div>Bill number of the original sale</div>' +
      '<div style="display:flex;gap:6px;margin:6px 0"><input id="rtNo" ' + inp + ' placeholder="RBH-S039" value="' + esc(prefill || '') + '" style="flex:1;padding:8px;border:1px solid #bbb;border-radius:6px;font-size:15px"><button id="rtFind" ' + bt() + '>Find</button></div><div id="rtBody"></div><div id="rtErr" style="color:#b00;margin-top:6px"></div>' +
      '<div style="text-align:right;margin-top:8px"><button id="rtX" ' + bt('#777') + '>Close</button></div>');
    $('rtX').onclick = close; $('rtFind').onclick = find; $('rtNo').onkeydown = function (e) { if (e.key === 'Enter') find(); };
    if (prefill) find(); else $('rtNo').focus();
  }
  function find() {
    var n = $('rtNo').value.trim(); $('rtErr').textContent = ''; if (!n) return;
    J('/api/pos-returns/bill?number=' + encodeURIComponent(n)).then(function (r) {
      if (!r.ok) { $('rtBody').innerHTML = ''; $('rtErr').textContent = (r.d && r.d.error) || 'Could not find that bill.'; return; }
      var d = r.d, rows = d.lines.map(function (l) {
        return '<tr><td>' + esc(l.item_name) + '<br><small>' + esc(l.item_code || '') + ' · sold ' + l.sold + (l.returned ? ' · back ' + l.returned : '') + ' · ' + money(l.refund_each) + ' each</small></td>' +
          '<td style="text-align:right"><input type="number" min="0" max="' + l.left + '" step="1" value="0" data-id="' + l.line_id + '" data-each="' + l.refund_each + '" class="rtq" style="width:70px;padding:6px;border:1px solid #bbb;border-radius:6px;font-size:15px"' + (l.left <= 0 ? ' disabled' : '') + '><br><small>can return ' + l.left + '</small></td></tr>';
      }).join('');
      $('rtBody').innerHTML = '<div style="margin:6px 0"><b>' + esc(d.bill.bill_number) + '</b> · ' + esc(d.bill.customer_name || 'Walk-in') + ' · ' + money(d.bill.total) + '</div><table style="width:100%;border-collapse:collapse">' + rows + '</table>' +
        '<div style="margin:8px 0">Refund total: <b id="rtTot">Rs 0.00</b></div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap"><select id="rtM" ' + inp + '><option value="cash">Cash back</option><option value="card">Back to card</option><option value="online">Online transfer back</option></select>' +
        '<input id="rtWhy" ' + inp + ' placeholder="Reason (required)" style="flex:1;min-width:160px;padding:8px;border:1px solid #bbb;border-radius:6px;font-size:15px"></div>' +
        '<div style="margin-top:8px"><button id="rtSave" ' + bt('#1b7a46') + '>Save return</button><button id="rtEx" ' + bt('#C9A24B') + '>Save + exchange (new item)</button></div>';
      var upd = function () { var t = 0; Array.prototype.forEach.call(document.querySelectorAll('.rtq'), function (i) { t += (Number(i.value) || 0) * Number(i.getAttribute('data-each')); }); $('rtTot').textContent = money(t); };
      Array.prototype.forEach.call(document.querySelectorAll('.rtq'), function (i) { i.oninput = upd; });
      $('rtSave').onclick = function () { save(d, false); }; $('rtEx').onclick = function () { save(d, true); };
    });
  }
  function save(d, exch) {
    var lines = []; Array.prototype.forEach.call(document.querySelectorAll('.rtq'), function (i) { var q = Number(i.value) || 0; if (q > 0) lines.push({ line_id: Number(i.getAttribute('data-id')), qty: q }); });
    $('rtErr').textContent = ''; if (!lines.length) { $('rtErr').textContent = 'Put the quantity that comes back.'; return; }
    var why = $('rtWhy').value.trim(); if (!why) { $('rtErr').textContent = 'Give the reason.'; return; }
    $('rtSave').disabled = true; $('rtEx').disabled = true;
    J('/api/pos-returns', { method: 'POST', body: { bill_number: d.bill.bill_number, refund_method: $('rtM').value, reason: why, lines: lines } }).then(function (r) {
      if (!r.ok) { $('rtSave').disabled = false; $('rtEx').disabled = false; $('rtErr').textContent = (r.d && r.d.error) || 'Could not save.'; return; }
      done(r.d, exch);
    });
  }
  function print(o) {
    var w = window.open('', '_blank'); if (!w) return;
    w.document.write('<!doctype html><meta charset="utf-8"><title>' + esc(o.return_number) + '</title><style>body{font:14px Arial;max-width:360px;margin:12px auto}h2,h3{text-align:center;margin:4px 0}td{padding:3px 2px;border-bottom:1px dotted #aaa}td:last-child{text-align:right}</style><h2>Royal Bath Hub</h2><div style="text-align:center;font-size:12px">173/1 Kandy Road, Thihariya · 074 035 5536</div><h3>RETURN NOTE ' + esc(o.return_number) + '</h3><div>For bill ' + esc(o.orig_number) + ' · ' + esc(o.customer_name || '') + '</div><table style="width:100%">' +
      o.lines.map(function (l) { return '<tr><td>' + esc(l.item_name) + ' x ' + l.qty + '</td><td>' + money(l.amount) + '</td></tr>'; }).join('') + '</table><p style="text-align:right"><b>Refunded: ' + money(o.refund) + '</b> (' + esc(o.method) + ')</p><div style="font-size:12px">Reason: ' + esc(o.reason) + '</div><script>setTimeout(function(){window.print()},300)<\/script>');
    w.document.close();
  }
  function done(o, exch) {
    modal('<h3 style="margin:0 0 8px;color:#1b7a46">Return saved · ' + esc(o.return_number) + '</h3><div>Refund ' + money(o.refund) + ' (' + esc(o.method) + ') for ' + esc(o.orig_number) + '. Stock is back.</div>' +
      (exch ? '<div style="margin-top:8px;padding:8px;background:#fff4d6;border-radius:6px">Exchange: the refund is paid out. Now bill the new item in full on this screen.</div>' : '') +
      '<div style="margin-top:8px"><button id="rtP" ' + bt() + '>Print return note</button><button id="rtD" ' + bt('#777') + '>Done</button></div>');
    $('rtP').onclick = function () { print(o); };
    $('rtD').onclick = function () { close(); if (exch && window.Pos2 && window.Pos2.clearForNext) { try { window.Pos2.clearForNext(); } catch (_) {} } };
  }
  btn.onclick = function () { start(''); };
  window.PosReturn = start;   // other screens (All bills) can call PosReturn('RBH-S039')
})();
