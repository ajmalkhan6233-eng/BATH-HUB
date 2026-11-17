/* POS customer rules (AJ 16 Nov). Own module, wraps the page; remove the tag and the page works as before.
   - Blank name or "cash" with no phone = ONE shared "Walk-in customer": no new customer, no phone, no credit.
   - A phone must be a real Sri Lankan number (0771234567, +94 77 123 4567, 011 2345678). Anything else is refused with a clear message.
   - The bill number shows next to the Quotation tab, and updates after every bill. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var WALK = /^(|cash|walk[- ]?in|walk[- ]?in customer|cash customer)$/i;
  function slPhone(raw) {            // returns "0XXXXXXXXX" or '' (empty input) or null (not a Sri Lankan number)
    if (/[A-Za-z]/.test(String(raw || ''))) return null;
    var d = String(raw || '').trim().replace(/^009[\s-]/, '00').replace(/[^\d+]/g, ''); if (!d) return '';   // "009 61..." (Sri Lanka's old dialling prefix, typed with a space) = 00 61...
    // 17 Nov (AJ): a number with + or 00 in front from any other country is accepted as an international number (8 to 15 digits). Sri Lanka rules below are unchanged.
    if (/^(\+|00)/.test(d) && !/^(\+94|0094)/.test(d)) { var c = d.replace(/^(\+|00)/, ''); return /^[1-9]\d{7,14}$/.test(c) ? '+' + c : null; }
    d = d.replace(/^\+/, '').replace(/^0094/, '94');
    if (/^94\d{9}$/.test(d)) d = '0' + d.slice(2); else if (/^[1-9]\d{8}$/.test(d)) d = '0' + d;
    return /^0[1-9]\d{8}$/.test(d) ? d : null;
  }
  function paysCredit() { var m = $('paymentMethod'); if (!m) return false; if (m.value === 'credit') return true; return m.value === 'split' && /credit/i.test(($('splitRows') || {}).textContent + [].map.call(document.querySelectorAll('#splitRows select'), function (s) { return s.value; }).join(' ')); }
  if (typeof window.generateBill === 'function') {
    var orig = window.generateBill;
    window.generateBill = function () {
      var n = $('customerName'), p = $('customerPhone'); if (!n || !p) return orig.apply(this, arguments);
      var ph = slPhone(p.value);
      if (ph === null) { if (typeof window.showError === 'function') window.showError('Phone must be a Sri Lankan number like 077 123 4567, or an international number starting with + or 00. Check it and try again.'); p.focus(); return; }
      p.value = ph;
      var walk = WALK.test(n.value.trim()) && !ph;
      if (walk) {
        if (paysCredit()) { if (typeof window.showError === 'function') window.showError('Credit needs the customer name and phone. Walk-in cannot buy on credit.'); n.focus(); return; }
        n.value = 'Walk-in customer';
      }
      return orig.apply(this, arguments);
    };
  }
  // bill number chip next to the Quotation tab
  function chip() {
    var c = $('billNoChip'); if (c) return c;
    var tabs = $('pqTabs'); if (!tabs) return null;
    c = document.createElement('span'); c.id = 'billNoChip'; c.style.cssText = 'margin-left:10px;font-size:13px;font-weight:700;opacity:.8;white-space:nowrap;align-self:center';
    tabs.appendChild(c); return c;
  }
  function show(no) { var c = chip(); if (c) c.textContent = no ? 'Bill ' + no : ''; }
  if (typeof window.renderBill === 'function') {
    var r0 = window.renderBill;
    window.renderBill = function (bill) { var r = r0.apply(this, arguments); try { if (bill && bill.bill_number) show(bill.bill_number); } catch (e) { /* ignore */ } return r; };
  }
  setTimeout(function () { try { fetch('/api/pos-bills?limit=1', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : []; }).then(function (a) { if (Array.isArray(a) && a[0] && a[0].bill_number) show('last ' + a[0].bill_number); }); } catch (e) { /* ignore */ } }, 600);
  window.PosCustomer = { slPhone: slPhone, show: show };
})();
