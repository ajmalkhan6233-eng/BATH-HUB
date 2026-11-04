/* MOTION layer JS: tab ink, tab content slide, button ripple, card tilt + shine, gold burst. Loaded in the shell and in every screen frame. */
(function () {
  'use strict';
  var doc = document, win = window;
  if (win.__bhMotion) return; win.__bhMotion = 1;
  try { if (localStorage.getItem('bh_motion') === 'off') { doc.documentElement.classList.add('mo-off'); return; } } catch (e) { /* ignore */ }
  if (win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var fine = win.matchMedia && win.matchMedia('(pointer:fine)').matches;

  /* 1 ripple on buttons and menu items */
  doc.addEventListener('pointerdown', function (e) {
    var t = e.target.closest && e.target.closest('button,.nav-item,.mb-item,.dr .t,[role=button]'); if (!t || t.disabled) return;
    var r = t.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2, s = doc.createElement('span');
    s.className = 'mo-rp'; s.style.cssText = 'width:' + d + 'px;height:' + d + 'px;left:' + (e.clientX - r.left - d / 2) + 'px;top:' + (e.clientY - r.top - d / 2) + 'px';
    var cs = win.getComputedStyle(t); if (cs.position === 'static') t.style.position = 'relative';
    t.classList.add('mo-ripple'); t.appendChild(s); setTimeout(function () { s.remove(); }, 600);
  }, true);

  /* 2 sliding ink under the active tab, and the screen of that tab slides in */
  function ink(box) {
    var on = box.querySelector('button.on'); if (!on) return;
    var bar = box.querySelector('.tab-ink'); if (!bar) { bar = doc.createElement('div'); bar.className = 'tab-ink'; box.appendChild(bar); }
    bar.style.left = on.offsetLeft + 'px'; bar.style.width = on.offsetWidth + 'px'; bar.style.top = (on.offsetTop + on.offsetHeight - 3) + 'px'; bar.style.bottom = 'auto';
  }
  function tabs() { Array.prototype.forEach.call(doc.querySelectorAll('.tabs'), ink); }
  doc.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.tabs button'); if (!b) return;
    setTimeout(function () {
      tabs();
      Array.prototype.forEach.call(doc.querySelectorAll('[id^="view"]'), function (v) { if (v.offsetParent) { v.classList.remove('mo-in'); void v.offsetWidth; v.classList.add('mo-in'); } });
    }, 20);
  }, true);
  win.addEventListener('resize', tabs); setTimeout(tabs, 300); setTimeout(tabs, 1200);

  /* 3 cards tilt a little and catch a moving light (mouse only) */
  if (fine) {
    var cur = null, raf = 0, ev = null;
    doc.addEventListener('pointermove', function (e) {
      ev = e; if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = 0; var c = ev.target.closest && ev.target.closest('.dp-card,.stat,.glass-card'); if (cur && cur !== c) { cur.style.setProperty('--rx', '0deg'); cur.style.setProperty('--ry', '0deg'); cur.style.setProperty('--sh', '0'); }
        cur = c; if (!c) return; if (!c.classList.contains('mo-tilt')) c.classList.add('mo-tilt');
        var r = c.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height;
        c.style.setProperty('--ry', ((x - .5) * 7).toFixed(2) + 'deg'); c.style.setProperty('--rx', ((.5 - y) * 5).toFixed(2) + 'deg');
        c.style.setProperty('--mx', (x * 100) + '%'); c.style.setProperty('--my', (y * 100) + '%'); c.style.setProperty('--sh', '1');
      });
    }, { passive: true });
    doc.addEventListener('pointerleave', function () { if (cur) { cur.style.setProperty('--rx', '0deg'); cur.style.setProperty('--ry', '0deg'); cur.style.setProperty('--sh', '0'); } }, true);
  }

  /* 4 gold burst (used when a bill is saved): window.bhBurst(x, y) */
  win.bhBurst = function (x, y) {
    var box = doc.createElement('div'); box.className = 'mo-confetti'; box.style.left = (x == null ? win.innerWidth / 2 : x) + 'px'; box.style.top = (y == null ? win.innerHeight / 3 : y) + 'px';
    var cols = ['#C9A24B', '#ffd08a', '#ffb347', '#ffffff', '#3b82f6'];
    for (var i = 0; i < 28; i++) { var p = doc.createElement('i'), a = Math.random() * Math.PI * 2, d = 70 + Math.random() * 150; p.style.background = cols[i % cols.length]; p.style.setProperty('--dx', Math.cos(a) * d + 'px'); p.style.setProperty('--dy', Math.sin(a) * d - 40 + 'px'); p.style.setProperty('--rot', (Math.random() * 540 - 270) + 'deg'); p.style.animationDelay = (Math.random() * 80) + 'ms'; box.appendChild(p); }
    doc.body.appendChild(box); setTimeout(function () { box.remove(); }, 1300);
  };

  /* ---- round 2 ---- */
  var weak = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) || (navigator.deviceMemory && navigator.deviceMemory <= 4);
  if (weak) doc.documentElement.classList.add('mo-lite');   // no blur, no tilt light on slow computers

  /* toast: window.bhToast('Saved') */
  win.bhToast = function (msg, ms) {
    ms = ms || 3500; var c = doc.querySelector('.toast-container');
    if (!c) { c = doc.createElement('div'); c.className = 'toast-container'; doc.body.appendChild(c); }
    var t = doc.createElement('div'); t.className = 'bh-toast'; var m = doc.createElement('div'); m.textContent = msg; var b = doc.createElement('div'); b.className = 'bar'; t.append(m, b); c.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('show'); b.style.transition = 'transform ' + ms + 'ms linear'; b.style.transform = 'scaleX(0)'; });
    setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 400); }, ms);
  };

  /* a small gold dot flies from one element to another (item picked -> bill list) */
  win.bhFly = function (from, to) {
    if (!from || !to || !from.animate) return;
    var a = from.getBoundingClientRect(), b = to.getBoundingClientRect(), d = doc.createElement('div'); d.className = 'mo-fly';
    var x0 = a.left + 12, y0 = a.top + a.height / 2 - 13, x1 = b.left + 24, y1 = b.top + 12;
    doc.body.appendChild(d);
    var an = d.animate([{ transform: 'translate(' + x0 + 'px,' + y0 + 'px) scale(1)', opacity: 1 }, { transform: 'translate(' + ((x0 + x1) / 2) + 'px,' + (Math.min(y0, y1) - 70) + 'px) scale(1.15)', opacity: 1, offset: .5 }, { transform: 'translate(' + x1 + 'px,' + y1 + 'px) scale(.3)', opacity: .2 }], { duration: 560, easing: 'cubic-bezier(.3,.7,.3,1)' });
    an.onfinish = function () { d.remove(); };
  };

  /* one gold pill glides behind the hovered top menu button (the menu rebuilds itself now and then, so the pill is made on demand) */
  (function () {
    var raf = 0;
    function glider(bar) { var g = bar.querySelector('.nav-glider'); if (!g) { g = doc.createElement('div'); g.className = 'nav-glider'; bar.insertBefore(g, bar.firstChild); } return g; }
    doc.addEventListener('mouseover', function (e) {
      var b = e.target.closest && e.target.closest('#rbh-menubar .mb-btn'); if (!b) return;
      var bar = doc.getElementById('rbh-menubar'), g = glider(bar);
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(function () { var br = bar.getBoundingClientRect(), r = b.getBoundingClientRect(); g.style.width = r.width + 'px'; g.style.height = r.height + 'px'; g.style.transform = 'translate3d(' + (r.left - br.left) + 'px,' + (r.top - br.top) + 'px,0)'; g.style.opacity = '1'; });
    });
    doc.addEventListener('mouseout', function (e) { var bar = doc.getElementById('rbh-menubar'); if (bar && !bar.contains(e.relatedTarget)) { var g = bar.querySelector('.nav-glider'); if (g) g.style.opacity = '0'; } });
  })();
})();
