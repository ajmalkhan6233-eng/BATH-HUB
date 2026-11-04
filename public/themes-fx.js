/* THEMES-FX (5 Nov 2026): the moving parts of the six OS/animation themes. Loaded in the shell and in every screen frame.
   win10  reveal light that follows the pointer on buttons, tiles and rows        (--mx --my)
   win7   glass sheen that slides across a card as the pointer moves              (--sx)
   apple  rim light that follows the pointer on glass cards                       (--px --py)
   kinetic magnetic buttons, mouse parallax, drifting light pools
   aqua   click ripple rings, rising bubbles, wave, caustic light, success drop
   Rules kept: transform/opacity only, one rAF per frame, max 10 bubbles, auto "lite" on slow computers, off with localStorage bh_motion=off or reduced motion. */
(function () {
  'use strict';
  var win = window, doc = document, root = doc.documentElement;
  if (win.__bhThemeFX) return; win.__bhThemeFX = 1;
  var NAMES = ['win7', 'win10', 'win11', 'apple', 'kinetic', 'aqua'];
  var off = false;
  try { off = localStorage.getItem('bh_motion') === 'off'; } catch (e) { /* ignore */ }
  var reduced = !!(win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var isTop = win === win.top;
  var enabled = !off && !reduced;
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) root.classList.add('mo-lite');

  function theme() { return root.getAttribute('data-theme') || ''; }
  function lite() { return root.classList.contains('mo-lite'); }

  /* ---------- pointer effects: ONE listener, one rAF ---------- */
  var ev = null, raf = 0, lastEl = null;
  var REVEAL = 'button,.card,.panel,.dp-card,.stat,tbody tr,.mb-btn,.tabs>button,.sm-pill,.mb-item';
  var CARDS = '.card,.panel,.dp-card,.stat,.glass-card';
  function frame() {
    raf = 0; if (!ev || !enabled) return;
    var t = theme(), tg = ev.target;
    if (!tg || !tg.closest) return;
    if (t === 'win10') {
      var el = tg.closest(REVEAL);
      if (lastEl && lastEl !== el) { lastEl.style.removeProperty('--mx'); lastEl.style.removeProperty('--my'); }
      lastEl = el; if (!el) return;
      var r = el.getBoundingClientRect(); el.style.setProperty('--mx', (ev.clientX - r.left) + 'px'); el.style.setProperty('--my', (ev.clientY - r.top) + 'px');
    } else if (t === 'win7') {
      var c7 = tg.closest(CARDS + ',.topbar'); if (!c7) return;
      var r7 = c7.getBoundingClientRect(); c7.style.setProperty('--sx', Math.max(0, Math.min(100, (ev.clientX - r7.left) / r7.width * 100)).toFixed(1) + '%');
    } else if (t === 'apple') {
      var ca = tg.closest(CARDS); if (!ca) return;
      var ra = ca.getBoundingClientRect(); ca.style.setProperty('--px', ((ev.clientX - ra.left) / ra.width * 100).toFixed(1) + '%'); ca.style.setProperty('--py', ((ev.clientY - ra.top) / ra.height * 100).toFixed(1) + '%');
    } else if (t === 'kinetic') {
      root.style.setProperty('--pxx', ((ev.clientX / win.innerWidth) - .5).toFixed(3)); root.style.setProperty('--pyy', ((ev.clientY / win.innerHeight) - .5).toFixed(3));
      magnet(ev.clientX, ev.clientY);
    }
  }
  doc.addEventListener('pointermove', function (e) { if (!enabled || NAMES.indexOf(theme()) < 0 || e.pointerType === 'touch') return; ev = e; if (!raf) raf = requestAnimationFrame(frame); }, { passive: true });
  doc.addEventListener('pointerout', function (e) { if (theme() === 'win10' && e.target.closest) { var el = e.target.closest(REVEAL); if (el) { el.style.removeProperty('--mx'); el.style.removeProperty('--my'); } } }, true);

  /* kinetic: buttons lean toward the pointer (cached rectangles, refreshed once a second) */
  var mags = [], magAt = 0;
  function magnet(x, y) {
    var now = Date.now();
    if (now - magAt > 1000) {
      magAt = now; mags = [];
      Array.prototype.forEach.call(doc.querySelectorAll('button.p,.generate-btn,#bh-upd,.sm-pill,.theme-toggle'), function (b) { var r = b.getBoundingClientRect(); if (r.width && r.bottom > 0 && r.top < win.innerHeight) mags.push({ b: b, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }); });
    }
    for (var i = 0; i < mags.length && i < 14; i++) {
      var m = mags[i], dx = x - m.cx, dy = y - m.cy, d = Math.sqrt(dx * dx + dy * dy);
      if (d < 70) { m.b.style.translate = (dx / 70 * 6).toFixed(1) + 'px ' + (dy / 70 * 6).toFixed(1) + 'px'; m.on = 1; }
      else if (m.on) { m.b.style.translate = ''; m.on = 0; }
    }
  }
  win.addEventListener('scroll', function () { magAt = 0; }, true); win.addEventListener('resize', function () { magAt = 0; });

  /* ---------- aqua: ripple ring on every click ---------- */
  doc.addEventListener('pointerdown', function (e) {
    if (!enabled || theme() !== 'aqua') return;
    var r = doc.createElement('div'); r.className = 'bh-ripple-ring'; r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px'; doc.body.appendChild(r); setTimeout(function () { r.remove(); }, 900);
  }, true);

  /* ---------- success (bill made): aqua drop + splash, kinetic burst ---------- */
  function success() {
    if (!enabled) return; var t = theme(), g = doc.getElementById('genBtn'), r = g ? g.getBoundingClientRect() : null, x = r ? r.left + r.width / 2 : win.innerWidth / 2, y = r ? r.top + r.height / 2 : win.innerHeight / 3;
    if (t === 'aqua') {
      var d = doc.createElement('div'); d.className = 'bh-drop'; d.style.left = x + 'px'; d.style.top = (y - 20) + 'px'; doc.body.appendChild(d);
      setTimeout(function () { d.remove(); for (var i = 0; i < 3; i++) { var s = doc.createElement('div'); s.className = 'bh-splash'; s.style.left = x + 'px'; s.style.top = y + 'px'; s.style.animationDelay = (i * 120) + 'ms'; doc.body.appendChild(s); (function (n) { setTimeout(function () { n.remove(); }, 1000 + i * 120); })(s); } }, 520);
    } else if (t === 'kinetic' && win.bhBurst) win.bhBurst(x, y);
  }
  function watchBill() {
    var bp = doc.getElementById('billPanel'); if (!bp || bp.__fx) return; bp.__fx = 1;
    var was = bp.style.display !== 'none' && bp.style.display !== '';
    new MutationObserver(function () { var on = bp.style.display !== 'none' && bp.style.display !== ''; if (on && !was) success(); was = on; }).observe(bp, { attributes: true, attributeFilter: ['style'] });
  }
  win.addEventListener('DOMContentLoaded', watchBill); setTimeout(watchBill, 1500);

  /* ---------- ambient layers (top window only): kinetic light pools, aqua water ---------- */
  function clearAmbient() { var a = doc.getElementById('bh-ambient'); if (a) a.remove(); }
  function wavePath() { var p = 'M0 8'; for (var i = 0; i < 16; i++) p += ' q 62.5 ' + (i % 2 ? 14 : -14) + ' 125 0'; return p; }
  function build() {
    if (!isTop) return; clearAmbient(); if (!enabled || !doc.body) return;
    var t = theme(); if (t !== 'kinetic' && t !== 'aqua') return;
    var a = doc.createElement('div'); a.id = 'bh-ambient';
    if (t === 'kinetic') {
      ['k1', 'k2', 'k3'].forEach(function (c) { var d = doc.createElement('div'); d.className = 'k-blob ' + c; a.appendChild(d); });
    } else {
      ['a-caustic', 'a-caustic c2'].forEach(function (c) { var d = doc.createElement('div'); d.className = c; a.appendChild(d); });
      var ns = 'http://www.w3.org/2000/svg', s = doc.createElementNS(ns, 'svg'); s.setAttribute('class', 'a-wave'); s.setAttribute('viewBox', '0 0 2000 16'); s.setAttribute('preserveAspectRatio', 'none');
      var path = doc.createElementNS(ns, 'path'); path.setAttribute('d', wavePath()); path.setAttribute('fill', 'none'); path.setAttribute('stroke', 'rgba(220,250,255,.8)'); path.setAttribute('stroke-width', '2'); s.appendChild(path); a.appendChild(s);
      var n = lite() ? 4 : 10;
      for (var i = 0; i < n; i++) { var b = doc.createElement('div'), sz = 8 + Math.round(Math.random() * 18); b.className = 'a-bub'; b.style.cssText = 'left:' + (4 + Math.random() * 92).toFixed(1) + '%;width:' + sz + 'px;height:' + sz + 'px;--dur:' + (11 + Math.random() * 12).toFixed(1) + 's;--del:-' + (Math.random() * 14).toFixed(1) + 's;--sway:' + (Math.round(Math.random() * 50) - 25) + 'px'; a.appendChild(b); }
    }
    doc.body.insertBefore(a, doc.body.firstChild);
    watchFrames();
  }
  /* if the first 40 frames are slow (>24 ms average) switch to lite by itself */
  var probing = false;
  function probe() {
    if (probing || lite() || !isTop) return; probing = true; var n = 0, t0 = 0, last = 0;
    (function tick(now) { if (!t0) t0 = now; n++; if (n < 40) return requestAnimationFrame(tick); var avg = (now - t0) / n; probing = false; if (avg > 24) { root.classList.add('mo-lite'); build(); } })(performance.now());
    requestAnimationFrame(function s(now) { /* spacer so the first sample is a real frame */ });
  }
  function watchFrames() { /* same-origin frames carry the theme attribute already (ui_comfort syncs it); nothing else to do here */ }

  function apply() {
    var t = theme(), known = NAMES.indexOf(t) >= 0;
    if (!known) { clearAmbient(); return; }
    build(); if (t === 'kinetic' || t === 'aqua') setTimeout(probe, 1500);
  }
  new MutationObserver(function (m) { for (var i = 0; i < m.length; i++) if (m[i].attributeName === 'data-theme') { apply(); break; } }).observe(root, { attributes: true });
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', apply); else apply();

  win.BHThemeFX = {
    enable: function () { enabled = true; apply(); },
    disable: function () { enabled = false; clearAmbient(); },
    lite: function () { root.classList.add('mo-lite'); build(); }
  };
})();
