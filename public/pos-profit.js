/* POS live profit (AJ 16 Nov). Own module; remove the tag and nothing else changes.
   Shows Profit under the bill, updating as he types (no Enter). Tap it to blur when a customer is looking. */
(function () {
  'use strict';
  var host = document.getElementById('itemRows'), live = document.getElementById('liveBill'); if (!host || !live) return;
  var box = document.createElement('div'); box.id = 'posProfit'; live.parentNode.insertBefore(box, live.nextSibling);
  box.addEventListener('click', function () { box.classList.toggle('blur'); });
  var num = function (v) { var n = parseFloat(String(v).replace(/,/g, '')); return isFinite(n) ? n : 0; };
  function calc() {
    var rows = Array.prototype.slice.call(host.querySelectorAll('.item-row')).filter(function (r) { return r.dataset.itemCode; });
    if (!rows.length) { box.textContent = ''; return; }
    var cost = (window.PosLine && PosLine.cost) || {}, c = 0, sum = 0, known = true;
    rows.forEach(function (r) {
      var q = num(r.querySelector('.i-qty').value), code = r.dataset.itemCode;
      if (cost[code] == null) known = false; else c += q * cost[code];
      sum += num((r.querySelector('.i-line') || {}).textContent);
    });
    var sp = num((document.getElementById('sellPrice') || {}).value), rev = sp > 0 ? sp : sum;
    var t = known && rev ? 'Profit  Rs ' + Math.round(rev - c).toLocaleString('en-LK') : '';
    if (box.textContent !== t) box.textContent = t;
  }
  ['input', 'change', 'keyup'].forEach(function (ev) { document.addEventListener(ev, calc, true); });
  setInterval(calc, 600);
})();
