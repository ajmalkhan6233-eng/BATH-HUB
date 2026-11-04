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
})();
