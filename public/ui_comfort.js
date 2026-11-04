/* Owner shell comfort (Ajmal, 17-inch touch screen, read from a distance):
   1) the left menu can be made wider or narrower by dragging its right edge (double-click = back to normal), remembered on this device;
   2) menu and page text a little bigger and clearer.  Touches no data. */
(function () {
  'use strict';
  var KEY = 'bh_sidebar_w', MIN = 170, MAX = 460, DEF = 260;
  function get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function put(v) { try { localStorage.setItem(KEY, String(v)); } catch (e) {} }
  function apply(w) { document.documentElement.style.setProperty('--sidebar-w', w + 'px'); var g = document.getElementById('sb-grip'); if (g) g.style.left = (w - 5) + 'px'; }
  var css = document.createElement('style');
  css.textContent =
    /* one menu only: the top menu bar. The left side list is hidden on a computer screen (phone keeps its own bottom bar). */
    '@media(min-width:768px){.sidebar{display:none!important}.main-content{margin-left:0!important}#sb-grip{display:none!important}}' +
    /* no outer up-and-down scrolling: the top bar and menu stay put, the screen below fills the rest of the window and only scrolls inside if it really must (Ajmal 4 Nov) */
    '@media(min-width:768px){html,body{height:100%;overflow:hidden!important}.app-wrapper,.main-content{height:100dvh;overflow:hidden}.main-content{display:flex;flex-direction:column}' +
    '.main-content>.page.active{flex:1 1 auto;min-height:0;overflow:auto;padding:8px 12px!important}.main-content>.page.active:has(>iframe){display:flex;flex-direction:column;overflow:hidden;padding:6px 8px!important}' +
    'html body .main-content>.page.active>iframe{flex:1 1 auto;height:auto!important;min-height:0!important}.topbar-right .sm-modebtn{display:none!important}}' +
    /* clear sans-serif font everywhere, darker text, bigger small print */
    'html body,html body *:not(svg):not(path){font-family:"Segoe UI",Arial,Helvetica,sans-serif!important}' +
    'html body{font-size:17px}html[data-theme="light"] body{--text:#0b0b0b;--text2:#2a2a2a;--text3:#444}' +
    '.main-content{font-size:17px;color:var(--text)}.main-content td,.main-content th,.main-content label,.main-content p,.main-content li{font-size:16px}' +
    '.main-content small,.main-content .sub,.main-content .dp-note,.main-content [class*="sub"],.main-content [style*="font-size:11px"],.main-content [style*="font-size:12px"],.main-content [style*="font-size:13px"]{font-size:15px!important}' +
    '.main-content h1,.main-content h2,.main-content h3{font-weight:700;letter-spacing:0}' +
    '.topbar .page-title,.topbar h1{font-size:20px;font-weight:700}' +
    '#rbh-menubar button.mb-btn{font-size:17px!important;font-weight:700!important}.mb-item{font-size:16px!important;min-height:46px!important}.mb-item small{font-size:12px!important}' +
    /* life: menus slide open, screens fade in, cards lift, buttons press */
    '@keyframes bhPop{from{opacity:0;transform:translateY(-8px) scale(.98)}to{opacity:1;transform:none}}@keyframes bhFade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}' +
    '#rbh-menubar .mb-top.on .mb-list{animation:bhPop .16s ease-out;box-shadow:0 14px 34px rgba(0,0,0,.28);border-radius:12px}' +
    '.page.active{animation:bhFade .22s ease-out}.modal.on .box,.modal-overlay .modal-box{animation:bhPop .18s ease-out}' +
    '.main-content [class*="card"],.main-content .dp-card,.main-content [class*="tile"]{transition:transform .15s,box-shadow .15s}.main-content [class*="card"]:hover,.main-content .dp-card:hover,.main-content [class*="tile"]:hover{transform:translateY(-2px);box-shadow:0 10px 24px rgba(0,0,0,.14)}' +
    'button:active{transform:scale(.97)}button{transition:transform .08s,background .15s}' +
    '@media(min-width:900px){h1,h2,h3{margin-top:0!important;margin-bottom:6px!important}td,th{padding-top:5px!important;padding-bottom:5px!important}input,select,textarea{padding-top:3px!important;padding-bottom:3px!important;min-height:34px!important}button{min-height:34px!important;padding-top:3px!important;padding-bottom:3px!important}.card,.panel,.dp-card,[class*="-card"]{padding:10px 14px!important;margin-bottom:8px!important}[class*="grid"]{gap:8px!important}p{margin:4px 0!important}}' +
    '@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}';
  document.head.appendChild(css);
  function start() {
    var sb = document.querySelector('.sidebar'); if (!sb || document.getElementById('sb-grip')) return;
    var g = document.createElement('div'); g.id = 'sb-grip'; g.title = 'Drag to make the menu wider or narrower. Double-click to reset.'; document.body.appendChild(g);
    var v = parseInt(get(), 10); apply(v >= MIN && v <= MAX ? v : DEF);
    var down = false;
    g.addEventListener('pointerdown', function (e) { down = true; g.classList.add('drag'); try { g.setPointerCapture(e.pointerId); } catch (x) {} e.preventDefault(); sb.style.transition = 'none'; });
    g.addEventListener('pointermove', function (e) { if (!down) return; apply(Math.max(MIN, Math.min(MAX, Math.round(e.clientX)))); });
    function up() { if (!down) return; down = false; g.classList.remove('drag'); sb.style.transition = ''; var w = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-w'), 10); if (w) put(w); }
    g.addEventListener('pointerup', up); g.addEventListener('pointercancel', up);
    g.addEventListener('dblclick', function () { apply(DEF); put(DEF); });
    new MutationObserver(function () { g.style.display = sb.classList.contains('collapsed') ? 'none' : ''; }).observe(sb, { attributes: true, attributeFilter: ['class'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

/* ---- part 2 (4 Nov): small print everywhere, also inside every screen frame; and a ▶ Update button ---- */
(function () {
  'use strict';
  var MINPX = 15;
  var FRAME_CSS = 'html body,html body *:not(svg):not(path){font-family:"Segoe UI",Arial,Helvetica,sans-serif!important}html body{font-size:17px}' +
    'html[data-theme="light"] body{--text:#0b0b0b;--text2:#2a2a2a;--text3:#444}' +
    'body>.wrap,body>.container,body>main,body>.page,body>.content,.container,.wrap{max-width:none!important}body{padding-left:12px!important;padding-right:12px!important}' +
    '@media(min-width:900px){h1,h2,h3{margin-top:0!important;margin-bottom:6px!important}td,th{padding-top:5px!important;padding-bottom:5px!important}input,select,textarea{padding-top:3px!important;padding-bottom:3px!important;min-height:34px!important}button{min-height:34px!important;padding-top:3px!important;padding-bottom:3px!important}.card,.panel,.dp-card,[class*="-card"]{padding:10px 14px!important;margin-bottom:8px!important}[class*="grid"]{gap:8px!important}p{margin:4px 0!important}}' +
    '*{scrollbar-width:auto}';
  function bump(doc) {
    try {
      var win = doc.defaultView; if (!win || !doc.body) return;
      var els = doc.body.querySelectorAll('*'), n = els.length, i, e, cs, fs;
      for (i = 0; i < n && i < 6000; i++) {
        e = els[i]; if (e.tagName === 'SCRIPT' || e.tagName === 'STYLE' || e.tagName === 'svg' || e.tagName === 'path' || e.tagName === 'IFRAME') continue;
        if (!e.firstChild || !Array.prototype.some.call(e.childNodes, function (c) { return c.nodeType === 3 && c.nodeValue.trim(); })) continue;
        cs = win.getComputedStyle(e); fs = parseFloat(cs.fontSize);
        if (fs && fs < MINPX) e.style.setProperty('font-size', MINPX + 'px', 'important');
      }
    } catch (x) { /* never break a screen */ }
  }
  function lift(doc) {
    try {
      if (!doc || !doc.head || doc.getElementById('bh-lift')) return;
      var st = doc.createElement('style'); st.id = 'bh-lift'; st.textContent = FRAME_CSS; doc.head.appendChild(st);
      ['/themes-os.css', '/themes-anim.css'].forEach(function (h) { var l = doc.createElement('link'); l.rel = 'stylesheet'; l.href = h; doc.head.appendChild(l); });
      var fx = doc.createElement('script'); fx.src = '/themes-fx.js'; doc.head.appendChild(fx);
      var mc = doc.createElement('link'); mc.rel = 'stylesheet'; mc.href = '/motion.css'; doc.head.appendChild(mc);
      var ms = doc.createElement('script'); ms.src = '/motion.js'; doc.head.appendChild(ms);
      var gl = doc.createElement('link'); gl.rel = 'stylesheet'; gl.href = '/glass.css'; doc.head.appendChild(gl);   // the Glass look reaches every screen
      var theme = function () { try { var t = localStorage.getItem('bathhub-theme'); if (t) { doc.documentElement.setAttribute('data-theme', t); if (['glass', 'aurora', 'midnight', 'emerald', 'rose'].indexOf(t) >= 0) doc.documentElement.setAttribute('data-style', 'glass'); else doc.documentElement.removeAttribute('data-style'); } } catch (x) { /* ignore */ } };
      theme(); try { doc.defaultView.addEventListener('storage', theme); } catch (x) { /* ignore */ }
      var t = null, run = function () { clearTimeout(t); t = setTimeout(function () { bump(doc); }, 350); };
      run(); new MutationObserver(run).observe(doc.body, { childList: true, subtree: true, characterData: true });
    } catch (x) { /* ignore */ }
  }
  function watchFrames() {
    Array.prototype.forEach.call(document.querySelectorAll('iframe'), function (f) {
      if (f.dataset.bhLift) return; f.dataset.bhLift = '1';
      var go = function () { try { if (f.contentDocument && f.contentDocument.body) lift(f.contentDocument); } catch (x) { /* other origin */ } };
      f.addEventListener('load', go); go();
    });
  }
  function updateButton() {
    var right = document.querySelector('.topbar-right'); if (!right || document.getElementById('bh-upd')) return;
    var b = document.createElement('button'); b.id = 'bh-upd'; b.type = 'button'; b.className = 'sm-pill'; b.textContent = '▶ Update';
    b.title = 'Get the newest version of the app now (it restarts by itself if needed)';
    b.style.cssText = 'font-weight:700;padding:6px 14px;min-height:40px;border-radius:999px;border:2px solid #C9A24B;background:#C9A24B;color:#111;cursor:pointer;margin-right:6px';
    b.onclick = function () {
      b.disabled = true; b.textContent = 'Updating...';
      fetch('/api/pc-actions/update', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}' })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (j.error) { b.textContent = '▶ Update'; b.disabled = false; alert(j.error); return; }
          if (j.state === 'current') { b.textContent = 'Already newest'; setTimeout(function () { location.reload(); }, 900); return; }
          if (j.state === 'blocked') { b.textContent = '▶ Update'; b.disabled = false; alert('Could not update: ' + (j.why || 'unknown') + '. Tell Claude this exact line.'); return; }
          if (j.needsInstall) alert('Updated. One extra step (npm install) is needed: tell Claude.');
          b.textContent = j.restart ? 'Restarting...' : 'Done';
          var tries = 0, wait = function () { tries++; fetch('/health', { cache: 'no-store' }).then(function (r) { if (r.ok && (!j.restart || tries > 3)) location.reload(); else setTimeout(wait, 2000); }).catch(function () { setTimeout(wait, 2000); }); };
          setTimeout(wait, j.restart ? 4000 : 500);
        }).catch(function () { b.textContent = '▶ Update'; b.disabled = false; alert('Could not reach the app.'); });
    };
    right.insertBefore(b, right.firstChild);
  }
  function start() { lift(document); watchFrames(); updateButton(); new MutationObserver(function () { watchFrames(); updateButton(); }).observe(document.body, { childList: true, subtree: true }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

/* ---- numbers count up on the dashboard (1.2 s, ease-out), like the dashboard video ---- */
(function () {
  'use strict';
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  function run(el) {
    var t = el.textContent, m = /(\d[\d,]*)(\.\d+)?/.exec(t); if (!m || el.dataset.cu === t) return;
    var target = parseFloat(m[0].replace(/,/g, '')); if (!isFinite(target) || target < 10) { el.dataset.cu = t; return; }
    var pre = t.slice(0, m.index), post = t.slice(m.index + m[0].length), dec = m[2] ? m[2].length - 1 : 0, t0 = performance.now();
    el.dataset.cu = t; var final = t;
    (function step(now) {
      var p = Math.min(1, (now - t0) / 1200), e = 1 - Math.pow(1 - p, 3), v = target * e;
      el.textContent = pre + v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + post;
      if (p < 1) requestAnimationFrame(step); else { el.textContent = final; el.dataset.cu = final; }
    })(t0);
  }
  function scan() { Array.prototype.forEach.call(document.querySelectorAll('#dash-pro .dp-val'), run); }
  var tm = null, start = function () { var d = document.getElementById('dash-pro') || document.body; new MutationObserver(function () { clearTimeout(tm); tm = setTimeout(scan, 60); }).observe(d, { childList: true, subtree: true }); scan(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

/* ---- theme palette: tap the theme icon, pick a look ---- */
(function () {
  'use strict';
  var T = [['dark', 'Gold', 'linear-gradient(135deg,#0d0d0d,#3a2e10)'], ['water', 'Water', 'linear-gradient(135deg,#0b3b5c,#5fb7d4)'], ['light', 'Light', 'linear-gradient(135deg,#ffffff,#e6e9ee)'], ['sand', 'Sand', 'linear-gradient(135deg,#f7f0e1,#d9c08a)'],
    ['glass', 'Ocean glass', 'linear-gradient(135deg,#0d2740,#2a97b3)'], ['aurora', 'Aurora', 'linear-gradient(135deg,#1a0f3a,#0f8aa0)'], ['midnight', 'Midnight', 'linear-gradient(135deg,#04060d,#12285a)'], ['emerald', 'Emerald', 'linear-gradient(135deg,#03261f,#16936a)'], ['rose', 'Sunset', 'linear-gradient(135deg,#2e0f2b,#e0715a)'],
    ['win7', 'Windows 7 Aero', 'linear-gradient(135deg,#5fa8dc,#b7e6e2)'], ['win10', 'Windows 10', 'linear-gradient(135deg,#1b1b1b,#0078d7)'], ['win11', 'Windows 11', 'linear-gradient(135deg,#f3f3f3,#bcd6f5)'], ['apple', 'Apple glass', 'linear-gradient(135deg,#3a1c6e,#ff5caa)'], ['kinetic', 'Kinetic', 'linear-gradient(135deg,#2a0f3d,#ff5e62)'], ['aqua', 'Aqua', 'linear-gradient(135deg,#0a6fb8,#5fe0f7)']];
  var css = document.createElement('style');
  css.textContent = '#bh-pal{position:fixed;z-index:100001;background:rgba(16,24,36,.96);border:1px solid rgba(255,255,255,.2);border-radius:18px;padding:12px;box-shadow:0 18px 50px rgba(0,0,0,.5);display:none;grid-template-columns:repeat(4,112px);gap:10px;animation:moSpring .3s cubic-bezier(.34,1.56,.64,1) both}' +
    '#bh-pal.on{display:grid}#bh-pal button{border:2px solid transparent;border-radius:14px;background:transparent;color:#fff;padding:6px;cursor:pointer;font:600 13px "Segoe UI",Arial,sans-serif;text-align:center}#bh-pal button:hover{background:rgba(255,255,255,.1);transform:translateY(-2px)}' +
    '#bh-pal button.cur{border-color:#C9A24B}#bh-pal i{display:block;height:46px;border-radius:10px;margin-bottom:6px;border:1px solid rgba(255,255,255,.25)}';
  document.head.appendChild(css);
  var pal = null;
  function build() {
    pal = document.createElement('div'); pal.id = 'bh-pal';
    T.forEach(function (t) { var b = document.createElement('button'); b.type = 'button'; b.dataset.t = t[0]; var i = document.createElement('i'); i.style.background = t[2]; b.appendChild(i); b.appendChild(document.createTextNode(t[1]));
      b.onclick = function () { if (window.BHTheme) BHTheme.set(t[0]); try { if (typeof _theme !== 'undefined') { _theme = t[0]; } if (typeof _paintThemeButton === 'function') _paintThemeButton(); } catch (e) { /* ignore */ } mark(); pal.classList.remove('on'); }; pal.appendChild(b); });
    document.body.appendChild(pal);
  }
  function mark() { var c = window.BHTheme ? BHTheme.current() : ''; Array.prototype.forEach.call(pal.children, function (b) { b.classList.toggle('cur', b.dataset.t === c); }); }
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.theme-toggle');
    if (btn) { e.preventDefault(); e.stopImmediatePropagation(); if (!pal) build(); mark(); var r = btn.getBoundingClientRect(); pal.style.top = (r.bottom + 8) + 'px'; pal.style.right = Math.max(8, window.innerWidth - r.right) + 'px'; pal.classList.toggle('on'); return; }
    if (pal && !e.target.closest('#bh-pal')) pal.classList.remove('on');
  }, true);
})();
