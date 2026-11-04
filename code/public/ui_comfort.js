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
    '.sidebar-nav .nav-label{font-size:16px;font-weight:600;color:var(--text)}.sidebar-nav .nav-item{min-height:46px}.sidebar-nav .nav-icon{font-size:18px}' +
    '.sm-head{font-size:13px!important;opacity:.95!important;color:var(--gold)}' +
    '.main-content{font-size:16px}.main-content,.main-content td,.main-content th{color:var(--text)}.main-content .sub,.main-content small{color:var(--text2)}' +
    '#sb-grip{position:fixed;top:0;bottom:0;width:10px;cursor:col-resize;z-index:210;touch-action:none;background:transparent}' +
    '#sb-grip:hover,#sb-grip.drag{background:rgba(245,166,35,.35)}' +
    '@media(max-width:767px){#sb-grip{display:none}}';
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
