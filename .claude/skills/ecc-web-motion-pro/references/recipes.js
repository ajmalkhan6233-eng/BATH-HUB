/* ecc-web-motion-pro recipes.js: own code, zero dependencies, nothing is sent out. window.Motion.init() first. */
(function () {
  'use strict';
  var M = (window.Motion = {});
  var $ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (n, a, b) { return Math.min(b, Math.max(a, n)); };

  // 0 device tier: low = little memory, Save-Data, or reduced motion -> show finished still layout, no heavy effects
  M.tier = function () {
    var c = navigator.connection || {};
    var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    return (reduced || c.saveData || (navigator.deviceMemory && navigator.deviceMemory < 4)) ? 'low' : 'high';
  };

  // 1 reveal on scroll (IntersectionObserver); .rv, .split, .clip, .counter get .in when seen
  M.reveal = function () {
    var els = $('.rv,.split,.clip,[data-count]');
    if (!('IntersectionObserver' in window) || M.low) { els.forEach(function (e) { e.classList.add('in'); if (e.dataset.count) e.textContent = Number(e.dataset.count).toLocaleString('en-LK'); }); return; }   // still layout: final numbers, no animation
    var map = new Map();   // a clipped element is never "intersecting", so .clip is watched through its parent
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (x) { if (x.isIntersecting) { (map.get(x.target) || []).forEach(function (t) { t.classList.add('in'); if (t.dataset.count) M.count(t); }); io.unobserve(x.target); } });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (e) { var w = e.classList.contains('clip') ? e.parentElement : e; map.set(w, (map.get(w) || []).concat(e)); io.observe(w); });
  };

  // 2 split text into masked words (keeps real text for screen readers via aria-label)
  M.split = function (el) {
    var t = el.textContent.trim(); el.setAttribute('aria-label', t); el.textContent = '';
    t.split(/\s+/).forEach(function (w, i) {
      var o = document.createElement('span'); o.className = 'w'; o.setAttribute('aria-hidden', 'true');
      var s = document.createElement('span'); s.textContent = w; s.style.setProperty('--i', i); o.appendChild(s);
      el.appendChild(o); el.appendChild(document.createTextNode(' '));
    });
  };

  // 3 scroll progress (0..1 of the page) and per-section progress into --p
  M.progress = function () {
    var bar = $('.progress')[0];
    function tick() {
      var h = document.documentElement; var p = clamp(h.scrollTop / (h.scrollHeight - h.clientHeight || 1), 0, 1);
      if (bar && !bar.classList.contains('css-driven')) bar.style.setProperty('--p', p);
      $('.pin,.hscroll').forEach(function (s) {
        var r = s.getBoundingClientRect(); var total = r.height - window.innerHeight;
        s.style.setProperty('--p', clamp(-r.top / (total || 1), 0, 1));
        var tr = s.querySelector('.track'); if (tr) s.style.setProperty('--shift', Math.max(0, tr.scrollWidth - window.innerWidth) + 'px');
        var steps = $('[data-step]', s); if (steps.length) { var idx = Math.min(steps.length - 1, Math.floor(clamp(-r.top / (total || 1), 0, 0.999) * steps.length)); steps.forEach(function (e, i) { e.classList.toggle('on', i === idx); }); }
      });
    }
    var q = false; window.addEventListener('scroll', function () { if (!q) { q = true; requestAnimationFrame(function () { q = false; tick(); }); } }, { passive: true });
    window.addEventListener('resize', tick); tick();
  };

  // 4 counter 0 -> data-count
  M.count = function (el) {
    var to = Number(el.dataset.count), t0 = performance.now(), dur = 1200;
    (function f(n) { var k = clamp((n - t0) / dur, 0, 1); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))).toLocaleString('en-LK'); if (k < 1) requestAnimationFrame(f); })(t0);
  };

  // 5 magnetic button + tilt card (fine pointer only)
  M.magnetic = function (el, pull) {
    if (!matchMedia('(pointer:fine)').matches || M.low) return; pull = pull || 0.25;
    el.addEventListener('pointermove', function (e) { var r = el.getBoundingClientRect(); el.style.transform = 'translate(' + (e.clientX - r.left - r.width / 2) * pull + 'px,' + (e.clientY - r.top - r.height / 2) * pull + 'px)'; });
    el.addEventListener('pointerleave', function () { el.style.transform = ''; });
  };
  M.tilt = function (el, max) {
    if (!matchMedia('(pointer:fine)').matches || M.low) return; max = max || 8;
    el.addEventListener('pointermove', function (e) { var r = el.getBoundingClientRect(); el.style.setProperty('--ry', ((e.clientX - r.left) / r.width - 0.5) * max * 2 + 'deg'); el.style.setProperty('--rx', -((e.clientY - r.top) / r.height - 0.5) * max * 2 + 'deg'); });
    el.addEventListener('pointerleave', function () { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
  };

  // 6 custom cursor (desktop only)
  M.cursor = function () {
    if (!matchMedia('(pointer:fine)').matches || M.low) return;
    var c = document.createElement('div'); c.className = 'cursor'; document.body.appendChild(c);
    window.addEventListener('pointermove', function (e) { c.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px) translate(-50%,-50%)'; }, { passive: true });
  };

  // 7 image sequence on canvas, scrubbed by scroll of its .pin section. frames = array of URLs or ImageBitmap/Image
  M.sequence = function (canvas, frames, section) {
    var ctx = canvas.getContext('2d'), cur = -1, imgs = [];
    function load(i) { var f = frames[i]; if (typeof f !== 'string') return Promise.resolve(f); return new Promise(function (ok) { var im = new Image(); im.onload = function () { ok(im); }; im.onerror = function () { ok(null); }; im.src = f; }); }
    function draw(i) { var im = imgs[i]; if (!im || i === cur) return; cur = i; var w = canvas.width, h = canvas.height, s = Math.max(w / im.width, h / im.height); ctx.drawImage(im, (w - im.width * s) / 2, (h - im.height * s) / 2, im.width * s, im.height * s); }
    function size() { var d = Math.min(window.devicePixelRatio || 1, 2); canvas.width = canvas.clientWidth * d; canvas.height = canvas.clientHeight * d; cur = -1; }
    size(); window.addEventListener('resize', size);
    var first = Math.min(frames.length, 30);          // load the first frames at once, the rest lazily
    Promise.all(frames.slice(0, first).map(function (_, i) { return load(i).then(function (im) { imgs[i] = im; }); })).then(function () {
      for (var i = first; i < frames.length; i++) (function (k) { setTimeout(function () { load(k).then(function (im) { imgs[k] = im; }); }, 40 * (k - first)); })(i);
      (function loop() { var p = parseFloat(getComputedStyle(section).getPropertyValue('--p')) || 0; var idx = Math.round(p * (frames.length - 1)); var j = idx; while (j > 0 && !imgs[j]) j--; draw(j); requestAnimationFrame(loop); })();
    });
  };

  // 8 shader gradient background (tiny WebGL); stops when off screen/hidden; CSS gradient stays as fallback
  M.shader = function (canvas, c1, c2) {
    if (M.low) return false;
    var gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' }); if (!gl) return false;
    var vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
    var fs = 'precision mediump float;uniform vec2 r;uniform float t;uniform vec3 a;uniform vec3 b;void main(){vec2 u=gl_FragCoord.xy/r;float v=sin(u.x*3.+t*.4)*.5+sin(u.y*4.-t*.3)*.5+sin((u.x+u.y)*5.+t*.2)*.25;vec3 c=mix(a,b,smoothstep(-.8,1.,v)*(1.-u.y*.5));gl_FragColor=vec4(c,1.);}';
    function sh(t, s) { var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; }
    var pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return false;
    gl.useProgram(pr); var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var U = function (n) { return gl.getUniformLocation(pr, n); }; gl.uniform3fv(U('a'), c1); gl.uniform3fv(U('b'), c2);
    var vis = true; if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { vis = e[0].isIntersecting; }).observe(canvas);
    function size() { var d = 0.5; canvas.width = canvas.clientWidth * d; canvas.height = canvas.clientHeight * d; gl.viewport(0, 0, canvas.width, canvas.height); gl.uniform2f(U('r'), canvas.width, canvas.height); }
    size(); window.addEventListener('resize', size);
    (function f(ms) { if (vis && !document.hidden) { gl.uniform1f(U('t'), ms / 1000); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); } requestAnimationFrame(f); })(0);
    canvas.dataset.live = '1'; return true;
  };

  // 9 view transition between states (guarded; plain swap if unsupported)
  M.transition = function (swap) { if (document.startViewTransition && !M.low) document.startViewTransition(swap); else swap(); };

  M.init = function () {
    M.low = M.tier() === 'low'; if (M.low) document.documentElement.classList.add('low');
    $('.split').forEach(M.split); M.reveal(); M.progress();
    $('.mag').forEach(function (e) { M.magnetic(e); }); $('.tilt').forEach(function (e) { M.tilt(e); }); M.cursor();
    return M.low ? 'low' : 'high';
  };
})();
