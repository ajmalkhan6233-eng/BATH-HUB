/* RBH Pocket navigation module (isolated). Touches no shop data and none of app.js's logic: it only watches the page.
   1) Left slide menu: swipe right (or tap the menu button) and every section is there. Finger-tracked, velocity release, catchable mid-slide.
   2) Back button / swipe-back: closes menu, then the sheet, then returns to Home.
   3) Sheet: grab handle + swipe down to close. 4) Each tab remembers its scroll spot. 5) Loading shimmer. */
(function () {
  if (typeof document === 'undefined') return;
  var $ = function (id) { return document.getElementById(id); };
  var app = $('app'), sheet = $('sheet'), cards = $('cards');
  var scrollAt = {}, pushed = 0, drawerPushed = false, sheetPushed = false;
  var cur = function () { var b = document.querySelector('#tabs [aria-current="page"]'); return b ? b.getAttribute('aria-label') : 'Home'; };
  var tabBtn = function (name) { var all = document.querySelectorAll('#tabs .tab'); for (var i = 0; i < all.length; i++) if (all[i].getAttribute('aria-label') === name) return all[i]; return null; };
  var svgOf = function (node) { var s = node && node.querySelector('svg'); return s ? s.outerHTML : ''; };

  // ---------- left slide menu
  var drawer = document.createElement('div'); drawer.className = 'drawer'; drawer.setAttribute('aria-hidden', 'true');
  drawer.innerHTML = '<div class="dscrim"></div><div class="dpanel" role="dialog" aria-modal="true" aria-label="Menu"><div class="dhead"><b><span>RBH</span> Pocket</b><small id="dwhen"></small></div><div class="dlist" id="dlist"></div></div>';
  document.body.appendChild(drawer);
  var dpanel = drawer.querySelector('.dpanel'), dscrim = drawer.querySelector('.dscrim'), W = 300, MAXA = .62, isOpen = false;

  function build() {
    var L = $('dlist'); L.textContent = ''; var now = cur();
    var t = document.querySelectorAll('#tabs .tab');
    function item(label, svg, on, fn) {
      var b = document.createElement('button'); b.className = 'ditem' + (on ? ' on' : ''); b.innerHTML = svg; var s = document.createElement('span'); s.textContent = label; b.appendChild(s);
      b.addEventListener('click', function () { close(); setTimeout(fn, 60); }); L.appendChild(b);
    }
    for (var i = 0; i < t.length; i++) (function (tb) { var n = tb.getAttribute('aria-label'); item(n, svgOf(tb), n === now, function () { tb.click(); }); })(t[i]);
    var sep = document.createElement('div'); sep.className = 'dsep'; L.appendChild(sep);
    if ($('refresh')) item('Refresh now', svgOf($('refresh')), false, function () { $('refresh').click(); });
    if ($('lock')) item('Lock app', svgOf($('lock')), false, function () { $('lock').click(); });
    $('dwhen').textContent = ($('when') && $('when').textContent) || '';
  }
  function x() { var m = getComputedStyle(dpanel).transform; if (!m || m === 'none') return -W; try { return new DOMMatrix(m).m41; } catch (e) { return -W; } }
  function paint(p) { dpanel.style.transform = 'translateX(' + ((p - 1) * W) + 'px)'; dscrim.style.opacity = String(MAXA * p); }
  function settle(open) {
    drawer.classList.add('settle'); drawer.classList.remove('drag'); drawer.classList.toggle('open', open); drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
    paint(open ? 1 : 0); isOpen = open;
    if (open && !drawerPushed) { try { history.pushState({ rbh: 3 }, ''); drawerPushed = true; } catch (e) {} }
    if (!open && drawerPushed) { drawerPushed = false; if (history.state && history.state.rbh === 3) { try { history.back(); } catch (e) {} } }
  }
  function open() { W = dpanel.offsetWidth || 300; build(); settle(true); }
  function close() { settle(false); }
  dscrim.addEventListener('click', close);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && isOpen) close(); });

  // menu button in the header (sits left of the title)
  var head = document.querySelector('#app header');
  if (head) {
    var first = head.firstElementChild, wrap = document.createElement('div'); wrap.className = 'hdl';
    var mb = document.createElement('button'); mb.className = 'menubtn'; mb.id = 'menu'; mb.setAttribute('aria-label', 'Menu');
    mb.innerHTML = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h10"/></svg>';
    mb.addEventListener('click', open); head.insertBefore(wrap, first); wrap.appendChild(mb); wrap.appendChild(first);
  }

  // swipe right anywhere to open, swipe left to close. Finger = panel, 1:1. Release: distance OR flick.
  var g = null;
  document.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1 || !app || app.hidden || (sheet && !sheet.hidden)) { g = null; return; }
    W = dpanel.offsetWidth || 300; var t = e.touches[0];
    g = { x0: t.clientX, y0: t.clientY, t0: Date.now(), on: false, base: 0, lx: t.clientX, lt: Date.now(), v: 0 };
    if (drawer.classList.contains('settle') && (isOpen || x() > -W + 2)) { g.base = (x() + W) / W; }   // caught mid-slide
    else g.base = isOpen ? 1 : 0;
  }, { passive: true });
  document.addEventListener('touchmove', function (e) {
    if (!g) return; var t = e.touches[0], dx = t.clientX - g.x0, dy = t.clientY - g.y0;
    if (!g.on) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { g = null; return; }              // it is a scroll
      if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      if ((g.base < .02 && dx < 0) || (g.base > .98 && dx > 0)) { g = null; return; }           // nothing to do that way
      g.on = true; drawer.classList.remove('settle'); drawer.classList.add('drag'); if (g.base < .02) build();
    }
    e.preventDefault();
    var now = Date.now(); if (now > g.lt) g.v = (t.clientX - g.lx) / (now - g.lt); g.lx = t.clientX; g.lt = now;
    paint(Math.max(0, Math.min(1, g.base + dx / W)));
  }, { passive: false });
  document.addEventListener('touchend', function () {
    if (!g || !g.on) { g = null; return; }
    var p = (x() + W) / W, v = g.v; g = null;
    settle(v > .45 ? true : v < -.45 ? false : p > .5);
  });
  document.addEventListener('touchcancel', function () { if (g && g.on) settle(isOpen); g = null; });

  // ---------- tabs: remember scroll per tab, Back returns to Home
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('#tabs .tab'); if (!b) return;
    var from = cur(), to = b.getAttribute('aria-label'); if (from === to) return;
    scrollAt[from] = window.pageYOffset;
    if (to !== 'Home' && !pushed) { try { history.pushState({ rbh: 1 }, ''); pushed = 1; } catch (x) {} }
    var y = scrollAt[to] || 0;
    if (y) requestAnimationFrame(function () { requestAnimationFrame(function () { window.scrollTo(0, y); }); });
  }, true);

  // ---------- sheet: Back closes it first
  if (sheet && window.MutationObserver) {
    new MutationObserver(function () {
      if (!sheet.hidden && !sheetPushed) { try { history.pushState({ rbh: 2 }, ''); sheetPushed = true; } catch (x) {} }
      if (sheet.hidden && sheetPushed) { sheetPushed = false; if (history.state && history.state.rbh === 2) { try { history.back(); } catch (x) {} } }
    }).observe(sheet, { attributes: true, attributeFilter: ['hidden'] });
  }
  window.addEventListener('popstate', function () {
    if (isOpen) { drawerPushed = false; settle(false); return; }
    if (sheet && !sheet.hidden) { sheetPushed = false; $('sheetX').click(); return; }
    if (cur() !== 'Home') { pushed = 0; var h = tabBtn('Home'); if (h) h.click(); } else pushed = 0;
  });

  // ---------- sheet: grab handle + swipe down (finger-tracked)
  var panel = sheet && sheet.querySelector('.panel');
  if (panel) {
    var gb = document.createElement('div'); gb.className = 'grab'; gb.setAttribute('aria-hidden', 'true'); panel.insertBefore(gb, panel.firstChild);
    var y0 = null, dy = 0, sv = 0, ly = 0, lt = 0;
    panel.addEventListener('touchstart', function (e) { if (panel.scrollTop <= 0) { y0 = e.touches[0].clientY; ly = y0; lt = Date.now(); dy = 0; sv = 0; panel.style.animation = 'none'; panel.style.transition = 'none'; } else y0 = null; }, { passive: true });
    panel.addEventListener('touchmove', function (e) { if (y0 == null) return; var y = e.touches[0].clientY, n = Date.now(); dy = Math.max(0, y - y0); if (n > lt) sv = (y - ly) / (n - lt); ly = y; lt = n; panel.style.transform = 'translateY(' + dy + 'px)'; }, { passive: true });
    panel.addEventListener('touchend', function () {
      if (y0 == null) return; y0 = null; panel.style.transition = ''; panel.style.transform = '';
      if (dy > 90 || sv > .5) $('sheetX').click(); else panel.style.animation = '';
    });
  }

  // ---------- loading shimmer while the cards are empty
  if (cards && window.MutationObserver) {
    new MutationObserver(function () {
      if (cards.childNodes.length === 0 && app && !app.hidden) {
        for (var i = 0; i < 3; i++) { var s = document.createElement('div'); s.className = 'card sk'; s.setAttribute('aria-hidden', 'true'); cards.appendChild(s); }
      } else if (cards.querySelector('.sk') && cards.querySelector(':scope > :not(.sk)')) {
        cards.querySelectorAll('.sk').forEach(function (n) { n.remove(); });
      }
    }).observe(cards, { childList: true });
  }
})();
