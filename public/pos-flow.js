/* POS keyboard flow (AJ 16 Nov). Own module; remove the tag and the page works as before.
   item added (scan box, code or name) -> cursor goes to that line's Qty; Enter -> its Selling price (pos-line.js).
   Selling price + Enter -> discount % and Rs work themselves out -> cursor goes to Generate Bill.
   Selling price empty + Enter (same price, no change) -> cursor jumps to Discount Rs.
   Discount Rs or % + Enter -> Generate Bill. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var host = $('itemRows'), sp = $('sellPrice'); if (!host || !sp) return;
  var timer = null;
  function toSell() {
    var a = document.activeElement, ok = !a || a === document.body || a.id === 'scanBox' || (a.classList && a.classList.contains('i-name'));
    if (!ok) return;
    var named = Array.prototype.filter.call(host.querySelectorAll('.item-row'), function (r) { return r.dataset.itemCode; });
    var last = named[named.length - 1], q = last && last.querySelector('.i-qty');     // AJ: item code, then quantity, Enter, then Selling
    if (q) { q.focus(); if (q.select) q.select(); }
  }
  new MutationObserver(function (m) {
    var picked = m.some(function (x) { return (x.type === 'attributes' && x.attributeName === 'data-item-code' && x.target.dataset.itemCode) || (x.type === 'childList' && x.addedNodes.length && Array.prototype.some.call(x.addedNodes, function (n) { return n.dataset && n.dataset.itemCode; })); });
    if (!picked) return; clearTimeout(timer); timer = setTimeout(toSell, 40);
  }).observe(host, { childList: true, attributes: true, attributeFilter: ['data-item-code'], subtree: true });

  function go(el) { if (el) { el.focus(); if (el.select) el.select(); } }
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return; var t = e.target; if (!t || !t.id) return;
    if (t.id === 'sellPrice') {
      e.preventDefault(); e.stopImmediatePropagation();
      if (String(t.value).trim() === '') { go($('discountAmt')); return; }   // same price: jump to the Rs discount box
      t.dispatchEvent(new Event('input', { bubbles: true }));
      setTimeout(function () { go($('genBtn')); }, 60);
    } else if (t.id === 'discountAmt' || t.id === 'discountPct') {
      e.preventDefault(); e.stopImmediatePropagation(); t.dispatchEvent(new Event('change', { bubbles: true })); setTimeout(function () { go($('genBtn')); }, 60);
    }
  }, true);
})();
