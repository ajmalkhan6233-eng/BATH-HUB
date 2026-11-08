/* dashboard_v2.js: makes the owner Home page compact, colourful and alive. Own module: it only restyles and decorates what dashboard_pro.js draws (#dash-pro),
   it changes no numbers. Colour accent per kind of card, numbers count up, bars grow, payments donut, long lists show 5 rows (tap "Show all"),
   rows open the matching screen (vendors owed -> Vendors overview, next cheques -> Cheque register, stock by category -> Stock & items).
   Motion off (localStorage bh_motion=off) = no animation. Plain JS, no libraries. */
(function () {
  'use strict';
  var css = ''
    + '#page-dashboard.dp-on{padding:8px 10px}#dash-pro{margin-bottom:6px;font-size:13px}'
    + '#dash-pro .dp-head{margin-bottom:6px}#dash-pro .dp-title{font-size:18px;background:linear-gradient(90deg,#f5d77a,#c9a24b);-webkit-background-clip:text;background-clip:text;color:transparent}'
    + '#dash-pro .dp-grid{grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:6px;margin-bottom:6px}'
    + '#dash-pro .dp-grid2{grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:6px;margin-bottom:6px}'
    + '#dash-pro .dp-card{padding:6px 10px;border-radius:12px;border-left:4px solid var(--v2c,#c9a24b);background:linear-gradient(135deg,var(--v2g,rgba(201,162,75,.12)),var(--card) 62%);box-shadow:0 1px 0 rgba(255,255,255,.04) inset,0 6px 16px rgba(0,0,0,.14);transition:transform .15s,box-shadow .15s}'
    + '#dash-pro .dp-card:hover{transform:translateY(-2px);box-shadow:0 10px 22px rgba(0,0,0,.24)}'
    + '#dash-pro .dp-val{font-size:22px;color:var(--v2c,inherit)}#dash-pro .dp-lab{font-size:10.5px;color:var(--v2c,var(--text2))}#dash-pro h3{font-size:13px;margin-bottom:3px}'
    + '#dash-pro .dp-note{font-size:11.5px;margin-top:2px}#dash-pro .dp-row{padding:4px 0;font-size:12.5px}'
    + '#dash-pro .v2-m{--v2c:#22c55e;--v2g:rgba(34,197,94,.14)}#dash-pro .v2-p{--v2c:#e0b43c;--v2g:rgba(224,180,60,.16)}#dash-pro .v2-e{--v2c:#ef4444;--v2g:rgba(239,68,68,.13)}'
    + '#dash-pro .v2-s{--v2c:#3b82f6;--v2g:rgba(59,130,246,.14)}#dash-pro .v2-o{--v2c:#a855f7;--v2g:rgba(168,85,247,.14)}#dash-pro .v2-c{--v2c:#14b8a6;--v2g:rgba(20,184,166,.14)}'
    + '#dash-pro .dp-alert{display:inline-flex;width:auto;max-width:100%;padding:5px 10px;margin:0 6px 6px 0;font-size:12.5px;border-radius:99px}'
    + '#dash-pro .v2-link{cursor:pointer}#dash-pro .v2-link:hover{background:rgba(201,162,75,.12);border-radius:6px}#dash-pro .v2-link:after{content:" \\203A";opacity:.5}'
    + '#dash-pro .v2-more{display:block;width:100%;margin-top:2px;padding:3px 0;border:0;background:transparent;color:var(--v2c,var(--gold,#c9a24b));font:700 12px inherit;cursor:pointer}'
    + '#dash-pro .v2-hid{display:none!important}#dash-pro .v2-fold h3{cursor:pointer}#dash-pro .v2-fold h3:after{content:" \\25BE";opacity:.6}#dash-pro .v2-fold.v2-shut h3:after{content:" \\25B8"}#dash-pro .v2-fold.v2-shut>:not(h3){display:none!important}'
    + '#dash-pro .v2-donut{display:flex;align-items:center;gap:10px}#dash-pro .v2-donut svg{width:96px;height:96px;flex:none}#dash-pro .v2-leg{flex:1;font-size:12px}#dash-pro .v2-leg div{display:flex;justify-content:space-between;gap:8px;padding:2px 0}#dash-pro .v2-leg i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px}'
    + 'html:not(.mo-off) #dash-pro svg rect{transform-box:fill-box;transform-origin:bottom;animation:v2grow .8s cubic-bezier(.2,.8,.2,1) both}'
    + 'html:not(.mo-off) #dash-pro .dp-bar>i{animation:v2wide .9s cubic-bezier(.2,.8,.2,1) both}html:not(.mo-off) #dash-pro .v2-donut circle{animation:v2dash 1s ease-out both}'
    + '@keyframes v2grow{from{transform:scaleY(0)}to{transform:scaleY(1)}}@keyframes v2wide{from{width:0!important}}@keyframes v2dash{from{stroke-dasharray:0 999}}';
  var KIND = [
    ['v2-m', /^(sales today|bills today|this week|this month|daily target|stock bought|cash sales|card \+ online|cheques received)/],
    ['v2-p', /(profit|margin)/], ['v2-e', /^(expenses|cancelled)/],
    ['v2-s', /^(stock value|out of stock|items without|not sold|stock by|reorder|top sellers)/],
    ['v2-o', /^(we owe|vendors|cheques pending|customers owe|investor|next cheques|credit given)/],
    ['v2-c', /^(enquiries|open quotations|pieces|average sales|sales by|busy|bank|money in)/]];
  var GO = { 'vendors we owe': 'vendorsum', 'next cheques': 'chequereg', 'stock by category (cost)': 'stockmgr', 'reorder soon': 'helper', 'top sellers this month': 'stockmgr', 'latest grns': 'grn' };
  var FOLD = ['if we sell all stock with a discount', 'latest grns', 'average sales by weekday (8 weeks)'];
  var COLORS = ['#e0b43c', '#22c55e', '#3b82f6', '#a855f7', '#ef4444', '#14b8a6'];
  var box = null, obs = null, last = {};
  var calm = function () { try { return localStorage.getItem('bh_motion') === 'off'; } catch (e) { return false; } };
  var low = function (s) { return String(s || '').trim().toLowerCase(); };

  function count(el, key) {   // "LKR 12,345" or "12": count up from the last shown value (or 0)
    var t = el.textContent, m = /^(LKR )?([\d,]+)$/.exec(t.trim()); if (!m) return;
    var to = parseInt(m[2].replace(/,/g, ''), 10), pre = m[1] || '', from = last[key] != null ? last[key] : 0; last[key] = to;
    if (calm() || from === to || !isFinite(to)) return;
    var t0 = performance.now(), dur = 800;
    (function step(now) { var p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3), v = Math.round(from + (to - from) * e); el.textContent = pre + v.toLocaleString('en-LK'); if (p < 1) requestAnimationFrame(step); else el.textContent = t; })(t0);
  }
  function donut(card) {
    var rows = card.querySelectorAll('.dp-row'), items = [], tot = 0;
    rows.forEach(function (r) { var b = r.querySelector('b'), m = b && /LKR\s*([\d,]+)/.exec(b.textContent); if (m) { var v = parseInt(m[1].replace(/,/g, ''), 10); items.push([r.querySelector('span').textContent, v]); tot += v; } });
    if (!tot) return;
    var R = 15.9, off = 0, svg = '<svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="' + R + '" fill="none" stroke="rgba(127,127,127,.2)" stroke-width="5"/>', leg = '';
    items.forEach(function (it, i) { var p = it[1] / tot * 100, c = COLORS[i % COLORS.length]; svg += '<circle cx="18" cy="18" r="' + R + '" fill="none" stroke="' + c + '" stroke-width="5" stroke-dasharray="' + p.toFixed(2) + ' ' + (100 - p).toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '" transform="rotate(-90 18 18)"/>'; off += p; leg += '<div><span><i style="background:' + c + '"></i>' + it[0] + '</span><b>' + Math.round(p) + '%</b></div>'; });
    var w = document.createElement('div'); w.className = 'v2-donut'; w.innerHTML = svg + '</svg><div class="v2-leg">' + leg + '</div>';
    rows.forEach(function (r) { r.remove(); }); card.appendChild(w);
  }
  function decorate() {
    if (!box) return;
    obs.disconnect();
    try {
      box.querySelectorAll('.dp-card').forEach(function (c) {
        var lab = c.querySelector('.dp-lab'), h3 = c.querySelector('h3'), name = low((lab || h3 || {}).textContent);
        if (c.dataset.v2) return; c.dataset.v2 = '1';
        for (var i = 0; i < KIND.length; i++) if (KIND[i][1].test(name)) { c.classList.add(KIND[i][0]); break; }
        var val = c.querySelector('.dp-val'); if (val) count(val, name);
        if (h3) {
          if (name === 'how customers paid today') donut(c);
          if (FOLD.indexOf(name) > -1) { c.classList.add('v2-fold', 'v2-shut'); h3.onclick = function () { c.classList.toggle('v2-shut'); }; }
          var rows = c.querySelectorAll('.dp-row'), go = GO[name];
          if (go) rows.forEach(function (r) { r.classList.add('v2-link'); r.dataset.go2 = go; });
          if (rows.length > 5 && !c.classList.contains('v2-fold')) {
            var extra = [].slice.call(rows, 5); extra.forEach(function (r) { r.classList.add('v2-hid'); });
            var b = document.createElement('button'); b.type = 'button'; b.className = 'v2-more'; b.textContent = 'Show all ' + rows.length;
            b.onclick = function () { var shut = !extra[0].classList.contains('v2-hid'); extra.forEach(function (r) { r.classList.toggle('v2-hid', shut); }); b.textContent = shut ? 'Show all ' + rows.length : 'Show fewer'; };
            c.appendChild(b);
          }
        }
      });
    } catch (e) { console.error('[dashboard_v2]', e); }
    obs.observe(box, { childList: true });
  }
  function go(e) {
    var r = e.target.closest && e.target.closest('#dash-pro .v2-link'); if (!r) return;
    e.stopPropagation(); e.preventDefault();
    try { if (window.rbhGo) window.rbhGo(r.dataset.go2); else if (window.navigate) window.navigate(r.dataset.go2); } catch (x) { /* ignore */ }
  }
  function start() {
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    document.addEventListener('click', go, true);
    var tries = 0, t = setInterval(function () {
      box = document.getElementById('dash-pro');
      if (box) { clearInterval(t); obs = new MutationObserver(function () { decorate(); }); obs.observe(box, { childList: true }); decorate(); }
      else if (++tries > 120) clearInterval(t);
    }, 500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
