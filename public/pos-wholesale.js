/* POS wholesale bill (AJ 16 Nov). Bill tools -> "Wholesale bill". Own module: remove the tag and the button does nothing.
   On: the bill is for a shop. The Selling price of every line is typed freely (wholesale price differs from the marked price), the bill is numbered RBH-HS001, RBH-HS002 ...
   It switches itself off when the form is cleared for the next bill (Back), so the next one is a normal bill. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var btn = $('wholesaleBtn'), on = false; if (!btn) return;
  function tag() {
    btn.textContent = 'Wholesale bill: ' + (on ? 'ON' : 'off'); btn.style.fontWeight = on ? '700' : ''; btn.style.color = on ? '#8a6d2f' : '';
    var h = document.querySelector('.pos-h1'), g = $('genBtn'), tabs = $('pqTabs'), c = $('wsChip');
    if (h && h.firstChild && !/Quotation/.test(h.firstChild.textContent || '')) h.firstChild.textContent = on ? 'Wholesale Bill ' : 'Generate Bill ';
    if (g) { if (!g.dataset.retail) g.dataset.retail = g.textContent; if (!/Quotation/.test(g.textContent)) g.textContent = on ? 'Generate Wholesale Bill' : g.dataset.retail; }
    if (tabs && !c) { c = document.createElement('span'); c.id = 'wsChip'; c.style.cssText = 'margin-left:8px;font-size:12px;font-weight:700;padding:3px 10px;border-radius:999px;background:#c9a24a;color:#fff;align-self:center'; c.textContent = 'WHOLESALE'; tabs.appendChild(c); }
    if (c) c.style.display = on ? '' : 'none';
  }
  btn.addEventListener('click', function () { on = !on; tag(); var m = $('toolMenu'); try { if (m && m.classList.contains('open')) { var tb = $('toolsBtn'); if (tb) tb.click(); } } catch (e) { /* ignore */ } });
  var rf = window.resetForm; if (typeof rf === 'function') window.resetForm = function () { var r = rf.apply(this, arguments); on = false; try { tag(); } catch (e) { /* ignore */ } return r; };
  window.PosWholesale = { on: function () { return on; } };
  tag();
})();
