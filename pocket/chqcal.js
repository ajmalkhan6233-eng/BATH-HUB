/* RBH Pocket: CHEQUE CALENDAR (module). Same idea as the PC Cheque Calendar: a month grid, the cheque total on each due day,
   gold = waiting, green = cleared, red = bounced. Pinch (or the + / - buttons) zooms: 3 months small <-> 1 month big. Tap a day for its cheques.
   Read-only: it only draws the list the shop PC already sent (s.chq_cal). */
(function () {
  'use strict';
  if (typeof window === 'undefined' || !window.RBHP) return;
  var P = window.RBHP, el = P.el, rs = P.rs;
  var MN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], DWL = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  var Z = 2, base = null, pick = null;           // Z: 1 = 3 months small, 2 = 1 month, 3 = 1 month big
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var key = function (y, m, d) { return y + '-' + pad(m + 1) + '-' + pad(d); };
  function sum(a) { return a.reduce(function (t, c) { return t + (c.amount || 0); }, 0); }
  function short(v) { return v >= 1e6 ? (Math.round(v / 1e5) / 10) + 'M' : v >= 1000 ? (Math.round(v / 100) / 10) + 'K' : String(Math.round(v)); }
  function nice(k, today) { return window.RBHD.full(k, today); }   // "Fri 25 Dec 2026 · in 32 days" (dates.js)
  function setZ(v, s, box) { Z = Math.max(1, Math.min(3, v)); P.redraw(); }

  function draw(s, box, today) {
    var all = s.chq_cal;
    if (!all) { var f = P.card('Cheque calendar'); f.appendChild(el('div', 'note', 'Update the shop PC app, then refresh: the calendar needs the new cheque list.')); box.appendChild(f); return; }
    if (!base) base = new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, 1));
    var by = {}; all.forEach(function (c) { if (c.due) (by[c.due] = by[c.due] || []).push(c); });
    var n = Z === 1 ? 3 : 1;
    var wait = all.filter(function (c) { return c.st === 'W'; }), clr = all.filter(function (c) { return c.st === 'C'; }), bnc = all.filter(function (c) { return c.st === 'B'; });
    // top: totals + zoom + month moves
    var top = P.card('Cheque calendar', P.pill(wait.length + ' waiting', wait.length ? 'amber' : 'ok'));
    var sm = el('div', 'cc-sum');
    [['Waiting', sum(wait), 'cc-w'], ['Cleared (60 d)', sum(clr), 'cc-c'], ['Bounced', sum(bnc), 'cc-b']].forEach(function (a) { var d = el('div', 'cc-s ' + a[2]); d.appendChild(el('b', null, rs(a[1]))); d.appendChild(el('span', null, a[0])); sm.appendChild(d); });
    top.appendChild(sm);
    var bar = el('div', 'cc-bar');
    function btn(t, fn, lab) { var b = el('button', 'cc-btn', t); b.setAttribute('aria-label', lab || t); b.addEventListener('click', fn); bar.appendChild(b); return b; }
    btn('◀', function () { base = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - n, 1)); pick = null; P.redraw(); }, 'Earlier');
    btn('Today', function () { base = new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, 1)); pick = null; P.redraw(); });
    btn('▶', function () { base = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + n, 1)); pick = null; P.redraw(); }, 'Later');
    bar.appendChild(el('span', 'cc-gap'));
    btn('−', function () { setZ(Z - 1); }, 'Zoom out').disabled = Z <= 1;
    btn('+', function () { setZ(Z + 1); }, 'Zoom in').disabled = Z >= 3;
    top.appendChild(bar);
    top.appendChild(el('div', 'cc-key', 'Gold = waiting · Green = cleared · Red = bounced · Pinch or + / − to zoom. Tap a day.'));
    box.appendChild(top);
    // months
    var wrap = el('div', 'cc-wrap z' + Z);
    for (var i = 0; i < n; i++) {
      var d0 = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + i, 1)), y = d0.getUTCFullYear(), m = d0.getUTCMonth(), days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(), lead = d0.getUTCDay();
      var mTot = 0, mCnt = 0; for (var q = 1; q <= days; q++) (by[key(y, m, q)] || []).forEach(function (c) { if (c.st === 'W') { mTot += c.amount; mCnt++; } });
      var mm = el('div', 'cc-m'), mh = el('div', 'cc-mh'); mh.appendChild(el('span', 'cc-mt', MN[m] + ' ' + y)); mh.appendChild(el('span', 'cc-mw', mCnt ? 'Waiting ' + rs(mTot) : 'Nothing waiting'));
      mm.appendChild(mh);
      var g = el('div', 'cc-g'); DW.forEach(function (w, k) { g.appendChild(el('div', 'cc-dow', Z === 1 ? DWL[k] : w)); });
      for (var b = 0; b < lead; b++) g.appendChild(el('div', 'cc-d out'));
      for (var dd = 1; dd <= days; dd++) {
        var k2 = key(y, m, dd), L = by[k2] || [], cls = 'cc-d';
        if (L.length) cls += L.some(function (c) { return c.st === 'B'; }) ? ' bnc' : L.some(function (c) { return c.st === 'W'; }) ? ' due' : ' clr';
        if (k2 === today) cls += ' today'; if (k2 === pick) cls += ' sel';
        var cell = el('button', cls); cell.appendChild(el('span', 'cc-n', dd));
        if (L.length) cell.appendChild(el('span', 'cc-a', Z === 3 ? rs(sum(L)).replace('Rs ', '') : short(sum(L))));
        (function (kk, LL) { cell.addEventListener('click', function () { if (!LL.length) { pick = null; P.redraw(); return; } pick = kk; P.redraw(); day(kk, LL, today); }); })(k2, L);
        g.appendChild(cell);
      }
      mm.appendChild(g); wrap.appendChild(mm);
    }
    if (Z === 1) wrap.appendChild(el('div', 'cc-note', 'Small numbers are thousands: 120K = Rs 120,000'));
    pinch(wrap); box.appendChild(wrap);
  }
  function day(k, L, today) {
    var rows = L.map(function (c) { return [(c.who || 'Cheque') + (c.ref ? ' · No. ' + c.ref : '') + ' · ' + (c.st === 'C' ? 'cleared' : c.st === 'B' ? 'bounced' : 'waiting'), rs(c.amount), c.st === 'B' ? 'down' : '']; });
    rows.push(['Total', rs(sum(L)), 'up']);
    P.sheet(nice(k, today), rows);
  }
  function pinch(node) {   // two fingers apart = zoom in, together = zoom out (one step per pinch)
    var d0 = 0, done = false;
    function dist(t) { var a = t[0], b = t[1]; return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); }
    node.addEventListener('touchstart', function (e) { if (e.touches.length === 2) { d0 = dist(e.touches); done = false; } }, { passive: true });
    node.addEventListener('touchmove', function (e) {
      if (e.touches.length !== 2 || !d0 || done) return; var r = dist(e.touches) / d0;
      if (r > 1.25 && Z < 3) { done = true; setZ(Z + 1); } else if (r < 0.8 && Z > 1) { done = true; setZ(Z - 1); }
    }, { passive: true });
    node.addEventListener('touchend', function () { d0 = 0; }, { passive: true });
  }
  P.EXTRA.chqcal = function (s, box) { draw(s, box, window.RBHD.today(s)); };
})();
