/* pos-billstab.js (AJ 27 Nov): "All bills" tab inside the POS. Pick a date, recall any bill (view, download, edit, cancel) without leaving the POS.
   Own module: remove the script tag and nothing else changes. Shows the existing /all-bills.html inside this screen. */
(function () {
  'use strict';
  var tabs = document.querySelector('.doc-tabs'), bill = document.getElementById('billTab'); if (!tabs || !bill) return;
  var t = document.createElement('button'); t.className = 'tab'; t.id = 'allBillsTab'; t.type = 'button'; t.textContent = 'All bills'; bill.parentNode.insertBefore(t, document.getElementById('quotationTab').nextSibling);
  var box = null;
  function open() {
    if (box) return; box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:0;right:0;bottom:0;top:96px;background:#fff;z-index:9000;display:flex;flex-direction:column;border-top:3px solid #C9A24B';
    box.innerHTML = '<div style="padding:6px 10px;display:flex;gap:8px;align-items:center;background:#f6efdc"><b>All bills</b><span style="flex:1;font-size:12px;color:#555">Pick the date inside, tap a bill to view, download, edit or cancel.</span><button type="button" id="abBack" style="padding:7px 14px;border:0;border-radius:6px;background:#222;color:#fff;font-weight:700">Back to POS</button></div><iframe src="/all-bills.html" title="All bills" style="flex:1;border:0;width:100%"></iframe>';
    document.body.appendChild(box); document.getElementById('abBack').onclick = close; t.classList.add('active'); bill.classList.remove('active');
  }
  function close() { if (box && box.parentNode) box.parentNode.removeChild(box); box = null; t.classList.remove('active'); bill.classList.add('active'); }
  t.onclick = open; bill.addEventListener('click', close);
})();
