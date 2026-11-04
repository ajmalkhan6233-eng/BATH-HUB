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
