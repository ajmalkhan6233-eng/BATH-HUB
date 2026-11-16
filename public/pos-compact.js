/* POS: once the customer name / date / phone are filled and you move on, they fold into one slim line (tap it to change). */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var row = $('custRow'), n = $('customerName'), p = $('customerPhone'), d = $('saleDate'); if (!row || !n || !p) return;
  var sum = document.createElement('div'); sum.id = 'custSum'; sum.title = 'Tap to change the customer, date or phone'; row.insertBefore(sum, row.firstChild);
  function fmt(v) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || ''); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; }
  function fold() {
    var name = n.value.trim(), ph = p.value.trim(); if (!name && !ph) return;
    sum.textContent = [name || 'Walk-in customer', fmt(d && d.value), ph].filter(Boolean).join('  ·  ') + '   (change)';
    row.classList.add('cust-done');
  }
  function open() { row.classList.remove('cust-done'); n.focus(); }
  sum.addEventListener('click', open);
  row.addEventListener('focusout', function (e) { setTimeout(function () { if (!row.contains(document.activeElement) && !row.classList.contains('cust-done')) fold(); }, 80); });
  if (typeof window.clearCustomer === 'function') { var c0 = window.clearCustomer; window.clearCustomer = function () { row.classList.remove('cust-done'); return c0.apply(this, arguments); }; }
})();
