/* POS live profit (AJ 16 Nov). Own module; remove the tag and nothing else changes.
   Shows the profit number only (no word) under the bill, updating as he types (no Enter). Tap it to blur when a customer is looking. */
(function () {
  'use strict';
  var host = document.getElementById('itemRows'), live = document.getElementById('liveBill'); if (!host || !live) return;
  var box = document.createElement('div'); box.id = 'posProfit'; live.parentNode.insertBefore(box, live.nextSibling);
  var ex = document.createElement('div'); ex.id = 'posExtra'; live.parentNode.insertBefore(ex, live.nextSibling);   // 'After item discounts 24,500 | extra discount 700'
  box.addEventListener('click', function () { box.classList.toggle('blur'); });
  var num = function (v) { var n = parseFloat(String(v).replace(/,/g, '')); return isFinite(n) ? n : 0; };
  function calc() {
    var rows = Array.prototype.slice.call(host.querySelectorAll('.item-row')).filter(function (r) { return r.dataset.itemCode; });
    if (!rows.length) { box.textContent = ''; ex.textContent = ''; return; }
    var cost = (window.PosLine && PosLine.cost) || {}, c = 0, sum = 0, known = true;
    rows.forEach(function (r) {
      var q = num(r.querySelector('.i-qty').value), code = r.dataset.itemCode;
      if (cost[code] == null) known = false; else c += q * cost[code];
      sum += num((r.querySelector('.i-line') || {}).textContent);
    });
    var sp = num((document.getElementById('sellPrice') || {}).value), rev = sp > 0 ? sp : sum;
    // after the item discounts, and the extra bill discount typed in the Selling price box (AJ 16 Nov)
    var gross = 0, ld = 0; Array.prototype.forEach.call(host.querySelectorAll('.item-row'), function (r) { var g = num(r.querySelector('.i-qty').value) * num(r.querySelector('.i-price').value); gross += g; ld += (window.PosLine ? PosLine.cash(r) : 0); });
    var after = gross - ld, given = sp > 0 ? sp : after, extra = Math.round((after - given) * 100) / 100;
    var et = (ld > 0 && extra > 0.5) ? 'After item discounts ' + Math.round(after).toLocaleString('en-LK') + '  ·  extra bill discount ' + Math.round(extra).toLocaleString('en-LK') : '';
    if (ex.textContent !== et) ex.textContent = et;
    var t = known && rev ? Math.round(rev - c).toLocaleString('en-LK') : '';
    if (box.textContent !== t) box.textContent = t;
  }
  ['input', 'change', 'keyup'].forEach(function (ev) { document.addEventListener(ev, calc, true); });
  setInterval(calc, 600);
})();
