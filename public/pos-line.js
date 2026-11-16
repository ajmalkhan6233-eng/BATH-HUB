/* POS item line (AJ 16 Nov): Item | Qty | Base | Selling | Discount (Rs or %) | Total.
   Own module: wraps the page, changes none of its functions. Remove the 2 tags and the page works as before.
   - Base = what the item cost us, light grey, tap the word "Base" in the header to blur it when a customer is looking.
   - Discount: 500 = Rs 500 off, 10% = ten percent off. The line Total works itself out. Line discounts still feed the bill discount.
   - Enter walks: item -> Qty -> Selling -> Discount -> next line. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var host = $('itemRows'); if (!host) return;
  var rows = function () { return Array.prototype.slice.call(host.querySelectorAll('.item-row')); };
  var cost = {};                                   // item code -> cost, learned when an item is picked
  var num = function (v) { var n = parseFloat(v); return isFinite(n) ? n : 0; };
  var money = function (n) { return n ? Number(n).toLocaleString('en-LK', { maximumFractionDigits: 2 }) : ''; };

  if (window.PosPicker && PosPicker.fill) {
    var f0 = PosPicker.fill;
    PosPicker.fill = function (item) { try { if (item && item.item_code != null) cost[String(item.item_code)] = Number(item.avg_cost || 0); } catch (e) { /* ignore */ } return f0.apply(this, arguments); };
  }

  function gross(row) { return num(row.querySelector('.i-qty').value) * num(row.querySelector('.i-price').value); }
  function cash(row) {                              // the discount of one line in rupees
    var d = row.querySelector('.i-disc'); if (!d) return 0;
    var t = String(d.value).trim(), g = gross(row), v;
    if (/%\s*$/.test(t)) v = g * num(t) / 100; else v = num(t);
    return Math.min(Math.max(0, v), g);
  }
  function refresh(row) {
    var b = row.querySelector('.i-base'), l = row.querySelector('.i-line'), code = row.dataset.itemCode;
    var bv = code && cost[code] ? money(cost[code]) : '', lv = gross(row) ? money(Math.round((gross(row) - cash(row)) * 100) / 100) : '';
    if (b && b.value !== bv) b.value = bv;                    // only when changed: writing the same text again would wake the observer forever
    if (l && l.textContent !== lv) l.textContent = lv;
  }
  window.PosLine = { cash: cash, refresh: refresh };

  function heads() {
    var h = document.querySelector('.item-head'); if (!h) return;
    h.textContent = '';
    ['Item', 'Qty', 'Base', 'Selling', 'Disc Rs or %', 'Total', ''].forEach(function (t, i) {
      var s = document.createElement('span'); s.textContent = t; if (i === 2) { s.className = 'h-base'; s.title = 'Tap to blur or show'; s.style.cursor = 'pointer'; } h.appendChild(s);
    });
  }
  function decorate(row) {
    if (row.dataset.lined) return; var disc = row.querySelector('.i-disc'), price = row.querySelector('.i-price'), rm = row.querySelector('.remove-btn');
    if (!disc || !price) return; row.dataset.lined = '1';
    var b = document.createElement('input'); b.className = 'i-base'; b.readOnly = true; b.tabIndex = -1; b.placeholder = ''; b.setAttribute('aria-label', 'Base price');
    row.insertBefore(b, price);
    disc.type = 'text'; disc.setAttribute('inputmode', 'decimal'); disc.placeholder = '0 or 10%'; disc.removeAttribute('min');
    var l = document.createElement('div'); l.className = 'i-line'; row.insertBefore(l, rm);
    refresh(row);
  }
  function all() { if (!document.querySelector('.item-head .h-base')) heads(); rows().forEach(decorate); rows().forEach(refresh); }
  all();
  new MutationObserver(function (m) { all(); }).observe(host, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-item-code'] });
  host.addEventListener('change', function () { rows().forEach(refresh); });
  var hd = document.querySelector('.item-head'); if (hd) hd.addEventListener('click', function (e) { if (e.target.className === 'h-base') host.classList.toggle('hide-base'); });

  // any change in a line: its Total, and a % discount follows the new price
  host.addEventListener('input', function (e) {
    var t = e.target, row = t.closest && t.closest('.item-row'); if (!row) return;
    refresh(row);
    if ((t.classList.contains('i-qty') || t.classList.contains('i-price')) && /%/.test(row.querySelector('.i-disc').value)) row.querySelector('.i-disc').dispatchEvent(new Event('input', { bubbles: true }));
  }, true);

  // Enter walks across the line
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return; var t = e.target; if (!t || !t.classList) return; var row = t.closest('.item-row'); if (!row) return;
    var go = null;
    if (t.classList.contains('i-qty')) go = row.querySelector('.i-price');
    else if (t.classList.contains('i-price')) go = row.querySelector('.i-disc');
    else if (t.classList.contains('i-disc')) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (!row.querySelector('.i-name').value.trim()) return;
      var rs = rows(); if (rs[rs.length - 1] === row && typeof window.addItemRow === 'function') window.addItemRow();
      var n = rows(), nx = n[n.indexOf(row) + 1]; if (nx) nx.querySelector('.i-name').focus(); return;
    }
    if (go) { e.preventDefault(); e.stopImmediatePropagation(); go.focus(); if (go.select) go.select(); }
  }, true);
})();
