/* POS item line (AJ 16 Nov): Item | Qty | Selling | Discount (Rs or %) | Total.
   Own module: wraps the page, changes none of its functions. Remove the 2 tags and the page works as before.
   - No Base column any more (AJ). Cost is still learned silently for the Profit line (pos-profit.js).
   - Selling = the price he agrees. Type 1550 on a 2000 item: the Discount fills itself (450 x qty) and Total follows. Typing a Discount moves Selling back.
   - Discount: 500 = Rs 500 off, 10% = ten percent off. The line Total works itself out. Line discounts still feed the bill discount.
   - Enter walks: item -> Qty -> Selling -> next line. */
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
  var r2 = function (n) { return Math.round(n * 100) / 100; };
  function refresh(row) {
    var l = row.querySelector('.i-line'), sell = row.querySelector('.i-sell'), pe = row.querySelector('.i-price'), p = num(pe && pe.value);
    if (p && p !== num(row.dataset.priceSet)) { row.dataset.list = p; row.dataset.priceSet = p; delete row.dataset.sell; }   // a new price came from the picker: that is the list price
    var q = num(row.querySelector('.i-qty').value), g = gross(row);
    var lv = g ? money(r2(g - cash(row))) : '';
    if (l && l.textContent !== lv) l.textContent = lv;     // only when changed: writing the same text again would wake the observer forever
    if (sell && document.activeElement !== sell) { var sv = g && q ? String(r2((g - cash(row)) / q)) : ''; if (sell.value !== sv) sell.value = sv; }
  }
  window.PosLine = { cash: cash, refresh: refresh, cost: cost };

  function heads() {
    var h = document.querySelector('.item-head'); if (!h) return;
    h.textContent = '';
    ['Item', 'Qty', 'Selling', 'Disc Rs or %', 'Total', ''].forEach(function (t, i) {
      var s = document.createElement('span'); s.textContent = t; if (i === 2) s.className = 'h-sell'; h.appendChild(s);
    });
  }
  function decorate(row) {
    if (row.dataset.lined) return; var disc = row.querySelector('.i-disc'), price = row.querySelector('.i-price'), rm = row.querySelector('.remove-btn');
    if (!disc || !price) return; row.dataset.lined = '1';
    var b = document.createElement('input'); b.className = 'i-sell'; b.type = 'number'; b.step = 'any'; b.min = '0'; b.placeholder = 'Selling'; b.setAttribute('inputmode', 'decimal'); b.setAttribute('aria-label', 'Selling price'); b.onfocus = function () { this.select(); };
    row.insertBefore(b, price);
    disc.type = 'text'; disc.setAttribute('inputmode', 'decimal'); disc.placeholder = '0 or 10%'; disc.removeAttribute('min');
    var l = document.createElement('div'); l.className = 'i-line'; row.insertBefore(l, rm);
    refresh(row);
  }
  function all() { if (!document.querySelector('.item-head .h-sell')) heads(); rows().forEach(decorate); rows().forEach(refresh); }
  all();
  new MutationObserver(function (m) { all(); }).observe(host, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-item-code'] });
  host.addEventListener('change', function () { rows().forEach(refresh); });

  function fire(el) { el.dispatchEvent(new Event('input', { bubbles: true })); }
  function setDisc(row, perUnit) { var d = row.querySelector('.i-disc'), q = num(row.querySelector('.i-qty').value) || 1, v = perUnit > 0 ? String(r2(perUnit * q)) : ''; if (d.value !== v) { d.value = v; fire(d); } }
  function sellTyped(row, el) {                      // he types the agreed price: the discount works itself out
    var s = num(el.value), L = num(row.dataset.list), pe = row.querySelector('.i-price');
    if (el.value === '') return;
    if (L && s < L) { pe.value = L; row.dataset.priceSet = L; row.dataset.sell = s; fire(pe); setDisc(row, L - s); }
    else { pe.value = s; row.dataset.priceSet = s; row.dataset.list = s; delete row.dataset.sell; fire(pe); setDisc(row, 0); }
    var l = row.querySelector('.i-line'); refresh(row);
  }
  // any change in a line: its Total, and a % discount follows the new price
  host.addEventListener('input', function (e) {
    var t = e.target, row = t.closest && t.closest('.item-row'); if (!row) return;
    if (t.classList.contains('i-sell')) { sellTyped(row, t); return; }
    if (t.classList.contains('i-qty') && row.dataset.sell != null && row.dataset.sell !== '') setDisc(row, num(row.dataset.list) - num(row.dataset.sell));
    if (t.classList.contains('i-disc')) delete row.dataset.sell;
    refresh(row);
    if ((t.classList.contains('i-qty') || t.classList.contains('i-price')) && /%/.test(row.querySelector('.i-disc').value)) row.querySelector('.i-disc').dispatchEvent(new Event('input', { bubbles: true }));
  }, true);

  // Enter walks across the line
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return; var t = e.target; if (!t || !t.classList) return; var row = t.closest('.item-row'); if (!row) return;
    var go = null;
    if (t.classList.contains('i-qty')) go = row.querySelector('.i-sell');
    else if (t.classList.contains('i-sell') || t.classList.contains('i-disc')) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (!row.querySelector('.i-name').value.trim()) return;
      var rs = rows(); if (rs[rs.length - 1] === row && typeof window.addItemRow === 'function') window.addItemRow();
      var n = rows(), nx = n[n.indexOf(row) + 1]; if (nx) nx.querySelector('.i-name').focus(); return;
    }
    if (go) { e.preventDefault(); e.stopImmediatePropagation(); go.focus(); if (go.select) go.select(); }
  }, true);
})();
