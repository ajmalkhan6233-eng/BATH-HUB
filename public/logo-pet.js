/* LIVING LOGO (5 Nov 2026). The gold RBH logo in the top bar can be picked up, thrown, and parked anywhere; it breathes when idle, looks at the pointer,
   jumps when a bill is made, shakes on an error banner, and spins a ring while the app updates. Works in every theme. Top window only, computers only.
   Layout never moves: the real logo is only hidden (visibility), a floating copy is what you drag. Double-click the floating logo and it flies home.
   Off with localStorage bh_motion=off, or reduced motion. Position kept in localStorage bh_logo_pos. */
(function () {
  'use strict';
  if (window !== window.top || window.__bhLogoPet) return; window.__bhLogoPet = 1;
  var FRICTION = 2.4, BOUNCE = 0.72, MAX_SPEED = 2600, MIN_SPEED = 8, DRAG_START = 5;   // friction per second, bounce keep, px/s
  var doc = document;
  try { if (localStorage.getItem('bh_motion') === 'off') return; } catch (e) { /* ignore */ }
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var css = doc.createElement('style');
  css.textContent = '#lp{position:fixed;left:0;top:0;z-index:99990;touch-action:none;cursor:grab;will-change:transform;-webkit-user-select:none;user-select:none}' +
    '#lp.grab{cursor:grabbing}#lp img{display:block;pointer-events:none;-webkit-user-drag:none;transition:filter .2s}' +
    '#lp::before{content:"";position:absolute;inset:-10px;border-radius:50%;background:radial-gradient(circle,rgba(255,200,90,.55),transparent 68%);opacity:0;pointer-events:none}' +
    '#lp.breathe::before{animation:lpBreathe 3.2s ease-in-out infinite}#lp.grab::before{opacity:.9}' +
    '#lp::after{content:"";position:absolute;inset:-7px;border-radius:50%;border:3px solid transparent;border-top-color:#ffc46b;border-right-color:rgba(255,196,107,.4);opacity:0;pointer-events:none}' +
    '#lp.spin::after{opacity:1;animation:lpSpin .8s linear infinite}' +
    '#lp.shake img{animation:lpShake .5s ease}#lp.drop img{animation:lpDrop .6s cubic-bezier(.34,1.56,.64,1)}' +
    '@keyframes lpBreathe{0%,100%{opacity:0;transform:scale(.92)}50%{opacity:.85;transform:scale(1.08)}}@keyframes lpSpin{to{transform:rotate(360deg)}}' +
    '@keyframes lpShake{0%,100%{transform:translateX(0)}15%{transform:translateX(-7px) rotate(-8deg)}35%{transform:translateX(6px) rotate(7deg)}55%{transform:translateX(-4px) rotate(-4deg)}75%{transform:translateX(3px) rotate(2deg)}}' +
    '@keyframes lpDrop{0%{transform:translateY(-46px) scale(.7);opacity:0}100%{transform:none;opacity:1}}' +
    '@media(max-width:767px){#lp{display:none!important}}';
  doc.head.appendChild(css);

  var orig = null, box = null, W = 48, H = 40;
  var x = 0, y = 0, vx = 0, vy = 0, rot = 0, sx = 1, sy = 1, lookRot = 0;
  var dragging = false, pending = false, px0 = 0, py0 = 0, ox = 0, oy = 0, trail = [], loopOn = false, lastT = 0, idleAt = 0, homing = null;

  function logoEl() { var h = doc.querySelector('header.topbar'); return h ? h.querySelector('img') : null; }
  function homeRect() { var r = orig.getBoundingClientRect(); return { x: r.left, y: r.top }; }
  function save() { try { localStorage.setItem('bh_logo_pos', JSON.stringify({ x: Math.round(x), y: Math.round(y) })); } catch (e) { /* ignore */ } }
  function clear() { try { localStorage.removeItem('bh_logo_pos'); } catch (e) { /* ignore */ } }
  function paint() { box.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) rotate(' + (rot + lookRot).toFixed(1) + 'deg) scale(' + sx.toFixed(3) + ',' + sy.toFixed(3) + ')'; }

  function detach(atX, atY, dropIn) {
    if (box) return;
    var r = orig.getBoundingClientRect(); W = r.width || 48; H = r.height || 40;
    box = doc.createElement('div'); box.id = 'lp'; var im = orig.cloneNode(false); im.removeAttribute('id'); im.style.width = W + 'px'; im.style.height = H + 'px'; im.alt = ''; box.appendChild(im);
    doc.body.appendChild(box); orig.style.visibility = 'hidden';
    x = atX == null ? r.left : atX; y = atY == null ? r.top : atY; vx = vy = 0; rot = 0; sx = sy = 1; paint();
    if (dropIn) { box.classList.add('drop'); setTimeout(function () { if (box) box.classList.remove('drop'); }, 700); }
    bind(); idleAt = Date.now();
  }
  function attach() {   // back home: remove the floating copy, show the real logo
    if (!box) return; box.remove(); box = null; orig.style.visibility = ''; clear(); loopOn = false; homing = null;
  }

  function bounds() { return { maxX: Math.max(0, window.innerWidth - W), maxY: Math.max(0, window.innerHeight - H) }; }
  function overlapNudge() {   // never park on top of a control
    var els = doc.querySelectorAll('#bh-upd,.theme-toggle,.topbar-right button,.sm-pill');
    for (var i = 0; i < els.length; i++) {
      var r = els[i].getBoundingClientRect(); if (!r.width) continue;
      if (x + W > r.left - 4 && x < r.right + 4 && y + H > r.top - 4 && y < r.bottom + 4) { y = r.bottom + 10; if (y > bounds().maxY) y = bounds().maxY; return true; }
    }
    return false;
  }
  function settle() {
    var h = homeRect(); if (Math.abs(x - h.x) < 26 && Math.abs(y - h.y) < 26) { goHome(); return; }
    overlapNudge(); paint(); save();
  }

  /* ---- one loop, runs only while something moves ---- */
  function loop(t) {
    if (!box) { loopOn = false; return; }
    var dt = Math.min(0.04, (t - lastT) / 1000 || 0.016); lastT = t;
    if (homing) {
      homing.t += dt / homing.d; var k = Math.min(1, homing.t), e = 1 - Math.pow(1 - k, 3);
      x = homing.x0 + (homing.x1 - homing.x0) * e; y = homing.y0 + (homing.y1 - homing.y0) * e - Math.sin(k * Math.PI) * 60; rot = (1 - k) * 18; sx = sy = 1; paint();
      if (k >= 1) { attach(); } else requestAnimationFrame(loop); return;
    }
    if (!dragging) {
      var f = Math.exp(-FRICTION * dt); vx *= f; vy *= f; x += vx * dt; y += vy * dt;
      var b = bounds();
      if (x < 0) { x = 0; vx = Math.abs(vx) * BOUNCE; squash('x', vx); } else if (x > b.maxX) { x = b.maxX; vx = -Math.abs(vx) * BOUNCE; squash('x', vx); }
      if (y < 0) { y = 0; vy = Math.abs(vy) * BOUNCE; squash('y', vy); } else if (y > b.maxY) { y = b.maxY; vy = -Math.abs(vy) * BOUNCE; squash('y', vy); }
      rot += (Math.max(-25, Math.min(25, vx / 60)) - rot) * Math.min(1, dt * 10);
      sx += (1 - sx) * Math.min(1, dt * 12); sy += (1 - sy) * Math.min(1, dt * 12);
      paint();
      if (Math.sqrt(vx * vx + vy * vy) < MIN_SPEED && Math.abs(rot) < .3 && Math.abs(sx - 1) < .01) { vx = vy = 0; rot = 0; sx = sy = 1; paint(); loopOn = false; settle(); idleAt = Date.now(); return; }
    }
    requestAnimationFrame(loop);
  }
  function squash(axis, v) { var s = Math.min(.35, Math.abs(v) / 4000); if (axis === 'x') { sx = 1 - s; sy = 1 + s; } else { sy = 1 - s; sx = 1 + s; } }
  function run() { if (loopOn) return; loopOn = true; lastT = performance.now(); requestAnimationFrame(loop); }
  function goHome() { var h = homeRect(); homing = { x0: x, y0: y, x1: h.x, y1: h.y, t: 0, d: 0.65 }; vx = vy = 0; dragging = false; run(); }

  /* ---- pointer handling on the floating logo and on the real one ---- */
  function down(e) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    pending = true; px0 = e.clientX; py0 = e.clientY; trail = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
    var r = (box || orig).getBoundingClientRect(); ox = e.clientX - r.left; oy = e.clientY - r.top;
    try { (e.currentTarget).setPointerCapture(e.pointerId); } catch (x2) { /* ignore */ }
  }
  function move(e) {
    if (!pending && !dragging) return;
    if (pending && !dragging) { if (Math.abs(e.clientX - px0) + Math.abs(e.clientY - py0) < DRAG_START) return; detach(); dragging = true; pending = false; box.classList.add('grab'); box.classList.remove('breathe'); homing = null; run(); }
    x = e.clientX - ox; y = e.clientY - oy; var now = performance.now(); trail.push({ x: e.clientX, y: e.clientY, t: now }); while (trail.length > 5) trail.shift();
    var b = bounds(); x = Math.max(-W * .4, Math.min(b.maxX + W * .4, x)); y = Math.max(-H * .4, Math.min(b.maxY + H * .4, y));
    var tv = 0; if (trail.length > 1) { var a = trail[0], c = trail[trail.length - 1]; tv = (c.x - a.x) / Math.max(1, (c.t - a.t)) * 1000; }
    rot += (Math.max(-30, Math.min(30, tv / 50)) - rot) * .35; sx = 1.1; sy = .94; paint();
  }
  function up(e) {
    pending = false; if (!dragging) return; dragging = false; box.classList.remove('grab');
    var a = trail[0], c = trail[trail.length - 1], dt = Math.max(16, c.t - a.t);
    vx = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, (c.x - a.x) / dt * 1000)); vy = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, (c.y - a.y) / dt * 1000)); run();
  }
  var bound = false;
  function bind() {
    if (bound) return; bound = true;
    box.addEventListener('pointerdown', down); box.addEventListener('pointermove', move); box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
    box.addEventListener('dblclick', function () { goHome(); });
    box.addEventListener('lostpointercapture', function () { if (dragging) up(); });
  }

  /* ---- reactions ---- */
  function react(cls, ms) { if (!box) return; box.classList.remove(cls); void box.offsetWidth; box.classList.add(cls); setTimeout(function () { if (box) box.classList.remove(cls); }, ms); }
  function celebrate() { if (!box) return; vy = -760; vx += (Math.random() - .5) * 200; run(); if (window.bhBurst) window.bhBurst(x + W / 2, y + H / 2); }
  function watchDoc(d) {
    if (!d || d.__lpw) return; d.__lpw = 1;
    try {
      var bp = d.getElementById('billPanel');
      if (bp) { var was = bp.style.display !== 'none' && bp.style.display !== ''; new MutationObserver(function () { var on = bp.style.display !== 'none' && bp.style.display !== ''; if (on && !was) celebrate(); was = on; }).observe(bp, { attributes: true, attributeFilter: ['style'] }); }
      new MutationObserver(function (ms) { for (var i = 0; i < ms.length; i++) for (var j = 0; j < ms[i].addedNodes.length; j++) { var n = ms[i].addedNodes[j]; if (n.nodeType === 1 && (n.matches && n.matches('.msg.bad') || n.querySelector && n.querySelector('.msg.bad'))) { react('shake', 600); return; } } }).observe(d.body, { childList: true, subtree: true });
    } catch (e) { /* other origin */ }
  }
  function scanFrames() { watchDoc(doc); Array.prototype.forEach.call(doc.querySelectorAll('iframe'), function (f) { try { if (f.contentDocument && f.contentDocument.body) watchDoc(f.contentDocument); } catch (e) { /* ignore */ } }); }

  /* ---- idle breathing + eyes that follow the pointer ---- */
  var pe = null, praf = 0;
  doc.addEventListener('pointermove', function (e) {
    if (!box || dragging) return; idleAt = Date.now(); box.classList.remove('breathe'); pe = e;
    if (!praf) praf = requestAnimationFrame(function () { praf = 0; if (!box || loopOn || !pe) return; var dx = pe.clientX - (x + W / 2), dy = pe.clientY - (y + H / 2), d = Math.sqrt(dx * dx + dy * dy); lookRot = d < 240 ? Math.max(-6, Math.min(6, dx / 40)) : 0; paint(); });
  }, { passive: true });
  setInterval(function () { if (box && !dragging && !loopOn && Date.now() - idleAt > 8000) box.classList.add('breathe'); }, 2000);

  /* update spinner: watch the gold Update button text */
  setInterval(function () { var b = doc.getElementById('bh-upd'); if (!box) return; var on = b && /Updating|Restarting/i.test(b.textContent || ''); box.classList.toggle('spin', !!on); }, 700);

  function start() {
    orig = logoEl(); if (!orig) { setTimeout(start, 700); return; }
    orig.style.cursor = 'grab'; orig.addEventListener('pointerdown', down); orig.addEventListener('pointermove', move); orig.addEventListener('pointerup', up); orig.addEventListener('pointercancel', up);
    orig.style.touchAction = 'none'; orig.setAttribute('draggable', 'false'); orig.addEventListener('dragstart', function (e) { e.preventDefault(); });
    var s = null; try { s = JSON.parse(localStorage.getItem('bh_logo_pos') || 'null'); } catch (e) { s = null; }
    if (s && typeof s.x === 'number') { var b = bounds(), h = homeRect(); if (Math.abs(s.x - h.x) > 26 || Math.abs(s.y - h.y) > 26) detach(Math.max(0, Math.min(b.maxX, s.x)), Math.max(0, Math.min(b.maxY, s.y)), true); }
    scanFrames(); setInterval(scanFrames, 2500);
    window.addEventListener('resize', function () { if (!box || dragging) return; var b = bounds(); x = Math.max(0, Math.min(b.maxX, x)); y = Math.max(0, Math.min(b.maxY, y)); paint(); });
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
  window.BHLogo = { home: function () { if (box) goHome(); }, jump: celebrate };
})();
