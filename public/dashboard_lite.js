/* Home, lighter (AJ 16 Nov). Own module, removes nothing: extra cards are only hidden, "More details" brings them back.
   Kept: sales today, daily target, this week, this month, profit, expenses, stock value (cost + selling).
   Also: double-click a bill in any list (Bills today etc.) opens it in POS for editing. */
(function () {
  'use strict';
  var KEEP = /^(sales today|daily target|this week|this month|month profit|profit today|expenses today|stock value)/;
  var showAll = false, busy = false;
  var css = document.createElement('style');
  css.textContent = '#dash-pro .dl-hid{display:none!important}#dash-pro .dp-grid2.dl-hid,#dash-pro .dp-grid3.dl-hid{display:none!important}'
    + '#dl-more{margin:6px 0 10px;padding:6px 14px;border:1px solid var(--gold-primary,#c9a24b);background:transparent;color:inherit;border-radius:999px;font-size:13px;cursor:pointer}';
  document.head.appendChild(css);
  function label(card) { var l = card.querySelector('.dp-lab, h3'); return l ? l.textContent.trim().toLowerCase() : ''; }
  function apply() {
    if (busy) return; busy = true;
    try {
      var root = document.getElementById('dash-pro'); if (!root) return;
      Array.prototype.forEach.call(root.querySelectorAll('.dp-card'), function (c) {
        var t = label(c); if (!t) return;
        c.classList.toggle('dl-hid', !showAll && !KEEP.test(t));
      });
      Array.prototype.forEach.call(root.querySelectorAll('.dp-grid2, .dp-grid3'), function (g) {   // a row with nothing left to show
        g.classList.toggle('dl-hid', !showAll && !g.querySelector('.dp-card:not(.dl-hid)'));
      });
      Array.prototype.forEach.call(root.querySelectorAll('details, .dp-fold'), function (d) { d.classList.toggle('dl-hid', !showAll); });
      var b = document.getElementById('dl-more');
      if (!b) { b = document.createElement('button'); b.id = 'dl-more'; b.type = 'button'; b.onclick = function () { showAll = !showAll; apply(); }; root.parentNode.insertBefore(b, root); }
      b.textContent = showAll ? 'Fewer details' : 'More details';
    } finally { busy = false; }
  }
  var t = null;
  new MutationObserver(function () { clearTimeout(t); t = setTimeout(apply, 120); }).observe(document.body, { childList: true, subtree: true });
  apply();

  // double-click a bill row -> open it in POS, ready to edit
  document.addEventListener('dblclick', function (e) {
    var tr = e.target && e.target.closest && e.target.closest('tr'); if (!tr) return;
    var m = /(?:RBH-(?:S|HS)\d{3,6}|BHT-\d{8}-\d{3,5})/.exec(tr.textContent || ''); if (!m) return;
    e.preventDefault(); openForEdit(m[0]);
  });
  async function openForEdit(no) {
    try {
      var r = await fetch('/api/pos-bills?q=' + encodeURIComponent(no), { credentials: 'same-origin' });
      var rows = r.ok ? await r.json() : []; var b = rows.filter(function (x) { return x.bill_number === no; })[0] || rows[0];
      if (!b) { alert('Could not find bill ' + no); return; }
      var close = document.querySelector('.bd-close, .modal-close, [aria-label="Close"]'); if (close) close.click();
      if (typeof window.navigate === 'function') window.navigate('pos');
      var tries = 0, iv = setInterval(function () {
        var f = document.getElementById('pos-frame'), w = f && f.contentWindow; tries++;
        if (w && typeof w.editBill === 'function' && f.contentDocument && f.contentDocument.readyState === 'complete') { clearInterval(iv); w.editBill(b.id); }
        else if (tries > 60) { clearInterval(iv); alert('POS did not open. Try again.'); }
      }, 150);
    } catch (err) { alert('Could not open the bill.'); }
  }
})();
