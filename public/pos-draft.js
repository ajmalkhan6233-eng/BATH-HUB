/* pos-draft.js (16 Nov audit): the POS cart survives a refresh or a closed window. Saves the unsaved bill on this device, puts it back on open,
   forgets it when the screen is cleared or the bill is generated. Own module: touches nothing else. Any failure is ignored. */
(function () {
  var K = 'pos_draft_v1', t = null;
  function g(id) { var e = document.getElementById(id); return e ? e.value : ''; }
  function snap() {
    try {
      var rows = cartRows().filter(function (r) { return r.name; });
      if (!rows.length) { localStorage.removeItem(K); return; }
      localStorage.setItem(K, JSON.stringify({ at: Date.now(), rows: cartRows(), c: g('customerName'), p: g('customerPhone'), d: g('discountPct'), m: g('paymentMethod') }));
    } catch (e) { /* ignore */ }
  }
  function later() { clearTimeout(t); t = setTimeout(snap, 800); }
  function restore() {
    try {
      var s = JSON.parse(localStorage.getItem(K) || 'null');
      if (!s || Date.now() - s.at > 12 * 3600 * 1000) { localStorage.removeItem(K); return; }
      if (cartRows().some(function (r) { return r.name; })) return;
      setCartRows(s.rows);
      var set = function (id, v) { var e = document.getElementById(id); if (e && v != null) e.value = v; };
      set('customerName', s.c); set('customerPhone', s.p); set('discountPct', s.d); set('paymentMethod', s.m);
      if (typeof payModeChanged === 'function') payModeChanged();
      if (typeof updateCapHint === 'function') updateCapHint();
      if (typeof scanMsg === 'function') scanMsg('Your unsaved bill was put back.', 'ok');
    } catch (e) { /* ignore */ }
  }
  try {
    var rf = window.resetForm; if (typeof rf === 'function') window.resetForm = function () { var r = rf.apply(this, arguments); try { localStorage.removeItem(K); } catch (e) {} return r; };
    document.addEventListener('input', later, true); document.addEventListener('change', later, true);
    window.addEventListener('pagehide', snap); document.addEventListener('visibilitychange', function () { if (document.hidden) snap(); });
    setTimeout(restore, 600);
  } catch (e) { /* ignore */ }
})();
