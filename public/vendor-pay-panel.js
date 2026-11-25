/* Vendors page, "Add Payment to Supplier" (AJ 25 Nov): the chosen supplier's total outstanding on the right; the typed amount is taken off live.
   Own module. Record Payment saves through POST /api/vendor-pay. Remove the script tag and the panel is gone. */
(function (root) {
  'use strict';
  function key(s) { return String(s || '').trim().toLowerCase(); }
  function figures(vendors, name, amount) {
    var v = (vendors || []).filter(function (x) { return key(x.vendor_name) === key(name); })[0];
    var owed = v ? Number(v.outstanding_balance) || 0 : 0, pay = Math.max(0, Number(amount) || 0);
    return { found: !!v, owed: owed, pay: pay, after: Math.round((owed - pay) * 100) / 100, cheques: v ? Number(v.cheques_pending) || 0 : 0 };
  }
  if (typeof module !== 'undefined' && module.exports) { module.exports = { figures: figures }; return; }
  var vendors = null, at = 0;
  var $ = function (id) { return document.getElementById(id); };
  var rs = function (n) { return 'Rs ' + Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  function row(label, value, big, colour) {
    var d = document.createElement('div'); d.style.cssText = 'display:flex;justify-content:space-between;gap:12px;padding:6px 0;font-size:' + (big ? '22px;font-weight:800' : '15px') + (colour ? ';color:' + colour : '');
    var a = document.createElement('span'), b = document.createElement('span'); a.textContent = label; b.textContent = value; d.appendChild(a); d.appendChild(b); return d;
  }
  function draw() {
    var sel = $('vend-sel'), amt = $('vend-amt'), ref = $('vend-total-out'); if (!sel || !amt || !ref) return;
    var box = $('vend-bal'); if (!box) { box = document.createElement('div'); box.id = 'vend-bal'; box.className = 'card'; box.style.marginBottom = '12px'; var first = ref.parentNode; first.parentNode.insertBefore(box, first); }
    var name = sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text : '';
    box.textContent = '';
    if (!vendors) { box.appendChild(row('Loading balance...', '')); return; }
    var f = figures(vendors, name, amt.value);
    var h = document.createElement('div'); h.className = 'kpi-label'; h.textContent = name || 'Choose a supplier'; box.appendChild(h);
    if (!f.found) { box.appendChild(row('No bills saved for this supplier', rs(0))); return; }
    box.appendChild(row('Total outstanding', rs(f.owed), true, 'var(--red)'));
    box.appendChild(row('This payment', '- ' + rs(f.pay)));
    box.appendChild(row(f.after < 0 ? 'Paying too much by' : 'Left after this payment', rs(Math.abs(f.after)), true, f.after < 0 ? 'var(--red)' : 'var(--amber)'));
    if (f.cheques) box.appendChild(row('Cheques still waiting', rs(f.cheques)));
  }
  function load() {
    if (Date.now() - at < 5000) return; at = Date.now();
    fetch('/api/vendor360/list', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) { if (d && d.vendors) { vendors = d.vendors; draw(); } }).catch(function () { at = 0; });
  }
  var busy = false;
  var say = function (t, k) { if (typeof root.toast === 'function') root.toast(t, k || 'info'); else alert(t); };
  root.RBHVendorPay = { save: async function () {
    if (busy) return;
    var sel = $('vend-sel'), name = sel && sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text : '';
    var body = { vendor: name, amount: Number($('vend-amt').value), method: $('vend-method').value, date: $('vend-date').value, ref: $('vend-ref').value };
    if (!name || !(body.amount > 0)) return say('Choose the supplier and type the amount', 'error');
    if (!body.date) return say('Choose the date', 'error');
    if (!confirm('Save ' + body.method + ' ' + rs(body.amount) + ' to ' + name + ', dated ' + body.date + (body.ref ? ', ref ' + body.ref : '') + '?')) return;
    busy = true;
    try {
      var r = await fetch('/api/vendor-pay', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      var d = await r.json().catch(function () { return {}; });
      if (!r.ok) return say(d.error || 'Could not save. Nothing was saved.', 'error');
      say('Saved: ' + rs(d.amount) + ' on bill ' + d.parts.map(function (p) { return p.bill_no; }).join(', ') + '. Left to pay (not covered): ' + rs(d.left_to_pay), 'success');
      $('vend-amt').value = ''; $('vend-ref').value = ''; at = 0; load(); draw(); if (typeof root.loadVendors === 'function') { var keep = sel.value; await root.loadVendors(); sel.value = keep; draw(); }
    } catch (e) { say('No connection. Check the cheque list before trying again.', 'error'); } finally { busy = false; }
  } };
  document.addEventListener('input', function (e) { if (e.target.id === 'vend-amt') draw(); });
  document.addEventListener('change', function (e) { if (e.target.id === 'vend-sel') { draw(); load(); } });
  setInterval(function () {   // only while the Vendors page is open
    var p = $('page-vendors'), sel = $('vend-sel'); if (!p || !p.offsetParent || !sel || !sel.options.length) return;
    if (!$('vend-bal') || sel.dataset.bal !== sel.value) { sel.dataset.bal = sel.value; load(); draw(); }
  }, 700);
})(this);
